import path from 'node:path';
import { CACHE_DIR, ROOT } from './constants.mjs';
import { fetchVerified, readJson } from './io.mjs';

export async function readSchemaLock() {
  return readJson(path.join(ROOT, 'schema-lock.json'));
}

export async function readToolchainLock() {
  return readJson(path.join(ROOT, 'toolchain-lock.json'));
}

export async function fetchPinnedSchema() {
  const lock = await readSchemaLock();
  const destination = path.join(CACHE_DIR, 'cloudflare', lock.commit, lock.schema.path);
  await fetchVerified({
    url: lock.schema.url,
    sha: lock.schema.sha256,
    destination,
    expectedBytes: lock.schema.bytes
  });
  return { lock, destination };
}

export async function fetchPostmanCollectionSchema() {
  const lock = await readToolchainLock();
  const destination = path.join(CACHE_DIR, 'postman', 'collection-v2.1.0.schema.json');
  await fetchVerified({
    url: lock.collectionSchema.url,
    sha: lock.collectionSchema.sha256,
    destination
  });
  return destination;
}

export async function fetchLatestUpstreamCommit() {
  const response = await fetch('https://api.github.com/repos/cloudflare/api-schemas/commits/main', {
    headers: {
      accept: 'application/vnd.github+json',
      'user-agent': '@salixiaholdings/cloudflare-postman/0.1.0',
      'x-github-api-version': '2022-11-28'
    }
  });
  if (!response.ok) {
    throw new Error(`Unable to resolve Cloudflare api-schemas main: ${response.status} ${response.statusText}`);
  }
  const result = await response.json();
  if (!/^[0-9a-f]{40}$/u.test(result.sha ?? '')) {
    throw new Error('GitHub returned an invalid api-schemas commit SHA.');
  }
  return result.sha;
}
