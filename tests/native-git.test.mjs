import { spawnSync } from 'node:child_process';
import { ROOT } from '../src/constants.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm,symlink} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {normalizeAuthId,inspectAuthId,assertUnstableAuthIds,assertSemanticEquivalence,environmentYaml,globalsYaml,assertEmptyGlobals,assertNativeEntityDirectories,treeManifest} from '../src/native-git.mjs';
import {deterministicUuid} from '../src/identity.mjs';
import YAML from 'yaml';
import {createTemplateEnvironment} from '../src/chaining.mjs';
const random='12345678-1234-4234-8234-123456789abc';
const collectionId='22345678-1234-5234-8234-123456789abc';
async function fixture(t,source=`$kind: collection\nauth:\n  - id: ${random}\n    type: bearer\n`) {
  const root=await mkdtemp(path.join(os.tmpdir(),'native-test-'));t.after(()=>rm(root,{recursive:true,force:true}));
  await mkdir(path.join(root,'.resources'));await writeFile(path.join(root,'.resources/definition.yaml'),source);return root;
}
test('normalization replaces only the unreferenced collection auth UUID bytes',async t=>{
  const root=await fixture(t);const file=path.join(root,'.resources/definition.yaml');const before=await readFile(file,'utf8');
  const id=await normalizeAuthId(root,collectionId);assert.equal(id,deterministicUuid(`postman-v3:collection-auth:${collectionId}`));
  assert.equal(await readFile(file,'utf8'),before.replace(random,id));
  assert.notEqual(id,deterministicUuid('postman-v3:collection-auth:other'));
});
test('normalization rejects missing auth, multiple entries, wrong kind, quoted/aliased or missing UUID',async t=>{
  for(const source of ['$kind: collection\n',`$kind: collection\nauth:\n  - id: ${random}\n    type: bearer\n  - id: ${random}\n    type: bearer\n`,
    `$kind: folder\nauth:\n  - id: ${random}\n    type: bearer\n`,
    `$kind: collection\nauth:\n  - id: "${random}"\n    type: bearer\n`,
    '$kind: collection\nauth:\n  - type: bearer\n']) {
    const root=await fixture(t,source);await assert.rejects(normalizeAuthId(root,collectionId));
  }
});
test('normalization rejects references in nested requests, binary files, comments and filenames',async t=>{
  for(const file of ['nested/request.yaml','nested/other.bin',`${random}.yaml`]) {
    const root=await fixture(t);await mkdir(path.dirname(path.join(root,file)),{recursive:true});
    await writeFile(path.join(root,file),file.endsWith('.bin')?Buffer.from(`\x00${random}\x00`):`# ${random}\n`);
    await assert.rejects(inspectAuthId(root));
  }
  const root=await fixture(t,`$kind: collection\n# ${random}\nauth:\n  - id: ${random}\n    type: bearer\n`);await assert.rejects(inspectAuthId(root));
});
test('normalization rejects ID occurring only outside expected field and unsafe symlinks',async t=>{
  const root=await fixture(t,`$kind: collection\nid: ${random}\nauth: []\n`);await assert.rejects(normalizeAuthId(root,collectionId));
  const linked=await fixture(t);await symlink('.resources/definition.yaml',path.join(linked,'linked.yaml'));await assert.rejects(inspectAuthId(linked));
});
test('future stable official IDs force explicit review',()=>{
  assert.throws(()=>assertUnstableAuthIds(random,random),/now stable/u);
  assert.doesNotThrow(()=>assertUnstableAuthIds(random,collectionId));
});
test('shared UUID implementation preserves existing v2 identity algorithm',()=>{
  assert.equal(deterministicUuid('collection:accounts-identity-billing:1cf9b4dcf3241bef73d3300b045cb01543cc7a5f'), 'a57f79b9-717e-5a4a-86d8-a3df0781d54f');
});
test('v3 environment uses exactly the v2 source model',()=>{
  const model=createTemplateEnvironment();assert.deepEqual(YAML.parse(environmentYaml()),{id:model.id,name:model.name,values:model.values});
});
test('semantic validation rejects modified operation paths, names, auth, scripts and omitted requests',async t=>{
  const root=await fixture(t);const definition={$kind:'collection',id:collectionId,name:'Fixture',description:'generated',variables:{base_url:'https://api.cloudflare.com/client/v4'},auth:[{id:random,type:'bearer',credentials:{token:'{{api_token}}'}}]};
  const item={id:random,name:'Read',request:{method:'GET',url:'{{base_url}}/example',description:'operation identity',auth:{type:'noauth'}},event:[]};
  const collection={info:{_postman_id:collectionId,name:'Fixture',description:'generated'},variable:[{key:'base_url',value:'https://api.cloudflare.com/client/v4'}],auth:{type:'bearer',bearer:[{key:'token',value:'{{api_token}}'}]},item:[item]};
  await writeFile(path.join(root,'.resources/definition.yaml'),YAML.stringify(definition));
  const request={$kind:'http-request',id:random,method:'GET',url:'{{base_url}}/example',description:'operation identity',auth:{type:'noauth'}};
  const file=path.join(root,'Read.request.yaml');await writeFile(file,YAML.stringify(request));await assertSemanticEquivalence(collection,root);
  for(const patch of [{url:'{{base_url}}/wrong'},{method:'POST'},{name:'Wrong'},{description:'wrong'},{auth:{type:'bearer'}},{scripts:[{type:'beforeRequest',code:'wrong'}]}]) {
    await writeFile(file,YAML.stringify({...request,...patch}));await assert.rejects(assertSemanticEquivalence(collection,root));
  }
  await rm(file);await assert.rejects(assertSemanticEquivalence(collection,root));
});

