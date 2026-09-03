import { readFile } from 'node:fs/promises';
import path from 'node:path';
import SwaggerParser from '@apidevtools/swagger-parser';
import AjvDraft04 from 'ajv-draft-04';
import addFormats from 'ajv-formats';
import { POSTMAN_DIR } from './constants.mjs';
import { readJson, sha256, stableJson } from './io.mjs';
import { listOperations } from './openapi.mjs';
import { fetchPinnedSchema, fetchPostmanCollectionSchema } from './upstream.mjs';
import { assertAuthenticationMetadata, assertRequestAuthentication, authenticationCounts, AUTH_VARIABLES } from './auth.mjs';
import { classifyOperations, loadPartitionConfig } from './partition.mjs';
import { createBootstrapCollection } from './chaining.mjs';
import { assertEmptyPublicVariables, assertNoLocalPaths, localPaths } from './public-safety.mjs';

function collectRequests(items, requests = []) {
  for (const item of items ?? []) {
    if (Array.isArray(item.item)) collectRequests(item.item, requests);
    else if (item.request) requests.push(item);
  }
  return requests;
}

function normalizedRequestKey(request) {
  const method = String(request.method ?? '').toUpperCase();
  let apiPath;
  if (Array.isArray(request.url?.path)) {
    apiPath = `/${request.url.path
      .map((segment) => String(segment).replace(/^\{\{(.+)\}\}$/u, '{$1}'))
      .join('/')}`;
  } else {
    const raw = typeof request.url === 'string' ? request.url : request.url?.raw ?? '';
    apiPath = raw
      .split('?')[0]
      .replace(/^\{\{base_url\}\}/u, '')
      .replace(/\{\{([^}]+)\}\}/gu, '{$1}');
  }
  return `${method} ${apiPath}`;
}

function assertCollectionContract(collection, file) {
  assertEmptyPublicVariables(collection.variable ?? [], file);
  if (collection.auth?.type !== 'bearer') {
    throw new Error(`${file} does not inherit Bearer authentication.`);
  }
  const token = collection.auth.bearer?.find((entry) => entry.key === 'token')?.value;
  if (token !== '{{api_token}}') {
    throw new Error(`${file} does not reference the api_token variable.`);
  }
  const variables = new Map((collection.variable ?? []).map((entry) => [entry.key, entry.value]));
  for (const required of ['base_url', 'api_token', 'account_id', 'zone_id']) {
    if (!variables.has(required)) throw new Error(`${file} is missing collection variable ${required}.`);
  }
  if ([...AUTH_VARIABLES, 'account_id', 'zone_id'].some((key) => variables.get(key) !== '')) {
    throw new Error(`${file} contains a non-empty credential or resource identifier template.`);
  }
}

function diagnosticKey(diagnostic) {
  return [
    diagnostic.instancePath,
    diagnostic.keyword,
    diagnostic.params?.additionalProperty ?? ''
  ].join('|');
}

async function validateOpenApiWithExceptions(schemaPath, commit) {
  const exceptionConfig = await readJson(
    path.join(path.dirname(POSTMAN_DIR), 'config', 'upstream-validation-exceptions.json')
  );
  if (exceptionConfig.upstreamCommit !== commit) {
    throw new Error('Upstream validation exceptions must be reviewed for the pinned schema commit.');
  }
  const expected = new Set(
    exceptionConfig.exceptions.map((exception) =>
      [exception.instancePath, exception.keyword, exception.additionalProperty ?? ''].join('|')
    )
  );
  try {
    await SwaggerParser.validate(schemaPath);
  } catch (error) {
    if (!Array.isArray(error.details)) throw error;
    const actual = new Set(error.details.map(diagnosticKey));
    const unexpected = [...actual].filter((diagnostic) => !expected.has(diagnostic));
    const stale = [...expected].filter((diagnostic) => !actual.has(diagnostic));
    if (unexpected.length || stale.length) {
      throw new Error(
        `Upstream OpenAPI validation deviations changed. Unexpected: ${unexpected.join(', ') || 'none'}. ` +
          `No longer present: ${stale.join(', ') || 'none'}.`,
        { cause: error }
      );
    }
    return actual.size;
  }
  if (expected.size) {
    throw new Error('Pinned upstream validation exceptions are stale because strict validation now succeeds.');
  }
  return 0;
}

