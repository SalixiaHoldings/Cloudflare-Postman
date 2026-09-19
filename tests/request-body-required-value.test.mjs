import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import Ajv from 'ajv-draft-04';
import { fetchPinnedSchema } from '../src/upstream.mjs';
import { createBodyContract, INCOMPLETE_BODY_WARNING } from '../src/request-body.mjs';

test('pinned firewall bulk updates are source-incomplete without fabricating an id or changing the body', async () => {
  const { destination, lock } = await fetchPinnedSchema();
  assert.equal(lock.commit, '49731bd0592b0c8c2c781b8d15d9f27c7293b210',
    'Reevaluate the required-value diagnostic when advancing the schema pin.');
  assert.equal(lock.schema.sha256, '3a7ba0e10e3b84f36e9ba6d6135a99d69177c2c3501711bcb367cb8b462bc627');
  const document = JSON.parse(await readFile(destination, 'utf8'));
  const ajv = new Ajv({ strict: false, allErrors: true });
  const contract = createBodyContract(document);
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
    const operation = { key: `${method.toUpperCase()} /zones/{zone_id}/firewall/rules`,
      path: '/zones/{zone_id}/firewall/rules', methodLower: method,
      operation: document.paths['/zones/{zone_id}/firewall/rules'][method] };
    const request = { description: 'Fictional test description.', header: [{ key: 'Content-Type', value: 'application/json' }],
      body: { mode: 'raw', options: { raw: { language: 'json' } }, raw: '{  }' } };
    const original = structuredClone(request.body);
    const result = contract.normalize(request, operation);
    assert.equal(result.classification, 'source-incomplete');
    assert.deepEqual(result.issues, [{ instancePath: '/id', schemaPath: `${pointer}/required/0`,
      reason: 'Required property has no value schema, example, or default.' }]);
    assert.deepEqual(request.body, original);
    assert.ok(request.description.startsWith(INCOMPLETE_BODY_WARNING));
    assert.deepEqual(contract.validate(request, operation), result);
    assert.equal(Object.hasOwn(JSON.parse(request.body.raw), 'id'), false);
    const withoutWarning = structuredClone(request); withoutWarning.description = '';
    assert.throws(() => contract.validate(withoutWarning, operation), /missing source-incomplete/u);
  }
});
