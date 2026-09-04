import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { format } from 'node:util';
import { DEFAULT_BASE_URL } from './constants.mjs';
import { applyAuthentication, AUTH_VARIABLES } from './auth.mjs';

const require = createRequire(import.meta.url);
const converter = require('openapi-to-postmanv2');
const schemaFaker = require('openapi-to-postmanv2/assets/json-schema-faker.js');

function deterministicUuid(seed) {
  const digest = createHash('sha256').update(seed).digest('hex').slice(0, 32).split('');
  digest[12] = '5';
  digest[16] = ['8', '9', 'a', 'b'][Number.parseInt(digest[16], 16) % 4];
  return `${digest.slice(0, 8).join('')}-${digest.slice(8, 12).join('')}-${digest
    .slice(12, 16)
    .join('')}-${digest.slice(16, 20).join('')}-${digest.slice(20).join('')}`;
}

function convert(schema) {
  return new Promise((resolve, reject) => {
    const warnings = [];
    const originalWarn = console.warn;
    const originalError = console.error;
    const originalRandom = Math.random;
    const OriginalDate = Date;
    const originalSchemaRandom = schemaFaker.option('random');
    const seed = Number.parseInt(
      createHash('sha256').update(schema.info?.title ?? 'cloudflare-postman').digest('hex').slice(0, 8),
      16
    );
    let randomState = seed >>> 0;
    const seededRandom = () => {
      randomState += 0x6d2b79f5;
      let value = randomState;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
    Math.random = seededRandom;
    schemaFaker.option({ random: seededRandom });
    const fixedNow = OriginalDate.parse('2000-01-01T00:00:00.000Z');
    globalThis.Date = class extends OriginalDate {
      constructor(...arguments_) {
        super(...(arguments_.length ? arguments_ : [fixedNow]));
      }

      static now() {
        return fixedNow;
      }
    };
    console.warn = (...arguments_) => warnings.push(format(...arguments_));
    console.error = (...arguments_) => warnings.push(format(...arguments_));
    const restoreConsole = () => {
      console.warn = originalWarn;
      console.error = originalError;
      Math.random = originalRandom;
      globalThis.Date = OriginalDate;
      schemaFaker.option({ random: originalSchemaRandom });
    };
    try {
      converter.convert(
        { type: 'json', data: schema },
        {
          folderStrategy: 'Paths',
          includeAuthInfoInExample: false,
          includeDeprecated: true,
          keepImplicitHeaders: false,
          optimizeConversion: true,
          requestNameSource: 'Fallback',
          requestParametersResolution: 'Example',
          exampleParametersResolution: 'Example',
          schemaFaker: false
        },
        (error, result) => {
          restoreConsole();
          if (error) return reject(error);
          if (!result?.result || result.output?.length !== 1) {
            return reject(new Error(`Postman conversion failed: ${result?.reason ?? 'unknown error'}`));
          }
          resolve({ collection: result.output[0].data, warnings });
        }
      );
    } catch (error) {
      restoreConsole();
      reject(error);
    }
  });
}

function requestPath(request) {
  const pathSegments = request.url?.path;
  if (Array.isArray(pathSegments)) {
    return `/${pathSegments
      .map((segment) =>
        String(segment)
          .replace(/^:([^/]+)$/u, '{$1}')
          .replace(/\{\{([^}]+)\}\}/gu, '{$1}')
      )
      .join('/')}`;
  }
  const raw = typeof request.url === 'string' ? request.url : request.url?.raw ?? '';
  const withoutQuery = raw.split('?')[0];
  return withoutQuery
    .replace(DEFAULT_BASE_URL, '')
    .replace(/^\{\{baseUrl\}\}/u, '')
    .replace(/^\{\{base_url\}\}/u, '')
    .replace(/:([^/]+)/gu, '{$1}');
}

function makeRawUrl(apiPath, query) {
  const pathWithVariables = apiPath.replace(/\{([^}]+)\}/gu, '{{$1}}');
  const queryString = (query ?? [])
    .filter((entry) => entry && entry.disabled !== true)
    .map((entry) => `${entry.key}=${entry.value ?? ''}`)
    .join('&');
  return `{{base_url}}${pathWithVariables}${queryString ? `?${queryString}` : ''}`;
}

function coreIdentifierVariable(key) {
  const normalized = String(key).toLowerCase();
  if (normalized === 'account_id' || normalized === 'account.id') return '{{account_id}}';
  if (normalized === 'zone_id' || normalized === 'zone.id') return '{{zone_id}}';
  if (/(?:^|_)(?:api_?key|api_?token|access_?token|refresh_?token|secret|password|token_uuid)(?:_|$)/iu.test(normalized)) {
    return `{{${normalized.replace(/[^a-z0-9_]/gu, '_')}}}`;
  }
  return undefined;
}

function replaceCoreIdentifiers(value) {
  if (Array.isArray(value)) return value.map(replaceCoreIdentifiers);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => [
      key,
      coreIdentifierVariable(key) ?? replaceCoreIdentifiers(child)
    ])
  );
}

