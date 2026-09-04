import { DEFAULT_BASE_URL } from './constants.mjs';

// Validate structure, not private organization vocabulary. Upstream API examples
// are preserved; human release review and secret scanning complement these checks.
export function assertEmptyPublicVariables(entries, label) {
  const seen = new Set();
  for (const entry of entries) {
    if (!entry.key || seen.has(entry.key)) throw new Error(`${label} contains an invalid or duplicate template variable.`);
    seen.add(entry.key);
    const expected = entry.key === 'base_url' ? DEFAULT_BASE_URL : '';
    if (entry.value !== expected) throw new Error(`${label} contains a populated or nonstandard template variable: ${entry.key}`);
  }
}

export function localPaths(text) {
  const normalized = text.replaceAll('\\\\', '\\');
  return [...normalized.matchAll(/(?:\/Users\/|\/home\/|[A-Za-z]:\\Users\\)[A-Za-z0-9._-]+(?:\/|\\)[A-Za-z0-9._/\\-]+/gu)]
    .map((match) => match[0].replace(/\\+$/u, ''));
}

export function assertNoLocalPaths(text, label, upstreamPaths = new Set()) {
  if (localPaths(text).some((value) => !upstreamPaths.has(value))) {
    throw new Error(`${label} contains a local user-directory path.`);
  }
}
