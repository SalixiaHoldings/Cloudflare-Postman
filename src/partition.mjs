import path from 'node:path';
import { ROOT } from './constants.mjs';
import { readJson } from './io.mjs';

export async function loadPartitionConfig() {
  const config = await readJson(path.join(ROOT, 'config', 'partitions.json'));
  const overlapConfig = await readJson(path.join(ROOT, 'config', 'partition-overlaps.json'));
  return { ...config, overlaps: overlapConfig.overlaps };
}

export function classifyOperations(operations, config) {
  const residual = config.partitions.filter((partition) => partition.residual);
  if (residual.length !== 1 || config.partitions.at(-1)?.id !== residual[0].id) {
    throw new Error('Partition config must contain exactly one final residual partition.');
  }
  const ids = new Set(config.partitions.map((partition) => partition.id));
  if (ids.size !== config.partitions.length) throw new Error('Duplicate partition IDs.');
  const declarations = new Map();
  const declarationIds = new Set();
  for (const declaration of config.overlaps ?? []) {
    const matches = [...new Set(declaration.matches)].sort();
    if (matches.length < 2 || matches.length !== declaration.matches.length ||
        !matches.includes(declaration.owner) || matches.some((id) => !ids.has(id) || id === residual[0].id) ||
        !declaration.reason?.trim() || declaration.id !== matches.join('+') || declarationIds.has(declaration.id) ||
        !declaration.operations?.length) throw new Error(`Invalid overlap declaration: ${declaration.id}`);
    declarationIds.add(declaration.id);
    for (const key of declaration.operations) {
      if (declarations.has(key)) throw new Error(`Duplicate overlap declaration: ${key}`);
      declarations.set(key, { ...declaration, matches });
    }
  }
  const compiled = config.partitions.map((partition) => ({
    ...partition,
    expressions: (partition.match ?? []).map((pattern) => new RegExp(pattern, 'imu'))
  }));
  const assignments = new Map(compiled.map((partition) => [partition.id, []]));
  const ownership = new Map();
  const classification = new Map();
  const used = new Set();

  for (const operation of operations) {
    const haystack = [operation.path, operation.operationId, ...operation.tags].filter(Boolean).join('\n');
    if (ownership.has(operation.key)) {
      throw new Error(`Duplicate operation key: ${operation.key}`);
    }
    const matches = compiled.filter((partition) => !partition.residual &&
      partition.expressions.some((expression) => expression.test(haystack))).map((partition) => partition.id).sort();
    let owner = matches[0] ?? residual[0].id;
    let overlapId = null;
    if (matches.length > 1) {
      const declaration = declarations.get(operation.key);
      if (!declaration) throw new Error(`Undeclared partition overlap: ${operation.key} (${matches.join(', ')})`);
      if (matches.join('+') !== declaration.matches.join('+')) throw new Error(`Stale overlap matches: ${operation.key}`);
      owner = declaration.owner;
      overlapId = declaration.id;
      used.add(operation.key);
    }
    ownership.set(operation.key, owner);
    assignments.get(owner).push(operation);
    classification.set(operation.key, { matches, overlapId });
  }

  const unused = [...declarations.keys()].filter((key) => !used.has(key));
  if (unused.length) throw new Error(`Stale or unused overlap declarations: ${unused.join(', ')}`);

  if (ownership.size !== operations.length) {
    throw new Error(`Operation accounting mismatch: ${ownership.size} assigned, ${operations.length} upstream.`);
  }
  return { assignments, ownership, classification, overlapCount: used.size, overlapDeclarations: declarationIds.size };
}
