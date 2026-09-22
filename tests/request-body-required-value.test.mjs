import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import Ajv from 'ajv-draft-04';
import { fetchPinnedSchema } from '../src/upstream.mjs';
import { createBodyContract, INCOMPLETE_BODY_WARNING } from '../src/request-body.mjs';

test('pinned firewall bulk updates construct the newly declared string id without incomplete quarantine', async () => {
  const { destination, lock } = await fetchPinnedSchema();
  assert.equal(lock.commit, '73947ddceec8571140469a90a1a35078e10fa054',
    'Reevaluate the required-value diagnostic when advancing the schema pin.');
  assert.equal(lock.schema.sha256, '66259004b9ee38da435ec59992dbb73a7740d4249971bb80f3fa1f0a9ee1c344');
  const document = JSON.parse(await readFile(destination, 'utf8'));
  const ajv = new Ajv({ strict: false, allErrors: true });
  const contract = createBodyContract(document);
  for (const method of ['patch', 'put']) {
    const body = document.paths['/zones/{zone_id}/firewall/rules'][method].requestBody;
    const pointer = `#/paths/~1zones~1{zone_id}~1firewall~1rules/${method}/requestBody/content/application~1json/schema`;
    assert.deepEqual(body, { required: true, content: { 'application/json': { schema: {
      type: 'object', properties: { id: { description: 'The unique identifier of the firewall rule.', type: 'string' } },
      required: ['id']
    } } } }, pointer);
    const validate = ajv.compile(body.content['application/json'].schema);
    assert.equal(validate({}), false);
    assert.deepEqual(validate.errors, [{ instancePath: '', schemaPath: '#/required', keyword: 'required',
      params: { missingProperty: 'id' }, message: "must have required property 'id'" }]);
    // Upstream now supplies the missing value semantics; boolean ids are invalid.
    assert.equal(validate({ id: 'fictional' }), true);
    assert.equal(validate({ id: false }), false);
    const operation = { key: `${method.toUpperCase()} /zones/{zone_id}/firewall/rules`,
      path: '/zones/{zone_id}/firewall/rules', methodLower: method,
      operation: document.paths['/zones/{zone_id}/firewall/rules'][method] };
    const request = { description: 'Fictional test description.', header: [{ key: 'Content-Type', value: 'application/json' }],
      body: { mode: 'raw', options: { raw: { language: 'json' } }, raw: '{  }' } };
    const result = contract.normalize(request, operation);
    assert.equal(result.classification, 'valid');
    assert.deepEqual(JSON.parse(request.body.raw), { id: '{{id}}' });
    assert.equal(request.description.includes(INCOMPLETE_BODY_WARNING), false);
    assert.deepEqual(contract.validate(request, operation), result);
    const stale = structuredClone(request); stale.description = INCOMPLETE_BODY_WARNING;
    assert.throws(() => contract.validate(stale, operation), /stale source-incomplete/u);
  }
});

test('pinned Hyperdrive constructs an unresolved password variable, never an emitted secret witness', async () => {
  const { destination, lock } = await fetchPinnedSchema();
  assert.equal(lock.commit, '73947ddceec8571140469a90a1a35078e10fa054');
  const document = JSON.parse(await readFile(destination, 'utf8'));
  const path = '/accounts/{account_id}/hyperdrive/configs/{hyperdrive_id}';
  const operation = { key: `PUT ${path}`, path, methodLower: 'put', operation: document.paths[path].put };
  const request = { body: { mode: 'raw', options: { raw: { language: 'json' } }, raw: JSON.stringify({
    name: 'fictional-hyperdrive', origin: { value: '<Error: Too many levels of nesting to fake this schema>' }
  }) } };
  const contract = createBodyContract(document);
  assert.equal(contract.normalize(request, operation).classification, 'valid');
  assert.equal(JSON.parse(request.body.raw).origin.password, '{{origin__password}}');
  assert.equal(contract.validate(request, operation).classification, 'valid');
});