export async function validateAll() {
  const [{ destination: schemaPath, lock }, postmanSchemaPath] = await Promise.all([
    fetchPinnedSchema(),
    fetchPostmanCollectionSchema()
  ]);
  const openapiExceptions = await validateOpenApiWithExceptions(schemaPath, lock.commit);
  const schema = await readJson(schemaPath);
  const upstreamOperations = listOperations(schema);
  const upstreamByKey = new Map(upstreamOperations.map((operation) => [operation.key, operation]));
  const config = await loadPartitionConfig();
  const { ownership, classification, overlapCount, overlapDeclarations, assignments } = classifyOperations(upstreamOperations, config);
  const manifest = await readJson(path.join(POSTMAN_DIR, 'manifest.json'));
  const accounting = await readJson(path.join(POSTMAN_DIR, 'operation-accounting.json'));
  const postmanSchema = await readJson(postmanSchemaPath);
  const ajv = new AjvDraft04({ allErrors: true, strict: false });
  addFormats(ajv);
  const validateCollection = ajv.compile(postmanSchema);
  const represented = new Map();
  assertAuthenticationMetadata(manifest.authentication, { policyVersion: 1, categories: authenticationCounts(upstreamOperations) }, 'manifest');
  assertAuthenticationMetadata(manifest.classification, { policy: config.classification, overlapCount, overlapDeclarations }, 'partition classification');

  for (const partition of manifest.partitions) {
    const file = path.join(POSTMAN_DIR, partition.file);
    const collection = await readJson(file);
    if (!validateCollection(collection)) {
      throw new Error(`${partition.file} is not valid Collection v2.1: ${ajv.errorsText(validateCollection.errors)}`);
    }
    assertCollectionContract(collection, partition.file);
    const serialized = stableJson(collection);
    if (sha256(serialized) !== partition.sha256) {
      throw new Error(`${partition.file} does not match its manifest SHA-256.`);
    }
    const requests = collectRequests(collection.item);
    if (requests.length !== partition.operationCount) {
      throw new Error(
        `${partition.file} has ${requests.length} requests; manifest declares ${partition.operationCount}.`
      );
    }
    assertAuthenticationMetadata(partition.authentication, authenticationCounts(assignments.get(partition.id)), partition.id);
    for (const item of requests) {
      const key = normalizedRequestKey(item.request);
      const upstream = upstreamByKey.get(key);
      if (!upstream) throw new Error(`Unexpected request: ${key}`);
      assertRequestAuthentication(item, upstream.authSupport, key);
      const owners = represented.get(key) ?? [];
      owners.push(partition.id);
      represented.set(key, owners);
    }
  }

  const upstreamKeys = new Set(upstreamOperations.map((operation) => operation.key));
  const unclassified = [...upstreamKeys].filter((key) => !represented.has(key));
  const duplicates = [...represented].filter(([, owners]) => owners.length !== 1);
  const unexpected = [...represented.keys()].filter((key) => !upstreamKeys.has(key));
  if (unclassified.length || duplicates.length || unexpected.length) {
    throw new Error(
      `Exact-once accounting failed: ${unclassified.length} missing, ${duplicates.length} duplicate, ${unexpected.length} unexpected.`
    );
  }
  if (accounting.length !== upstreamOperations.length || manifest.accounting.upstreamOperations !== upstreamOperations.length) {
    throw new Error('Operation accounting files do not match the pinned upstream operation count.');
  }
  if (sha256(stableJson(accounting)) !== manifest.accounting.sha256) {
    throw new Error('operation-accounting.json does not match its manifest SHA-256.');
  }
  const accounted = new Set();
  for (const row of accounting) {
    const upstream = upstreamByKey.get(row.key);
    if (!upstream || accounted.has(row.key)) throw new Error(`Unexpected or duplicate accounting row: ${row.key}`);
    accounted.add(row.key);
    if (represented.get(row.key)?.[0] !== row.partition || ownership.get(row.key) !== row.partition) {
      throw new Error(`Accounting owner mismatch for ${row.key}.`);
    }
    assertAuthenticationMetadata(row.authSupport, upstream.authSupport, row.key);
    assertAuthenticationMetadata(row.classification, classification.get(row.key), row.key);
  }

  const workflowPath = path.join(POSTMAN_DIR, manifest.workflow.file);
  const workflow = await readJson(workflowPath);
  if (!validateCollection(workflow)) {
    throw new Error(`Bootstrap workflow is not valid Collection v2.1: ${ajv.errorsText(validateCollection.errors)}`);
  }
  assertCollectionContract(workflow, manifest.workflow.file);
  if (stableJson(workflow) !== stableJson(createBootstrapCollection({ commit: lock.commit, schemaSha256: lock.schema.sha256, operations: upstreamOperations }))) {
    throw new Error('Bootstrap workflow does not reflect current pagination/authentication policy.');
  }
  if (sha256(stableJson(workflow)) !== manifest.workflow.sha256) {
    throw new Error('Bootstrap workflow does not match its manifest SHA-256.');
  }

  const environment = await readJson(path.join(POSTMAN_DIR, manifest.environment.file));
  assertEmptyPublicVariables(environment.values, manifest.environment.file);
  const environmentValues = new Map(environment.values.map((entry) => [entry.key, entry]));
  for (const required of ['base_url', 'api_token', 'account_id', 'zone_id']) {
    if (!environmentValues.has(required)) throw new Error(`Template environment is missing ${required}.`);
  }
  if (AUTH_VARIABLES.some((key) => environmentValues.get(key)?.value !== '' || environmentValues.get(key)?.type !== 'secret')) {
    throw new Error('Template environment must contain empty secret authentication variables.');
  }
  if (sha256(stableJson(environment)) !== manifest.environment.sha256) {
    throw new Error('Template environment does not match its manifest SHA-256.');
  }

  const generatedText = await Promise.all(
    [
      ...manifest.partitions.map((partition) => partition.file),
      manifest.workflow.file,
      manifest.environment.file
    ].map((file) => readFile(path.join(POSTMAN_DIR, file), 'utf8'))
  );
  // Public upstream examples may themselves contain illustrative local paths.
  // Permit only exact paths independently present in the verified upstream bytes.
  const upstreamPaths = new Set(localPaths(await readFile(schemaPath, 'utf8')));
  for (const text of generatedText) assertNoLocalPaths(text, 'Generated output', upstreamPaths);

  return {
    commit: lock.commit,
    schemaSha256: lock.schema.sha256,
    operations: upstreamOperations.length,
    partitions: manifest.partitions,
    residual: manifest.partitions.find((partition) => partition.residual)?.operationCount ?? 0,
    openapiExceptions,
    authentication: authenticationCounts(upstreamOperations),
    overlapCount,
    overlapDeclarations
  };
}
