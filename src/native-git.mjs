import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, readFile, readdir, writeFile, rm, mkdtemp } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import YAML from 'yaml';
import { ROOT } from './constants.mjs';
import { deterministicUuid } from './identity.mjs';
import { readJson, sha256, stableJson, writeJson } from './io.mjs';
import { createTemplateEnvironment } from './chaining.mjs';
import { assertEmptyPublicVariables, assertNoLocalPaths } from './public-safety.mjs';

const execute = promisify(execFile);
const cli = path.join(ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'postman.cmd' : 'postman');
export const POLICY_VERSION = 1;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

export async function filesUnder(root, relative = '') {
  const files = [];
  for (const entry of (await readdir(path.join(root, relative), { withFileTypes: true })).sort((a,b) => a.name < b.name ? -1 : 1)) {
    const file = path.join(relative, entry.name);
    if (entry.isSymbolicLink()) throw new Error('Generated output must not contain symlinks.');
    if (entry.isDirectory()) files.push(...await filesUnder(root, file));
    else if (entry.isFile()) files.push(file.split(path.sep).join('/'));
    else throw new Error('Unexpected generated filesystem entry.');
  }
  return files;
}

async function run(args) {
  const { stdout } = await execute(cli, args, { maxBuffer: 16 * 1024 * 1024 });
  return stdout;
}

export async function assertCli() {
  const lock = await readJson(path.join(ROOT, 'toolchain-lock.json'));
  assert.equal(lock.postmanCli.version, '1.56.3', 'CLI change requires compatibility-policy review.');
  assert.equal(lock.postmanCli.compatibilityPolicyVersion, POLICY_VERSION);
  assert.equal((await run(['--version'])).trim(), lock.postmanCli.version, 'Wrong Postman CLI binary.');
  return lock;
}

export async function lintNative(kind, root) {
  // Stronger than errors-only: neither raw nor normalized output may have warnings.
  await run([kind, 'lint', root, '--fail-severity', 'warning']);
}

export async function inspectAuthId(root) {
  const file = '.resources/definition.yaml';
  const source = await readFile(path.join(root, file), 'utf8');
  const document = YAML.parseDocument(source);
  if (document.errors.length) throw new Error('Invalid collection definition YAML.');
  const definition = document.toJS();
  const node = document.getIn(['auth', 0, 'id'], true);
  if (definition.$kind !== 'collection' || !Array.isArray(definition.auth) || definition.auth.length !== 1 ||
      definition.auth[0].type !== 'bearer' || !YAML.isScalar(node) || typeof node.value !== 'string' || !uuid.test(node.value)) {
    throw new Error('Collection auth structure changed; compatibility review required.');
  }
  const original = node.value;
  let occurrences = 0;
  for (const entry of await filesUnder(root)) {
    if (entry.includes(original)) throw new Error('Collection auth UUID referenced in a filename.');
    const bytes = await readFile(path.join(root, entry));
    occurrences += bytes.toString('utf8').split(original).length - 1;
  }
  if (occurrences !== 1 || !node.range || source.slice(node.range[0], node.range[1]) !== original) {
    throw new Error('Collection auth UUID must occur exactly once at the expected scalar field.');
  }
  return { file, source, original, offset: node.range[0] };
}

export function assertUnstableAuthIds(first, second) {
  if (first === second) throw new Error('Official collection auth ID is now stable; review and retire compatibility policy.');
}

export async function normalizeAuthId(root, collectionId) {
  if (!uuid.test(collectionId)) throw new Error('Expected stable v2 collection UUID.');
  const inspected = await inspectAuthId(root);
  const replacement = deterministicUuid(`postman-v3:collection-auth:${collectionId}`);
  if (replacement === inspected.original) throw new Error('Official auth ID already matches policy; review required.');
  await writeFile(path.join(root, inspected.file), inspected.source.slice(0, inspected.offset) + replacement +
    inspected.source.slice(inspected.offset + inspected.original.length));
  return replacement;
}

