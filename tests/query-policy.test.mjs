import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm, readdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import YAML from 'yaml';
import policy from '../config/query-projection.json' with { type: 'json' };
import { listOperations } from '../src/openapi.mjs';
import { generateCollection, makeRawUrl, indexOperations, projectQueryRows } from '../src/postman.mjs';
import { queryContracts, assertQueryContract, assertOmissions, assertQueryRevision, warningRecord, orderedQuery } from '../src/query-policy.mjs';
import { createTemplateEnvironment } from '../src/chaining.mjs';
import { environmentYaml, assertSemanticEquivalence } from '../src/native-git.mjs';
import { assertEmptyPublicVariables } from '../src/public-safety.mjs';
const walk = items => items.flatMap(i => i.item ? walk(i.item) : [i]);
const parameter = (name, required, schema) => ({ name, in: 'query', ...(required === undefined ? {} : { required }), schema, description: `Description of ${name}` });
function fixture() {
  return { openapi: '3.0.3', info: { title: 'Query fixture', version: '1' }, servers: [{ url: 'https://api.cloudflare.com/client/v4' }],
    paths: { '/widgets': { parameters: [{ $ref: '#/components/parameters/inherited' }], get: { operationId: 'list',
      parameters: [parameter('required', true, { type: 'string', example: 'useful' }), parameter('optional', false, { type: 'string', example: 'not-sent' }),
        parameter('repeated', false, { type: 'array', items: { type: 'string' }, example: ['first', 'second'] }),
        parameter('object', false, { type: 'object', properties: { start: { type: 'string' }, end: { type: 'string' } }, example: { start: 'a', end: 'b' } }),
        parameter('count', true, { type: 'integer', default: 7 }), parameter('choice', true, { type: 'string', enum: ['one', 'two'] }),
        ...['account_id', 'account.id', 'zone_id', 'zone.id', 'tenant_id', 'organization_id'].map(n => parameter(n, true, { type: 'string', example: 'synthetic-id' }))],
      responses: { 200: { description: 'OK', content: { 'application/json': { schema: { type: 'string', example: 'primary-response' } } } } } } },
      '/other': { post: { operationId: 'other', parameters: [parameter('optional', undefined, { type: 'string', example: 'another' })],
        requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { organization_id: { type: 'string', example: 'body-must-stay' } } } } } }, responses: { 200: { description: 'OK' } } } } },
    components: { parameters: { inherited: parameter('inherited', true, { type: 'string', example: 'inherited-example' }) } } };
}
async function generate(schema) {
  return generateCollection(schema, { partition: { id: 'fixture', title: 'Fixture', description: 'Fixture' }, operations: listOperations(schema), commit: 'a'.repeat(40), schemaSha256: 'b'.repeat(64) });
}
test('official query state, examples/default/enum, repetition, object expansion, identifiers and raw URL apply globally', async () => {
  const schema = fixture(); const before = structuredClone(schema); const { collection } = await generate(schema);
  const items = walk(collection.item), request = items.find(i => i.request.method === 'GET').request;
  const query = request.url.query, byName = n => query.filter(q => q.key === n);
  assert.equal(byName('required')[0].value, 'useful'); assert.equal(byName('count')[0].value, '7');
  assert.ok(['one','two'].includes(byName('choice')[0].value));
  assert.deepEqual(byName('repeated').map(q => q.value), ['first','second']);
  assert.deepEqual(query.filter(q => ['start','end'].includes(q.key)).map(q => [q.key,q.value,q.disabled]), [['start','a',true],['end','b',true]]);
  for (const q of query) assert.equal(q.disabled, ['optional','repeated','start','end'].includes(q.key));
  for (const n of ['account_id','zone_id','tenant_id','organization_id']) assert.equal(byName(n)[0].value, `{{${n}}}`);
  assert.equal(byName('account.id')[0].value, '{{account_id}}'); assert.equal(byName('zone.id')[0].value, '{{zone_id}}');
  assert.equal(request.url.raw, makeRawUrl('/widgets', query)); assert.ok(!request.url.raw.includes('not-sent'));
  const enabled = structuredClone(query); enabled.find(q => q.key === 'optional').disabled = false;
  assert.ok(makeRawUrl('/widgets', enabled).includes('optional=not-sent'));
  const other = items.find(i => i.request.method === 'POST').request;
  assert.equal(other.url.raw, '{{base_url}}/other'); assert.equal(other.url.query[0].disabled, true);
  assert.ok(other.body.raw.includes('body-must-stay'));
  for (const item of items) for (const response of item.response ?? []) { const snapshot = structuredClone(item.request); delete snapshot.description; assert.deepEqual(response.originalRequest, snapshot); }
  const op = listOperations(before).find(o => o.method === 'GET'); assertQueryContract(request, before, op);
});
test('path inheritance, operation overrides and local refs resolve without changing the source', () => {
  const s = fixture(); s.paths['/widgets'].get.parameters.push(parameter('inherited', false, { type:'string' }));
  const before = structuredClone(s); const op = listOperations(s).find(o => o.method === 'GET');
  assert.equal(queryContracts(s,op).find(p => p.name === 'inherited').required,false); assert.deepEqual(s,before);
  s.paths['/widgets'].parameters[0].$ref = '#/missing'; assert.throws(() => queryContracts(s,op));
});
test('operation join fails closed for missing, duplicate and unexpected requests', () => {
  const operations = [{ key:'GET /widgets' }], item = { request: { method:'GET',url:{path:['widgets']} } };
  assert.equal(indexOperations({item:[item]},operations).size,1);
  for (const items of [[],[item,item],[{request:{method:'POST',url:{path:['widgets']}}}]]) assert.throws(() => indexOperations({item:items},operations));
});
test('query validation rejects unmapped, wrong-state, missing-required and nesting-error rows', () => {
  const s = fixture(), op = listOperations(s).find(o=>o.method==='GET');
  for (const query of [[{key:'unknown',value:'',disabled:true}],[{key:'required',value:'useful',disabled:true}],[],[{key:'required',value:'<Error: Too many levels of nesting to fake this schema>'}]]) {
    assert.throws(()=>assertQueryContract({url:{query}},s,op));
  }
});
test('optional scalar omissions are fingerprinted and still require explicit policy approval', () => {
  const s=fixture(),op=listOperations(s).find(o=>o.method==='POST');
  const result=assertQueryContract({url:{query:[]}},s,op);
  assert.equal(result.omissions.length,1);
  assert.equal(result.omissions[0].parameter,'optional');
  assert.match(result.omissions[0].parameterSha256,/^[0-9a-f]{64}$/u);
  assert.throws(()=>assertOmissions(result.omissions,[]));
});
test('revision-bound omission identities, schema fingerprints and warning drift fail closed', () => {
  assert.deepEqual(policy.omissions.map(o => `${o.operation} ${o.parameter}`).sort(), [
    ...['lists','locations','proxy_endpoints','rules'].map(name => `GET /accounts/{account_id}/gateway/${name} filter`),
    'GET /accounts/{account_id}/cloudforce-one/events search',
    'GET /accounts/{account_id}/devices/physical-devices has_registration_type',
    'GET /accounts/{account_id}/devices/registrations registration_type'
  ].sort());
  assert.equal(new Set(policy.omissions.map(o=>o.operation+o.parameter)).size,7);
  assertOmissions(policy.omissions,policy.omissions);
  for (const actual of [policy.omissions.slice(1),[...policy.omissions,{operation:'GET /new',parameter:'filter',parameterSha256:'changed'}],policy.omissions.map((o,i)=>i?o:{...o,parameterSha256:'changed'})]) assert.throws(()=>assertOmissions(actual,policy.omissions));
  const lock={commit:policy.upstreamCommit,schema:{sha256:policy.schemaSha256}}; assertQueryRevision(policy,lock,'6.3.3');
  assert.throws(()=>assertQueryRevision(policy,{...lock,commit:'changed'},'6.3.3'));assert.throws(()=>assertQueryRevision(policy,lock,'different'));
  const a=warningRecord(['Error while resolving allOf schema: conflict\n    at /synthetic/one:1']);
  assert.deepEqual(a,warningRecord(['Error while resolving allOf schema: conflict\n    at /synthetic/two:2']));
  assert.notEqual(a.sha256,warningRecord(['Error while resolving allOf schema: changed']).sha256);
  assert.notEqual(a.sha256,warningRecord(['Error while resolving allOf schema: conflict','Error while resolving allOf schema: conflict']).sha256);
  assert.throws(()=>warningRecord(['unexpected warning']));
});
test('tenant and organization variables are empty in the single v2/v3 environment model', () => {
  const v2=createTemplateEnvironment(),v3=YAML.parse(environmentYaml());assert.deepEqual(v3.values,v2.values);
  for(const key of ['tenant_id','organization_id'])assert.deepEqual(v2.values.find(v=>v.key===key),{key,value:'',type:'default',enabled:true});
  assertEmptyPublicVariables(v2.values,'fixture');
  for(const key of ['tenant_id','organization_id'])assert.throws(()=>assertEmptyPublicVariables(v2.values.map(v=>v.key===key?{...v,value:'synthetic'}:v),'fixture'));
});
test('official migration preserves ordered query semantics and validation rejects query corruption', async t => {
  const {collection}=await generate(fixture());const root=await mkdtemp(path.join(os.tmpdir(),'query-migrate-'));t.after(()=>rm(root,{recursive:true,force:true}));
  const input=path.join(root,'input.json'),out=path.join(root,'native');const {writeFile}=await import('node:fs/promises');await writeFile(input,JSON.stringify(collection));
  execFileSync('node_modules/.bin/postman',['collection','migrate',input,'-o',out]);
  execFileSync('node_modules/.bin/postman',['collection','lint',out,'--fail-severity','warning']);await assertSemanticEquivalence(collection,out);
  const file=(await readdir(out,{recursive:true})).find(f=>f.endsWith('.request.yaml')&&f.includes('widgets'));
  const candidates=(await readdir(out,{recursive:true})).filter(f=>f.endsWith('.request.yaml'));
  let target=file;
  for(const f of candidates){const r=YAML.parse(await readFile(path.join(out,f),'utf8'));if(Array.isArray(r.queryParams)&&r.queryParams.length>3)target=f;}
  const absolute=path.join(out,target),original=YAML.parse(await readFile(absolute,'utf8'));
  for(const change of [r=>r.queryParams.reverse(),r=>r.queryParams[0].value='changed',r=>r.queryParams[0].disabled=!r.queryParams[0].disabled,r=>r.queryParams[0].description='changed',r=>r.queryParams.pop(),r=>r.url+='?wrong=true']){
    const r=structuredClone(original);change(r);await writeFile(absolute,YAML.stringify(r));await assert.rejects(assertSemanticEquivalence(collection,out));
  }
  assert.notDeepEqual(orderedQuery([{key:'x',value:'a'},{key:'x',value:'b'}]),orderedQuery([{key:'x',value:'b'},{key:'x',value:'a'}]));
});

