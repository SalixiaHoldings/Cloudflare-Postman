import assert from 'node:assert/strict';
import test from 'node:test';
import Ajv from 'ajv-draft-04';
import { createBodyContract, INCOMPLETE_BODY_WARNING } from '../src/request-body.mjs';

const contract = createBodyContract({ openapi: '3.0.3' });
const operation = (media, selected) => ({ key: 'POST /fictional-ajv', path: '/fictional-ajv', methodLower: 'post',
  operation: { requestBody: { required: true, content: { [media]: selected } } } });
const request = (media, body) => ({ header: [{ key: 'Content-Type', value: media }], body });
const json = value => request('application/json', { mode: 'raw', raw: JSON.stringify(value) });

test('F1: form root assertions are evaluated together by structural validation', () => {
  for (const [media, mode] of [['multipart/form-data', 'formdata'], ['application/x-www-form-urlencoded', 'urlencoded']]) {
    for (const assertion of [{ not: {} }, { enum: [{ name: 'different-fictional-value' }] },
      { maxProperties: 0 }, { minProperties: 2 }, { allOf: [{ not: { required: ['name'] } }] }]) {
      const schema = { type: 'object', properties: { name: { type: 'string' } }, ...assertion };
      assert.throws(() => contract.validate(request(media, { mode, [mode]: [{ key: 'name', type: 'text', value: 'fictional' }] }),
        operation(media, { schema })), /violates|invalid/u);
    }
  }
});

test('F2: file form rows cannot bypass an impossible property schema', () => {
  const media = 'multipart/form-data';
  const schema = { type: 'object', required: ['file'], properties: { file: { type: 'string', format: 'binary', not: {} } } };
  for (const method of ['validate', 'normalize']) for (const type of ['text', 'file']) {
    assert.throws(() => contract[method](request(media, { mode: 'formdata', formdata: [
      { key: 'file', type, value: 'fictional', src: '' }
    ] }), operation(media, { schema })), /violates|invalid|cannot be represented/u);
  }
});

test('F3: an empty required JSON body cannot bypass authoritative media examples', () => {
  for (const selected of [{ example: { name: 'fictional' } },
    { examples: { fictional: { value: { name: 'fictional' } } } }]) {
    const op = operation('application/json', selected);
    const req = request('application/json', { mode: 'raw', raw: '' });
    assert.throws(() => contract.validate(structuredClone(req), op), /required|parseable/u);
    assert.notEqual(contract.normalize(req, op).classification, 'source-incomplete');
    assert.deepEqual(JSON.parse(req.body.raw), { name: 'fictional' });
    assert.notEqual(contract.validate(req, op).classification, 'source-incomplete');
  }
});

test('F4: enclosing enum candidates prevent source-incomplete quarantine', () => {
  const op = operation('application/json', { schema: { required: ['id'], enum: [{}, { id: 'fictional-id' }] } });
  const req = json({});
  assert.equal(contract.normalize(req, op).classification, 'valid');
  assert.deepEqual(JSON.parse(req.body.raw), { id: 'fictional-id' });
  assert.equal(contract.validate(req, op).classification, 'valid');
  const stale = json({}); stale.description = INCOMPLETE_BODY_WARNING;
  assert.throws(() => contract.validate(stale, op), /violates/u);
});

test('F5: contradictory required declarations fail closed instead of source-incomplete', () => {
  for (const assertion of [{ not: { required: ['id'] } }, { maxProperties: 0 }]) {
    const op = operation('application/json', { schema: { type: 'object', required: ['id'], ...assertion } });
    assert.throws(() => contract.normalize(json({}), op), /cannot be represented|violates/u);
    const req = json({}); req.description = INCOMPLETE_BODY_WARNING;
    assert.throws(() => contract.validate(req, op), /violates/u);
  }
});

