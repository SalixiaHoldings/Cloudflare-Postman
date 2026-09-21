import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import Ajv from 'ajv-draft-04';
import addFormats from 'ajv-formats';
import { createBodyContract, CONFLICT_BODY_WARNING, hasBodySentinel } from '../src/request-body.mjs';
import { stringCandidates } from '../src/request-construction.mjs';
import cases from './fixtures/request-body-construction-cases.json' with { type: 'json' };
import { fetchPinnedSchema } from '../src/upstream.mjs';
import { listOperations, subsetSchema } from '../src/openapi.mjs';
import { classifyOperations, loadPartitionConfig } from '../src/partition.mjs';
import { convert } from '../src/postman.mjs';

const contract = createBodyContract({ openapi: '3.0.3' });
const ajv = new Ajv({ strict: false }); addFormats(ajv);
const sentinel = { value: '<Error: Too many levels of nesting to fake this schema>' };
const op = (schema, media = 'application/json', extra = {}) => ({ key: 'POST /fictional-construction',
  path: '/fictional-construction', methodLower: 'post', operation: { requestBody: { required: true,
    content: { [media]: { schema, ...extra } } } } });
const json = value => ({ description: '', body: { mode: 'raw', options: { raw: { language: 'json' } }, raw: JSON.stringify(value) } });
const form = rows => ({ description: '', body: { mode: 'formdata', formdata: rows } });

for (const name of ['label', 'password', 'id']) test(`required ${name} becomes an unresolved variable, not a fabricated string`, () => {
  const schema = { type: 'object', required: [name], properties: { [name]: { type: 'string', minLength: 1 } } };
  const value = contract.normalizeValue(schema, { [name]: sentinel });
  assert.deepEqual(value, { [name]: `{{${name}}}` });
  assert.equal(contract.classifyValue(schema, value), 'valid');
  assert.equal(contract.validateValue(schema, { [name]: '' }), false);
});

test('valid converter values win; examples precede defaults and enums across allOf', () => {
  const schema = { allOf: [{ type: 'string', default: 'fictional-default', enum: ['fictional-example', 'fictional-default'] },
    { type: 'string', example: 'fictional-example' }] };
  assert.equal(contract.normalizeValue(schema, 'fictional-default'), 'fictional-default');
  assert.equal(contract.normalizeValue(schema, undefined), 'fictional-example');
  assert.equal(contract.normalizeValue({ anyOf: [{ type: 'number', default: 3 },
    { type: 'string', example: 'fictional-example' }] }, undefined), 'fictional-example');
  assert.equal(contract.normalizeValue({ anyOf: [{ type: 'number', enum: [3] },
    { type: 'string', default: 'fictional-default' }] }, undefined), 'fictional-default');
  const request = json({});
  contract.normalize(request, op({ type: 'object', required: ['label'], properties: { label: { type: 'string', default: 'fictional-default' } } },
    'application/json', { example: { label: 'fictional-media-example' } }));
  assert.deepEqual(JSON.parse(request.body.raw), { label: 'fictional-media-example' });
});

for (const schema of [
  { type: 'string', minLength: 20, maxLength: 25 },
  { type: 'string', pattern: '^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$' },
  { type: 'string', pattern: '^[a-zA-Z0-9_-]+$', minLength: 1, maxLength: 64 },
  { type: 'string', format: 'uuid' }, { type: 'string', format: 'uri', maxLength: 2048 }
]) test(`bounded non-emitted string witness: ${JSON.stringify(schema)}`, () => {
  const candidate = stringCandidates([schema]).find(value => ajv.compile(schema)(value));
  assert.notEqual(candidate, undefined);
  assert.equal(contract.normalizeValue(schema, undefined), '{{body}}');
  assert.equal(contract.validateValue(schema, '{{body}}'), true);
});

test('unsupported or impossible string constraints fail closed', () => {
  for (const schema of [{ type: 'string', pattern: '^fictional-unimplemented$' },
    { type: 'string', format: 'fictional-format' }, { type: 'string', minLength: 5, maxLength: 2 },
    { type: 'string', not: {} }, { type: 'string', maxLength: 0 }]) {
    assert.throws(() => contract.normalizeValue(schema, undefined), /cannot be represented/u);
  }
});

