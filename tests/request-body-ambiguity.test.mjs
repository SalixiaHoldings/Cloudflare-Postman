import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import Ajv from 'ajv-draft-04';
import { fetchPinnedSchema } from '../src/upstream.mjs';
import { createBodyContract } from '../src/request-body.mjs';

// A revision-bound proof of the generic compatibility condition, not an override.
test('pinned Bot Management overlap is classified without changing the source or request', async () => {
  const { destination, lock } = await fetchPinnedSchema();
  assert.equal(lock.commit, '49731bd0592b0c8c2c781b8d15d9f27c7293b210',
    'Review and retire or update the request-body ambiguity diagnostic when advancing the pin.');
  const document = JSON.parse(await readFile(destination, 'utf8'));
  const body = document.paths['/zones/{zone_id}/bot_management'].put.requestBody;
  const contract = createBodyContract(document);
  const before = JSON.stringify(body);
  assert.equal(body.required, true);
  function dereference(value) {
    if (!value || typeof value !== 'object') return value;
    if (value.$ref) {
      assert.ok(value.$ref.startsWith('#/'));
      return dereference(value.$ref.slice(2).split('/').reduce((node, key) =>
        node[decodeURIComponent(key).replaceAll('~1', '/').replaceAll('~0', '~')], document));
    }
    if (Array.isArray(value)) return value.map(dereference);
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, dereference(child)]));
  }
  const schema = dereference(body.content['application/json'].schema);
  const ajv = new Ajv({ strict: false, validateFormats: false, allErrors: true });
  const validate = ajv.compile(schema);
  const branches = schema.oneOf.map(branch => ajv.compile(branch));
  assert.equal(branches.length, 4);
  for (const value of [{}, { fight_mode: true },
    { auto_update_model: true, bm_cookie_enabled: true, suppress_session_score: false }]) {
    assert.deepEqual(branches.map(branch => branch(value)), [true, true, true, true]);
    assert.equal(validate(value), false);
    assert.deepEqual(validate.errors.map(error => error.keyword), ['oneOf']);
    assert.equal(contract.classifyValue(body.content['application/json'].schema, value), 'ambiguous-oneOf');
    assert.deepEqual(contract.normalizeValue(body.content['application/json'].schema, value), value);
  }
  assert.equal(JSON.stringify(body), before);
  assert.equal(contract.classifyValue(body.content['application/json'].schema, { enable_js: 'invalid' }), 'invalid');
  assert.equal(contract.classifyValue(body.content['application/json'].schema, { stale_zone_configuration: {} }), 'invalid');
});