export async function treeManifest(root) {
  const files = [];
  for (const file of await filesUnder(root)) files.push({ file, sha256: sha256(await readFile(path.join(root, file))) });
  const directories = [];
  async function visit(relative = '') {
    for (const entry of await readdir(path.join(root, relative), { withFileTypes: true })) {
      if (entry.isDirectory()) { const dir = relative ? `${relative}/${entry.name}` : entry.name; directories.push(dir); await visit(dir); }
    }
  }
  await visit(); directories.sort();
  return { files, directories, sha256: sha256(stableJson({ files, directories })) };
}

function requests(items) { return (items ?? []).flatMap(item => item.item ? requests(item.item) : [item]); }
function scripts(events = []) {
  return events.map(event => ({ type: event.listen === 'prerequest' ? 'beforeRequest' : 'afterResponse',
    code: Array.isArray(event.script.exec) ? event.script.exec.join('\n') : event.script.exec,
    language: event.script.type ?? 'text/javascript' }));
}
function auth(value) {
  if (!value || value.type === 'inherit') return undefined;
  const result = { type: value.type };
  if (value[value.type]?.length) result.credentials = Object.fromEntries(value[value.type].map(v => [v.key, v.value]));
  return result;
}
function operation(method, url) {
  return `${method.toUpperCase()} ${url.split('?')[0].replace(/^\{\{base_url\}\}/u, '').replace(/\{\{([^}]+)\}\}/gu, '{$1}')}`;
}

export async function assertSemanticEquivalence(collection, root) {
  const definition = YAML.parse(await readFile(path.join(root, '.resources/definition.yaml'), 'utf8'));
  assert.equal(definition.id, collection.info._postman_id, 'Collection identity/ownership drift.');
  assert.equal(definition.name, collection.info.name);
  assert.equal(definition.description, collection.info.description);
  assert.deepEqual(definition.variables, Object.fromEntries(collection.variable.map(v => [v.key,v.value])), 'Collection variable drift.');
  assertEmptyPublicVariables(Object.entries(definition.variables).map(([key,value])=>({key,value})), 'v3 collection');
  const collectionAuth = definition.auth[0];
  assert.deepEqual({ type: collectionAuth.type, credentials: collectionAuth.credentials }, auth(collection.auth));
  assert.deepEqual(definition.scripts ?? [], scripts(collection.event));
  const expected = new Map(requests(collection.item).map(item => [item.id,item]));
  const seen = new Set();
  const operations = [];
  for (const file of await filesUnder(root)) {
    if (!file.endsWith('.request.yaml')) continue;
    const request = YAML.parse(await readFile(path.join(root,file),'utf8'));
    assert.equal(request.$kind, 'http-request');
    const item = expected.get(request.id);
    assert.ok(item && !seen.has(request.id), `Missing/duplicate/unexpected request identity: ${file}`);
    seen.add(request.id);
    const v2 = item.request;
    assert.equal(request.name ?? path.basename(file,'.request.yaml'), request.name === undefined ? item.name.trim() : item.name, 'Request name drift.');
    assert.equal(request.description ?? '', typeof v2.description === 'string' ? v2.description : v2.description?.content ?? '', 'Description/operation identity drift.');
    assert.equal(request.method, v2.method, 'HTTP method drift.');
    const raw = typeof v2.url === 'string' ? v2.url : v2.url.raw;
    assert.equal(operation(request.method,request.url),operation(v2.method,raw),'Operation path drift.');
    assert.deepEqual(request.auth ?? undefined,auth(v2.auth),'Request auth drift.');
    const authHeaders = entries => entries.filter(h => /^X-Auth-/iu.test(h.key) && !h.disabled)
      .map(h => [h.key.toLowerCase(),h.value]).sort((a,b) => a[0].localeCompare(b[0]));
    const nativeHeaders = Array.isArray(request.headers) ? request.headers :
      Object.entries(request.headers ?? {}).map(([key,value])=>({key,value}));
    assert.deepEqual(authHeaders(nativeHeaders),authHeaders(v2.header ?? []),`Auth header drift: ${file}`);
    assert.deepEqual(request.scripts ?? [],scripts(item.event),'Pre/post script drift.');
    operations.push(operation(request.method,request.url));
  }
  assert.equal(seen.size,expected.size,'Missing v3 requests.');
  assert.equal(new Set(operations).size, operations.length, 'Duplicate v3 operation.');
  return operations.sort();
}

