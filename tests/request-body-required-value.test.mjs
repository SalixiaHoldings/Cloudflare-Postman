import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import Ajv from 'ajv-draft-04';
import { fetchPinnedSchema } from '../src/upstream.mjs';

test('pinned firewall bulk updates require an id without a value schema or source example', async () => {
  const { destination, lock } = await fetchPinnedSchema();
  assert.equal(lock.commit, '49731bd0592b0c8c2c781b8d15d9f27c7293b210',
    'Reevaluate the required-value diagnostic when advancing the schema pin.');
  assert.equal(lock.schema.sha256, '3a7ba0e10e3b84f36e9ba6d6135a99d69177c2c3501711bcb367cb8b462bc627');
  const document = JSON.parse(await readFile(destination, 'utf8'));
  const ajv = new Ajv({ strict: false, allErrors: true });
  for (const method of ['patch', 'put']) {
    const body = document.paths['/zones/{zone_id}/firewall/rules'][method].requestBody;
    const pointer = `#/paths/~1zones~1{zone_id}~1firewall~1rules/${method}/requestBody/content/application~1json/schema`;
    assert.deepEqual(body, { required: true, content: { 'application/json': { schema: { required: ['id'] } } } }, pointer);
    const validate = ajv.compile(body.content['application/json'].schema);
    assert.equal(validate({}), false);
    assert.deepEqual(validate.errors, [{ instancePath: '', schemaPath: '#/required', keyword: 'required',
      params: { missingProperty: 'id' }, message: "must have required property 'id'" }]);
    // Both types pass: there is no source constraint from which to derive an id
    // value. These are evidence of missing semantics, not approved templates.
    assert.equal(validate({ id: 'fictional' }), true);
    assert.equal(validate({ id: false }), true);
  }
});
