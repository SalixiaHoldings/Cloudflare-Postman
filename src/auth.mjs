import { sha256, stableJson } from './io.mjs';

export const BEARER_AUTH = {
  type: 'bearer', bearer: [{ key: 'token', value: '{{api_token}}', type: 'string' }]
};
export const AUTH_VARIABLES = ['api_token', 'api_email', 'api_key', 'user_service_key'];
export const MANUAL_AUTH_SCRIPT = [
  "console.error('BLOCKED: upstream authentication cannot be generated safely. Read the request authentication notice and configure a local copy explicitly.');",
  'pm.execution.setNextRequest(null);',
  'pm.execution.skipRequest();'
];

// OpenAPI: array entries are OR alternatives; keys within an entry are AND.
export function authenticationSupport(schema, operation) {
  const source = Object.hasOwn(operation, 'security') ? 'operation'
    : Object.hasOwn(schema, 'security') ? 'root' : 'unspecified';
  const requirements = structuredClone(operation.security ?? schema.security ?? []);
  if (!Array.isArray(requirements)) throw new Error('Invalid upstream security declaration.');
  const names = [...new Set(requirements.flatMap((entry) => Object.keys(entry)))].sort();
  const schemes = Object.fromEntries(names.map((name) => [name, schema.components?.securitySchemes?.[name] ?? null]));
  const isToken = (name) => name === 'api_token' && schemes[name]?.type === 'http' && schemes[name]?.scheme === 'bearer';
  const supported = (entry) => Object.entries(entry).every(([name, scopes]) =>
    Array.isArray(scopes) && scopes.length === 0 && (isToken(name) || (
      AUTH_VARIABLES.includes(name) && schemes[name]?.type === 'apiKey' && schemes[name]?.in === 'header'
    ))
  );
  const tokenIndex = requirements.findIndex((entry) => Object.keys(entry).length === 1 && isToken(Object.keys(entry)[0]) && supported(entry));
  const anonymousIndex = requirements.findIndex((entry) => Object.keys(entry).length === 0);
  // Prefer a standalone API token, then anonymous, then the least-credential supported alternative.
  const candidates = requirements.map((entry, index) => ({ entry, index }))
    .filter(({ entry }) => supported(entry))
    .sort((a, b) => Object.keys(a.entry).length - Object.keys(b.entry).length || stableJson(a.entry).localeCompare(stableJson(b.entry)));
  const selectedRequirement = tokenIndex >= 0 ? tokenIndex : anonymousIndex >= 0 ? anonymousIndex : candidates[0]?.index ?? null;
  const selected = selectedRequirement === null ? {} : requirements[selectedRequirement];
  const anonymous = requirements.length === 0 || anonymousIndex >= 0;
  let category;
  if (tokenIndex >= 0) category = requirements.length === 1 ? 'bearer-only' : 'bearer-alternative';
  else if (anonymous) category = 'anonymous';
  else if (selectedRequirement === null) category = 'manual-unresolved';
  else if (Object.keys(selected).sort().join(',') === 'api_email,api_key') category = 'legacy-only';
  else category = 'multi-scheme-or-other';
  const declaration = { source, requirements, schemes };
  return {
    ...declaration,
    fingerprint: sha256(stableJson(declaration)),
    category,
    supportsBearerToken: tokenIndex >= 0,
    selectedRequirement,
    requiresManualConfiguration: category === 'manual-unresolved'
  };
}

export function authenticationPlan(support) {
  const selected = support.selectedRequirement === null ? {} : support.requirements[support.selectedRequirement];
  const headers = Object.keys(selected).sort().filter((name) => support.schemes[name]?.type === 'apiKey')
    .map((name) => ({ key: support.schemes[name].name, value: `{{${name}}}` }));
  return {
    auth: Object.hasOwn(selected, 'api_token') ? BEARER_AUTH : { type: 'noauth' },
    headers,
    script: support.requiresManualConfiguration ? MANUAL_AUTH_SCRIPT : []
  };
}

export function authenticationNotice(support) {
  const selected = support.selectedRequirement === null ? null : support.requirements[support.selectedRequirement];
  return `Authentication support: ${support.category}\nAuth declaration SHA-256: ${support.fingerprint}\n` +
    `Upstream security (${support.source}; OR alternatives, AND within each object): ${JSON.stringify(support.requirements)}\n` +
    `Selected requirement: ${JSON.stringify(selected)}\n` +
    (support.supportsBearerToken ? 'Use the narrowly scoped api_token; legacy alternatives are not enabled.'
      : support.requiresManualConfiguration ? 'BLOCKED: upstream security scheme is undefined or unsupported. No Bearer assumption is made. Consult upstream documentation, configure authentication on a local copy, then explicitly remove its pre-request guard.'
        : support.category === 'anonymous' ? 'Upstream permits an unauthenticated request; collection Bearer inheritance is disabled.'
          : 'Upstream does not declare a standalone API-token alternative. Configure only the empty credential variables required by this request. Multi-scheme requirements are preserved literally, not treated as alternatives. This is schema metadata, not proof of live API behavior.');
}

export function applyAuthentication(item, support) {
  const plan = authenticationPlan(support);
  const authHeaders = new Set(['authorization', 'x-auth-email', 'x-auth-key', 'x-auth-user-service-key',
    ...Object.values(support.schemes).filter((scheme) => scheme?.in === 'header').map((scheme) => scheme.name.toLowerCase())]);
  item.request.header = (item.request.header ?? []).filter((header) => !authHeaders.has(header.key.toLowerCase()));
  item.request.header.push(...plan.headers);
  item.request.auth = structuredClone(plan.auth);
  item.request.description = `${item.request.description ?? ''}\n\n${authenticationNotice(support)}`;
  if (plan.script.length) {
    (item.event ??= []).push({ listen: 'prerequest', script: { type: 'text/javascript', exec: [...plan.script] } });
  }
}

export function assertAuthenticationMetadata(actual, expected, key) {
  if (stableJson(actual) !== stableJson(expected)) throw new Error(`Authentication metadata mismatch: ${key}`);
}

export function assertRequestAuthentication(item, support, key) {
  const plan = authenticationPlan(support);
  assertAuthenticationMetadata(item.request.auth, plan.auth, key);
  if (!item.request.description?.endsWith(authenticationNotice(support))) throw new Error(`Authentication notice mismatch: ${key}`);
  const names = new Set(['authorization', 'x-auth-email', 'x-auth-key', 'x-auth-user-service-key',
    ...Object.values(support.schemes).filter((scheme) => scheme?.in === 'header').map((scheme) => scheme.name.toLowerCase())]);
  assertAuthenticationMetadata((item.request.header ?? []).filter((h) => names.has(h.key.toLowerCase())), plan.headers, key);
  const scripts = (item.event ?? []).filter((event) => event.listen === 'prerequest').flatMap((event) => event.script.exec);
  assertAuthenticationMetadata(scripts, plan.script, key);
}

export function authenticationCounts(operations) {
  const counts = {};
  for (const operation of operations) counts[operation.authSupport.category] = (counts[operation.authSupport.category] ?? 0) + 1;
  return counts;
}
