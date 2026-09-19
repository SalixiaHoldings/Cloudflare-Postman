import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createBodyContract, assertNoBodySentinel, INCOMPLETE_BODY_WARNING } from '../src/request-body.mjs';
import { generateCollection, convert } from '../src/postman.mjs';
import { listOperations } from '../src/openapi.mjs';
import { assertBodyEquivalence } from '../src/native-git.mjs';
import { assertRequestAuthentication } from '../src/auth.mjs';

const fixture = JSON.parse(await readFile(new URL('fixtures/request-body-openapi.json', import.meta.url)));
const contract = createBodyContract(fixture);
const shared = { $ref: '#/components/schemas/Shared' };
const sentinel = '<Error: Too many levels of nesting to fake this schema>';
const walk = items => items.flatMap(item => item.item ? walk(item.item) : [item]);

test('request semantics follow refs, arrays, allOf, oneOf and anyOf; writeOnly and deprecated remain writable', () => {
  const child = { server_id: 'fictional-id', input_value: 'fictional-input', legacy: 'fictional-legacy' };
  const output = contract.normalizeValue(shared, { server_id: 'fictional-id', name: 'fictional-name',
    child, children: [child], choice: { ...child, kind: 'first' }, alternative: child,
    response_only: { id: 'fictional-id' } });
  const expected = { input_value: 'fictional-input', legacy: 'fictional-legacy' };
  assert.deepEqual(output, { name: 'fictional-name', child: expected, children: [expected],
    choice: { ...expected, kind: 'first' }, alternative: expected });
  assert.ok(contract.validateValue(shared, output));
  assert.equal(contract.validateValue(shared, { ...output, server_id: 'fictional-id' }), false);
});

test('optional unsafe fields are omitted; required values use schema evidence or fail closed', () => {
  const schema = { type: 'object', required: ['required'], properties: {
    required: { type: 'string', enum: ['fictional-enum'] },
    optional: { type: 'string' }, nested: { type: 'object', properties: { unsafe: { type: 'string' } } }
  } };
  assert.deepEqual(contract.normalizeValue(schema, { required: { value: sentinel }, optional: sentinel,
    nested: { unsafe: sentinel } }), { required: 'fictional-enum' });
  assert.throws(() => contract.normalizeValue({ type: 'string', pattern: '^fictional-required-value$' }, sentinel), /value violates|cannot be represented/u);
  assert.throws(() => contract.normalizeValue({ required: ['id'] }, {}), /\$\/id: required value cannot be represented safely/u);
  assert.throws(() => assertNoBodySentinel({ raw: '<Error: another converter failure>' }, 'fixture'), /sentinel/u);
});

test('allOf read-only required declarations do not become request requirements', () => {
  const schema = { allOf: [{ type: 'object', required: ['id'] },
    { type: 'object', properties: { id: { $ref: '#/components/schemas/ServerId' } } }] };
  assert.deepEqual(contract.normalizeValue(schema, { id: 'fictional-id' }), {});
  assert.ok(contract.validateValue(schema, {}));
});

test('exclusive unions, additionalProperties and required write-only fields are enforced', () => {
  assert.equal(contract.validateValue({ oneOf: [{ type: 'object' }, { type: 'object' }] }, {}, { compatibility: false }), false);
  assert.equal(contract.validateValue({ type: 'object', additionalProperties: false }, { invented: 1 }), false);
  assert.equal(contract.validateValue({ $ref: '#/components/schemas/Child' }, {}), false);
  const schema = { type: 'object', additionalProperties: { $ref: '#/components/schemas/Child' } };
  assert.deepEqual(contract.normalizeValue(schema, { fictional: { server_id: 'fictional-id', input_value: 'fictional-input' } }),
    { fictional: { input_value: 'fictional-input' } });
});

