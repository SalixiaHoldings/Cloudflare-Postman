import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { convert, generateCollection } from '../src/postman.mjs';
import { generateV2 } from '../src/generate.mjs';
import { createRequestBodySource } from '../src/request-body-source.mjs';
import { sha256 } from '../src/io.mjs';
import { createBodyContract, hasBodySentinel } from '../src/request-body.mjs';
import { listOperations, subsetSchema } from '../src/openapi.mjs';
import { fetchPinnedSchema } from '../src/upstream.mjs';

const sentinel = { value: '<Error: Too many levels of nesting to fake this schema>' };
const contract = createBodyContract({ openapi: '3.0.3' });
const walk = items => items.flatMap(item => item.item ? walk(item.item) : [item]);

function fixture() {
  return { openapi: '3.0.3', info: { title: 'Fictional conversion isolation', version: '1' },
    paths: Object.fromEntries(['/fictional-first', '/fictional-second'].map(path => [path, { post: {
      parameters: [{ in: 'query', name: 'fictional_limit', schema: { type: 'integer', default: 7 } },
        { in: 'header', name: 'X-Fictional-Count', schema: { type: 'integer' } }],
      requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/Values' } } } },
      responses: { 200: { description: 'Fictional response', content: {
        'application/json': { schema: { $ref: '#/components/schemas/Values' } }
      } } }
    } }])), components: { schemas: { Values: { type: 'array', items: { type: 'string' },
      example: ['fictional-one', 'fictional-two', 'fictional-three'] } } } };
}

test('pristine body authority survives converter mutation and partition order for identical inputs', async () => {
  const original = fixture(), input = [sentinel, sentinel];
  const expected = createBodyContract(original).normalizeValue(original.components.schemas.Values, input);
  for (const order of [[0, 1], [1, 0]]) {
    const source = createRequestBodySource(JSON.stringify(original));
    const before = sha256(JSON.stringify(source.document));
    const working = structuredClone(original), operations = listOperations(working);
    for (const index of order) {
      const partition = { title: 'Fictional partition', description: '' };
      await convert(subsetSchema(working, partition, [operations[index]]));
      const view = subsetSchema(source.document, partition, [operations[index]]);
      const after = createBodyContract(view).normalizeValue(view.components.schemas.Values, input);
      assert.deepEqual(after, expected, 'same input must retain pristine example/cardinality after either partition');
      assert.equal(sha256(JSON.stringify(source.document)), before);
      source.assertUnchanged();
    }
    assert.notDeepEqual(working, original, 'broader converter mutation is deliberately outside this correction');
    assert.deepEqual(source.document, original);
    assert.ok(Object.isFrozen(source.document.components.schemas.Values.example));
    assert.throws(() => { source.document.components.schemas.Values.maxItems = 2; }, TypeError);
  }
});

test('body authority isolation preserves complete non-body output across shared converter partitions', async () => {
  const original = fixture(), source = createRequestBodySource(JSON.stringify(original));
  const legacy = structuredClone(original), revised = structuredClone(original);
  const stripBodies = collection => {
    const result = structuredClone(collection);
    for (const item of walk(result.item)) {
      delete item.request.body;
      for (const response of item.response ?? []) delete response.originalRequest.body;
    }
    return result;
  };
  for (let index = 0; index < 2; index++) {
    const partition = { id: `fictional-${index}`, title: `Fictional ${index}`, description: '' };
    const oldOperations = [listOperations(legacy)[index]], operations = [listOperations(revised)[index]];
    const context = { partition, commit: 'a'.repeat(40), schemaSha256: 'b'.repeat(64) };
    const before = await generateCollection(subsetSchema(legacy, partition, oldOperations), {
      ...context, operations: oldOperations
    });
    const after = await generateCollection(subsetSchema(revised, partition, operations), {
      ...context, operations, requestBodySchema: subsetSchema(source.document, partition, operations)
    });
    assert.deepEqual(stripBodies(after.collection), stripBodies(before.collection),
      'responses, queries, headers, URLs, auth, and all other fields must retain existing converter behavior');
    assert.deepEqual(revised, legacy, 'authority isolation must not change the converter working graph');
  }
  assert.deepEqual(source.document, original);
  source.assertUnchanged();
});