test('projection imports query rows only, with no secondary objects or aliases', () => {
  const primary={method:'GET',url:{path:['widgets'],raw:'baseline',query:[]},body:{raw:'primary'},header:[{key:'x',value:'primary'}],auth:{type:'noauth'},description:'primary'};
  const before=structuredClone(primary);const secondary={method:'POST',url:{path:['wrong'],raw:'wrong',query:[{key:'x',value:'official',disabled:true}]},body:{raw:'secondary'},header:[],auth:{type:'bearer'},description:'secondary',id:'secondary',name:'secondary',event:[]};
  projectQueryRows(primary,secondary);assert.deepEqual(primary,{...before,url:{...before.url,query:secondary.url.query}});
  secondary.url.query[0].value='changed';assert.equal(primary.url.query[0].value,'official');
});
test('pinned distribution preserves query contracts, exact omissions, Organizations and five repaired identities', async () => {
  const {fetchPinnedSchema}=await import('../src/upstream.mjs');const {destination}=await fetchPinnedSchema();const schema=JSON.parse(await readFile(destination));
  const operations=new Map(listOperations(schema).map(o=>[o.key,o]));const manifest=JSON.parse(await readFile('dist/v2.1/manifest.json'));const omissions=[];let enabled=0,disabled=0;const items=new Map();
  for(const partition of manifest.partitions){const c=JSON.parse(await readFile('dist/v2.1/'+partition.file));for(const i of walk(c.item)){const key=i.request.method+' /'+i.request.url.path.join('/').replaceAll('{{','{').replaceAll('}}','}');const result=assertQueryContract(i.request,schema,operations.get(key));omissions.push(...result.omissions);enabled+=result.enabled;disabled+=result.disabled;items.set(key,i);}}
  assertOmissions(omissions,policy.omissions);assert.equal(items.size,3522);assert.equal(enabled,141);assert.equal(disabled,8070);
  for(const [key,url,count]of [['GET /organizations','{{base_url}}/organizations',11],['GET /organizations/{organization_id}/accounts','{{base_url}}/organizations/{{organization_id}}/accounts',14]]){const r=items.get(key).request;assert.equal(r.url.raw,url);assert.equal(r.url.query.length,count);assert.ok(r.url.query.every(q=>q.disabled===true));}
  for(const p of ['/accounts/{account_id}/iam/resource_groups','/accounts/{account_id}/iam/user_groups','/user/spectrum_analytics/zones/report','/zones/{zone_id}/spectrum/analytics/events/bytime','/zones/{zone_id}/spectrum/analytics/events/summary']){const q=items.get('GET '+p).request.url.query;for(const name of p.includes('/iam/')?['id']:['since','until'])assert.ok(q.some(v=>v.key===name&&v.disabled===true));assert.ok(!q.some(v=>['description','title','value'].includes(v.key)));}
  assert.equal(manifest.partitions.reduce((n,p)=>n+p.converterWarningCount,0),47);
  assert.equal(manifest.partitions.reduce((n,p)=>n+p.queryProjection.secondaryWarnings.count,0),539);
});

test('secondary runtime cannot mutate primary converter generation state', async () => {
  const { convert } = await import('../src/postman.mjs');
  const { createQueryConverter } = await import('../src/query-process.mjs');
  const schema=fixture();schema.paths['/other'].post.requestBody.content['application/json'].schema.properties.enabled={type:'boolean'};
  const bodies = collection => walk(collection.item).map(i=>({body:i.request.body,responses:(i.response??[]).map(r=>r.body)}));
  const before=await convert(structuredClone(schema));
  const worker=createQueryConverter();
  try { await worker.convert(structuredClone(schema),listOperations(schema)); }
  finally { await worker.close(); }
  const after=await convert(structuredClone(schema));
  assert.deepEqual(bodies(after.collection),bodies(before.collection));
});