test('F6: constrained non-JSON raw values receive structural validation', () => {
  const op = operation('text/plain', { schema: { type: 'string', enum: ['fictional-allowed'] } });
  const req = request('text/plain', { mode: 'raw', raw: 'fictional-rejected' });
  assert.throws(() => contract.validate(req, op), /violates|invalid/u);
  assert.equal(contract.normalize(req, op).classification, 'valid');
  assert.equal(req.body.raw, 'fictional-allowed');
  assert.equal(contract.validate(req, op).classification, 'valid');
});

test('complete structural assertions agree with independent Ajv across JSON and form values', () => {
  const ajv = new Ajv({ strict: false, validateFormats: false });
  const cases = [
    [{ type: 'integer', minimum: 1, maximum: 5, exclusiveMaximum: true, multipleOf: 2 }, [0, 1, 2, 4, 5, 6, '2']],
    [{ type: 'string', minLength: 2, maxLength: 4, pattern: '^f' }, ['', 'ff', 'other', 1]],
    [{ type: 'array', minItems: 1, maxItems: 2, uniqueItems: true, items: { type: 'integer' } }, [[], [1], [1, 1], [1, 2, 3], ['fictional']]],
    [{ type: 'object', required: ['name'], minProperties: 1, maxProperties: 2,
      properties: { name: { enum: ['fictional'] } }, additionalProperties: { type: 'boolean' } },
    [{}, { name: 'fictional' }, { name: 'other' }, { name: 'fictional', extra: true }, { name: 'fictional', extra: 1 }]],
    [{ allOf: [{ anyOf: [{ type: 'integer' }, { type: 'boolean' }] }, { not: { enum: [false, 0] } }] }, [0, 1, true, false, 'fictional']],
    [{ type: 'string', nullable: true, enum: ['fictional'] }, [null, 'fictional', 'other']],
    [{ oneOf: [{ type: 'object', required: ['a'] }, { type: 'object', required: ['b'] }] }, [{}, { a: 1 }, { b: 1 }, { a: 1, b: 1 }]]
  ];
  for (const [schema, values] of cases) {
    const validate = ajv.compile(schema);
    for (const value of values) assert.equal(contract.validateValue(schema, value, { compatibility: false }), validate(value), JSON.stringify({ schema, value }));
  }
});

test('overlap checks cannot hide other assertions, nested read-only leakage, or strict negation', () => {
  const shared = { oneOf: [{ type: 'object' }, { type: 'object' }] };
  for (const schema of [
    { ...shared, not: {} }, { ...shared, required: ['missing'] },
    { ...shared, maxProperties: 0 }, { ...shared, additionalProperties: false },
    { anyOf: [{ oneOf: [{ properties: { id: { readOnly: true } } }, { type: 'object' }] }] },
    { allOf: [shared], not: { allOf: [shared], oneOf: [{}, { required: ['missing'] }] } }
  ]) {
    const before = JSON.stringify(schema);
    const result = contract.classifyValue(schema, { id: 'fictional' });
    // Negated overlapping oneOf is strictly false, so its not is true.
    assert.equal(result, schema.not?.allOf ? 'ambiguous-oneOf' : 'invalid');
    assert.equal(JSON.stringify(schema), before);
  }
  assert.equal(contract.classifyValue({ type: 'array', items: shared }, [{}, 'fictional']), 'invalid');
});

test('read-only adaptation preserves source refs, recursive properties, array item scope, and writeOnly', () => {
  const document = { openapi: '3.0.3', components: { schemas: { Node: {
    type: 'object', required: ['server'], properties: {
      server: { type: 'string', readOnly: true }, input: { type: 'string', writeOnly: true },
      next: { $ref: '#/components/schemas/Node' }
    }
  } } } };
  const before = JSON.stringify(document), reader = createBodyContract(document);
  const schema = { $ref: '#/components/schemas/Node', required: ['ignored-reference-sibling'] };
  const value = { input: 'fictional', next: { input: 'fictional-child' } };
  assert.equal(reader.validateValue(schema, value), true);
  assert.equal(reader.validateValue(schema, { ...value, next: { server: 'fictional' } }), false);
  assert.equal(JSON.stringify(document), before);
});

