import { createQueryConverter } from './query-process.mjs';
import assert from 'node:assert/strict';
import { IDENTIFIER_VARIABLES, warningRecord, assertQueryContract, assertOmissions } from './query-policy.mjs';
import { createHash } from 'node:crypto';
import { deterministicUuid } from './identity.mjs';
import { createRequire } from 'node:module';
import { format } from 'node:util';
import { DEFAULT_BASE_URL } from './constants.mjs';
import { applyAuthentication, AUTH_VARIABLES } from './auth.mjs';
import { createBodyContract, summarizeBodyResults } from './request-body.mjs';

const require = createRequire(import.meta.url);
const converter = require('openapi-to-postmanv2');
const schemaFaker = require('openapi-to-postmanv2/assets/json-schema-faker.js');

export function convert(schema, overrides = {}) {
  return new Promise((resolve, reject) => {
    const warnings = [];
    const originalWarn = console.warn;
    const originalError = console.error;
    const originalRandom = Math.random;
    const OriginalDate = Date;
    const originalSchemaRandom = schemaFaker.option('random');
    const seed = Number.parseInt(
      createHash('sha256').update(schema.info?.title ?? 'cloudflare-postman').digest('hex').slice(0, 8),
      16
    );
    let randomState = seed >>> 0;
    const seededRandom = () => {
      randomState += 0x6d2b79f5;
      let value = randomState;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
    Math.random = seededRandom;
    schemaFaker.option({ random: seededRandom });
    const fixedNow = OriginalDate.parse('2000-01-01T00:00:00.000Z');
    globalThis.Date = class extends OriginalDate {
      constructor(...arguments_) {
        super(...(arguments_.length ? arguments_ : [fixedNow]));
      }

      static now() {
        return fixedNow;
      }
    };
    console.warn = (...arguments_) => warnings.push(format(...arguments_));
    console.error = (...arguments_) => warnings.push(format(...arguments_));
    const restoreConsole = () => {
      console.warn = originalWarn;
      console.error = originalError;
      Math.random = originalRandom;
      globalThis.Date = OriginalDate;
      schemaFaker.option({ random: originalSchemaRandom });
    };
    try {
      converter.convert(
        { type: 'json', data: schema },
        {
          folderStrategy: 'Paths',
          includeAuthInfoInExample: false,
          includeDeprecated: true,
          keepImplicitHeaders: false,
          optimizeConversion: true,
          requestNameSource: 'Fallback',
          requestParametersResolution: 'Example',
          exampleParametersResolution: 'Example',
          schemaFaker: false,
          ...overrides
        },
        (error, result) => {
          restoreConsole();
          if (error) return reject(error);
          if (!result?.result || result.output?.length !== 1) {
            return reject(new Error(`Postman conversion failed: ${result?.reason ?? 'unknown error'}`));
          }
          resolve({ collection: result.output[0].data, warnings });
        }
      );
    } catch (error) {
      restoreConsole();
      reject(error);
    }
  });
}

function requestPath(request) {
  const pathSegments = request.url?.path;
  if (Array.isArray(pathSegments)) {
    return `/${pathSegments
      .map((segment) =>
        String(segment)
          .replace(/^:([^/]+)$/u, '{$1}')
          .replace(/\{\{([^}]+)\}\}/gu, '{$1}')
      )
      .join('/')}`;
  }
  const raw = typeof request.url === 'string' ? request.url : request.url?.raw ?? '';
  const withoutQuery = raw.split('?')[0];
  return withoutQuery
    .replace(DEFAULT_BASE_URL, '')
    .replace(/^\{\{baseUrl\}\}/u, '')
    .replace(/^\{\{base_url\}\}/u, '')
    .replace(/:([^/]+)/gu, '{$1}');
}

export function makeRawUrl(apiPath, query) {
  const pathWithVariables = apiPath.replace(/\{([^}]+)\}/gu, '{{$1}}');
  const queryString = (query ?? [])
    .filter((entry) => entry && entry.disabled !== true)
    .map((entry) => `${entry.key}=${entry.value ?? ''}`)
    .join('&');
  return `{{base_url}}${pathWithVariables}${queryString ? `?${queryString}` : ''}`;
}

function coreIdentifierVariable(key) {
  const normalized = String(key).toLowerCase();
  if (normalized === 'account_id' || normalized === 'account.id') return '{{account_id}}';
  if (normalized === 'zone_id' || normalized === 'zone.id') return '{{zone_id}}';
  if (/(?:^|_)(?:api_?key|api_?token|access_?token|refresh_?token|secret|password|token_uuid)(?:_|$)/iu.test(normalized)) {
    return `{{${normalized.replace(/[^a-z0-9_]/gu, '_')}}}`;
  }
  return undefined;
}

