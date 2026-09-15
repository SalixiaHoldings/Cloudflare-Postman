import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { listOperations } from '../src/openapi.mjs';
import {
  createBootstrapCollection,
  createTemplateEnvironment,
  resolveUniqueResource,
  runBootstrapFixtures
} from '../src/chaining.mjs';
import { ROOT } from '../src/constants.mjs';

async function fixture(name) {
  return JSON.parse(await readFile(path.join(ROOT, 'tests', 'fixtures', name), 'utf8'));
}

test('fixture-backed bootstrap resolves and persists explicit account and unique zone IDs', async () => {
  const variables = runBootstrapFixtures({
    token: await fixture('token-active.json'),
    accounts: await fixture('accounts.json'),
    zones: await fixture('zones.json'),
    variables: { account_name: 'Example B' }
  });
  assert.equal(variables.account_id, 'fixture-account-b');
  assert.equal(variables.zone_id, 'fixture-zone-a');
});

test('resource resolution fails closed on ambiguity and empty results', () => {
  assert.throws(
    () => resolveUniqueResource([{ id: 'a' }, { id: 'b' }], { label: 'Account' }),
    /ambiguous/u
  );
  assert.throws(() => resolveUniqueResource([], { label: 'Zone' }), /no matches/u);
});

async function bootstrapCollection() {
  return createBootstrapCollection({ commit: 'a'.repeat(40), schemaSha256: 'b'.repeat(64), operations: listOperations(await fixture('auth-openapi.json')) });
}

