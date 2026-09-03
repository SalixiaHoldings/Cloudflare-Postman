import { applyAuthentication, AUTH_VARIABLES } from './auth.mjs';

function requireSuccessfulEnvelope(envelope, label) {
  if (!envelope || envelope.success !== true || !Array.isArray(envelope.result)) {
    const errors = Array.isArray(envelope?.errors)
      ? envelope.errors.map((error) => error.message ?? JSON.stringify(error)).join('; ')
      : 'unexpected response envelope';
    throw new Error(`${label} failed: ${errors}`);
  }
  return envelope.result;
}

export function verifyTokenFixture(envelope) {
  if (!envelope || envelope.success !== true || envelope.result?.status !== 'active') {
    throw new Error('Token verification failed: the token is missing, invalid, or inactive.');
  }
  return envelope.result;
}

export function resolveUniqueResource(items, { id, name, label }) {
  let matches = items;
  if (id) matches = matches.filter((item) => item.id === id);
  if (!id && name) matches = matches.filter((item) => item.name === name);
  if (matches.length === 0) {
    throw new Error(`${label} resolution returned no matches. Set a valid ${label.toLowerCase()} ID or name.`);
  }
  if (matches.length > 1) {
    throw new Error(
      `${label} resolution is ambiguous (${matches.length} matches). Set an explicit ${label.toLowerCase()} ID or unique name.`
    );
  }
  return matches[0];
}

export function runBootstrapFixtures({ token, accounts, zones, variables = {} }) {
  verifyTokenFixture(token);
  const accountItems = requireSuccessfulEnvelope(accounts, 'Account listing');
  const account = resolveUniqueResource(accountItems, {
    id: variables.account_id,
    name: variables.account_name,
    label: 'Account'
  });
  const zoneItems = requireSuccessfulEnvelope(zones, 'Zone listing');
  const zone = resolveUniqueResource(zoneItems, {
    id: variables.zone_id,
    name: variables.zone_name,
    label: 'Zone'
  });
  return {
    ...variables,
    account_id: account.id,
    zone_id: zone.id
  };
}

// Self-contained so these exact functions can also execute in the Postman sandbox.
export function initialPageState(selectors) {
  return { page: 1, totalPages: null, totalCount: null, items: [], selectors };
}

export function acceptResourcePage(state, envelope) {
  if (envelope?.success !== true || !Array.isArray(envelope.result)) throw new Error('Invalid listing response envelope.');
  const info = envelope.result_info;
  if (!info || !Number.isInteger(info.page) || info.page !== state.page ||
      !Number.isInteger(info.total_pages) || info.total_pages < 0 || info.total_pages > 1000 ||
      (info.total_pages < state.page && !(state.page === 1 && info.total_pages === 0 && envelope.result.length === 0)) ||
      info.per_page !== 50 || envelope.result.length > 50 ||
      (info.count !== undefined && info.count !== envelope.result.length)) {
    throw new Error('Invalid pagination metadata or exceeded 1000-page bound.');
  }
  const totalCount = info.total_count ?? null;
  if (totalCount !== null && (!Number.isInteger(totalCount) || totalCount < 0)) throw new Error('Invalid pagination total count.');
  if (state.totalPages !== null && (state.totalPages !== info.total_pages || state.totalCount !== totalCount)) {
    throw new Error('Pagination totals changed during listing; retry the bootstrap.');
  }
  state.totalPages = info.total_pages;
  state.totalCount = totalCount;
  const seen = new Set(state.items.map((item) => item.id));
  for (const item of envelope.result) {
    if (!item || typeof item.id !== 'string' || !item.id || seen.has(item.id)) throw new Error('Invalid or repeated resource ID across pages.');
    seen.add(item.id);
    state.items.push({ id: item.id, name: item.name });
  }
  const done = state.page >= state.totalPages;
  if (!done && envelope.result.length === 0) throw new Error('Empty intermediate resource page.');
  if (done && state.totalCount !== null && state.totalCount !== state.items.length) throw new Error('Incomplete paginated result set.');
  if (!done) state.page += 1;
  return done;
}

