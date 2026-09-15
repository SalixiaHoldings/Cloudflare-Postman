import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { CACHE_DIR, ROOT } from '../src/constants.mjs';
import { generateAll } from '../src/generate.mjs';
import { sha256, writeJson } from '../src/io.mjs';
import { listOperations } from '../src/openapi.mjs';
import { fetchLatestUpstreamCommit, readSchemaLock } from '../src/upstream.mjs';
import { validateAll } from '../src/validate.mjs';

const apply = process.argv.includes('--apply');
const check = process.argv.includes('--check');
if (apply === check) throw new Error('Choose exactly one of --check or --apply.');

const currentLock = await readSchemaLock();
const latestCommit = await fetchLatestUpstreamCommit();
if (latestCommit === currentLock.commit) {
  console.log(`No upstream drift: cloudflare/api-schemas remains at ${latestCommit}.`);
  process.exit(0);
}
if (check) {
  console.error(`Upstream drift detected: ${currentLock.commit} -> ${latestCommit}.`);
  process.exit(2);
}

async function fetchBytes(url) {
  const response = await fetch(url, {
    headers: { 'user-agent': '@salixiaholdings/cloudflare-postman/0.1.0' }
  });
  if (!response.ok) throw new Error(`Unable to fetch ${url}: ${response.status} ${response.statusText}`);
  return Buffer.from(await response.arrayBuffer());
}

function operationDiff(oldSchema, newSchema) {
  const oldOperations = new Map(listOperations(oldSchema).map((operation) => [operation.key, operation]));
  const newOperations = new Map(listOperations(newSchema).map((operation) => [operation.key, operation]));
  const added = [...newOperations.keys()].filter((key) => !oldOperations.has(key)).sort();
  const removed = [...oldOperations.keys()].filter((key) => !newOperations.has(key)).sort();
  const changed = [...newOperations]
    .filter(([key, operation]) => oldOperations.has(key) && (oldOperations.get(key).fingerprint !== operation.fingerprint ||
      oldOperations.get(key).authSupport.fingerprint !== operation.authSupport.fingerprint))
    .map(([key]) => key)
    .sort();
  const newlyDeprecated = [...newOperations]
    .filter(([key, operation]) => operation.deprecated && !oldOperations.get(key)?.deprecated)
    .map(([key]) => key)
    .sort();
  return { oldOperations, newOperations, added, removed, changed, newlyDeprecated };
}

function section(title, entries) {
  if (!entries.length) return `## ${title}\n\nNone.\n`;
  const shown = entries.slice(0, 75).map((entry) => `- \`${entry}\``).join('\n');
  const suffix = entries.length > 75 ? `\n- ...and ${entries.length - 75} more` : '';
  return `## ${title}\n\n${shown}${suffix}\n`;
}

const oldSchemaBytes = await fetchBytes(currentLock.schema.url);
if (sha256(oldSchemaBytes) !== currentLock.schema.sha256) {
  throw new Error('Previously pinned upstream schema no longer matches schema-lock.json.');
}
const schemaUrl = `https://raw.githubusercontent.com/cloudflare/api-schemas/${latestCommit}/openapi.json`;
const licenseUrl = `https://raw.githubusercontent.com/cloudflare/api-schemas/${latestCommit}/LICENSE`;
const [newSchemaBytes, licenseBytes] = await Promise.all([fetchBytes(schemaUrl), fetchBytes(licenseUrl)]);
const oldSchema = JSON.parse(oldSchemaBytes.toString('utf8'));
const newSchema = JSON.parse(newSchemaBytes.toString('utf8'));
const diff = operationDiff(oldSchema, newSchema);
const newLock = {
  ...currentLock,
  commit: latestCommit,
  schema: {
    ...currentLock.schema,
    url: schemaUrl,
    sha256: sha256(newSchemaBytes),
    bytes: newSchemaBytes.length
  },
  license: {
    ...currentLock.license,
    url: licenseUrl,
    sha256: sha256(licenseBytes)
  }
};

await writeJson(path.join(ROOT, 'schema-lock.json'), newLock);
const exceptionFile = path.join(ROOT, 'config', 'upstream-validation-exceptions.json');
const exceptionConfig = JSON.parse(await readFile(exceptionFile, 'utf8'));
exceptionConfig.upstreamCommit = latestCommit;
await writeJson(exceptionFile, exceptionConfig);
const cacheSchema = path.join(CACHE_DIR, 'cloudflare', latestCommit, 'openapi.json');
await mkdir(path.dirname(cacheSchema), { recursive: true });
await writeFile(cacheSchema, newSchemaBytes);

let generationResult = 'passed';
let validationResult = 'not run';
let failure;
try {
  await generateAll({ schemaPath: cacheSchema, schemaLock: newLock });
} catch (error) {
  failure = error;
  generationResult = `failed: ${error.message}`;
}
if (!failure) {
  try {
    await validateAll();
    validationResult = 'passed';
  } catch (error) {
    failure = error;
    validationResult = `failed: ${error.message}`;
  }
}

const summary = [
  '# Cloudflare API schema update',
  '',
  `- Previous revision: \`${currentLock.commit}\``,
  `- New revision: \`${latestCommit}\``,
  `- Previous operations: ${diff.oldOperations.size}`,
  `- New operations: ${diff.newOperations.size}`,
  `- Operation delta: ${diff.newOperations.size - diff.oldOperations.size >= 0 ? '+' : ''}${
    diff.newOperations.size - diff.oldOperations.size
  }`,
  `- Added: ${diff.added.length}`,
  `- Removed: ${diff.removed.length}`,
  `- Changed: ${diff.changed.length}`,
  `- Newly deprecated: ${diff.newlyDeprecated.length}`,
  `- Generation: ${generationResult}`,
  `- Validation: ${validationResult}`,
  `- Read-only live smoke test: ${process.env.UPSTREAM_SMOKE_RESULT || 'not run; protected credentials are not exposed to this update job'}`,
  '',
  section('Added operations', diff.added),
  section('Removed operations', diff.removed),
  section('Changed operations', diff.changed),
  section('Newly deprecated operations', diff.newlyDeprecated)
].join('\n');
await writeFile(path.join(ROOT, 'upstream-change-summary.md'), `${summary}\n`);
console.log(summary);
if (failure) throw failure;
