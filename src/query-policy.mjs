import assert from 'node:assert/strict';
import { sha256, stableJson } from './io.mjs';

export const IDENTIFIER_VARIABLES = Object.freeze({ account_id: '{{account_id}}', 'account.id': '{{account_id}}', zone_id: '{{zone_id}}', 'zone.id': '{{zone_id}}', tenant_id: '{{tenant_id}}', organization_id: '{{organization_id}}' });

export const SECONDARY_OPTIONS = Object.freeze({ enableOptionalParameters: false, optimizeConversion: false, stackLimit: 50 });

export function warningRecord(warnings) {
  const counts = new Map();
  for (const warning of warnings) {
    // Converter stack frames contain installation paths and runtime line numbers.
    // Preserve the complete diagnostic message and incompatible values, not stacks.
    const message = warning.split(/\n\s+at /u)[0].trim();
    assert.ok(message.startsWith('Error while resolving allOf schema:') || message.startsWith('unknown format '),
      'Unclassified secondary converter warning; review required.');
    counts.set(message, (counts.get(message) ?? 0) + 1);
  }
  const diagnostics = [...counts].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
    .map(([message, count]) => ({ message, count }));
  return { count: warnings.length, allOf: warnings.filter(w => w.startsWith('Error while resolving allOf schema:')).length,
    unknownFormat: warnings.filter(w => w.startsWith('unknown format ')).length,
    sha256: sha256(stableJson(diagnostics)), diagnostics };
}

export function assertQueryRevision(policy, lock, converterVersion) {
  assert.equal(policy.upstreamCommit, lock.commit, 'Query limitations require upstream revision review.');
  assert.equal(policy.schemaSha256, lock.schema.sha256, 'Query limitations require schema review.');
  assert.equal(policy.converterVersion, converterVersion, 'Query limitations require converter review.');
  assert.deepEqual(policy.secondaryOptions, SECONDARY_OPTIONS, 'Secondary options require review.');
}

export function resolveLocal(schema, value, seen = new Set()) {
  if (!value?.$ref) return value;
  const ref = value.$ref;
  assert.ok(ref.startsWith('#/') && !seen.has(ref), 'Unresolved/cyclic/nonlocal query reference.');
  assert.ok(Object.keys(value).every(key => ['$ref', 'description', 'summary', 'example', 'examples', 'default', 'title', 'deprecated', 'nullable', 'readOnly', 'writeOnly', 'x-auditable'].includes(key)),
    'Structural query reference siblings require review.');
  const next = ref.slice(2).split('/').reduce((node, key) => node?.[key.replaceAll('~1', '/').replaceAll('~0', '~')], schema);
  assert.ok(next && typeof next === 'object', 'Missing query reference target.');
  return resolveLocal(schema, next, new Set([...seen, ref]));
}

export function queryContracts(schema, operation) {
  const merged = new Map();
  const item = schema.paths[operation.path];
  assert.ok(item && !item.$ref, 'Path reference requires query review.');
  for (const list of [item.parameters ?? [], operation.operation.parameters ?? []]) {
    assert.ok(Array.isArray(list), 'Invalid OpenAPI parameters.');
    const local = new Set();
    for (const original of list) {
      const param = resolveLocal(schema, original);
      assert.ok(typeof param.name === 'string' && typeof param.in === 'string', 'Ambiguous parameter identity.');
      const key = `${param.in}:${param.name}`;
      assert.ok(!local.has(key), 'Duplicate OpenAPI parameter identity.'); local.add(key);
      assert.ok(param.required === undefined || typeof param.required === 'boolean', 'Invalid parameter requiredness.');
      merged.set(key, param);
    }
  }
  return [...merged.values()].filter(p => p.in === 'query');
}

function objectProperties(schema, original, seen = new Set()) {
  const value = resolveLocal(schema, original);
  if (!value || seen.has(value)) return [];
  const next = new Set([...seen, value]);
  return [...new Set([...Object.keys(value.properties ?? {}), ...(value.allOf ?? []).flatMap(v => objectProperties(schema, v, next))])];
}

export function assertQueryContract(request, schema, operation) {
  const params = queryContracts(schema, operation);
  const seen = new Set();
  let enabled = 0, disabled = 0;
  for (const row of request.url?.query ?? []) {
    assert.ok(row.disabled === undefined || typeof row.disabled === 'boolean', 'Invalid query disabled flag.');
    assert.ok(typeof row.key === 'string' && typeof row.value === 'string', `Invalid query row: ${operation.key}`);
    assert.ok(!JSON.stringify(row).includes('<Error: Too many levels of nesting to fake this schema>'), 'Query nesting-error placeholder.');
    // This identifies official serialization rows; it never serializes values.
    const matches = params.filter(p => p.name === row.key || objectProperties(schema, p.schema).some(property =>
      (p.style === 'deepObject' && row.key === `${p.name}[${property}]`) ||
      ((p.style === undefined || p.style === 'form') && p.explode !== false && row.key === property)));
    assert.equal(matches.length, 1, `Unmapped/ambiguous query identity: ${operation.key} ${row.key}`);
    const param = matches[0]; seen.add(param.name);
    assert.equal(row.disabled === true, param.required !== true, `Wrong query state: ${operation.key} ${param.name}`);
    if (row.disabled === true) disabled++; else enabled++;
  }
  const omitted = params.filter(p => !seen.has(p.name));
  for (const p of omitted) {
    assert.notEqual(p.required, true, `Required query omitted: ${operation.key} ${p.name}`);
    assert.ok(resolveLocal(schema, p.schema), `Unresolved omitted query schema: ${operation.key} ${p.name}`);
  }
  return { enabled, disabled, omissions: omitted.map(p => ({ operation: operation.key, parameter: p.name, parameterSha256: sha256(stableJson(p)) })) };
}

export function assertOmissions(actual, expected) {
  const sorted = rows => [...rows].sort((a, b) => `${a.operation}:${a.parameter}`.localeCompare(`${b.operation}:${b.parameter}`));
  assert.deepEqual(sorted(actual), sorted(expected), 'Query omission set changed; explicit review required.');
}

export function orderedQuery(rows = []) {
  return rows.map(row => ({ key: row.key, value: row.value ?? '', disabled: row.disabled === true,
    description: typeof row.description === 'string' ? row.description : row.description?.content ?? '' }));
}
