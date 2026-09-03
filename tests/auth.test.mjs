import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { authenticationSupport, assertAuthenticationMetadata, assertRequestAuthentication } from '../src/auth.mjs';
import { listOperations, subsetSchema } from '../src/openapi.mjs';
import { generateCollection } from '../src/postman.mjs';

async function fixture() {
  return JSON.parse(await readFile(new URL('./fixtures/auth-openapi.json', import.meta.url), 'utf8'));
}

test('converter preserves token-only, token alternative, legacy, AND, anonymous, and unresolved contracts', async () => {
  const schema = await fixture();
  const operations = listOperations(schema);
  const partition = { id: 'auth-fixture', title: 'Auth Fixture', description: 'Authentication regression coverage.' };
  const view = subsetSchema(schema, partition, operations);
  assert.deepEqual(view.security, schema.security);
  const { collection, represented } = await generateCollection(view, { partition, operations, commit: 'a'.repeat(40), schemaSha256: 'b'.repeat(64) });
  assert.equal(represented.length, operations.length);
  const items = [];
  function visit(entries) { for (const item of entries) { if (item.item) visit(item.item); else items.push(item); } }
  visit(collection.item);
  for (const item of items) {
    const operation = operations.find((entry) => entry.path === `/${item.request.url.path.join('/')}`);
    assertRequestAuthentication(item, operation.authSupport, operation.key);
  }
  const get = (path) => items.find((item) => `/${item.request.url.path.join('/')}` === path);
  assert.equal(get('/user/tokens/verify').request.auth.type, 'bearer');
  assert.equal(get('/zones').request.auth.type, 'bearer');
  assert.deepEqual(get('/zones').request.header, []);
  assert.equal(get('/accounts').request.auth.type, 'noauth');
  assert.deepEqual(get('/accounts').request.header, [{ key: 'X-Auth-Email', value: '{{api_email}}' }, { key: 'X-Auth-Key', value: '{{api_key}}' }]);
  assert.equal(get('/combined').request.auth.type, 'bearer');
  assert.equal(get('/combined').request.header.length, 2);
  assert.equal(get('/anonymous').request.auth.type, 'noauth');
  assert.equal(get('/unknown').request.auth.type, 'noauth');
  assert.match(get('/unknown').event[0].script.exec.join('\n'), /skipRequest/u);
  let stopped = false;
  let skipped = false;
  let logged = false;
  vm.runInNewContext(get('/unknown').event[0].script.exec.join('\n'), {
    console: { error: () => { logged = true; } },
    pm: { execution: { setNextRequest: (next) => { stopped = next === null; }, skipRequest: () => { skipped = true; } } }
  });
  assert.ok(stopped && skipped && logged);
  const changed = structuredClone(get('/accounts')); changed.request.auth = get('/zones').request.auth;
  assert.throws(() => assertRequestAuthentication(changed, operations.find((o) => o.path === '/accounts').authSupport, 'fixture'), /metadata mismatch/u);
});

test('upstream operation, inherited root, and scheme changes invalidate auth metadata even without operation changes', async () => {
  const schema = await fixture();
  const op = schema.paths['/inherited'].get;
  const original = authenticationSupport(schema, op);
  const rootChanged = structuredClone(schema); rootChanged.security = [{ api_email: [], api_key: [] }];
  const schemeChanged = structuredClone(schema); schemeChanged.components.securitySchemes.api_token.scheme = 'basic';
  const operationChanged = { ...op, security: [{ api_email: [], api_key: [], api_token: [] }] };
  for (const changed of [authenticationSupport(rootChanged, op), authenticationSupport(schemeChanged, op), authenticationSupport(schema, operationChanged)]) {
    assert.notEqual(changed.fingerprint, original.fingerprint);
    assert.throws(() => assertAuthenticationMetadata(original, changed, 'fixture'), /Authentication metadata mismatch/u);
  }
  assert.equal(authenticationSupport(schema, { security: [{ api_email: [], api_key: [], api_token: [] }] }).supportsBearerToken, false);
  assert.equal(authenticationSupport(schema, { security: [{ api_token: [] }, {}] }).category, 'bearer-alternative');
  assert.equal(authenticationSupport(schema, { security: [{ api_email: [], api_key: [], api_token: [] }, {}] }).category, 'anonymous');
});
