import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import Ajv from 'ajv-draft-04';
import { createBodyContract, INCOMPLETE_BODY_WARNING } from '../src/request-body.mjs';
import { fetchPinnedSchema } from '../src/upstream.mjs';
import { listOperations } from '../src/openapi.mjs';

const contract = createBodyContract({ openapi: '3.0.3' });
const structural = new Ajv({ strict: false, validateFormats: false, allErrors: true });
const readonlyId = { type: 'object', required: ['id'], properties: { id: { type: 'string', readOnly: true } } };
const negation = { type: 'object', not: readonlyId };
const fictional = { id: 'fictional' };
const operationFor = (media, selected, required = true) => ({
  key: 'POST /fictional-boundary', path: '/fictional-boundary', methodLower: 'post',
  operation: { requestBody: { required, content: { [media]: selected } } }
});
const requestFor = (media, body) => ({ header: [{ key: 'Content-Type', value: media }], body });
const jsonRequest = value => requestFor('application/json', { mode: 'raw', raw: JSON.stringify(value) });

test('not uses structural read-only semantics while positive request properties stay protected', () => {
  const before = JSON.stringify(negation);
  const validate = structural.compile(negation);
  assert.equal(validate(fictional), false);
  assert.deepEqual(validate.errors.map(error => error.keyword), ['not']);
  assert.equal(contract.classifyValue(negation, fictional), 'invalid');
  assert.throws(() => contract.validate(jsonRequest(fictional), operationFor('application/json', { schema: negation })),
    /violates writable request schema/u);
  const normalized = contract.normalizeValue(negation, fictional);
  assert.deepEqual(normalized, {});
  assert.equal(validate(normalized), true);
  assert.equal(contract.classifyValue(readonlyId, fictional), 'invalid');
  assert.deepEqual(contract.normalizeValue(readonlyId, fictional), {});
  assert.equal(JSON.stringify(negation), before);
});

test('not keeps strict oneOf evaluation and separates structural policy in composition and caches', () => {
  const overlap = { ...negation, oneOf: [{ type: 'object' }, { type: 'object' }] };
  assert.equal(contract.classifyValue(overlap, fictional), 'invalid');
  assert.throws(() => contract.validate(jsonRequest(fictional), operationFor('application/json', { schema: overlap })),
    /violates writable request schema/u);
  assert.equal(contract.classifyValue({ not: { oneOf: [{}, {}] } }, {}), 'valid');
  // Only the second branch matches structurally: missing read-only required
  // properties must not gain the request-side exemption inside the first.
  assert.equal(contract.classifyValue({ not: { oneOf: [readonlyId, { type: 'object' }] } }, {}), 'invalid');
  // The exact same schema/value is evaluated with both structural and request
  // policies. A cached structural failure must not poison request applicability.
  assert.equal(contract.classifyValue({ type: 'object', anyOf: [readonlyId], not: readonlyId }, {}), 'valid');
});

test('source-incomplete cannot hide not failures or exempt missing values inside negation', () => {
  const operation = operationFor('application/json', { schema: { ...negation, required: ['missing'] } });
  assert.throws(() => contract.normalize(jsonRequest(fictional), operation), /cannot be represented safely/u);
  const warned = jsonRequest(fictional); warned.description = INCOMPLETE_BODY_WARNING;
  assert.throws(() => contract.validate(warned, operation), /violates writable request schema/u);

  // The preserved empty object fails only the outer unknown required value.
  // The inner required value is absent, so its integer prohibition does not match.
  const schema = { type: 'object', required: ['missing'],
    not: { type: 'object', required: ['missing'], properties: { missing: { type: 'integer' } } } };
  const validate = structural.compile(schema);
  assert.equal(validate({}), false);
  assert.deepEqual(validate.errors.map(error => error.keyword), ['required']);
  assert.equal(validate({ missing: 'fictional' }), true);
  const incomplete = operationFor('application/json', { schema });
  const request = jsonRequest({});
  // Even satisfiable negation is outside the deliberately narrow quarantine.
  assert.throws(() => contract.normalize(request, incomplete), /cannot be represented safely/u);
  assert.throws(() => contract.validate(request, incomplete), /violates writable request schema/u);
  assert.equal(request.body.raw, '{}');
});

test('JSON and form media enforce matching modes in normalization and validation', () => {
  const schema = { type: 'object', required: ['name'], properties: { name: { type: 'string', writeOnly: true } } };
  const cases = [
    ['application/json', { mode: 'raw', raw: '{"name":"fictional"}' }],
    ['application/scim+json', { mode: 'raw', raw: '{"name":"fictional"}' }],
    ['multipart/form-data', { mode: 'formdata', formdata: [{ key: 'name', type: 'text', value: 'fictional' }] }],
    ['application/x-www-form-urlencoded', { mode: 'urlencoded', urlencoded: [{ key: 'name', value: 'fictional' }] }]
  ];
  for (const [media, body] of cases) for (const method of ['normalize', 'validate']) {
    const operation = operationFor(media, { schema });
    const request = requestFor(media, structuredClone(body));
    assert.equal(contract[method](request, operation).classification, 'valid');
    assert.deepEqual(request.body, body);
    for (const wrongMode of ['raw', 'formdata', 'urlencoded', 'file'].filter(mode => mode !== body.mode)) {
      assert.throws(() => contract[method](requestFor(media, { mode: wrongMode, raw: '{}' }), operation),
        /body mode mismatch/u, `${method}: ${media} with ${wrongMode}`);
    }
  }
});