test('composed object intent rejects scalar child annotations without changing Ajv semantics', () => {
  for (const annotation of [{ default: 'off' }, { default: [] }, { example: 'off' }, { enum: ['off'] }]) {
    const schema = { allOf: [{ properties: { id: { type: 'string', example: 'fictional-setting' } }, required: ['id'] },
      { ...annotation, properties: { value: { type: 'string', example: 'on' } } }] };
    assert.equal(contract.validateValue(schema, 'off'), true);
    if (annotation.enum) assert.throws(() => contract.normalizeValue(schema, sentinel), /cannot be represented/u);
    else assert.deepEqual(contract.normalizeValue(schema, sentinel), { id: 'fictional-setting' });
  }
  const cardinality = { allOf: [{ minProperties: 1 }, { default: false,
    properties: { enabled: { type: 'boolean' } } }] };
  assert.deepEqual(contract.normalizeValue(cardinality, sentinel), { enabled: false });
  // The pin also has explicit arrays with inapplicable object keywords. Their
  // declared container type must not be reinterpreted as an untyped object.
  const array = { type: 'array', required: ['id'], items: { type: 'object', required: ['id'],
    properties: { id: { type: 'string', example: 'fictional-id' } } } };
  assert.deepEqual(contract.normalizeValue(array, [sentinel]), [{ id: 'fictional-id' }]);
});

test('complete authoritative scalar examples remain usable when the entire schema permits them', () => {
  const schema = { example: 'fictional-complete', allOf: [{ properties: { id: { type: 'string' } }, required: ['id'] }] };
  assert.equal(contract.normalizeValue(schema, sentinel), 'fictional-complete');
  const typed = { anyOf: [{ type: 'object' }, { type: 'string', example: 'fictional-scalar' }] };
  assert.equal(contract.normalizeValue(typed, undefined), 'fictional-scalar');
});

function union(secret = { type: 'string' }, keyword = 'oneOf') {
  return { [keyword]: [
    { type: 'object', additionalProperties: false, required: ['credentials'], properties: {
      credentials: { type: 'object', required: ['label', 'secret'], properties: {
        label: { type: 'string' }, secret
      } }
    } },
    { type: 'object', additionalProperties: false, required: ['token'], properties: {
      token: { type: 'string', example: 'fictional-token' }
    } }
  ] };
}
const wrapped = (config, required = false) => ({ type: 'object', properties: { config }, ...(required ? { required: ['config'] } : {}) });
const footprint = { config: { credentials: { label: 'fictional-label', secret: sentinel } } };

test('optional unions complete the recognizable branch without manufacturing a different alternative', () => {
  for (const keyword of ['oneOf', 'anyOf']) {
    const schema = wrapped(union({ type: 'string' }, keyword));
    assert.deepEqual(contract.normalizeValue(schema, footprint), {
      config: { credentials: { label: 'fictional-label', secret: '{{config__credentials__secret}}' } }
    });
    const unsafe = union({ type: 'string', format: 'fictional-unsupported' }, keyword);
    assert.deepEqual(contract.normalizeValue(wrapped(unsafe), footprint), {});
    assert.throws(() => contract.normalizeValue(wrapped(unsafe, true), footprint), /cannot be represented/u);
    assert.deepEqual(contract.normalizeValue(wrapped(unsafe), { config: sentinel }), {});
  }
});

test('already valid overlapping union input retains the existing ambiguity policy', () => {
  const schema = wrapped({ oneOf: [
    { type: 'object', properties: { label: { type: 'string' } } },
    { type: 'object', properties: { label: { type: 'string' } } }
  ] });
  const input = { config: { label: 'fictional-label' } };
  assert.deepEqual(contract.normalizeValue(schema, input), input);
  assert.equal(contract.classifyValue(schema, input), 'ambiguous-oneOf');
});

