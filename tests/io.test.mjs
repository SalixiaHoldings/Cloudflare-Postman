import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fetchVerified, sha256 } from '../src/io.mjs';

test('parallel cold-cache downloads publish verified bytes atomically without sharing staging files', async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'fictional-schema-cache-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const body = Buffer.from('{"fixture":"fictional-pinned-schema"}');
  const destination = path.join(root, 'schema.json');
  const count = 16;
  let received = 0, release;
  const ready = new Promise(resolve => { release = resolve; });
  t.mock.method(globalThis, 'fetch', async () => {
    if (++received === count) release();
    await ready;
    return new Response(body);
  });
  const request = { url: 'https://fictional.invalid/schema.json', sha: sha256(body), expectedBytes: body.length, destination };
  const results = await Promise.all(Array.from({ length: count }, () => fetchVerified(request)));
  assert.equal(received, count);
  for (const result of results) assert.deepEqual(result, body);
  assert.deepEqual(await readFile(destination), body);
  assert.deepEqual(await readdir(root), ['schema.json']);
  await assert.rejects(fetchVerified({ ...request, sha: '0'.repeat(64) }), /SHA-256 mismatch/u);
  await assert.rejects(fetchVerified({ ...request, expectedBytes: body.length + 1 }), /Size mismatch/u);
  assert.deepEqual(await readFile(destination), body);
  assert.deepEqual(await readdir(root), ['schema.json']);
});
