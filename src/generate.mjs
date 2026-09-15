import { mkdtemp, mkdir, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { POSTMAN_DIR, ROOT } from './constants.mjs';
import { createBootstrapCollection, createTemplateEnvironment } from './chaining.mjs';
import { sha256, stableJson, writeJson } from './io.mjs';
import { listOperations, subsetSchema } from './openapi.mjs';
import { classifyOperations, loadPartitionConfig } from './partition.mjs';
import { generateCollection } from './postman.mjs';
import { fetchPinnedSchema } from './upstream.mjs';
import { authenticationCounts } from './auth.mjs';

async function cleanGeneratedDirectories(outputRoot) {
  for (const directory of ['reference', 'workflows', 'environments']) {
    const destination = path.join(outputRoot, directory);
    await rm(destination, { recursive: true, force: true });
    await mkdir(destination, { recursive: true });
  }
  for (const file of ['manifest.json', 'operation-accounting.json']) {
    await rm(path.join(outputRoot, file), { force: true });
  }
}

export async function generateAll({ outputRoot = POSTMAN_DIR, schemaPath, schemaLock } = {}) {
  const pinned = schemaPath && schemaLock ? { destination: schemaPath, lock: schemaLock } : await fetchPinnedSchema();
  const schema = JSON.parse(await readFile(pinned.destination, 'utf8'));
  const operations = listOperations(schema);
  const config = await loadPartitionConfig();
  const { assignments, ownership, classification, overlapCount, overlapDeclarations } = classifyOperations(operations, config);
  await cleanGeneratedDirectories(outputRoot);

  const manifestPartitions = [];
  for (const partition of config.partitions) {
    const partitionOperations = assignments.get(partition.id);
    const partitionSchema = subsetSchema(schema, partition, partitionOperations);
    const { collection, represented, warnings } = await generateCollection(partitionSchema, {
      partition,
      operations: partitionOperations,
      commit: pinned.lock.commit,
      schemaSha256: pinned.lock.schema.sha256
    });
    const file = `reference/${partition.id}.postman_collection.json`;
    const serialized = stableJson(collection);
    await writeJson(path.join(outputRoot, file), collection);
    manifestPartitions.push({
      id: partition.id,
      title: partition.title,
      file,
      operationCount: represented.length,
      residual: partition.residual === true,
      converterWarningCount: warnings.length,
      authentication: authenticationCounts(partitionOperations),
      sha256: sha256(serialized)
    });
  }

  const workflow = createBootstrapCollection({
    commit: pinned.lock.commit,
    schemaSha256: pinned.lock.schema.sha256,
    operations
  });
  const environment = createTemplateEnvironment();
  const workflowFile = 'workflows/bootstrap.postman_collection.json';
  const environmentFile = 'environments/cloudflare.template.postman_environment.json';
  const workflowSerialized = stableJson(workflow);
  const environmentSerialized = stableJson(environment);
  await writeJson(path.join(outputRoot, workflowFile), workflow);
  await writeJson(path.join(outputRoot, environmentFile), environment);

  const accounting = operations.map((operation) => ({
    key: operation.key,
    operationId: operation.operationId,
    partition: ownership.get(operation.key),
    deprecated: operation.deprecated,
    fingerprint: operation.fingerprint,
    authSupport: operation.authSupport,
    classification: classification.get(operation.key)
  }));
  const accountingSerialized = stableJson(accounting);
  await writeJson(path.join(outputRoot, 'operation-accounting.json'), accounting);
  await writeJson(path.join(outputRoot, 'manifest.json'), {
    generated: true,
    generator: '@salixiaholdings/cloudflare-postman',
    collectionFormat: 'Postman Collection v2.1',
    authentication: { policyVersion: 1, categories: authenticationCounts(operations) },
    classification: { policy: config.classification, overlapCount, overlapDeclarations },
    upstream: {
      repository: pinned.lock.repository,
      commit: pinned.lock.commit,
      schemaSha256: pinned.lock.schema.sha256
    },
    accounting: {
      upstreamOperations: operations.length,
      representedOperations: accounting.length,
      unclassifiedOperations: 0,
      duplicateOperations: 0,
      sha256: sha256(accountingSerialized)
    },
    partitions: manifestPartitions,
    workflow: {
      file: workflowFile,
      requestCount: 3,
      sha256: sha256(workflowSerialized)
    },
    environment: {
      file: environmentFile,
      sha256: sha256(environmentSerialized)
    }
  });

  return {
    operations: operations.length,
    authentication: authenticationCounts(operations),
    overlapCount,
    overlapDeclarations,
    partitions: manifestPartitions,
    residual: manifestPartitions.find((partition) => partition.residual)?.operationCount ?? 0,
    converterWarnings: manifestPartitions.reduce(
      (total, partition) => total + partition.converterWarningCount,
      0
    )
  };
}

async function listFiles(directory, base = directory) {
  const { readdir } = await import('node:fs/promises');
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await listFiles(absolute, base)));
    else files.push(path.relative(base, absolute));
  }
  return files;
}

async function compareGenerated(actualRoot, expectedRoot) {
  const [actualFiles, expectedFiles] = await Promise.all([
    listFiles(actualRoot),
    listFiles(expectedRoot)
  ]);
  const allFiles = [...new Set([...actualFiles, ...expectedFiles])].sort();
  const differences = [];
  for (const file of allFiles) {
    if (!actualFiles.includes(file)) {
      differences.push(`missing generated file: ${file}`);
      continue;
    }
    if (!expectedFiles.includes(file)) {
      differences.push(`unexpected generated file: ${file}`);
      continue;
    }
    const [actual, expected] = await Promise.all([
      readFile(path.join(actualRoot, file)),
      readFile(path.join(expectedRoot, file))
    ]);
    if (!actual.equals(expected)) differences.push(`content differs: ${file}`);
  }
  return differences;
}

export async function verifyGenerated() {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), 'cloudflare-postman-generate-'));
  const generatedRoot = path.join(temporaryRoot, 'postman');
  try {
    const result = await generateAll({ outputRoot: generatedRoot });
    const differences = await compareGenerated(POSTMAN_DIR, generatedRoot);
    if (differences.length) {
      throw new Error(`Generated artifacts are stale or non-deterministic:\n${differences.join('\n')}`);
    }
    return result;
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
}

export function formatGenerationSummary(result) {
  const lines = result.partitions.map(
    (partition) =>
      `  ${partition.id}: ${partition.operationCount}${partition.residual ? ' (residual)' : ''}` +
      `${partition.converterWarningCount ? `; ${partition.converterWarningCount} converter warning(s)` : ''}`
  );
  return [
    `Generated ${result.operations} operations exactly once:`,
    ...lines,
    `Recoverable converter warnings: ${result.converterWarnings}`,
    `Intentional partition overlaps: ${result.overlapCount} operations in ${result.overlapDeclarations} declarations`,
    `Authentication categories: ${JSON.stringify(result.authentication)}`
  ].join('\n');
}

export const repositoryRoot = ROOT;