test('form validation uses only enabled rows and rejects unresolved encoding ambiguities', () => {
  const media = 'application/x-www-form-urlencoded';
  const op = operation(media, { schema: { type: 'object', required: ['count'],
    properties: { count: { type: 'integer', minimum: 2 } }, additionalProperties: false } });
  for (const rows of [[{ key: 'count', value: '2', disabled: true }], [{ key: 'count', value: '1' }],
    [{ key: 'count', value: '2' }, { key: 'extra', value: 'fictional' }],
    [{ key: 'count', value: '2' }, { key: 'count', value: '3' }]]) {
    assert.throws(() => contract.validate(request(media, { mode: 'urlencoded', urlencoded: rows }), op), /violates|duplicate/u);
  }
  assert.equal(contract.validate(request(media, { mode: 'urlencoded', urlencoded: [
    { key: 'count', value: '2' }, { key: 'extra', value: 'fictional', disabled: true }
  ] }), op).classification, 'valid');
});

test('unselected files establish representation without claiming unknown contents satisfy constraints', () => {
  for (const schema of [{ type: 'string', enum: [''] }, { type: 'string', minLength: 1 },
    { type: 'string', not: { enum: ['fictional'] } }, { allOf: [{ type: 'string' }, { not: {} }] }]) {
    for (const method of ['normalize', 'validate']) assert.throws(() => contract[method](
      request('text/plain', { mode: 'file' }), operation('text/plain', { schema })), /cannot be represented|violates/u);
  }
  const schema = { type: 'object', enum: [{ file: '' }], properties: { file: { type: 'string', format: 'binary' } } };
  assert.throws(() => contract.validate(request('multipart/form-data', { mode: 'formdata', formdata: [
    { key: 'file', type: 'file', src: '' }
  ] }), operation('multipart/form-data', { schema })), /cannot be represented/u);
});

test('constrained Postman variables require authoritative consistent witnesses and stay unresolved', () => {
  const property = { type: 'string', pattern: '^fictional-value$', example: 'fictional-value' };
  const schema = { type: 'object', required: ['input'], properties: { input: property } };
  const value = { input: '{{fictional_input}}' };
  assert.equal(contract.classifyValue(schema, value), 'valid');
  assert.deepEqual(contract.normalizeValue(schema, value), value);
  for (const replacement of [{ type: 'string', pattern: '^fictional-value$' },
    { ...property, example: 'wrong-example' }, { ...property, not: {} },
    { ...property, readOnly: true }, { type: 'integer', example: 1 }]) {
    assert.equal(contract.classifyValue({ ...schema, properties: { input: replacement } }, value), 'invalid');
  }
  assert.equal(contract.classifyValue({ ...schema, enum: [{ input: 'other-value' }] }, value), 'invalid');
  assert.equal(contract.classifyValue({ type: 'object', properties: {
    a: property, b: { type: 'string', enum: ['different-value'] }
  } }, { a: '{{shared_fictional}}', b: '{{shared_fictional}}' }), 'invalid');
  assert.equal(contract.classifyValue({ type: 'string', minLength: 30 }, '{{bounded_witness}}'), 'valid');
  assert.equal(contract.classifyValue({ type: 'string', minLength: 4097 }, '{{outside_bound}}'), 'invalid');
});

test('bounded construction admits declared values but never invents unsupported source completions', () => {
  for (const [type, expected] of [['string', '{{body}}'], ['number', 0], ['boolean', false], ['array', []], ['object', {}]]) {
    assert.deepEqual(contract.normalizeValue({ type }, undefined), expected);
  }
  for (const schema of [{ type: 'object', required: ['id'], minProperties: 1 },
    { required: ['id'], allOf: [{}] }, { required: ['id'], anyOf: [{}] },
    { required: ['id'], properties: { id: { example: 'fictional', not: {} } } }]) {
    const op = operation('application/json', { schema });
    assert.throws(() => contract.normalize(json({}), op), /cannot be represented safely/u);
  }
});
