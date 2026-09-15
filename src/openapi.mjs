import { HTTP_METHODS } from './constants.mjs';
import { sha256, stableJson } from './io.mjs';
import { authenticationSupport } from './auth.mjs';

export function listOperations(schema) {
  const operations = [];
  for (const [apiPath, pathItem] of Object.entries(schema.paths ?? {})) {
    for (const [method, operation] of Object.entries(pathItem ?? {})) {
      if (!HTTP_METHODS.has(method.toLowerCase())) continue;
      operations.push({
        key: `${method.toUpperCase()} ${apiPath}`,
        method: method.toUpperCase(),
        methodLower: method.toLowerCase(),
        path: apiPath,
        operation,
        operationId: operation.operationId,
        tags: operation.tags ?? [],
        deprecated: operation.deprecated === true,
        fingerprint: sha256(stableJson(operation)),
        authSupport: authenticationSupport(schema, operation)
      });
    }
  }
  return operations.sort((left, right) => left.key.localeCompare(right.key));
}

export function subsetSchema(schema, partition, operations) {
  const selected = new Map(operations.map((operation) => [operation.path, new Set([operation.methodLower])]));
  for (const operation of operations) {
    selected.get(operation.path).add(operation.methodLower);
  }
  const paths = {};
  for (const apiPath of [...selected.keys()].sort()) {
    const pathItem = schema.paths[apiPath];
    const next = {};
    for (const [key, value] of Object.entries(pathItem)) {
      if (!HTTP_METHODS.has(key.toLowerCase()) || selected.get(apiPath).has(key.toLowerCase())) {
        next[key] = value;
      }
    }
    paths[apiPath] = next;
  }
  const usedTags = new Set(operations.flatMap((operation) => operation.tags));
  return {
    openapi: schema.openapi,
    info: {
      ...schema.info,
      title: `Cloudflare API — ${partition.title}`,
      description: `${partition.description}\n\nGenerated from Cloudflare's official OpenAPI schema.`
    },
    servers: schema.servers,
    ...(Object.hasOwn(schema, 'security') ? { security: schema.security } : {}),
    tags: (schema.tags ?? []).filter((tag) => usedTags.has(tag.name)),
    paths,
    components: schema.components
  };
}