test('repeated variable witnesses are coherent even when braces pass literal length checks', () => {
  const schema = { type: 'object', properties: { a: { type: 'string', enum: ['fictional-a'] },
    b: { type: 'string', enum: ['fictional-b'] } } };
  assert.equal(contract.validateValue(schema, { a: '{{shared}}', b: '{{shared}}' }), false);
  const same = { type: 'object', properties: { a: { type: 'string', minLength: 20 }, b: { type: 'string', maxLength: 10 } } };
  assert.equal(contract.validateValue(same, { a: '{{shared}}', b: '{{shared}}' }), false);
});

test('required object/array construction is minimal and prunes read-only children', () => {
  const schema = { type: 'object', required: ['child'], properties: { child: { type: 'object', required: ['items', 'server'], properties: {
    items: { type: 'array', minItems: 2, maxItems: 2, items: { type: 'object', required: ['id'], properties: {
      id: { type: 'string' }, optional: { type: 'string', example: 'fictional-optional' } } } },
    server: { type: 'string', readOnly: true }, optional: { type: 'boolean', default: true }
  } } } };
  const value = contract.normalizeValue(schema, undefined);
  assert.deepEqual(value, { child: { items: [{ id: '{{child__items__0__id}}' }, { id: '{{child__items__1__id}}' }] } });
  assert.equal(contract.validateValue(schema, value), true);
  assert.equal(contract.validateValue(schema, { child: { items: [] } }), false);
  assert.deepEqual(contract.normalizeValue({ type: 'object', minProperties: 1, maxProperties: 1,
    properties: { first: { type: 'string' }, second: { type: 'boolean' } } }, undefined), { first: '{{first}}' });
});

test('recursive source schemas use finite terminating branches and required-only cycles fail closed', () => {
  const node = { type: 'object', properties: { next: { $ref: '#/components/schemas/Node' } } };
  const c = createBodyContract({ openapi: '3.0.3', components: { schemas: { Node: node } } });
  assert.deepEqual(c.normalizeValue(node, undefined), {});
  const recursive = { type: 'object', required: ['next'], properties: { next: { $ref: '#/components/schemas/Cycle' } } };
  const cycle = createBodyContract({ openapi: '3.0.3', components: { schemas: { Cycle: recursive } } });
  assert.throws(() => cycle.normalizeValue(recursive, undefined), /recursion|safety bound|cannot be represented/u);
});

test('required array composition retains only the independently proven overlapping-oneOf exception', () => {
  const item = { oneOf: [{ type: 'object', required: ['name'], properties: { name: { type: 'string' } } },
    { type: 'object', required: ['name'], properties: { name: { type: 'string' } } }] };
  const schema = { type: 'array', minItems: 1, items: item };
  const value = contract.normalizeValue(schema, undefined);
  assert.equal(contract.classifyValue(schema, value), 'ambiguous-oneOf');
  assert.equal(contract.validateValue(schema, value, { compatibility: false }), false);
  assert.throws(() => contract.normalizeValue({ ...schema, maxItems: 0 }, undefined), /cannot be represented/u);
});

test('boolean candidates prefer false, reject an invalid source example, and honor constraints', () => {
  assert.equal(contract.normalizeValue({ type: 'boolean', example: 'false' }, undefined), false);
  assert.equal(contract.normalizeValue({ type: 'boolean', not: { enum: [false] } }, undefined), true);
  assert.equal(contract.normalizeValue({ type: 'boolean', default: true }, undefined), true);
  assert.throws(() => contract.normalizeValue({ type: 'boolean', not: {} }, undefined), /cannot be represented/u);
});

for (const schema of [
  { type: 'integer', minimum: 5, maximum: 9, multipleOf: 2 },
  { type: 'integer', minimum: 5, exclusiveMinimum: true, maximum: 7, exclusiveMaximum: true },
  { type: 'integer', minimum: -9, maximum: -3, multipleOf: 2 },
  { type: 'number', minimum: 0.1, maximum: 0.9, exclusiveMinimum: true, exclusiveMaximum: true, multipleOf: 0.25 },
  { type: 'number', minimum: 0, maximum: 0.1, exclusiveMinimum: true, exclusiveMaximum: true },
  { allOf: [{ type: 'integer', minimum: 3 }, { maximum: 9, multipleOf: 2 }] }
]) test(`bounded numeric construction respects independent Ajv: ${JSON.stringify(schema)}`, () => {
  const result = contract.normalizeValue(schema, undefined);
  assert.equal(typeof result, 'number');
  assert.equal(ajv.compile(schema)(result), true);
});