test('bootstrap collection uses schema-aware authentication and fail-closed resolution scripts', async () => {
  const collection = await bootstrapCollection();
  assert.equal(collection.auth.type, 'bearer');
  assert.equal(collection.auth.bearer[0].value, '{{api_token}}');
  assert.equal(collection.item.length, 3);
  assert.equal(collection.item[1].request.auth.type, 'noauth');
  assert.deepEqual(collection.item[1].request.header.map((header) => header.key), ['X-Auth-Email', 'X-Auth-Key']);
  assert.equal(collection.item[2].request.auth.type, 'bearer');
  const scripts = collection.item.flatMap((item) => item.event.flatMap((event) => event.script.exec)).join('\n');
  assert.match(scripts, /pm\.execution\.setNextRequest\(null\)/u);
  assert.match(scripts, /pm\.environment\.set\('account_id'/u);
  assert.match(scripts, /pm\.environment\.set\('zone_id'/u);
});

// Run the emitted scripts, with Postman's local/environment/collection precedence and routing.
async function runGeneratedBootstrap({ accounts, zones, variables = {}, code = 200 }) {
  const collection = await bootstrapCollection();
  // Simulate Postman import assigning new IDs; forward transitions must not use export-time IDs.
  collection.item.forEach((item, index) => { item.id = `runtime-fixture-${index}`; });
  const local = new Map();
  const environment = new Map(Object.entries(variables));
  const collectionVariables = new Map(collection.variable.map(({ key, value }) => [key, value]));
  const scope = (map) => ({ get: (key) => map.get(key), set: (key, value) => map.set(key, value), unset: (key) => map.delete(key) });
  const calls = [];
  const run = async () => {
    let next = collection.item[0].id;
    for (let budget = 0; next !== null; budget += 1) {
      assert.ok(budget < 10, 'fixture runner loop exceeded request budget');
      const item = collection.item.find((entry) => entry.id === next || entry.name === next);
      assert.ok(item, 'setNextRequest targets an existing request ID or unique name');
      const pm = {
        variables: { ...scope(local), get: (key) => local.has(key) ? local.get(key) : environment.has(key) ? environment.get(key) : collectionVariables.get(key) },
        environment: scope(environment), collectionVariables: scope(collectionVariables),
        info: { requestId: item.id }, execution: { setNextRequest: (id) => { next = id; } }
      };
      const execute = (listen) => item.event.filter((event) => event.listen === listen).forEach((event) => vm.runInNewContext(event.script.exec.join('\n'), { pm }, { timeout: 1000 }));
      execute('prerequest');
      const path = item.request.url.path.join('/');
      const page = Number(pm.variables.get(path === 'accounts' ? '_cf_bootstrap_account_page' : '_cf_bootstrap_zone_page'));
      calls.push({ path, page });
      const response = path === 'accounts' ? accounts[page - 1] : path === 'zones' ? zones[page - 1] : await fixture('token-active.json');
      if (path === 'zones') assert.equal(pm.variables.get('account_id'), environment.get('account_id'));
      pm.response = { code, json: () => { if (response === 'invalid-json') throw new Error('Invalid JSON'); return structuredClone(response); } };
      try { execute('test'); } catch (error) { assert.equal(next, null, 'failure must stop the runner'); throw error; }
    }
    return { environment, calls, local };
  };
  return run();
}

function singlePage(result) {
  return [{ success: true, result, result_info: { page: 1, per_page: 50, total_pages: 1, total_count: result.length, count: result.length } }];
}

test('generated runner resolves ID and name selectors beyond page 1 for accounts and zones', async () => {
  for (const selector of ['id', 'name']) {
    const pages = await fixture('resource-pages.json');
    if (selector === 'id') pages[1].result[0].name = pages[0].result[0].name;
    const value = selector === 'id' ? 'fixture-resource-51' : 'Example 51';
    const result = await runGeneratedBootstrap({ accounts: pages, zones: pages, variables: { [`account_${selector}`]: value, [`zone_${selector}`]: value } });
    assert.equal(result.environment.get('account_id'), 'fixture-resource-51');
    assert.equal(result.environment.get('zone_id'), 'fixture-resource-51');
    assert.deepEqual(result.calls.map(({ page }) => page), [1, 1, 2, 1, 2]);
    assert.equal(result.local.has('_cf_bootstrap_account_state'), false);
    assert.equal(result.local.has('_cf_bootstrap_zone_state'), false);
  }
});

test('generated runner rejects cross-page ambiguous names, no selector, and empty or missing matches', async () => {
  const unique = singlePage([{ id: 'fixture-one', name: 'Unique' }]);
  for (const resource of ['accounts', 'zones']) {
    const prefix = resource === 'accounts' ? 'account' : 'zone';
    const base = { accounts: unique, zones: unique };
    const pages = await fixture('resource-pages.json');
    pages[1].result[0].name = pages[0].result[0].name;
    await assert.rejects(runGeneratedBootstrap({ ...base, [resource]: pages, variables: { [`${prefix}_name`]: 'Example 1' } }), /ambiguous/u);
    await assert.rejects(runGeneratedBootstrap({ ...base, [resource]: pages }), /ambiguous/u);
    await assert.rejects(runGeneratedBootstrap({ ...base, [resource]: pages, variables: { [`${prefix}_id`]: 'missing-fixture-id' } }), /no matches/u);
    await assert.rejects(runGeneratedBootstrap({ ...base, [resource]: singlePage([]) }), /no matches/u);
  }
  const result = await runGeneratedBootstrap({ accounts: unique, zones: unique });
  assert.equal(result.environment.get('zone_id'), 'fixture-one');
});

test('generated runner fails closed on malformed/repeated/changing pages and bounded loops', async () => {
  const unique = singlePage([{ id: 'fixture-one' }]);
  const mutations = [
    (pages) => { pages[0].result_info.total_pages = 1001; },
    (pages) => { pages[1].result_info.page = 1; },
    (pages) => { pages[1].result_info.total_pages = 3; },
    (pages) => { pages[1].result[0].id = pages[0].result[0].id; },
    (pages) => { delete pages[0].result_info; },
    (pages) => { pages[1].result_info.total_count = 52; },
    (pages) => { pages[0] = 'invalid-json'; }
  ];
  for (const mutate of mutations) {
    const pages = await fixture('resource-pages.json'); mutate(pages);
    await assert.rejects(runGeneratedBootstrap({ accounts: pages, zones: unique }), /pagination|Pagination|repeated|Invalid JSON/u);
  }
  await assert.rejects(runGeneratedBootstrap({ accounts: unique, zones: unique, code: 401 }), /Token verification/u);
});

test('template environment contains only empty secret and identifier values', () => {
  const environment = createTemplateEnvironment();
  const values = new Map(environment.values.map((entry) => [entry.key, entry]));
  for (const key of ['api_token', 'api_email', 'api_key', 'user_service_key']) {
    assert.equal(values.get(key).type, 'secret');
    assert.equal(values.get(key).value, '');
  }
  assert.equal(values.get('account_id').value, '');
  assert.equal(values.get('zone_id').value, '');
});