test('overlap compatibility accepts only independently valid writable branches without mutating requests', () => {
  const schema = { type: 'object', required: ['name'], properties: { name: { type: 'string', minLength: 3 } },
    oneOf: [{ type: 'object' }, { type: 'object' }] };
  const value = { name: 'fictional' };
  assert.equal(contract.classifyValue(schema, value), 'ambiguous-oneOf');
  assert.deepEqual(contract.normalizeValue(schema, value), value);
  for (const invalid of [{ name: 'x' }, {}, { name: 123 }, { name: sentinel }]) {
    assert.equal(contract.classifyValue(schema, invalid), 'invalid');
  }
  assert.equal(contract.classifyValue({ oneOf: [{ type: 'number' }, { type: 'boolean' }] }, 'fictional'), 'invalid');
  const conflicting = { oneOf: [
    { type: 'object', properties: { id: { type: 'string', readOnly: true } } },
    { type: 'object', properties: { id: { type: 'string', writeOnly: true } } }
  ] };
  assert.equal(contract.classifyValue(conflicting, { id: 'fictional' }), 'invalid');
  const nested = { type: 'object', properties: { conditional: { oneOf: [
    { type: 'string', readOnly: true }, { type: 'number' }
  ] } } };
  assert.equal(contract.validateValue(nested, { conditional: 'fictional' }), false);
  assert.deepEqual(contract.normalizeValue(nested, { conditional: 'fictional' }), {});
  assert.deepEqual(contract.normalizeValue(nested, { conditional: 1 }), { conditional: 1 });
  const arrayItems = { type: 'object', properties: { ids: { type: 'array', items: {
    $ref: '#/components/schemas/ServerId'
  } } } };
  // OAS annotations apply at property definitions, not at the primitive item root.
  assert.deepEqual(contract.normalizeValue(arrayItems, { ids: ['fictional'] }), { ids: ['fictional'] });
  const closed = { allOf: [schema, { type: 'object', properties: { name: { type: 'string' } }, additionalProperties: false }] };
  assert.equal(contract.classifyValue(closed, { ...value, invented: 1 }), 'invalid');
});

test('request credential substitution preserves numeric, boolean and structured values', async () => {
  const schema = structuredClone(fixture);
  schema.paths['/fictional'].post.requestBody.content['application/json'].schema = {
    type: 'object', properties: { client_secret_version: { type: 'number', default: 1 },
      secret_enabled: { type: 'boolean', example: true }, secret_settings: { type: 'object', example: { name: 'fictional' } },
      client_secret: { type: 'string', example: 'fictional-placeholder' } }
  };
  const { collection } = await generateCollection(schema, { operations: listOperations(schema),
    partition: { id: 'typed-fixture', title: 'Fixture', description: 'Fictional fixture' },
    commit: 'a'.repeat(40), schemaSha256: 'b'.repeat(64) });
  assert.deepEqual(JSON.parse(walk(collection.item)[0].request.body.raw), {
    client_secret_version: 1, secret_enabled: true, secret_settings: { name: 'fictional' }, client_secret: '{{client_secret}}'
  });
});

test('generic conversion leaves response bodies intact while correcting live requests and saved request snapshots', async () => {
  const original = await convert(structuredClone(fixture));
  const { collection } = await generateCollection(structuredClone(fixture), {
    operations: listOperations(fixture), partition: { id: 'body-fixture', title: 'Fixture', description: 'Fictional fixture' },
    commit: 'a'.repeat(40), schemaSha256: 'b'.repeat(64)
  });
  const item = walk(collection.item)[0];
  contract.validate(item.request, listOperations(fixture)[0]);
  assert.deepEqual(item.response.map(response => response.body), walk(original.collection.item)[0].response.map(response => response.body));
  assert.ok(item.response.some(response => response.body.includes('fictional-server-id')));
  assert.ok(!item.request.body.raw.includes('fictional-server-id'));
  for (const response of item.response) assert.deepEqual(response.originalRequest.body, item.request.body);
});

test('incomplete source warnings preserve the existing authentication notice contract', async () => {
  const schema = structuredClone(fixture);
  schema.paths['/fictional'].post.requestBody = { required: true,
    content: { 'application/json': { schema: { required: ['fictional_missing'] } } } };
  const operations = listOperations(schema);
  const { collection, requestBodies } = await generateCollection(schema, { operations,
    partition: { id: 'incomplete-fixture', title: 'Fixture', description: 'Fictional fixture' },
    commit: 'a'.repeat(40), schemaSha256: 'b'.repeat(64) });
  const item = walk(collection.item)[0];
  assert.equal(requestBodies.counts['source-incomplete'], 1);
  assert.ok(item.request.description.startsWith(INCOMPLETE_BODY_WARNING));
  assertRequestAuthentication(item, operations[0].authSupport, operations[0].key);
  assert.deepEqual(JSON.parse(item.request.body.raw), {});
});

test('Native Git rejects JSON body, form field and mode drift, and scans bodies only', () => {
  assert.doesNotThrow(() => assertBodyEquivalence({ mode: 'raw', options: { raw: { language: 'json' } }, raw: '{"input":1}' },
    { type: 'json', content: '{"input":1}' }, 'fixture'));
  assert.throws(() => assertBodyEquivalence({ mode: 'raw', options: { raw: { language: 'json' } }, raw: '{"input":1}' },
    { type: 'json', content: '{"response":1}' }, 'fixture'), /drift/u);
  assert.throws(() => assertBodyEquivalence({ mode: 'file', file: {} }, { type: 'json', content: '{}' }, 'fixture'), /mode drift/u);
  assert.throws(() => assertBodyEquivalence({ mode: 'formdata', formdata: [{ key: 'input', type: 'text', value: 'fictional' }] },
    { type: 'formdata', content: [{ key: 'input', type: 'text', value: 'changed' }] }, 'fixture'), /drift/u);
  assert.throws(() => assertBodyEquivalence({ mode: 'raw', raw: sentinel }, { type: 'text', content: sentinel }, 'fixture'), /sentinel/u);
});