test('other media preserve supported raw and file bodies without treating them as JSON or forms', () => {
  for (const media of ['application/octet-stream', 'application/x-ndjson', 'text/plain']) {
    const operation = operationFor(media, { schema: { type: 'string', format: 'binary' } });
    for (const body of [{ mode: 'file' }, { mode: 'raw', raw: 'fictional text' }]) {
      for (const method of ['normalize', 'validate']) {
        const request = requestFor(media, structuredClone(body));
        assert.equal(contract[method](request, operation).classification, 'valid');
        assert.deepEqual(request.body, body);
      }
    }
  }
});

test('schema-less nonempty JSON must parse and cannot be repaired by inventing a quoted string', () => {
  for (const media of ['application/json', 'application/scim+json']) for (const method of ['normalize', 'validate']) {
    for (const raw of ['not-json', '{', '   ']) {
      const request = requestFor(media, { mode: 'raw', raw });
      assert.throws(() => contract[method](request, operationFor(media, {})), /not parseable/u);
      assert.equal(request.body.raw, raw);
    }
  }
});

test('schema-less valid JSON retains its classification and exact bytes', () => {
  for (const raw of ['{  }', '[]', '"fictional"', '1', 'true', 'null']) for (const method of ['normalize', 'validate']) {
    const request = requestFor('application/json', { mode: 'raw', raw });
    assert.equal(contract[method](request, operationFor('application/json', {})).classification, 'not-applicable');
    assert.equal(request.body.raw, raw);
  }
  const request = requestFor('application/json', { mode: 'raw', raw: 'fictional' });
  const operation = operationFor('application/json', { schema: { type: 'string' } });
  assert.equal(contract.normalize(request, operation).classification, 'valid');
  assert.equal(request.body.raw, '"fictional"');
  assert.equal(contract.validate(request, operation).classification, 'valid');
});

test('schema-less empty required JSON retains the warned source-incomplete exception', () => {
  const operation = operationFor('application/json', {});
  const request = requestFor('application/json', { mode: 'raw', raw: '' });
  assert.throws(() => contract.validate(request, operation), /missing source-incomplete body warning/u);
  const result = contract.normalize(request, operation);
  assert.equal(result.classification, 'source-incomplete');
  assert.deepEqual(contract.validate(request, operation), result);
  assert.equal(request.body.raw, '');
  assert.ok(request.description.includes(INCOMPLETE_BODY_WARNING));
});

test('pinned upload and schema-less JSON reproducers fail while all nine file bodies remain accepted', async () => {
  const { destination, lock } = await fetchPinnedSchema();
  assert.equal(lock.commit, '49731bd0592b0c8c2c781b8d15d9f27c7293b210', 'Review media/body diagnostics when advancing the pin.');
  const document = JSON.parse(await readFile(destination, 'utf8'));
  const pinned = createBodyContract(document);
  const operations = new Map(listOperations(document).map(operation => [operation.key, operation]));
  const upload = operations.get('POST /accounts/{account_id}/gateway/lists/upload');
  assert.deepEqual(upload.operation.requestBody.content['multipart/form-data'].schema.required, ['file']);
  const enable = operations.get('POST /zones/{zone_id}/email/routing/enable');
  assert.deepEqual(enable.operation.requestBody, { required: true, content: { 'application/json': {} } });
  for (const method of ['normalize', 'validate']) {
    assert.throws(() => pinned[method](requestFor('multipart/form-data', { mode: 'raw', raw: '{"fictional_unexpected":true}' }), upload), /body mode mismatch/u);
    assert.equal(pinned[method](requestFor('multipart/form-data', { mode: 'formdata', formdata: [{ key: 'file', type: 'file', src: '' }] }), upload).classification, 'valid');
    assert.throws(() => pinned[method](requestFor('application/json', { mode: 'raw', raw: 'not-json' }), enable), /not parseable/u);
  }
  const manifest = JSON.parse(await readFile(new URL('../dist/v2.1/manifest.json', import.meta.url)));
  const walk = items => items.flatMap(item => item.item ? walk(item.item) : [item]);
  const mediaCounts = {};
  for (const partition of manifest.partitions) {
    const collection = JSON.parse(await readFile(new URL(`../dist/v2.1/${partition.file}`, import.meta.url)));
    for (const { request } of walk(collection.item)) {
      if (request.body?.mode !== 'file') continue;
      const media = request.header.find(header => !header.disabled && header.key.toLowerCase() === 'content-type').value;
      mediaCounts[media] = (mediaCounts[media] ?? 0) + 1;
      const key = `${request.method} /${request.url.path.join('/').replace(/\{\{([^}]+)\}\}/gu, '{$1}')}`;
      for (const method of ['normalize', 'validate']) {
        const copy = structuredClone(request);
        assert.equal(pinned[method](copy, operations.get(key)).classification, 'valid');
        assert.deepEqual(copy, request);
      }
    }
  }
  assert.deepEqual(mediaCounts, { 'application/octet-stream': 3, 'application/x-ndjson': 4, 'text/plain': 2 });
});
