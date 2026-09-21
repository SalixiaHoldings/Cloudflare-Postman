// Finite candidate construction only. Callers must independently validate every
// candidate with the complete Ajv request view before emitting a template.
const patterns = new Set([
  '^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$',
  '^[a-zA-Z0-9_-]+$'
]);
export const CONSTRUCTION_LIMIT = 256;

export function stringCandidates(nodes, existingStringSlot = false) {
  // An existing quoted variable establishes a string slot even in a permissive
  // additionalProperties schema. This never authorizes creating an untyped value.
  if (!nodes.some(node => node.type === 'string') &&
    !(existingStringSlot && nodes.every(node => !node.type))) return [];
  if (nodes.some(node => node.pattern && !patterns.has(node.pattern))) return [];
  const formats = [...new Set(nodes.map(node => node.format).filter(Boolean))];
  if (formats.some(format => !['uuid', 'uri'].includes(format))) return [];
  const minimum = Math.max(1, ...nodes.map(node => node.minLength ?? 0));
  if (minimum > 4096) return [];
  return [...new Set([
    ...(formats.includes('uuid') ? ['00000000-0000-4000-8000-000000000000'] : []),
    ...(formats.includes('uri') ? ['https://example.invalid/'] : []),
    ...(!formats.length ? ['a'.repeat(minimum)] : [])
  ])];
}

function adjacent(value, direction) {
  if (value === 0) return direction * Number.MIN_VALUE;
  const bytes = new DataView(new ArrayBuffer(8));
  bytes.setFloat64(0, value);
  bytes.setBigUint64(0, bytes.getBigUint64(0) + (Math.sign(value) === direction ? 1n : -1n));
  return bytes.getFloat64(0);
}

export function primitiveCandidates(nodes) {
  if (nodes.some(node => node.type === 'boolean')) return [false, true];
  if (!nodes.some(node => ['number', 'integer'].includes(node.type))) return [];
  const integer = nodes.some(node => node.type === 'integer');
  const candidates = [0, 1, -1];
  for (const node of nodes) for (const [bound, direction] of [['minimum', 1], ['maximum', -1]]) {
    if (!Number.isFinite(node[bound])) continue;
    const value = node[bound], exclusive = node[bound === 'minimum' ? 'exclusiveMinimum' : 'exclusiveMaximum'];
    candidates.push(value, integer ? (direction > 0 ? Math.ceil(value) : Math.floor(value)) : value,
      integer ? (direction > 0 ? Math.floor(value) + 1 : Math.ceil(value) - 1) : adjacent(value, direction));
    if (exclusive) candidates.push(value + direction);
  }
  const multiples = nodes.map(node => node.multipleOf).filter(value => Number.isFinite(value) && value > 0);
  for (const value of [...candidates]) for (const multiple of multiples) {
    const quotient = value / multiple;
    for (const factor of [Math.floor(quotient) - 1, Math.floor(quotient), Math.ceil(quotient), Math.ceil(quotient) + 1]) {
      candidates.push(factor * multiple);
    }
  }
  return [...new Set(candidates.filter(Number.isFinite))].slice(0, CONSTRUCTION_LIMIT);
}

export function templateVariable(trail) {
  // Include the property path to distinguish repeated leaf names in nested objects.
  const name = trail.map(part => String(part).replace(/[^a-zA-Z0-9_]/gu,
    character => `_u${character.codePointAt(0).toString(16)}_`)).join('__') || 'body';
  return `{{${name}}}`;
}