test('source-incomplete is generic, and never exempts ordinary violations or available source information', () => {
  function run(schema, value, selected = {}) {
    const operation = { key: 'POST /fictional-incomplete', operation: { requestBody: { required: true,
      content: { 'application/json': { schema, ...selected } } } } };
    const request = { description: 'Fictional fixture.', header: [{ key: 'Content-Type', value: 'application/json' }],
      body: { mode: 'raw', options: { raw: { language: 'json' } }, raw: JSON.stringify(value) } };
    return { operation, request, result: contract.normalize(request, operation) };
  }
  for (const name of ['fictional', 'different_name']) {
    const { request, result } = run({ required: [name] }, {});
    assert.equal(result.classification, 'source-incomplete');
    assert.equal(request.body.raw, '{}');
  }
  for (const schema of [
    { required: ['fictional'], example: { fictional: 'source-example' } },
    { required: ['fictional'], default: { fictional: 'source-default' } },
    { required: ['fictional'], additionalProperties: { type: 'string' } },
    { required: ['fictional'], properties: { fictional: { type: 'string' } } }
  ]) assert.notEqual(run(schema, {}).result.classification, 'source-incomplete');
  const media = run({ required: ['fictional'] }, {}, { example: { fictional: 'fictional-source-example' } });
  assert.equal(media.result.classification, 'valid');
  assert.deepEqual(JSON.parse(media.request.body.raw), { fictional: 'fictional-source-example' });
  for (const value of [{ unsafe: sentinel }, { readonly: 'fictional' }, { typed: false }]) {
    assert.throws(() => run({ type: 'object', required: ['missing'], properties: {
      readonly: { type: 'string', readOnly: true }, typed: { type: 'string' }
    } }, value));
  }
  assert.throws(() => run({ oneOf: [{ type: 'number' }, { type: 'boolean' }], required: ['missing'] }, {}));
  const { request, operation } = run({ type: 'object' }, {});
  request.description += INCOMPLETE_BODY_WARNING;
  assert.throws(() => contract.validate(request, operation), /stale source-incomplete/u);
});

test('form bodies retain their mode and writable rows while pruning nested read-only and unsafe fields', () => {
  const schema = { type: 'object', required: ['input'], properties: {
    input: { type: 'string', writeOnly: true }, readonly: { type: 'string', readOnly: true },
    optional: { type: 'string' }, file: { type: 'string', format: 'binary' },
    child: { type: 'object', properties: { server: { type: 'string', readOnly: true }, input: { type: 'string' } } }
  } };
  const operation = { key: 'POST /fictional-form', operation: { requestBody: { content: {
    'multipart/form-data': { schema }
  } } } };
  const request = { body: { mode: 'formdata', formdata: [
    { key: 'input', type: 'text', value: 'fictional' }, { key: 'readonly', type: 'text', value: 'fictional' },
    { key: 'optional', type: 'text', value: sentinel }, { key: 'file', type: 'file', src: '' },
    { key: 'child', type: 'text', value: '{"server":"fictional","input":"fictional"}' }
  ] } };
  assert.equal(contract.normalize(request, operation).classification, 'valid');
  assert.equal(request.body.mode, 'formdata');
  assert.deepEqual(request.body.formdata.map(row => row.key), ['input', 'file', 'child']);
  assert.equal(request.body.formdata[2].value, '{"input":"fictional"}');
  assert.equal(contract.validate(request, operation).classification, 'valid');
  request.body.formdata[0].value = sentinel;
  assert.throws(() => contract.validate(request, operation), /sentinel/u);
});

test('required object cardinality uses only declared writable properties and optional sentinel arrays are omitted', () => {
  const schema = { type: 'object', required: ['device'], properties: { device: {
    type: 'object', minProperties: 1, maxProperties: 1,
    properties: { first: { type: 'string' }, second: { type: 'boolean' }, readonly: { type: 'string', readOnly: true } }
  }, optional: { type: 'array', items: { type: 'object', required: ['required'], properties: { required: { type: 'string' } } } } } };
  assert.deepEqual(contract.normalizeValue(schema, { device: { first: 'fictional', second: true }, optional: [{ required: sentinel }] }),
    { device: { first: 'fictional' } });
  assert.equal(contract.validateValue(schema, { device: {} }), false);
});
