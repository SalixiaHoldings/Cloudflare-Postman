import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { ROOT } from '../src/constants.mjs';
import { stableJson } from '../src/io.mjs';
import { listOperations } from '../src/openapi.mjs';
import { classifyOperations, loadPartitionConfig } from '../src/partition.mjs';

async function miniSchema() {
  return JSON.parse(await readFile(path.join(ROOT, 'tests', 'fixtures', 'mini-openapi.json'), 'utf8'));
}

test('partitioning assigns each fixture operation exactly once', async () => {
  const operations = listOperations(await miniSchema());
  const config = await loadPartitionConfig();
  const fixtureKeys = new Set(operations.map((operation) => operation.key));
  config.overlaps = config.overlaps.map((entry) => ({ ...entry, operations: entry.operations.filter((key) => fixtureKeys.has(key)) })).filter((entry) => entry.operations.length);
  const { assignments, ownership } = classifyOperations(operations, config);
  assert.equal(ownership.size, operations.length);
  assert.equal(ownership.get('GET /accounts'), 'accounts-identity-billing');
  assert.equal(ownership.get('GET /accounts/{account_id}/access/apps'), 'zero-trust');
  assert.equal(ownership.get('GET /zones/{zone_id}/dns_records'), 'zones-dns-domains');
  assert.equal(ownership.get('GET /widgets'), 'other-cloudflare-services');
  assert.equal(
    [...assignments.values()].reduce((total, partition) => total + partition.length, 0),
    operations.length
  );
});

test('duplicate operation keys are a hard accounting failure', async () => {
  const operations = listOperations(await miniSchema());
  const config = await loadPartitionConfig();
  assert.throws(() => classifyOperations([operations[0], operations[0]], config), /Duplicate operation key/u);
});

test('all matching partitions require exact explicit ownership, independent of rule order', () => {
  const operation = { key: 'GET /both', path: '/both', tags: [] };
  const config = { partitions: [{ id: 'a', match: ['both'] }, { id: 'b', match: ['both'] }, { id: 'residual', residual: true }] };
  assert.throws(() => classifyOperations([operation], config), /Undeclared partition overlap/u);
  config.overlaps = [{ id: 'a+b', matches: ['a', 'b'], owner: 'b', reason: 'Fixture intended owner.', operations: ['GET /both'] }];
  const result = classifyOperations([operation], config);
  assert.equal(result.ownership.get(operation.key), 'b');
  assert.equal(result.overlapCount, 1);
  assert.deepEqual(result.classification.get(operation.key).matches, ['a', 'b']);
  config.partitions = [config.partitions[1], config.partitions[0], config.partitions[2]];
  assert.equal(classifyOperations([operation], config).ownership.get(operation.key), 'b');
  assert.throws(() => classifyOperations([operation, { ...operation, key: 'POST /both' }], config), /Undeclared partition overlap/u);
  assert.throws(() => classifyOperations([], config), /unused overlap/u);
  config.partitions[0].match = ['never'];
  assert.throws(() => classifyOperations([operation], config), /unused overlap/u);
  config.partitions.splice(0, 0, { id: 'c', match: ['both'] });
  assert.throws(() => classifyOperations([operation], config), /Stale overlap matches/u);
});

test('stable JSON output is byte-identical for differently ordered keys', () => {
  assert.equal(stableJson({ z: 1, a: { y: 2, b: 3 } }), stableJson({ a: { b: 3, y: 2 }, z: 1 }));
});
