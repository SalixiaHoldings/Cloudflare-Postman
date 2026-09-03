import assert from 'node:assert/strict';
import test from 'node:test';
import { assertEmptyPublicVariables, assertNoLocalPaths, localPaths } from '../src/public-safety.mjs';
import { createTemplateEnvironment } from '../src/chaining.mjs';

test('public templates reject populated credential, identifier, and arbitrary fields', () => {
  const entries = createTemplateEnvironment().values;
  assert.doesNotThrow(() => assertEmptyPublicVariables(entries, 'fixture'));
  for (const key of ['api_token', 'api_key', 'api_email', 'account_id', 'zone_id', 'account_name', 'zone_name', 'custom']) {
    assert.throws(() => assertEmptyPublicVariables([{ key, value: 'synthetic-value' }], 'fixture'), /populated/u);
  }
  assert.throws(() => assertEmptyPublicVariables([{ key: 'base_url', value: 'https://example.invalid' }], 'fixture'), /nonstandard/u);
  assert.throws(() => assertEmptyPublicVariables([{ key: 'api_token', value: '' }, { key: 'api_token', value: '' }], 'fixture'), /duplicate/u);
});

test('public output rejects local home paths without denying upstream user API routes', () => {
  for (const value of ['/Users/example-user/project', '/home/example-user/project', 'C:\\Users\\example-user\\project']) {
    assert.throws(() => assertNoLocalPaths(value, 'fixture'), /local user-directory/u);
    assert.throws(() => assertNoLocalPaths(JSON.stringify({ value }), 'fixture'), /local user-directory/u);
  }
  assert.doesNotThrow(() => assertNoLocalPaths('/accounts/{account_id}/access/users/{user_id}', 'fixture'));
  const example = '/home/example-user/public-example.txt';
  const publicPaths = new Set(localPaths(JSON.stringify({ example })));
  assert.doesNotThrow(() => assertNoLocalPaths(JSON.stringify({ example }), 'fixture', publicPaths));
  assert.throws(() => assertNoLocalPaths('/home/example-user/private-file.txt', 'fixture', publicPaths), /local user-directory/u);
});