test('impossible numeric intervals and integral multiples fail closed', () => {
  for (const schema of [{ type: 'number', minimum: 2, maximum: 1 },
    { type: 'integer', minimum: 0, maximum: 1, exclusiveMinimum: true, exclusiveMaximum: true },
    { type: 'integer', minimum: 3, maximum: 3, multipleOf: 2 }, { type: 'number', not: {} }]) {
    assert.throws(() => contract.normalizeValue(schema, undefined), /cannot be represented/u);
  }
});

const binaryArraySchema = { type: 'object', required: ['metadata', 'files'], properties: {
  metadata: { type: 'object', required: ['main_module'], properties: { main_module: { type: 'string', example: 'fictional.js' } } }
}, additionalProperties: { type: 'array', minItems: 2, maxItems: 2, items: { type: 'string', format: 'binary' } } };

test('multipart binary arrays construct empty file rows and decode repeats as array elements', () => {
  const request = form([{ key: 'metadata', type: 'text', value: JSON.stringify({ main_module: sentinel }) },
    { key: 'files', type: 'text', value: JSON.stringify([sentinel]) }]);
  const operation = op(binaryArraySchema, 'multipart/form-data');
  assert.equal(contract.normalize(request, operation).classification, 'valid');
  assert.deepEqual(request.body.formdata, [{ key: 'metadata', type: 'text', value: '{"main_module":"fictional.js"}' },
    { key: 'files', type: 'file', src: '' }, { key: 'files', type: 'file', src: '' }]);
  assert.equal(contract.validate(request, operation).classification, 'valid');
  request.body.formdata.pop();
  assert.throws(() => contract.validate(request, operation), /violates/u);
});

test('binary file placeholders never bypass item, cardinality, content, or root impossibility', () => {
  for (const modification of [{ items: { type: 'string', format: 'binary', not: {} } },
    { items: { type: 'string', format: 'binary', minLength: 1 } }, { maxItems: 0 }, { uniqueItems: true }]) {
    const schema = { ...binaryArraySchema, additionalProperties: { ...binaryArraySchema.additionalProperties, ...modification } };
    for (const method of ['normalize', 'validate']) assert.throws(() => contract[method](form([
      { key: 'metadata', type: 'text', value: '{"main_module":"fictional.js"}' }, { key: 'files', type: 'file', src: '' }
    ]), op(schema, 'multipart/form-data')), /cannot|violates|uniqueItems/u);
  }
  assert.throws(() => contract.normalize(form([]), op({ ...binaryArraySchema, not: {} }, 'multipart/form-data')), /cannot|violates/u);
});

const revision = { commit: cases.upstreamCommit, schemaSha256: cases.schemaSha256 };
const conflict = createBodyContract({ openapi: '3.0.3' }, revision);
const shape = { type: 'string', properties: { notification_email: { type: 'string' } } };

test('source-conflict preserves safe primary bytes, records exact source paths/revision, and requires its warning', () => {
  const request = json({ notification_email: '' }), original = request.body.raw;
  const result = conflict.normalize(request, op(shape));
  assert.equal(result.classification, 'source-conflict');
  assert.equal(request.body.raw, original);
  assert.ok(request.description.startsWith(CONFLICT_BODY_WARNING));
  assert.match(result.issues[0].schemaPath, /\/schema\/type$/u);
  assert.equal(result.issues[0].upstreamCommit, cases.upstreamCommit);
  assert.deepEqual(conflict.validate(request, op(shape)), result);
  request.description = '';
  assert.throws(() => conflict.validate(request, op(shape)), /missing source-conflict/u);
  assert.throws(() => contract.normalize(json({ notification_email: '' }), op(shape)), /revision review/u);
  assert.throws(() => createBodyContract({ openapi: '3.0.3' }, { ...revision, schemaSha256: '0'.repeat(64) })
    .normalize(json({ notification_email: '' }), op(shape)), /digest review/u);
});

