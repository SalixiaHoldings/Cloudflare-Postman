import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

export function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

export async function readJson(file) {
  return JSON.parse(await readFile(file, 'utf8'));
}

export function stableObject(value) {
  if (Array.isArray(value)) {
    return value.map(stableObject);
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, stableObject(child)])
    );
  }
  return value;
}

export function stableJson(value) {
  return `${JSON.stringify(stableObject(value), null, 2)}\n`;
}

export async function writeJson(file, value) {
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.tmp`;
  await writeFile(temporary, stableJson(value));
  await rename(temporary, file);
}

export async function fetchVerified({ url, sha, destination, expectedBytes }) {
  try {
    const cached = await readFile(destination);
    if (sha256(cached) === sha && (!expectedBytes || cached.length === expectedBytes)) {
      return cached;
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  const response = await fetch(url, {
    headers: {
      accept: 'application/json, text/plain;q=0.9, */*;q=0.8',
      'user-agent': '@salixiaholdings/cloudflare-postman/0.1.0'
    },
    redirect: 'follow'
  });
  if (!response.ok) {
    throw new Error(`Unable to fetch ${url}: ${response.status} ${response.statusText}`);
  }
  const body = Buffer.from(await response.arrayBuffer());
  const actualSha = sha256(body);
  if (actualSha !== sha) {
    throw new Error(`SHA-256 mismatch for ${url}: expected ${sha}, received ${actualSha}`);
  }
  if (expectedBytes && body.length !== expectedBytes) {
    throw new Error(`Size mismatch for ${url}: expected ${expectedBytes}, received ${body.length}`);
  }
  await mkdir(path.dirname(destination), { recursive: true });
  const temporary = `${destination}.tmp`;
  await writeFile(temporary, body);
  await rename(temporary, destination);
  return body;
}
