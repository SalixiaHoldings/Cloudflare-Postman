import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { parse } from 'yaml';
import { ROOT } from '../src/constants.mjs';

const workflowDirectory = path.join(ROOT, '.github', 'workflows');

test('GitHub Actions workflows parse and pin every external action by commit SHA', async () => {
  const files = (await readdir(workflowDirectory)).filter((file) => file.endsWith('.yml')).sort();
  assert.deepEqual(files, ['live-smoke.yml', 'upstream-drift.yml', 'validate.yml']);
  for (const file of files) {
    const source = await readFile(path.join(workflowDirectory, file), 'utf8');
    assert.doesNotThrow(() => parse(source), file);
    for (const match of source.matchAll(/uses:\s*[^@\s]+@([^\s#]+)/gu)) {
      assert.match(match[1], /^[0-9a-f]{40}$/u, `${file} has an unpinned action ref`);
    }
    assert.doesNotMatch(source, /gh\s+pr\s+merge|merge-pull-request/iu);
  }
});

test('PR validation cannot access live Cloudflare secrets', async () => {
  const validate = await readFile(path.join(workflowDirectory, 'validate.yml'), 'utf8');
  assert.match(validate, /pull_request:/u);
  assert.doesNotMatch(validate, /secrets\./u);
  const smoke = await readFile(path.join(workflowDirectory, 'live-smoke.yml'), 'utf8');
  assert.doesNotMatch(smoke, /pull_request:/u);
});

test('upstream updater and hosted gate include both generated distributions', async () => {
  const drift = await readFile(path.join(workflowDirectory, 'upstream-drift.yml'), 'utf8');
  const validation = await readFile(path.join(workflowDirectory, 'validate.yml'), 'utf8');
  assert.match(drift, /git add[^\n]*dist postman/u);
  assert.match(validation, /git diff --exit-code -- dist postman/u);
  const generator = await readFile(path.join(ROOT,'src/generate.mjs'),'utf8');
  assert.match(generator,/await generateNative\(temporary\)/u);
  const updater = await readFile(path.join(ROOT,'scripts/upstream-update.mjs'),'utf8');
  assert.match(updater,/await generateAll\(/u);
  assert.match(updater,/await validateAll\(/u);
});
