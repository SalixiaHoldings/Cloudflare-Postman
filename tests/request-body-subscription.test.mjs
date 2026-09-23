import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { fetchPinnedSchema } from '../src/upstream.mjs';
import { createBodyContract, assertNoBodySentinel } from '../src/request-body.mjs';

test('pinned account subscription body follows writable OpenAPI semantics, including deprecated fields', async () => {
  const { destination, lock } = await fetchPinnedSchema();
  assert.equal(lock.commit, '7287cb19ea4c5feb93f8dd0a4d8d12872692a802', 'Reevaluate subscription authority on a pin change.');
  const document = JSON.parse(await readFile(destination, 'utf8'));
  const declaration = document.paths['/accounts/{account_id}/subscriptions'].post;
  const schema = declaration.requestBody.content['application/json'].schema;
  const contract = createBodyContract(document);
  const writable = { app: { install_id: 'fictional-install' }, component_values: [{ value: 1 }],
    frequency: 'monthly', rate_plan: { id: 'fictional-plan' } };
  assert.deepEqual(contract.normalizeValue(schema, { ...writable, currency: 'fictional', id: 'fictional',
    price: 0, state: 'Paid', current_period_start: 'fictional', current_period_end: 'fictional',
    zone: { id: 'fictional', name: 'fictional.example' } }), writable);

  const manifest = JSON.parse(await readFile(new URL('../dist/v2.1/manifest.json', import.meta.url)));
  const walk = items => items.flatMap(item => item.item ? walk(item.item) : [item]);
  const found = [];
  for (const partition of manifest.partitions) {
    const collection = JSON.parse(await readFile(new URL(`../dist/v2.1/${partition.file}`, import.meta.url)));
    found.push(...walk(collection.item).filter(item => item.request.method === 'POST' &&
      item.request.url.path.join('/') === 'accounts/{{account_id}}/subscriptions'));
  }
  assert.equal(found.length, 1);
  const request = found[0].request;
  assertNoBodySentinel(request.body, 'account subscription creation');
  const value = JSON.parse(request.body.raw);
  assert.ok(contract.validateValue(schema, value));
  for (const name of ['currency', 'current_period_end', 'current_period_start', 'id', 'price', 'state', 'zone']) {
    assert.equal(Object.hasOwn(value, name), false, name);
  }
  assert.ok(value.frequency);
  // Do not impose a field allowlist: safely generated writable fields may remain.
});

test('pinned account service-token creation preserves its numeric secret version', async () => {
  const { destination, lock } = await fetchPinnedSchema();
  assert.equal(lock.commit, '7287cb19ea4c5feb93f8dd0a4d8d12872692a802');
  const document = JSON.parse(await readFile(destination, 'utf8'));
  const schema = document.paths['/accounts/{account_id}/access/service_tokens'].post.requestBody.content['application/json'].schema;
  assert.equal(schema.properties.client_secret_version.$ref, '#/components/schemas/access_client_secret_version');
  assert.equal(document.components.schemas.access_client_secret_version.type, 'number');
  assert.equal(document.components.schemas.access_client_secret_version.default, 1);
  const collection = JSON.parse(await readFile(new URL('../dist/v2.1/reference/zero-trust.postman_collection.json', import.meta.url)));
  const walk = items => items.flatMap(item => item.item ? walk(item.item) : [item]);
  const item = walk(collection.item).find(item => item.request.method === 'POST' &&
    item.request.url.path.join('/') === 'accounts/{{account_id}}/access/service_tokens');
  assert.ok(item);
  const value = JSON.parse(item.request.body.raw);
  assert.equal(value.client_secret_version, 1);
  assert.equal(createBodyContract(document).classifyValue(schema, value), 'valid');
});