test('empty Globals is exact and deterministic in independent trees', async t => {
  const roots = await Promise.all([fixture(t), fixture(t)]);
  for (const root of roots) {
    await mkdir(path.join(root, 'globals'));
    await writeFile(path.join(root, 'globals/workspace.globals.yaml'), globalsYaml());
  }
  assert.equal(globalsYaml(), 'name: Globals\nvalues: []\n');
  assert.doesNotThrow(() => assertEmptyGlobals(globalsYaml()));
  assert.deepEqual(await treeManifest(roots[0]), await treeManifest(roots[1]));
});

test('any global variable, value, or changed globals structure fails', () => {
  for (const values of [[{ key: 'synthetic', value: '' }], [{ key: 'synthetic', value: 'example' }], ['example'], { synthetic: '' }, null]) {
    assert.throws(() => assertEmptyGlobals(YAML.stringify({ name: 'Globals', values })), /explicit review/u);
  }
  assert.throws(() => assertEmptyGlobals('name: Globals\nvalues: []\nvalue: example\n'));
});

test('Native Git permits exactly the three expected entity directories', async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'native-entities-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const name of ['collections', 'environments', 'globals']) await mkdir(path.join(root, name));
  await assertNativeEntityDirectories(root);
  await mkdir(path.join(root, 'unexpected'));
  await assert.rejects(assertNativeEntityDirectories(root));
  await rm(path.join(root, 'unexpected'), { recursive: true });
  await rm(path.join(root, 'globals'), { recursive: true });
  await assert.rejects(assertNativeEntityDirectories(root));
  await writeFile(path.join(root, 'globals'), '');
  await assert.rejects(assertNativeEntityDirectories(root));
});

test('generated globals are not ignored, while workspace bindings remain ignored', () => {
  for (const file of ['postman/globals/', 'postman/globals/workspace.globals.yaml']) {
    const result = spawnSync('git', ['check-ignore', '--no-index', file], { cwd: ROOT });
    assert.equal(result.status, 1, 'Generated Globals must be tracked, not ignored.');
  }
  for (const file of ['.postman/', '.postman/resources.yaml']) {
    assert.equal(spawnSync('git', ['check-ignore', '--no-index', file], { cwd: ROOT }).status, 0);
  }
});