function postmanResolveScript({ label, idVariable, stateVariable, pageVariable, nextRequest }) {
  return [
    acceptResourcePage.toString(),
    resolveUniqueResource.toString(),
    'try {',
    "  if (pm.response.code !== 200) throw new Error('Resource listing returned non-200 HTTP status.');",
    `  const state = JSON.parse(pm.variables.get('${stateVariable}'));`,
    '  const done = acceptResourcePage(state, pm.response.json());',
    '  if (!done) {',
    `    pm.variables.set('${stateVariable}', JSON.stringify(state));`,
    `    pm.variables.set('${pageVariable}', state.page);`,
    '    pm.execution.setNextRequest(pm.info.requestId);',
    '  } else {',
    `    const resolved = resolveUniqueResource(state.items, { ...state.selectors, label: '${label}' });`,
    `    pm.collectionVariables.set('${idVariable}', resolved.id);`,
    `    pm.environment.set('${idVariable}', resolved.id);`,
    `    pm.variables.set('${idVariable}', resolved.id);`,
    `    pm.variables.unset('${stateVariable}');`,
    `    pm.variables.set('${pageVariable}', 1);`,
    `    pm.execution.setNextRequest(${JSON.stringify(nextRequest)});`,
    '  }',
    '} catch (error) {',
    '  pm.execution.setNextRequest(null);',
    `  pm.variables.unset('${stateVariable}');`,
    `  pm.variables.set('${pageVariable}', 1);`,
    '  throw error;',
    '}'
  ];
}

function paginationPrerequest(idVariable, nameVariable, stateVariable, pageVariable) {
  return [
    initialPageState.toString(),
    `if (!pm.variables.get('${stateVariable}')) {`,
    `  const state = initialPageState({ id: pm.variables.get('${idVariable}'), name: pm.variables.get('${nameVariable}') });`,
    `  pm.variables.set('${stateVariable}', JSON.stringify(state));`,
    `  pm.variables.set('${pageVariable}', 1);`,
    '}'
  ];
}

function workflowItem({ id, name, method = 'GET', raw, path, query = [], test, prerequest = [] }) {
  return {
    id,
    name,
    event: [
      { listen: 'prerequest', script: { type: 'text/javascript', exec: prerequest } },
      {
        listen: 'test',
        script: { type: 'text/javascript', exec: test }
      }
    ],
    request: {
      method,
      header: [],
      url: {
        raw,
        host: ['{{base_url}}'],
        path,
        ...(query.length ? { query } : {})
      }
    },
    response: []
  };
}