test('optional unions use only exact-schema authority without a primary footprint', () => {
  assert.deepEqual(contract.normalizeValue(wrapped({ example: {}, oneOf: [
    { type: 'object', maxProperties: 0 }, { type: 'string' }
  ] }), { config: sentinel }), { config: {} });
  for (const keyword of ['oneOf', 'anyOf']) {
    const example = { token: 'fictional-exact' };
    for (const annotation of [{ example }, { default: example }, { enum: [example] }]) {
      const schema = { ...union({ type: 'string' }, keyword), ...annotation };
      const referenced = createBodyContract({ openapi: '3.0.3', components: { schemas: { Config: schema } } });
      assert.deepEqual(referenced.normalizeValue(wrapped({ $ref: '#/components/schemas/Config' }), { config: sentinel }), { config: example });
      const valid = { config: { token: 'fictional-primary' } };
      if (!annotation.enum) assert.deepEqual(contract.normalizeValue(wrapped(schema), valid), valid);
    }
    const branchOnly = union({ type: 'string' }, keyword);
    branchOnly[keyword][1].example = example;
    branchOnly[keyword][1].default = example;
    assert.deepEqual(contract.normalizeValue(wrapped(branchOnly), { config: sentinel }), {});
    branchOnly.example = example;
    assert.deepEqual(contract.normalizeValue(wrapped(branchOnly), footprint), {
      config: { credentials: { label: 'fictional-label', secret: '{{config__credentials__secret}}' } }
    }, 'exact annotation must not override surviving branch affinity');
  }
});

test('optional authoritative candidates must be writable and pass the complete containing request', () => {
  const config = { ...union(), example: { token: 'fictional-rejected' }, default: { token: 'fictional-accepted' } };
  const schema = { ...wrapped(config), properties: { ...wrapped(config).properties, label: { type: 'string' } },
    not: { required: ['config'], properties: { config: { properties: { token: { enum: ['fictional-rejected'] } }, required: ['token'] } } } };
  const input = { label: 'fictional-survivor', config: sentinel };
  assert.deepEqual(contract.normalizeValue(schema, input), { label: 'fictional-survivor', config: config.default });
  delete config.default;
  assert.deepEqual(contract.normalizeValue(schema, input), { label: 'fictional-survivor' });
  config.example = { token: 'fictional-readonly' };
  config.oneOf[1].properties.token.readOnly = true;
  assert.deepEqual(contract.normalizeValue(schema, input), { label: 'fictional-survivor' });
});

test('single-alternative optional unions construct safely and omit only when construction fails', () => {
  for (const keyword of ['oneOf', 'anyOf']) {
    const config = { [keyword]: [{ type: 'object', required: ['type', 'id'], properties: {
      type: { type: 'string', enum: ['fictional-kind'] }, id: { type: 'string' }
    } }] };
    assert.deepEqual(contract.normalizeValue(wrapped(config), { config: sentinel }), {
      config: { type: 'fictional-kind', id: '{{config__id}}' }
    });
    config[keyword][0].properties.id.format = 'fictional-unsupported';
    assert.deepEqual(contract.normalizeValue(wrapped(config), { config: sentinel }), {});
    assert.throws(() => contract.normalizeValue(wrapped(config, true), { config: sentinel }), /cannot be represented/u);
    config[keyword][0].example = { type: 'fictional-kind', id: 'fictional-source' };
    assert.deepEqual(contract.normalizeValue(wrapped(config), { config: sentinel }), { config: config[keyword][0].example });
  }
});

test('single-alternative optional construction also validates the enclosing request', () => {
  const config = { oneOf: [{ type: 'object', required: ['kind'], properties: { kind: { enum: ['fictional-only'] } } }] };
  const schema = { ...wrapped(config), not: { required: ['config'] } };
  assert.deepEqual(contract.normalizeValue(schema, { config: sentinel }), {});
});

test('exact optional union examples still pass through credential sanitization', async () => {
  const config = { example: { client_secret: 'fictional-example-secret' }, oneOf: [
    { type: 'object', required: ['client_secret'], properties: { client_secret: { type: 'string' } } },
    { type: 'object', required: ['alternative'], properties: { alternative: { type: 'boolean' } } }
  ] };
  const working = fixture(), authority = structuredClone(working);
  // Deliberately unsafe working input exercises the production privacy pass
  // after the pristine request authority restores its exact component example.
  working.components.schemas.Values = wrapped({ example: sentinel, type: 'object' });
  authority.components.schemas.Values = wrapped(config);
  const operations = listOperations(working), partition = { id: 'fictional', title: 'Fictional', description: '' };
  const result = await generateCollection(working, { partition, operations, commit: 'a'.repeat(40), schemaSha256: 'b'.repeat(64), requestBodySchema: authority });
  for (const item of walk(result.collection.item)) assert.deepEqual(JSON.parse(item.request.body.raw), { config: { client_secret: '{{client_secret}}' } });
});

