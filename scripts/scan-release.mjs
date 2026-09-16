// Run after generate:check: scan all Native Git files without blanket rule exclusions.
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import YAML from 'yaml';
import { ROOT } from '../src/constants.mjs';
import { fetchPinnedSchema } from '../src/upstream.mjs';
import { listOperations } from '../src/openapi.mjs';
import { filesUnder } from '../src/native-git.mjs';

const execute = promisify(execFile);
const scanner = process.env.GITLEAKS_BIN || 'gitleaks';
assert.equal((await execute(scanner,['version'])).stdout.trim(),'8.30.1','Use pinned Gitleaks 8.30.1.');
const temporary = await mkdtemp(path.join(os.tmpdir(),'cloudflare-release-scan-'));
try {
  const report = path.join(temporary,'findings.json');
  try { await execute(scanner,['dir',path.join(ROOT,'postman'),'--no-banner','--report-format','json','--report-path',report]); }
  catch (error) { if (error.code !== 1) throw new Error('Gitleaks scan failed before review.'); }
  const findings = JSON.parse(await readFile(report,'utf8'));
  const { destination } = await fetchPinnedSchema();
  const schema = JSON.parse(await readFile(destination,'utf8'));
  const strings = [];
  function walk(value, output) {
    if (typeof value === 'string') output.push(value);
    else if (value && typeof value === 'object') Object.values(value).forEach(child=>walk(child,output));
  }
  walk(schema,strings);
  const upstreamStrings = [...strings];
  // Gitleaks also inspects encoded public samples. Match their decoded bytes to the same verified source.
  for (const value of upstreamStrings) if (value.length > 64 && /^[A-Za-z0-9+/=\s]+$/u.test(value)) {
    strings.push(Buffer.from(value,'base64').toString('utf8'));
  }
  const fingerprints = new Set(listOperations(schema).map(operation=>operation.authSupport.fingerprint));
  const workerV2 = await readFile(path.join(ROOT,'dist/v2.1/reference/workers-developer-platform.postman_collection.json'),'utf8');
  const manifest = JSON.parse(await readFile(path.join(ROOT,'dist/v2.1/manifest.json'),'utf8'));
  const generatedEmails = new Set();
  function requestItems(items) { return (items ?? []).flatMap(item=>item.item ? requestItems(item.item) : [item]); }
  for (const partition of manifest.partitions) {
    const collection = JSON.parse(await readFile(path.join(ROOT,'dist/v2.1',partition.file),'utf8'));
    for (const item of requestItems(collection.item)) {
      const request = item.request;
      const apiPath = '/' + request.url.path.map(segment=>segment.replace(/^\{\{(.+)\}\}$/u,'{$1}')).join('/');
      const declaration = schema.paths[apiPath]?.[request.method.toLowerCase()];
      for (const parameter of declaration?.parameters ?? []) {
        if (parameter.in === 'query' && parameter.schema?.format === 'email' &&
          parameter.example === undefined && parameter.examples === undefined && parameter.schema.example === undefined) {
          const value = request.url.query?.find(query=>query.key === parameter.name)?.value;
          if (value) generatedEmails.add(value);
        }
      }
    }
  }
  const compact = value => value.replaceAll('\\n','\n').replace(/\s/gu,'');
  const counts = { authFingerprints:0, upstreamExamples:0, syntheticTokenIds:0, unresolved:0, upstreamEmailOccurrences:0, syntheticEmailOccurrences:0 };
  for (const finding of findings) {
    if (finding.RuleID === 'generic-api-key' && finding.Match === `Auth declaration SHA-256: ${finding.Secret}` && fingerprints.has(finding.Secret)) counts.authFingerprints++;
    else if (strings.some(value=>value.includes(finding.Secret) || value.includes(finding.Secret.replaceAll('\\n','\n'))) ||
      (finding.RuleID === 'private-key' && strings.some(value=>compact(value).includes(compact(finding.Secret))))) counts.upstreamExamples++;
    // The pinned schema's AI Search token_id has format: uuid with no example. The seeded v2
    // converter supplies these fixtures. generate:check must prove their source before release.
    else if (finding.RuleID === 'generic-api-key' && finding.Match === `token_id": "${finding.Secret}"` &&
      /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/u.test(finding.Secret) &&
      finding.File.includes('/workers-developer-platform/') && finding.File.includes('/ai-search/') && workerV2.includes(finding.Secret)) counts.syntheticTokenIds++;
    else counts.unresolved++;
  }
  for (const file of await filesUnder(path.join(ROOT,'postman'))) {
    const values = [];
    walk(YAML.parse(await readFile(path.join(ROOT,'postman',file),'utf8')),values);
    for (const value of values) for (const [email] of value.matchAll(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/giu)) {
      if (upstreamStrings.some(source=>source.includes(email))) counts.upstreamEmailOccurrences++;
      else if (generatedEmails.has(email)) counts.syntheticEmailOccurrences++;
      else counts.unresolved++;
    }
  }
  console.log(JSON.stringify({ scanner:'gitleaks@8.30.1', findings:findings.length, ...counts }));
  assert.equal(counts.unresolved,0,'Unexplained secret/PII candidates require review; values are not printed.');
} finally { await rm(temporary,{recursive:true,force:true}); }