export function createBootstrapCollection({ commit, schemaSha256, operations }) {
  const accountState = '_cf_bootstrap_account_state';
  const zoneState = '_cf_bootstrap_zone_state';
  const accountPage = '_cf_bootstrap_account_page';
  const zonePage = '_cf_bootstrap_zone_page';
  const accountRequest = '3c9d5046-611f-5207-81f4-5858f835ed01';
  const zoneRequest = '3c9d5046-611f-5207-81f4-5858f835ed02';
  const accountName = '2. List and resolve account';
  const zoneName = '3. List and resolve zone';
  const collection = {
    info: {
      _postman_id: '5ae45603-67b8-5c38-9d87-39a94f9ccf58',
      name: 'Cloudflare API — Generic Account & Zone Bootstrap',
      description:
        `GENERATED FILE — DO NOT EDIT.\n\nPublic-safe read-only bootstrap workflow generated from Cloudflare api-schemas ${commit} (${schemaSha256}).`,
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'
    },
    auth: {
      type: 'bearer',
      bearer: [{ key: 'token', value: '{{api_token}}', type: 'string' }]
    },
    variable: [
      { key: 'base_url', value: 'https://api.cloudflare.com/client/v4', type: 'string' },
      ...AUTH_VARIABLES.map((key) => ({ key, value: '', type: 'string' })),
      { key: 'account_id', value: '', type: 'string' },
      { key: 'account_name', value: '', type: 'string' },
      { key: 'zone_id', value: '', type: 'string' },
      { key: 'zone_name', value: '', type: 'string' }
    ],
    item: [
      workflowItem({
        id: '3c9d5046-611f-5207-81f4-5858f835ed00',
        name: '1. Verify API token',
        raw: '{{base_url}}/user/tokens/verify',
        path: ['user', 'tokens', 'verify'],
        prerequest: [
          `pm.variables.unset('${accountState}');`,
          `pm.variables.unset('${zoneState}');`,
          `pm.variables.set('${accountPage}', 1);`,
          `pm.variables.set('${zonePage}', 1);`
        ],
        test: [
          'try {',
          "  const tokenEnvelope = pm.response.json();",
          "  if (pm.response.code !== 200 || tokenEnvelope.success !== true || tokenEnvelope.result?.status !== 'active') throw new Error('Token verification failed.');",
          `  pm.execution.setNextRequest('${accountName}');`,
          '} catch (error) {',
          '  pm.execution.setNextRequest(null);',
          '  throw error;',
          '}'
        ]
      }),
      workflowItem({
        id: accountRequest,
        name: accountName,
        raw: `{{base_url}}/accounts?per_page=50&page={{${accountPage}}}`,
        path: ['accounts'],
        query: [{ key: 'per_page', value: '50' }, { key: 'page', value: `{{${accountPage}}}` }],
        prerequest: paginationPrerequest('account_id', 'account_name', accountState, accountPage),
        test: postmanResolveScript({
          label: 'Account',
          idVariable: 'account_id',
          stateVariable: accountState, pageVariable: accountPage, nextRequest: zoneName
        })
      }),
      workflowItem({
        id: zoneRequest,
        name: zoneName,
        raw: `{{base_url}}/zones?account.id={{account_id}}&per_page=50&page={{${zonePage}}}`,
        path: ['zones'],
        query: [
          { key: 'account.id', value: '{{account_id}}' },
          { key: 'per_page', value: '50' },
          { key: 'page', value: `{{${zonePage}}}` }
        ],
        prerequest: paginationPrerequest('zone_id', 'zone_name', zoneState, zonePage),
        test: postmanResolveScript({
          label: 'Zone',
          idVariable: 'zone_id',
          stateVariable: zoneState, pageVariable: zonePage, nextRequest: null
        })
      })
    ]
  };
  for (const item of collection.item) {
    const key = `GET /${item.request.url.path.join('/')}`;
    const operation = operations.find((entry) => entry.key === key);
    if (!operation) throw new Error(`Bootstrap operation missing from upstream: ${key}`);
    applyAuthentication(item, operation.authSupport);
  }
  return collection;
}

export function createTemplateEnvironment() {
  return {
    id: 'f5dc7d31-5d0f-5267-bde5-d29ea58946f8',
    name: 'Cloudflare API — Template',
    values: [
      { key: 'base_url', value: 'https://api.cloudflare.com/client/v4', type: 'default', enabled: true },
      ...AUTH_VARIABLES.map((key) => ({ key, value: '', type: 'secret', enabled: true })),
      { key: 'account_id', value: '', type: 'default', enabled: true },
      { key: 'account_name', value: '', type: 'default', enabled: true },
      { key: 'zone_id', value: '', type: 'default', enabled: true },
      { key: 'zone_name', value: '', type: 'default', enabled: true }
    ],
    _postman_variable_scope: 'environment',
    _postman_exported_using: '@salixiaholdings/cloudflare-postman (generated)',
    _postman_exported_at: '1970-01-01T00:00:00.000Z'
  };
}