test('complete pinned generation preserves authority and all twelve reviewed operation corrections', async t => {
  const { destination, lock } = await fetchPinnedSchema();
  assert.equal(lock.commit, '49731bd0592b0c8c2c781b8d15d9f27c7293b210');
  const original = JSON.parse(await readFile(destination));
  const pristine = createBodyContract(original, { commit: lock.commit, schemaSha256: lock.schema.sha256 });
  const operations = listOperations(original);
  const wanted = new Set([
    'POST /accounts/{account_id}/email/routing/rules/plan',
    'POST /accounts/{account_id}/load_balancers',
    'PUT /accounts/{account_id}/load_balancers/{load_balancer_id}',
    'PATCH /zones/{zone_id}/settings',
    'POST /accounts/{account_id}/pipelines/v1/sinks',
    'PUT /accounts/{account_id}/devices/networks/{network_id}',
    'POST /accounts/{account_id}/devices/posture',
    'PUT /accounts/{account_id}/devices/posture/{rule_id}',
    'PATCH /accounts/{account_id}/devices/posture/integration/{integration_id}',
    'POST /accounts/{account_id}/event_subscriptions/subscriptions',
    'PATCH /accounts/{account_id}/event_subscriptions/subscriptions/{subscription_id}',
    'PATCH /accounts/{account_id}/vuln_scanner/target_environments/{target_environment_id}'
  ]);
  const temporary = await mkdtemp(path.join(os.tmpdir(), 'cloudflare-body-authority-'));
  try {
    // The production path freezes the full authority before conversion and
    // asserts its deterministic hash after every partition has been generated.
    const result = await generateV2({ outputRoot: temporary, schemaPath: destination, schemaLock: lock });
    const inputs = new Map();
    for (const partition of result.partitions) {
      const collection = JSON.parse(await readFile(path.join(temporary, partition.file)));
      for (const { request } of walk(collection.item)) {
        const key = request.method + ' /' + request.url.path.map(s => s.replace(/^\{\{([^{}]+)\}\}$/u, '{$1}')).join('/');
        if (wanted.has(key)) inputs.set(key, request);
      }
    }
    assert.equal(inputs.size, wanted.size);
    for (const [key, request] of inputs) await t.test(key, () => {
      assert.equal(hasBodySentinel(request.body), false);
      const value = JSON.parse(request.body.raw);
      if (key.includes('/email/routing/')) assert.deepEqual(value, original.components.schemas.email_account_rules_plan_request.example);
      else if (key.includes('/load_balancers')) assert.deepEqual(value.default_pools, original.components.schemas['load-balancing_default_pools'].example);
      else if (key.endsWith('/settings')) {
        assert.ok(value.length > 0);
        for (const setting of value) assert.ok(setting && typeof setting === 'object' && setting.id && Object.hasOwn(setting, 'value'));
      } else if (key.includes('/pipelines/')) {
        assert.equal(value.type, 'r2');
        assert.equal(Object.hasOwn(value, 'config'), false, 'unanchored optional config must not switch sink kind');
      } else if (key.includes('/devices/networks/')) {
        assert.equal(value.type, 'tls');
        assert.deepEqual(value.config, original.components.schemas['teams-devices_schemas-config_request'].example);
      } else if (key.includes('/posture/integration/')) {
        assert.equal(value.type, 'workspace_one');
        assert.deepEqual(value.config, { ...original.components.schemas['teams-devices_config_request'].example, client_secret: '{{client_secret}}' });
      } else if (key.includes('/devices/posture')) {
        assert.equal(value.type, 'file');
        assert.deepEqual(value.input, original.components.schemas['teams-devices_input'].example);
      } else if (key.includes('/event_subscriptions/')) {
        assert.deepEqual(value.destination, { type: 'queues.queue', queue_id: '{{destination__queue_id}}' });
      } else assert.deepEqual(value.target, { type: 'zone', zone_tag: original.components.schemas['vuln_scanner_zone-target'].properties.zone_tag.example });
      assert.equal(pristine.validate(request, operations.find(o => o.key === key)).classification,
        key.includes('/devices/posture') ? 'ambiguous-oneOf' : 'valid');
    });
  } finally { await rm(temporary, { recursive: true, force: true }); }
});
