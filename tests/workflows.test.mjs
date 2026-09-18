import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { parse } from 'yaml';
import { ROOT } from '../src/constants.mjs';

const workflowDirectory = path.join(ROOT, '.github', 'workflows');

async function workflowFiles() {
  return (await readdir(workflowDirectory)).filter((file) => file.endsWith('.yml')).sort();
}

test('GitHub Actions workflows parse and pin every external action by commit SHA', async () => {
  const files = await workflowFiles();
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

test('only the scheduled upstream updater may request pull-request write access and Actions never auto-approves', async () => {
  for (const file of await workflowFiles()) {
    const source = await readFile(path.join(workflowDirectory, file), 'utf8');
    const workflow = parse(source);
    const jobs = Object.values(workflow.jobs ?? {});
    const prWriteJobs = jobs.filter((job) => job?.permissions?.['pull-requests'] === 'write');

    // GitHub's repository switch permits both PR creation and approval. Repository
    // policy intentionally uses the creation half only; approval remains human-owned.
    assert.notEqual(workflow.permissions?.['pull-requests'], 'write', `${file} grants top-level pull-request write access`);
    assert.doesNotMatch(source, /gh\s+pr\s+review\b[\s\S]*?--approve/iu, `${file} attempts to auto-approve a PR`);
    assert.doesNotMatch(source, /pulls\.createReview|event\s*:\s*['"]?APPROVE|state\s*:\s*['"]?APPROVE/iu,
      `${file} attempts to submit an approving review`);

    if (file === 'upstream-drift.yml') {
      assert.deepEqual(workflow.permissions, {}, 'upstream updater must keep top-level permissions empty');
      assert.deepEqual(Object.keys(workflow.on ?? {}).sort(), ['schedule', 'workflow_dispatch']);
      assert.equal(prWriteJobs.length, 1, 'only the updater job may receive pull-request write access');
      assert.equal(workflow.jobs.update.permissions.contents, 'write');
      assert.equal(workflow.jobs.update.permissions['pull-requests'], 'write');
    } else {
      assert.equal(prWriteJobs.length, 0, `${file} must not receive pull-request write access`);
    }
  }
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