function replaceCoreIdentifiers(value, preserveTypes = false) {
  if (Array.isArray(value)) return value.map(child => replaceCoreIdentifiers(child, preserveTypes));
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => [
      key,
      (typeof child === 'string' && /^\{\{[^{}]+\}\}$/u.test(child) ? child :
        !preserveTypes || typeof child === 'string' ? coreIdentifierVariable(key) : undefined) ??
        replaceCoreIdentifiers(child, preserveTypes)
    ])
  );
}

function sanitizeJsonString(value, preserveTypes = false) {
  try {
    return JSON.stringify(replaceCoreIdentifiers(JSON.parse(value), preserveTypes), null, 2);
  } catch {
    return value;
  }
}

function sanitizeRequestIdentifiers(request, preserveBody = false) {
  for (const query of request.url?.query ?? []) {
    query.value = IDENTIFIER_VARIABLES[query.key] ?? query.value;
  }
  if (!preserveBody && typeof request.body?.raw === 'string') {
    request.body.raw = sanitizeJsonString(request.body.raw, true);
  }
}

function normalizeUuidIds(value, seed, breadcrumb = []) {
  if (Array.isArray(value)) {
    value.forEach((child, index) => normalizeUuidIds(child, seed, [...breadcrumb, String(index)]));
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    const nextBreadcrumb = [...breadcrumb, key];
    if (
      key === 'id' &&
      typeof child === 'string' &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(child)
    ) {
      value[key] = deterministicUuid(`${seed}:${nextBreadcrumb.join('.')}`);
    } else {
      normalizeUuidIds(child, seed, nextBreadcrumb);
    }
  }
}

function normalizeCollection(collection, { partition, operations, commit, schemaSha256 }, secondary, bodies) {
  const expected = new Map(operations.map((operation) => [operation.key, operation]));
  const represented = new Set();
  const bodyResults = [];

  function visit(items, ancestry = []) {
    for (const item of items ?? []) {
      if (Array.isArray(item.item)) {
        item.id = deterministicUuid(`${partition.id}:folder:${[...ancestry, item.name].join('/')}`);
        visit(item.item, [...ancestry, item.name]);
        continue;
      }
      if (!item.request) continue;
      const method = String(item.request.method ?? '').toUpperCase();
      const apiPath = requestPath(item.request);
      const key = `${method} ${apiPath}`;
      const operation = expected.get(key);
      if (!operation) {
        throw new Error(`Converter emitted an unrecognized request in ${partition.id}: ${key}`);
      }
      if (represented.has(key)) {
        throw new Error(`Converter emitted a duplicate request in ${partition.id}: ${key}`);
      }
      represented.add(key);
      item.id = deterministicUuid(`${partition.id}:${key}`);
      item.name = operation.operation.summary || operation.operationId || key;
      const originalDescription = operation.operation.description || operation.operation.summary || '';
      item.request.description =
        `GENERATED FILE — DO NOT EDIT.\n\nUpstream operation: ${operation.operationId}\n${key}` +
        (originalDescription ? `\n\n${originalDescription}` : '');
      applyAuthentication(item, operation.authSupport);
      const projected = secondary.get(key);
      assert.ok(projected, `Missing secondary query: ${key}`);
      projectQueryRows(item.request, projected);
      const bodyResult = bodies.normalize(item.request, operation);
      sanitizeRequestIdentifiers(item.request, ['source-incomplete', 'source-conflict'].includes(bodyResult.classification));
      bodyResults.push(bodies.validate(item.request, operation));
      if (typeof item.request.url === 'string') {
        item.request.url = { raw: makeRawUrl(apiPath), host: ['{{base_url}}'], path: [] };
      } else {
        item.request.url.raw = makeRawUrl(apiPath, item.request.url.query);
        item.request.url.host = ['{{base_url}}'];
        item.request.url.path = apiPath
          .split('/')
          .filter(Boolean)
          .map((segment) => segment.replace(/^\{([^}]+)\}$/u, '{{$1}}'));
        delete item.request.url.protocol;
        delete item.request.url.variable;
      }
      for (const response of item.response ?? []) {
        if (typeof response.body === 'string') response.body = sanitizeJsonString(response.body);
        response.originalRequest = structuredClone(item.request);
        delete response.originalRequest.description;
      }
    }
  }

  visit(collection.item);
  const missing = [...expected.keys()].filter((key) => !represented.has(key));
  if (missing.length) {
    throw new Error(
      `Converter omitted ${missing.length} operation(s) in ${partition.id}: ${missing.slice(0, 10).join(', ')}`
    );
  }
  collection.info._postman_id = deterministicUuid(`collection:${partition.id}:${commit}`);
  collection.info.name = `Cloudflare API — ${partition.title}`;
  collection.info.schema = 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json';
  collection.info.description =
    `GENERATED FILE — DO NOT EDIT.\n\n${partition.description}\n\n` +
    `Upstream: cloudflare/api-schemas@${commit}\nSchema SHA-256: ${schemaSha256}\n` +
    `Operations: ${operations.length}\nFormat: Postman Collection v2.1`;
  collection.auth = {
    type: 'bearer',
    bearer: [{ key: 'token', value: '{{api_token}}', type: 'string' }]
  };
  collection.variable = [
    { key: 'base_url', value: DEFAULT_BASE_URL, type: 'string' },
    ...AUTH_VARIABLES.map((key) => ({ key, value: '', type: 'string' })),
    { key: 'account_id', value: '', type: 'string' },
    { key: 'zone_id', value: '', type: 'string' }
  ];
  normalizeUuidIds(collection, `${partition.id}:${commit}`);
  return { collection, represented: [...represented], requestBodies: summarizeBodyResults(bodyResults) };
}