test('source-conflict cannot retain sentinels/read-only leakage or rescue other errors', () => {
  for (const value of [{ notification_email: sentinel }, { notification_email: 1 }, { unknown: '' }, null, {}]) {
    assert.throws(() => conflict.normalize(json(value), op(shape)), /source-conflict|Source-conflict/u);
  }
  const metadataSentinel = json({ notification_email: '' });
  metadataSentinel.body.options.raw.extra = sentinel;
  assert.throws(() => conflict.normalize(metadataSentinel, op(shape)), /Converter error sentinel/u);
  const readonly = { ...shape, properties: { notification_email: { type: 'string', readOnly: true } } };
  assert.throws(() => conflict.normalize(json({ notification_email: '' }), op(readonly)), /source-conflict/u);
  assert.equal(conflict.normalize(json({ notification_email: '' }), op({ ...shape, example: 'fictional-source' })).classification, 'valid');
  for (const schema of [{ ...shape, not: {} }, { ...shape, enum: [] }]) assert.throws(() => conflict.normalize(json({ notification_email: '' }), op(schema)));
  assert.equal(conflict.normalize(json({ label: sentinel }), op({ type: 'object', required: ['label'], properties: { label: { type: 'string' } } })).classification, 'valid');
});

test('all 56 inventoried failures have explicit outcomes from fresh primary conversion of the pinned partitions', async () => {
  const { destination, lock } = await fetchPinnedSchema();
  assert.equal(lock.commit, cases.upstreamCommit); assert.equal(lock.schema.sha256, cases.schemaSha256);
  const document = JSON.parse(await readFile(destination)), config = await loadPartitionConfig();
  const { assignments } = classifyOperations(listOperations(document), config);
  const wanted = new Map(cases.cases.map(c => [c.operation, c.expected])), seen = new Set(), counts = {};
  assert.equal(wanted.size, 56);
  const walk = items => items.flatMap(item => item.item ? walk(item.item) : [item]);
  for (const partition of config.partitions) {
    const operations = assignments.get(partition.id), byKey = new Map(operations.map(o => [o.key, o]));
    const subset = subsetSchema(document, partition, operations), c = createBodyContract(subset, revision);
    const { collection } = await convert(structuredClone(subset));
    for (const { request } of walk(collection.item)) {
      const key = request.method + ' /' + request.url.path.map(s => s.replace(/^:([^/]+)$/u, '{$1}')).join('/');
      if (!wanted.has(key)) continue;
      assert.ok(!seen.has(key)); seen.add(key);
      request.description = '';
      const result = c.normalize(request, byKey.get(key));
      assert.equal(result.classification, wanted.get(key), key);
      assert.deepEqual(c.validate(request, byKey.get(key)), result, key);
      assert.equal(hasBodySentinel(request.body), false, key);
      counts[result.classification] = (counts[result.classification] ?? 0) + 1;
    }
  }
  assert.equal(seen.size, 56);
  assert.deepEqual(counts, { valid: 52, 'ambiguous-oneOf': 2, 'source-conflict': 2 });
});

test('bounded whole-request retries reject the first primitive choice before accepting another', () => {
  const schema = { type: 'object', required: ['enabled'], properties: { enabled: { type: 'boolean' } },
    not: { properties: { enabled: { enum: [false] } }, required: ['enabled'] } };
  assert.deepEqual(contract.normalizeValue(schema, undefined), { enabled: true });
  const array = { type: 'array', minItems: 2, maxItems: 2, uniqueItems: true, items: { type: 'integer' } };
  const value = contract.normalizeValue(array, undefined);
  assert.equal(ajv.compile(array)(value), true);
  assert.deepEqual(value, [0, 1]);
});

test('existing privacy variables in permissive maps have witnesses without constructing unknown required values', () => {
  const schema = { type: 'object', properties: { credentials: { type: 'object', additionalProperties: true } } };
  assert.equal(contract.validateValue(schema, { credentials: { access_token: '{{access_token}}' } }), true);
  assert.throws(() => contract.normalizeValue({ type: 'object', required: ['unknown'] }, undefined), /cannot be represented/u);
  assert.equal(contract.validateValue({ type: 'object', additionalProperties: { not: { type: 'string' } } }, { key: '{{key}}' }), false);
});
