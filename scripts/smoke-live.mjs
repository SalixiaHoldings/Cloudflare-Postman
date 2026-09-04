import { resolveUniqueResource, verifyTokenFixture } from '../src/chaining.mjs';
import { DEFAULT_BASE_URL } from '../src/constants.mjs';

const token = process.env.CLOUDFLARE_API_TOKEN;
if (!token) {
  throw new Error('CLOUDFLARE_API_TOKEN is required for the opt-in read-only live smoke test.');
}

const baseUrl = process.env.CLOUDFLARE_API_BASE_URL || DEFAULT_BASE_URL;
const headers = { authorization: `Bearer ${token}`, accept: 'application/json' };

async function getJson(apiPath, parameters = {}) {
  const url = new URL(`${baseUrl}${apiPath}`);
  for (const [key, value] of Object.entries(parameters)) {
    if (value) url.searchParams.set(key, value);
  }
  const response = await fetch(url, { method: 'GET', headers });
  let body;
  try {
    body = await response.json();
  } catch (error) {
    throw new Error(`GET ${apiPath} returned non-JSON HTTP ${response.status}.`, { cause: error });
  }
  if (!response.ok) {
    const details = (body.errors ?? []).map((entry) => entry.message).filter(Boolean).join('; ');
    throw new Error(`GET ${apiPath} failed with HTTP ${response.status}: ${details || 'unknown error'}`);
  }
  return body;
}

async function listAll(apiPath, parameters = {}) {
  const items = [];
  let page = 1;
  let totalPages = 1;
  do {
    const envelope = await getJson(apiPath, { ...parameters, page: String(page), per_page: '50' });
    if (envelope.success !== true || !Array.isArray(envelope.result)) {
      throw new Error(`GET ${apiPath} returned an invalid Cloudflare result envelope.`);
    }
    if (!envelope.result_info || !Number.isInteger(envelope.result_info.total_pages)) {
      throw new Error(`GET ${apiPath} did not return the expected pagination metadata.`);
    }
    totalPages = envelope.result_info.total_pages;
    if (totalPages < page || totalPages > 1000) {
      throw new Error(`GET ${apiPath} returned invalid pagination bounds.`);
    }
    items.push(...envelope.result);
    page += 1;
  } while (page <= totalPages);
  return items;
}

const tokenEnvelope = await getJson('/user/tokens/verify');
verifyTokenFixture(tokenEnvelope);

const accounts = await listAll('/accounts');
const account = resolveUniqueResource(accounts, {
  id: process.env.CLOUDFLARE_ACCOUNT_ID,
  name: process.env.CLOUDFLARE_ACCOUNT_NAME,
  label: 'Account'
});
const zones = await listAll('/zones', { 'account.id': account.id });
resolveUniqueResource(zones, {
  id: process.env.CLOUDFLARE_ZONE_ID,
  name: process.env.CLOUDFLARE_ZONE_NAME,
  label: 'Zone'
});

console.log('Read-only Cloudflare live smoke test passed: token, envelope, pagination, account, and zone chaining.');
