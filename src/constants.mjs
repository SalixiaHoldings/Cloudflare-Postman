import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const CACHE_DIR = path.join(ROOT, '.cache');
export const POSTMAN_DIR = path.join(ROOT, 'postman');
export const HTTP_METHODS = new Set([
  'get',
  'put',
  'post',
  'delete',
  'patch',
  'options',
  'head',
  'trace'
]);
export const COLLECTION_SCHEMA_URL =
  'https://schema.getpostman.com/json/collection/v2.1.0/collection.json';
export const DEFAULT_BASE_URL = 'https://api.cloudflare.com/client/v4';