export function projectQueryRows(primary, secondary) {
  assert.ok(primary.url && typeof primary.url === 'object' && secondary.url && typeof secondary.url === 'object', 'Expected structured query projection URLs.');
  if (Object.hasOwn(secondary.url, 'query')) primary.url.query = structuredClone(secondary.url.query);
  else delete primary.url.query;
}

export function indexOperations(collection, operations) {
  const expected = new Set(operations.map(o => o.key));
  assert.equal(expected.size, operations.length, 'Duplicate expected operation identity.');
  const indexed = new Map();
  function visit(items) {
    for (const item of items ?? []) {
      if (item.item) { visit(item.item); continue; }
      if (!item.request) continue;
      const key = `${String(item.request.method).toUpperCase()} ${requestPath(item.request)}`;
      assert.ok(expected.has(key) && !indexed.has(key), `Unexpected/duplicate conversion operation: ${key}`);
      assert.ok(item.request.url && typeof item.request.url === 'object', 'Expected structured converter URL.');
      indexed.set(key, item.request);
    }
  }
  visit(collection.item);
  assert.equal(indexed.size, expected.size, 'Missing conversion operation.');
  return indexed;
}

export async function generateCollection(schema, context) {
  // Independent full inputs: converter mutation must not leak between passes.
  const secondaryInput = structuredClone(schema);
  const contractOperations = context.operations.map(o => ({ ...o, operation: structuredClone(o.operation) }));
  const converted = await convert(schema);
  indexOperations(converted.collection, context.operations);
  let secondary = context.secondaryResult;
  if (!secondary) {
    const worker = createQueryConverter();
    try { secondary = await worker.convert(secondaryInput, context.operations); }
    finally { await worker.close(); }
  }
  const expected = new Set(context.operations.map(o => o.key));
  const indexed = new Map();
  for (const row of secondary.queries) {
    assert.ok(expected.has(row.key) && !indexed.has(row.key), 'Unexpected/duplicate secondary identity.');
    indexed.set(row.key, { url: row.query === undefined ? {} : { query: row.query } });
  }
  assert.equal(indexed.size, expected.size, 'Missing secondary identity.');
  const diagnostics = warningRecord(secondary.warnings);
  if (context.queryPolicy) assert.deepEqual(diagnostics, context.queryPolicy.partitions[context.partition.id],
    'Secondary warning fingerprint changed; explicit review required.');
  const omissions = [];
  let enabled = 0, disabled = 0;
  for (const operation of contractOperations) {
    const result = assertQueryContract(indexed.get(operation.key), secondaryInput, operation);
    omissions.push(...result.omissions); enabled += result.enabled; disabled += result.disabled;
  }
  const keys = new Set(context.operations.map(o => o.key));
  assertOmissions(omissions, (context.queryPolicy?.omissions ?? []).filter(o => keys.has(o.operation)));
  const normalized = normalizeCollection(converted.collection, { ...context, operations: contractOperations }, indexed,
    createBodyContract(secondaryInput, { commit: context.commit, schemaSha256: context.schemaSha256 }));
  return { ...normalized, warnings: converted.warnings,
    queryProjection: { enabled, disabled, omissions, secondaryWarnings: diagnostics } };
}