export function environmentYaml() {
  const environment = createTemplateEnvironment();
  return '# GENERATED FILE — DO NOT EDIT.\n' + YAML.stringify({ id: environment.id, name: environment.name, values: environment.values });
}

export const GLOBALS_FILE = 'globals/workspace.globals.yaml';

export function globalsYaml() {
  return YAML.stringify({ name: 'Globals', values: [] });
}

export function assertEmptyGlobals(source) {
  assert.ok(source === globalsYaml(), 'Globals must remain exactly empty; changes require explicit review.');
}

export async function assertNativeEntityDirectories(root) {
  const entries = await readdir(root, { withFileTypes: true });
  assert.deepEqual(entries.map(entry => entry.name).sort(), ['collections', 'environments', 'globals'],
    'Unexpected Native Git top-level entities.');
  assert.ok(entries.every(entry => entry.isDirectory()), 'Native Git entities must be directories.');
}

export async function generateNative(root) {
  const toolchain = await assertCli();
  const v2Root = path.join(root,'dist','v2.1');
  const manifest = await readJson(path.join(v2Root,'manifest.json'));
  const second = await mkdtemp(path.join(os.tmpdir(),'postman-native-second-'));
  const collections = [];
  try {
    for (const entry of [...manifest.partitions, { id:'bootstrap', ...manifest.workflow }]) {
      const collection = await readJson(path.join(v2Root,entry.file));
      const relative = `collections/${entry.id}`;
      const roots = [path.join(root,'postman',relative),path.join(second,relative)];
      for (const destination of roots) {
        await mkdir(path.dirname(destination),{recursive:true});
        await run(['collection','migrate',path.join(v2Root,entry.file),'-o',destination]);
        await lintNative('collection',destination);
      }
      const rawIds = await Promise.all(roots.map(inspectAuthId));
      assertUnstableAuthIds(rawIds[0].original,rawIds[1].original);
      for (const destination of roots) {
        await normalizeAuthId(destination,collection.info._postman_id);
        await lintNative('collection',destination);
        await assertSemanticEquivalence(collection,destination);
      }
      const [firstTree,secondTree] = await Promise.all(roots.map(treeManifest));
      assert.deepEqual(firstTree,secondTree,'Additional migration instability: stop; no further normalization permitted.');
      collections.push({id:entry.id,directory:relative,requestCount:entry.operationCount ?? entry.requestCount,
        operationsSha256:sha256(stableJson(await assertSemanticEquivalence(collection,roots[0]))),...firstTree});
      console.log(`v3 ${entry.id}: raw/normalized lint, semantic equivalence, two-run byte comparison passed`);
    }
    const environment = 'environments/cloudflare.template.environment.yaml';
    for (const destination of [path.join(root,'postman',environment),path.join(second,environment)]) {
      await mkdir(path.dirname(destination),{recursive:true});await writeFile(destination,environmentYaml());
      await lintNative('environment',destination);
    }
    for (const nativeRoot of [path.join(root,'postman'), second]) {
      const destination = path.join(nativeRoot, GLOBALS_FILE);
      await mkdir(path.dirname(destination), { recursive: true });
      await writeFile(destination, globalsYaml());
      assertEmptyGlobals(await readFile(destination, 'utf8'));
      await lintNative('globals', destination);
      await assertNativeEntityDirectories(nativeRoot);
    }
    assert.deepEqual(await treeManifest(path.join(root,'postman')),await treeManifest(second),'Full v3 distribution differs.');
    manifest.toolchain = toolchain;
    manifest.nativeGit = { compatibilityPolicyVersion:POLICY_VERSION, cliVersion:toolchain.postmanCli.version,
      collections, environment:{file:environment,sha256:sha256(environmentYaml())},
      globals:{file:GLOBALS_FILE,sha256:sha256(globalsYaml())},
      sha256:(await treeManifest(path.join(root,'postman'))).sha256 };
    await writeJson(path.join(v2Root,'manifest.json'),manifest);
  } finally { await rm(second,{recursive:true,force:true}); }
}

