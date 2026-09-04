import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { ROOT } from '../src/constants.mjs';
import { listOperations, subsetSchema } from '../src/openapi.mjs';
import { generateCollection } from '../src/postman.mjs';

test('converter output retains every fixture method/path and standardizes authentication', async () => {
  const schema = JSON.parse(
    await readFile(path.join(ROOT, 'tests', 'fixtures', 'mini-openapi.json'), 'utf8')
  );
  const operations = listOperations(schema);
  const partition = { id: 'fixture', title: 'Fixture', description: 'Fixture conversion.' };
  const subset = subsetSchema(schema, partition, operations);
  const { collection, represented } = await generateCollection(subset, {
    partition,
    operations,
    commit: 'a'.repeat(40),
    schemaSha256: 'b'.repeat(64)
  });
  assert.equal(represented.length, operations.length);
  assert.equal(collection.auth.type, 'bearer');
  assert.equal(collection.auth.bearer[0].value, '{{api_token}}');
  assert.equal(collection.info.schema, 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json');
  assert.doesNotMatch(JSON.stringify(collection), /fixture-build-token/u);
  assert.match(JSON.stringify(collection), /\{\{build_token_uuid\}\}/u);
});