function sanitizeJsonString(value) {
  try {
    return JSON.stringify(replaceCoreIdentifiers(JSON.parse(value)), null, 2);
  } catch {
    return value;
  }
}

function sanitizeRequestIdentifiers(request) {
  for (const query of request.url?.query ?? []) {
    query.value = coreIdentifierVariable(query.key) ?? query.value;
  }
  if (typeof request.body?.raw === 'string') {
    request.body.raw = sanitizeJsonString(request.body.raw);
  }
}

function normalizeUuidIds(value, seed, breadcrumb = []) {
  if (Array.isArray(value)) {
    value.forEach((child, index) => normalizeUuidIds(child, seed, [...breadcrumb, String(index)]));
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    const nextBreadcrumb = [...breadcrumb, key];
    if (
      key === 'id' &&
      typeof child === 'string' &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(child)
    ) {
      value[key] = deterministicUuid(`${seed}:${nextBreadcrumb.join('.')}`);
    } else {
      normalizeUuidIds(child, seed, nextBreadcrumb);
    }
  }
}

function normalizeCollection(collection, { partition, operations, commit, schemaSha256 }) {
  const expected = new Map(operations.map((operation) => [operation.key, operation]));
  const represented = new Set();

  function visit(items, ancestry = []) {
    for (const item of items ?? []) {
      if (Array.isArray(item.item)) {
        item.id = deterministicUuid(`${partition.id}:folder:${[...ancestry, item.name].join('/')}`);
        visit(item.item, [...ancestry, item.name]);
        continue;
      }
      if (!item.request) continue;
      const method = String(item.request.method ?? '').toUpperCase();
      const apiPath = requestPath(item.request);
      const key = `${method} ${apiPath}`;
      const operation = expected.get(key);
      if (!operation) {
        throw new Error(`Converter emitted an unrecognized request in ${partition.id}: ${key}`);
      }
      if (represented.has(key)) {
        throw new Error(`Converter emitted a duplicate request in ${partition.id}: ${key}`);
      }
      represented.add(key);
      item.id = deterministicUuid(`${partition.id}:${key}`);
      item.name = operation.operation.summary || operation.operationId || key;
      const originalDescription = operation.operation.description || operation.operation.summary || '';
      item.request.description =
        `GENERATED FILE — DO NOT EDIT.\n\nUpstream operation: ${operation.operationId}\n${key}` +
        (originalDescription ? `\n\n${originalDescription}` : '');
      applyAuthentication(item, operation.authSupport);
      sanitizeRequestIdentifiers(item.request);
      if (typeof item.request.url === 'string') {
        item.request.url = { raw: makeRawUrl(apiPath), host: ['{{base_url}}'], path: [] };
      } else {
        item.request.url.raw = makeRawUrl(apiPath, item.request.url.query);
        item.request.url.host = ['{{base_url}}'];
        item.request.url.path = apiPath
          .split('/')
          .filter(Boolean)
          .map((segment) => segment.replace(/^\{([^}]+)\}$/u, '{{$1}}'));
        delete item.request.url.protocol;
        delete item.request.url.variable;
      }
      for (const response of item.response ?? []) {
        if (typeof response.body === 'string') response.body = sanitizeJsonString(response.body);
        response.originalRequest = structuredClone(item.request);
        delete response.originalRequest.description;
      }
    }
  }

  visit(collection.item);
  const missing = [...expected.keys()].filter((key) => !represented.has(key));
  if (missing.length) {
    throw new Error(
      `Converter omitted ${missing.length} operation(s) in ${partition.id}: ${missing.slice(0, 10).join(', ')}`
    );
  }
  collection.info._postman_id = deterministicUuid(`collection:${partition.id}:${commit}`);
  collection.info.name = `Cloudflare API — ${partition.title}`;
  collection.info.schema = 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json';
  collection.info.description =
    `GENERATED FILE — DO NOT EDIT.\n\n${partition.description}\n\n` +
    `Upstream: cloudflare/api-schemas@${commit}\nSchema SHA-256: ${schemaSha256}\n` +
    `Operations: ${operations.length}\nFormat: Postman Collection v2.1`;
  collection.auth = {
    type: 'bearer',
    bearer: [{ key: 'token', value: '{{api_token}}', type: 'string' }]
  };
  collection.variable = [
    { key: 'base_url', value: DEFAULT_BASE_URL, type: 'string' },
    ...AUTH_VARIABLES.map((key) => ({ key, value: '', type: 'string' })),
    { key: 'account_id', value: '', type: 'string' },
    { key: 'zone_id', value: '', type: 'string' }
  ];
  normalizeUuidIds(collection, `${partition.id}:${commit}`);
  return { collection, represented: [...represented] };
}

export async function generateCollection(schema, context) {
  const converted = await convert(schema);
  return { ...normalizeCollection(converted.collection, context), warnings: converted.warnings };
}