export async function validateNative(root, manifest, upstreamPaths) {
  const toolchain = await assertCli();
  assert.deepEqual(manifest.toolchain,toolchain,'Toolchain provenance drift.');
  assert.equal(manifest.nativeGit.compatibilityPolicyVersion,POLICY_VERSION);
  assert.equal(manifest.nativeGit.cliVersion,toolchain.postmanCli.version);
  const expected = [...manifest.partitions,{id:'bootstrap',...manifest.workflow}];
  assert.deepEqual(manifest.nativeGit.collections.map(c=>c.id),expected.map(c=>c.id),'Missing/duplicate collections.');
  const nativeRoot = path.join(root,'postman');
  await assertNativeEntityDirectories(nativeRoot);
  assertEmptyGlobals(await readFile(path.join(nativeRoot, GLOBALS_FILE), 'utf8'));
  assert.equal(manifest.nativeGit.globals.file, GLOBALS_FILE);
  assert.equal(manifest.nativeGit.globals.sha256, sha256(globalsYaml()));
  await lintNative('globals', path.join(nativeRoot, GLOBALS_FILE));
  assert.deepEqual((await readdir(path.join(nativeRoot,'collections'))).sort(),expected.map(c=>c.id).sort());
  for (const entry of expected) {
    const record = manifest.nativeGit.collections.find(c=>c.id===entry.id);
    assert.equal(record.directory,`collections/${entry.id}`);
    const destination = path.join(nativeRoot,record.directory);
    const collection = await readJson(path.join(root,'dist','v2.1',entry.file));
    const operations = await assertSemanticEquivalence(collection,destination);
    assert.equal(operations.length,record.requestCount);
    assert.equal(sha256(stableJson(operations)),record.operationsSha256);
    const tree = await treeManifest(destination);
    assert.deepEqual(tree.files,record.files,'Stale/hand-edited v3 files.');assert.deepEqual(tree.directories,record.directories,'Directory set drift.');assert.equal(tree.sha256,record.sha256);
    const normalized = await inspectAuthId(destination);
    assert.equal(normalized.original,deterministicUuid(`postman-v3:collection-auth:${collection.info._postman_id}`));
    await lintNative('collection',destination);
  }
  const environment = path.join(nativeRoot,'environments/cloudflare.template.environment.yaml');
  assert.equal(await readFile(environment,'utf8'),environmentYaml(),'Environment drift.');
  assert.equal(manifest.nativeGit.environment.file,'environments/cloudflare.template.environment.yaml');
  assert.equal(manifest.nativeGit.environment.sha256,sha256(environmentYaml()));
  await lintNative('environment',environment);
  const tree = await treeManifest(nativeRoot);
  const expectedFiles = [...manifest.nativeGit.collections.flatMap(c=>c.files.map(f=>`${c.directory}/${f.file}`)),manifest.nativeGit.environment.file,manifest.nativeGit.globals.file].sort();
  assert.deepEqual(tree.files.map(f=>f.file).sort(),expectedFiles,'Unexpected Native Git files.');
  assert.equal(tree.sha256,manifest.nativeGit.sha256);
  for (const {file} of tree.files) {
    assert.ok(file.endsWith('.yaml'),'Only v3 YAML is allowed under postman/.');
    const text = await readFile(path.join(nativeRoot,file),'utf8');
    assertNoLocalPaths(text,file,upstreamPaths);
    function checkStrings(value) {
      if (typeof value === 'string') assertNoLocalPaths(value,file,upstreamPaths);
      else if (value && typeof value === 'object') for (const child of Object.values(value)) checkStrings(child);
    }
    checkStrings(YAML.parse(text));
    assert.ok(!/PMAK-[A-Za-z0-9]|\bworkspace[Ii]d\s*:/u.test(text),'Workspace binding or Postman key in generated YAML.');
  }
  const {stdout: tracked} = await execute('git',['ls-files','.postman'],{cwd:ROOT});
  assert.equal(tracked.trim(),'','Postman workspace state must never be tracked.');
  await execute('git',['check-ignore','.postman/resources.yaml'],{cwd:ROOT});
  console.log('v3: all collection/environment/globals lint, semantic equivalence, hashes and public-safety checks passed.');
}
