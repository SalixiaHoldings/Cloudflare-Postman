import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import Ajv from 'ajv-draft-04';
import addFormats from 'ajv-formats';
import conflictPolicy from '../config/request-body-conflicts.json' with { type: 'json' };
import { CONSTRUCTION_LIMIT, stringCandidates, primitiveCandidates, templateVariable } from './request-construction.mjs';

const OMIT = Symbol('omit');
const own = (value, key) => Object.hasOwn(value, key);
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const EMPTY = Object.freeze({});
const variable = value => typeof value === 'string' && /^\{\{[^{}]+\}\}$/u.test(value);
const annotations = new Set(['title', 'description', 'readOnly', 'writeOnly', 'deprecated', 'xml', 'externalDocs']);
export const INCOMPLETE_BODY_WARNING = 'WARNING — source-incomplete: the pinned OpenAPI does not contain sufficient request-body semantics to safely generate the required value. This body template is incomplete; the converter representation has been preserved.';

export const CONFLICT_BODY_WARNING = 'WARNING — source-conflict: the pinned request schema declares a string body together with object properties. This preserved converter template is not schema-valid; resolve the source contract before use.';

export function summarizeBodyResults(results) {
  const counts = { valid: 0, 'ambiguous-oneOf': 0, 'source-incomplete': 0, 'source-conflict': 0, 'not-applicable': 0 };
  for (const result of results) counts[result.classification]++;
  return { counts, conditions: results.filter(result => ['ambiguous-oneOf', 'source-incomplete', 'source-conflict'].includes(result.classification)) };
}

export function hasBodySentinel(value) {
  if (typeof value === 'string') return /<Error\s*:|Too many levels of nesting to fake this schema/iu.test(value);
  return value !== null && typeof value === 'object' && Object.values(value).some(hasBodySentinel);
}

export function assertNoBodySentinel(body, label) {
  assert.ok(!hasBodySentinel(body), `Converter error sentinel in live request body: ${label}`);
}

class UnsafeValue extends Error {}

// This reader never edits the upstream graph. Reference Object siblings follow OAS 3.0.
export function createBodyContract(document, revision = {}) {
  assert.match(document.openapi, /^3\.0\./u, 'Request-body semantics require an OpenAPI version review.');
  const ajv = new Ajv({ strict: false, validateFormats: false, allErrors: true, verbose: true, inlineRefs: false });
  const witnessAjv = new Ajv({ strict: false, allErrors: true, verbose: true, inlineRefs: false, logger: false });
  addFormats(witnessAjv);
  const witnessValidators = new WeakMap();
  const variantCache = new WeakMap();
  const views = new WeakMap();
  const validators = new WeakMap();
  const groups = new Map(), ids = new WeakMap();
  let idsCount = 0;
  const sourcePaths = new WeakMap();
  const pointerToken = key => String(key).replaceAll('~', '~0').replaceAll('/', '~1');
  function indexPaths(value, pointer = '#') {
    if (!value || typeof value !== 'object') return;
    sourcePaths.set(value, pointer);
    for (const [key, child] of Object.entries(value)) indexPaths(child, `${pointer}/${pointerToken(key)}`);
  }
  indexPaths(document);
  let evaluations = 0;
  function budget() { assert.ok(++evaluations <= 100000, 'Request schema evaluation exceeded its safety bound.'); }
  function reset() { evaluations = 0; }

  function resolve(schema, seen = new Set()) {
    if (!schema?.$ref) return schema ?? EMPTY;
    assert.ok(schema.$ref.startsWith('#/'), `Non-local request schema reference: ${schema.$ref}`);
    assert.ok(!seen.has(schema.$ref), `Cyclic request schema alias: ${schema.$ref}`);
    const next = schema.$ref.slice(2).split('/').reduce((value, key) =>
      value?.[decodeURIComponent(key).replaceAll('~1', '/').replaceAll('~0', '~')], document);
    assert.ok(next, `Unresolved request schema reference: ${schema.$ref}`);
    return resolve(next, new Set([...seen, schema.$ref]));
  }

  function variants(schema, active = new Set()) {
    schema = resolve(schema);
    if (!schema) return [[]];
    if (variantCache.has(schema)) return variantCache.get(schema);
    assert.ok(!active.has(schema), 'Recursive schema composition needs explicit review.');
    const next = new Set([...active, schema]);
    let result = [[schema]];
    function product(choices) {
      assert.ok(result.length * choices.length <= 256, 'Request schema alternatives exceed bounded evaluation.');
      result = result.flatMap(left => choices.map(right => [...left, ...right]));
    }
    for (const child of schema.allOf ?? []) product(variants(child, next));
    for (const keyword of ['oneOf', 'anyOf']) {
      if (schema[keyword]) product(schema[keyword].flatMap(child => variants(child, next)));
    }
    variantCache.set(schema, result);
    return result;
  }

  function combinations(schemas) {
    let result = [[]];
    for (const schema of schemas) {
      const choices = variants(schema);
      assert.ok(result.length * choices.length <= 256, 'Request schema alternatives exceed bounded evaluation.');
      result = result.flatMap(left => choices.map(right => [...left, ...right]));
    }
    return result;
  }

  function readOnly(schemas) {
    return schemas.some(source => {
      const schema = resolve(source);
      return schema.readOnly === true || readOnly(schema.allOf ?? []) ||
        ['oneOf', 'anyOf'].some(key => schema[key]?.length && schema[key].every(child => readOnly([child])));
    });
  }

  function childSchemas(nodes, key) {
    const schemas = [];
    for (const node of nodes) {
      if (own(node.properties ?? {}, key)) schemas.push(node.properties[key]);
      else if (node.additionalProperties === false) return null;
      else if (object(node.additionalProperties)) schemas.push(node.additionalProperties);
    }
    return schemas;
  }

  // Derived request schemas retain every assertion. Only request-side required
  // annotations and OAS Reference Objects are adapted; not remains structural.
  // Local definitions preserve recursive references without editing the source.
  function view(source) {
    source = resolve(source);
    if (views.has(source)) return views.get(source);
    const definitions = {}, seen = new WeakMap();
    function adapt(input, request = true, inherited = []) {
      const schema = resolve(input);
      const plans = request ? variants(schema) : [[]];
      const readonly = [...new Set([...inherited, ...plans.flat().flatMap(node => Object.keys(node.properties ?? {}))
        .filter(key => plans.every(nodes => readOnly(childSchemas(nodes, key) ?? [])))])].sort();
      const context = `${request}:${JSON.stringify(readonly)}`;
      let contexts = seen.get(schema);
      if (!contexts) { contexts = new Map(); seen.set(schema, contexts); }
      if (contexts.has(context)) return { $ref: contexts.get(context) };
      const id = `s${Object.keys(definitions).length}`, ref = `#/definitions/${id}`;
      const output = {}; definitions[id] = output; contexts.set(context, ref);
      for (const [key, value] of Object.entries(schema)) {
        if (key === 'properties') output[key] = Object.fromEntries(Object.entries(value).map(([name, child]) => [name, adapt(child, request)]));
        else if (['items', 'additionalProperties', 'not'].includes(key) && object(value)) output[key] = adapt(value, request && key !== 'not');
        else if (['allOf', 'oneOf', 'anyOf'].includes(key)) output[key] = value.map(child => adapt(child, request, readonly));
        else if (key === 'required' && request) {
          const required = value.filter(name => !readonly.includes(name));
          if (required.length) output[key] = required;
        } else if (key !== 'nullable' || schema.type) output[key] = value;
      }
      return { $ref: ref };
    }
    const root = adapt(source), result = { ...root, definitions };
    views.set(source, result);
    return result;
  }

  function validator(schema) {
    if (!validators.has(schema)) validators.set(schema, ajv.compile(schema));
    return validators.get(schema);
  }

  function structural(schemas, value, compatibility = true) {
    if (value === undefined) return false;
    if (schemas.length > 1) {
      const key = schemas.map(schema => { if (!ids.has(schema)) ids.set(schema, idsCount++); return ids.get(schema); }).join(',');
      if (!groups.has(key)) groups.set(key, { allOf: schemas });
      schemas = [groups.get(key)];
    }
    return schemas.every(source => {
      const schema = view(source), validate = validator(schema);
      if (validate(value)) return true;
      if (!compatibility) return false;
      const overlaps = validate.errors.filter(error => error.keyword === 'oneOf' && error.params.passingSchemas?.length > 1);
      if (!overlaps.length) return false;
      // Only Ajv-proven multiple-match sites in this failed validation can be
      // relaxed. Revalidate the complete view; any remaining error rejects it.
      const targets = new Set(overlaps.map(error => error.parentSchema));
      function copy(node) {
        if (Array.isArray(node)) return node.map(copy);
        if (!object(node)) return node;
        return Object.fromEntries(Object.entries(node).map(([key, child]) =>
          [key === 'oneOf' && targets.has(node) ? 'anyOf' : key, copy(child)]));
      }
      return ajv.compile(copy(schema))(value);
    });
  }

  // Annotation traversal only: Ajv decides which union branches apply. Negated
  // schemas do not impose writeability requirements on the positive request.
  function writable(schemas, value, property = false, depth = 0) {
    if (depth > 64) return false;
    return schemas.every(source => {
      const schema = resolve(source);
      if (property && schema.readOnly === true) return false;
      if (!writable(schema.allOf ?? [], value, property, depth + 1)) return false;
      for (const key of ['oneOf', 'anyOf']) {
        const applicable = (schema[key] ?? []).filter(child => structural([child], value));
        if (!writable(applicable, value, property, depth + 1)) return false;
      }
      if (object(value)) for (const [key, child] of Object.entries(value)) {
        const children = own(schema.properties ?? {}, key) ? [schema.properties[key]] :
          object(schema.additionalProperties) ? [schema.additionalProperties] : [];
        if (!writable(children, child, true, depth + 1)) return false;
      }
      return !Array.isArray(value) || !schema.items || value.every(child => writable([schema.items], child, false, depth + 1));
    });
  }

  function matches(schemas, value, depth = 0, policy = {}) {
    budget();
    if (hasBodySentinel(value)) return false;
    const compatible = policy.compatibility !== false;
    const logical = witness(schemas, value);
    return structural(schemas, logical, compatible) && writable(schemas, logical, policy.property, depth);
  }

  // Variables always receive non-emitted, coherent witnesses, even when their
  // literal braces happen to satisfy a permissive string schema. Ajv validates
  // both the individual candidates and the complete substituted request.
  function witness(schemas, input) {
    function containsVariable(value) {
      return variable(value) || value !== null && typeof value === 'object' && Object.values(value).some(containsVariable);
    }
    if (!containsVariable(input)) return input;
    const occurrences = new Map();
    function projected(children, key, array = false) {
      const choices = combinations(children).map(nodes => array ? nodes.flatMap(node => node.items ? [node.items] : []) : childSchemas(nodes, key))
        .filter(Boolean).map(allOf => allOf.length ? { allOf } : {});
      return choices.length ? [{ anyOf: choices }] : [];
    }
    function collect(children, value) {
      if (!containsVariable(value)) return;
      if (variable(value)) {
        if (!occurrences.has(value)) occurrences.set(value, []);
        occurrences.get(value).push(children);
      } else if (object(value)) for (const [key, child] of Object.entries(value)) collect(projected(children, key), child);
      else if (Array.isArray(value)) value.forEach(child => collect(projected(children, '', true), child));
    }
    collect(schemas, input);
    if (!occurrences.size) return input;
    const replacements = new Map();
    for (const [name, sites] of occurrences) {
      const plans = sites.flatMap(combinations);
      const candidates = [...examples(plans.flat()), ...plans.flatMap(nodes => stringCandidates(nodes, true))];
      const candidate = candidates.find(value => typeof value === 'string' && !variable(value) && !hasBodySentinel(value) &&
        sites.every(children => children.every(source => {
          const schema = view(source);
          if (!witnessValidators.has(schema)) witnessValidators.set(schema, witnessAjv.compile(schema));
          return witnessValidators.get(schema)(value);
        })));
      if (candidate === undefined) return undefined;
      replacements.set(name, candidate);
    }
    function substitute(value) {
      if (variable(value)) return replacements.get(value);
      if (Array.isArray(value)) return value.map(substitute);
      return object(value) ? Object.fromEntries(Object.entries(value).map(([key, child]) => [key, substitute(child)])) : value;
    }
    return substitute(input);
  }

  function repair(nodes, input, trail) {
    const candidates = [];
    if (nodes.some(node => node.type === 'object' || node.properties)) candidates.push({});
    if (nodes.some(node => node.type === 'array')) {
      const minimum = Math.max(0, ...nodes.map(node => node.minItems ?? 0));
      if (minimum <= CONSTRUCTION_LIMIT) {
        if (Array.isArray(input)) candidates.push(input.slice(0, minimum));
        candidates.push(Array(minimum).fill(undefined));
      }
    }
    if (stringCandidates(nodes).length) candidates.push(templateVariable(trail));
    candidates.push(...primitiveCandidates(nodes));
    // Existing arrays may be pruned without inventing an element.
    if (Array.isArray(input)) candidates.push([]);
    return candidates;
  }

  function normalizeNodes(nodes, input, depth, location, requiredValue, trail) {
    if (depth > 64) throw new UnsafeValue(`${location}: request value exceeds bounded recursion`);
    let output = input;
    if (object(input)) {
      output = {};
      const required = new Set(nodes.flatMap(node => node.required ?? []));
      for (const key of new Set([...Object.keys(input), ...required])) {
        const schemas = childSchemas(nodes, key);
        if (!schemas) {
          if (required.has(key)) throw new UnsafeValue(`${location}/${key}: forbidden required property`);
          continue;
        }
        if (readOnly(schemas)) continue;
        const value = normalize(schemas, input[key], required.has(key), depth + 1, `${location}/${key}`, true, [...trail, key]);
        if (value !== OMIT) Object.defineProperty(output, key, { value, enumerable: true, configurable: true, writable: true });
      }
      if (requiredValue) {
        const minimum = Math.max(0, ...nodes.map(node => node.minProperties ?? 0));
        const maximum = Math.min(Infinity, ...nodes.map(node => node.maxProperties ?? Infinity));
        // A required object's cardinality can require a subset of optional
        // properties. Preserve required keys and use deterministic source order.
        for (const key of Object.keys(output).reverse()) {
          if (Object.keys(output).length <= maximum) break;
          if (!required.has(key)) delete output[key];
        }
        for (const key of new Set(nodes.flatMap(node => Object.keys(node.properties ?? {})))) {
          if (Object.keys(output).length >= minimum) break;
          if (own(output, key)) continue;
          const schemas = childSchemas(nodes, key);
          if (!schemas || readOnly(schemas)) continue;
          try {
            const value = normalize(schemas, undefined, true, depth + 1, `${location}/${key}`, true, [...trail, key]);
            Object.defineProperty(output, key, { value, enumerable: true, configurable: true, writable: true });
          } catch (error) { if (!(error instanceof UnsafeValue)) throw error; }
        }
      }
    } else if (Array.isArray(input)) {
      const items = nodes.flatMap(node => node.items ? [node.items] : []);
      output = input.map((value, index) => normalize(items, value, true, depth + 1, `${location}/${index}`, false, [...trail, index]));
    }
    return output;
  }

  let construction;
  function construct(schemas, input, required, depth = 0, location = '$') {
    const indices = new Map();
    let failure;
    try {
      for (let attempt = 0; attempt < CONSTRUCTION_LIMIT; attempt++) {
        construction = { indices, points: [] };
        try { return normalize(schemas, input, required, depth, location); }
        catch (error) {
          if (!(error instanceof UnsafeValue)) throw error;
          failure = error;
          const last = construction.points.at(-1);
          if (!last) throw error;
          const prefix = new Set(construction.points.map(point => point.key));
          for (const key of indices.keys()) if (!prefix.has(key)) indices.delete(key);
          indices.set(last.key, last.index + 1);
        }
      }
      throw failure;
    } finally { construction = undefined; }
  }

  function normalize(schemas, input, required, depth = 0, location = '$', property = false, trail = []) {
    budget();
    if (input === undefined && !required) return OMIT;
    if (!required && Array.isArray(input) && hasBodySentinel(input)) return OMIT;
    // A proven overlapping-oneOf condition alone must never change the request.
    if (input !== undefined && matches(schemas, input, depth, { property })) return input;
    const choices = combinations(schemas);
    let failure, accepted = 0;
    // Preserve converter values when safe. Optional unsafe values are omitted; required
    // values use source candidates before bounded synthetic template construction.
    for (const phase of (required ? ['example', 'default', 'enum', 'input', 'construct'] : ['input'])) {
      for (const nodes of choices) {
        if (nodes.some(node => node.readOnly && node.writeOnly)) throw new Error(`${location}: both readOnly and writeOnly`);
        const candidates = phase === 'input' ? [input] : phase === 'construct' ? repair(nodes, input, trail) :
          phase === 'enum' ? nodes.flatMap(node => node.enum ?? []) : nodes.filter(node => own(node, phase)).map(node => node[phase]);
        for (const candidate of candidates) {
          try {
            if (candidate === undefined) continue;
            const output = normalizeNodes(nodes, candidate, depth, location, required, trail);
            if (!matches(schemas, output, depth, { property })) continue;
            if (!required && object(output) && !Object.keys(output).length && object(input) && Object.keys(input).length) return OMIT;
            if (!required && Array.isArray(output) && output.some((child, index) => object(child) &&
              !Object.keys(child).length && object(input?.[index]) && Object.keys(input[index]).length)) return OMIT;
            if (construction && required && phase !== 'input') {
              const index = accepted++;
              if (index < (construction.indices.get(location) ?? 0)) continue;
              construction.points.push({ key: location, index });
            }
            return output;
          } catch (error) {
            if (!(error instanceof UnsafeValue)) throw error;
            failure = error;
          }
        }
      }
    }
    if (!required) return OMIT;
    throw failure ?? new UnsafeValue(`${location}: required value cannot be represented safely`);
  }

  function examples(nodes) {
    return [...nodes.filter(node => own(node, 'example')).map(node => node.example),
      ...nodes.filter(node => own(node, 'default')).map(node => node.default), ...nodes.flatMap(node => node.enum ?? [])];
  }

  function mediaExamples(selected) {
    return [
      ...(own(selected, 'example') ? [selected.example] : []),
      ...Object.values(selected.examples ?? {}).map(example => resolve(example)).filter(example => own(example, 'value')).map(example => example.value)
    ];
  }

  function sourceIncomplete(schemas, value, selected, schemaPath) {
    // Quarantine only a plain missing-value declaration. Composition, negation,
    // enum, cardinality, or unfamiliar assertions require review, not exemptions.
    if (schemas.length !== 1 || !object(value) || hasBodySentinel(value) || !writable(schemas, value)) return;
    const schema = resolve(schemas[0]);
    if (Object.keys(schema).some(key => !annotations.has(key) && !['type', 'required', 'properties'].includes(key)) ||
      (schema.type && schema.type !== 'object') || mediaExamples(selected).length) return;
    const missing = (schema.required ?? []).filter(key => !own(value, key) && !readOnly([schema.properties?.[key] ?? EMPTY]));
    if (!missing.length || missing.some(key => Object.keys(resolve(schema.properties?.[key])).some(keyword => !annotations.has(keyword)))) return;
    const remainder = { ...schema, required: (schema.required ?? []).filter(key => !missing.includes(key)) };
    if (!remainder.required.length) delete remainder.required;
    if (!matches([remainder], value)) return;
    return missing.map(key => ({ instancePath: `/${pointerToken(key)}`,
      schemaPath: `${sourcePaths.get(schema) ?? schemaPath}/required/${schema.required.indexOf(key)}`,
      reason: 'Required property has no value schema, example, or default.' }));
  }

  // This is a source diagnostic, never an alternate validity schema. A plain
  // scalar declaration with object-property intent is formally satisfiable as a
  // scalar, but its safe primary object cannot satisfy the declared root type.
  function sourceConflict(schemas, value, selected, schemaPath) {
    if (schemas.length !== 1) return;
    const schema = resolve(schemas[0]);
    if (schema.type !== 'string' || !object(schema.properties) || !Object.keys(schema.properties).length ||
      Object.keys(schema).some(key => !annotations.has(key) && !['type', 'properties'].includes(key))) return;
    if (matches(schemas, value) || [...mediaExamples(selected), ...examples([schema])].some(candidate => matches(schemas, candidate))) return;
    assert.ok(object(value) && Object.keys(value).length, 'Source-conflict requires a safe primary object');
    assert.ok(!hasBodySentinel(value) && writable(schemas, value), 'Unsafe source-conflict converter body');
    assert.ok(Object.keys(value).every(key => own(schema.properties, key)), 'Undeclared source-conflict property');
    const validate = validator(view(schema));
    assert.equal(validate(value), false);
    assert.ok(validate.errors.every(error => error.keyword === 'type' && error.instancePath === ''),
      'Source-conflict cannot rescue another validation error');
    // Check only the already emitted properties; do not construct a replacement
    // object or silently repair its children under the conflict exception.
    assert.ok(Object.entries(value).every(([key, child]) => matches([schema.properties[key]], child)),
      'Unsafe source-conflict property');
    assert.equal(revision.commit, conflictPolicy.upstreamCommit, 'Source-conflict requires schema revision review');
    assert.equal(revision.schemaSha256, conflictPolicy.schemaSha256, 'Source-conflict requires schema digest review');
    return [{ instancePath: '', schemaPath: `${sourcePaths.get(schema) ?? schemaPath}/type`,
      propertiesSchemaPath: `${sourcePaths.get(schema) ?? schemaPath}/properties`,
      upstreamCommit: revision.commit, schemaSha256: revision.schemaSha256,
      reason: 'Declared string type conflicts with the declared object-property shape of the safe primary converter body.' }];
  }

  function finish(request, operation, classification, validateOnly, issues = []) {
    for (const [kind, message] of [['source-incomplete', INCOMPLETE_BODY_WARNING], ['source-conflict', CONFLICT_BODY_WARNING]]) {
      const warning = request.description?.includes(message) ?? false;
      if (classification === kind) {
        if (validateOnly) assert.ok(warning, `${operation.key}: missing ${kind} body warning`);
        else if (!warning) request.description = `${message}\n\n${request.description ?? ''}`;
      } else assert.ok(!warning, `${operation.key}: stale ${kind} body warning`);
    }
    return { operation: operation.key, classification, ...(issues.length ? { issues } : {}) };
  }

  function media(request, operation) {
    const declaration = document.paths?.[operation.path]?.[operation.methodLower] ?? operation.operation;
    const body = declaration.requestBody && resolve(declaration.requestBody);
    if (!body) {
      assert.ok(!request.body, `${operation.key}: generated body without requestBody declaration`);
      return undefined;
    }
    if (!request.body) {
      assert.ok(!body.required, `${operation.key}: missing required request body`);
      return undefined;
    }
    const type = request.header?.find(header => !header.disabled && header.key.toLowerCase() === 'content-type')?.value?.split(';')[0].trim();
    const mode = request.body.mode;
    const content = Object.entries(body.content ?? {}).filter(([name]) => {
      if (type) return name.toLowerCase() === type.toLowerCase();
      if (mode === 'formdata') return name === 'multipart/form-data';
      if (mode === 'urlencoded') return name === 'application/x-www-form-urlencoded';
      if (mode === 'raw' && request.body.options?.raw?.language === 'json') return /(?:\/|\+)json$/iu.test(name);
      return true;
    });
    assert.equal(content.length, 1, `${operation.key}: ambiguous or missing request media type`);
    return { ...content[0][1], name: content[0][0], required: body.required === true };
  }

  // An unselected file establishes a string representation, never its contents.
  // Reject content-dependent assertions rather than certify a placeholder.
  function fileShape(schemas, path = []) {
    for (const source of schemas) {
      const schema = resolve(source);
      const allowed = new Set([...annotations, 'example', 'default', 'type', 'format', 'nullable', 'not', 'allOf', 'oneOf', 'anyOf']);
      assert.ok(!own(schema, 'enum') && (path.length || Object.keys(schema).every(key => allowed.has(key) || key.startsWith('x-'))),
        'Unknown file contents cannot be represented safely under content constraints');
      for (const key of ['allOf', 'oneOf', 'anyOf']) fileShape(schema[key] ?? [], path);
      if (schema.not) fileShape([schema.not], path);
      if (path.length) fileShape(path[0] === null ? (schema.items ? [schema.items] : []) :
        childSchemas([schema], path[0]) ?? [], path.slice(1));
    }
  }

  function binaryArray(children) {
    const choices = combinations(children);
    if (!choices.length || !choices.every(nodes => nodes.some(node => node.type === 'array'))) return;
    const nodes = choices.flat(), items = nodes.flatMap(node => node.items ? [node.items] : []);
    if (!items.length || !combinations(items).every(plan => plan.some(node => node.type === 'string' && node.format === 'binary'))) return;
    assert.ok(!nodes.some(node => node.uniqueItems), 'Unknown file contents cannot establish uniqueItems');
    fileShape(items);
    assert.ok(matches(items, ''), 'File array item cannot be represented safely');
    return { minimum: Math.max(1, ...nodes.map(node => node.minItems ?? 0)) };
  }

  function apply(request, operation, validateOnly = false) {
    reset();
    const selected = media(request, operation);
    if (!selected) return finish(request, operation, 'not-applicable', validateOnly);
    const body = request.body;
    const schemas = selected.schema ? [selected.schema] : [];
    const label = operation.key;
    const json = /(?:\/|\+)json$/iu.test(selected.name);
    const formMode = { 'multipart/form-data': 'formdata', 'application/x-www-form-urlencoded': 'urlencoded' }[selected.name.toLowerCase()];
    // Other media may legitimately use raw or file (including text/plain and
    // NDJSON). A Content-Type header must not bypass JSON/form mode checks.
    const modes = json ? ['raw'] : formMode ? [formMode] : ['raw', 'file'];
    assert.ok(modes.includes(body.mode), `${label}: ${selected.name} body mode mismatch (expected ${modes.join(' or ')})`);
    if (validateOnly) assertNoBodySentinel(body, label);
    let classification = 'valid';
    if (json) {
      const schemaPath = sourcePaths.get(selected.schema) ??
        `#/paths/${pointerToken(operation.path)}/${operation.methodLower}/requestBody/content/${pointerToken(selected.name)}/schema`;
      let value;
      const empty = body.raw === '' || body.raw === undefined;
      if (empty && !validateOnly) {
        const example = mediaExamples(selected).find(candidate => matches(schemas, candidate));
        if (example !== undefined) { value = example; body.raw = JSON.stringify(example, null, 2); }
      }
      if (value === undefined && (selected.schema || !empty)) {
        try { value = JSON.parse(body.raw); }
        catch {
          if (selected.schema && !validateOnly && body.raw && matches(schemas, body.raw)) {
            body.raw = JSON.stringify(body.raw); value = JSON.parse(body.raw);
          } else throw new Error(`${label}: live JSON body is not parseable`);
        }
      }
      if (!selected.schema) {
        assertNoBodySentinel(body, label);
        if (selected.required && !body.raw && !own(selected, 'example') && !own(selected, 'examples')) {
          return finish(request, operation, 'source-incomplete', validateOnly,
            [{ instancePath: '', schemaPath, reason: 'Required body has no request schema or example.' }]);
        }
        assert.ok(!selected.required || body.raw, `${label}: empty required JSON body with authoritative examples`);
        return finish(request, operation, 'not-applicable', validateOnly);
      }
      const conflict = sourceConflict(schemas, value, selected, schemaPath);
      if (conflict) {
        assertNoBodySentinel(body, label);
        return finish(request, operation, 'source-conflict', validateOnly, conflict);
      }
      const incomplete = sourceIncomplete(schemas, value, selected, schemaPath);
      if (incomplete) return finish(request, operation, 'source-incomplete', validateOnly, incomplete);
      if (validateOnly) assert.ok(matches(schemas, value), `${label}: live JSON violates writable request schema`);
      else {
        let result;
        try { result = matches(schemas, value) ? value :
          mediaExamples(selected).find(example => matches(schemas, example)) ?? construct(schemas, value, true, 0, label); }
        catch (error) {
          if (!(error instanceof UnsafeValue)) throw error;
          result = mediaExamples(selected).find(example => matches(schemas, example));
          if (result === undefined) throw error;
        }
        if (!isDeepStrictEqual(value, result)) body.raw = JSON.stringify(result, null, 2);
        value = result;
      }
      if (!matches(schemas, value, 0, { compatibility: false })) classification = 'ambiguous-oneOf';
    } else {
      const form = Boolean(formMode), rows = form ? body[body.mode] ?? [] : [];
      let value = body.raw;
      const fileArrays = new Map();
      if (form) {
        value = {};
        const choices = combinations(schemas), nodes = choices.flat();
        const names = new Set([...rows.filter(row => !row.disabled).map(row => row.key),
          ...nodes.flatMap(node => node.required ?? [])]);
        for (const key of names) {
          const group = rows.filter(row => !row.disabled && row.key === key);
          const children = childSchemas(nodes, key) ?? [];
          const binary = body.mode === 'formdata' && binaryArray(children);
          if (binary) {
            fileShape(schemas, [key, null]);
            fileArrays.set(key, binary);
            const required = choices.every(plan => plan.some(node => node.required?.includes(key)));
            if (!group.length && (!required || validateOnly)) continue;
            if (validateOnly || group.every(row => row.type === 'file')) {
              assert.ok(group.every(row => row.type === 'file'), `${label}: binary array requires file form rows`);
              value[key] = group.map(() => '');
              if (!validateOnly && group.length && group.length < binary.minimum) {
                assert.ok(binary.minimum <= CONSTRUCTION_LIMIT, `${label}: file array exceeds construction bound`);
                value[key] = Array(binary.minimum).fill('');
              }
              if (group.length) continue;
            }
            assert.ok(group.length <= 1, `${label}: mixed/duplicate file-array representation`);
            assert.ok(binary.minimum <= CONSTRUCTION_LIMIT, `${label}: file array exceeds construction bound`);
            value[key] = Array(binary.minimum).fill('');
            continue;
          }
          assert.ok(group.length <= 1, `${label}: duplicate enabled form field requires encoding review`);
          if (!group.length) continue;
          const row = group[0];
          let child = row.type === 'file' ? '' : row.value;
          if (row.type === 'file') fileShape(schemas, [key]);
          else if (children.some(schema => variants(schema).flat().some(node =>
            ['object', 'array', 'number', 'integer', 'boolean'].includes(node.type) || node.properties))) {
            try { child = JSON.parse(child); } catch { child = undefined; }
          }
          Object.defineProperty(value, key, { value: child, enumerable: true });
        }
      } else if (body.mode === 'file') { fileShape(schemas); value = ''; }
      let output = value;
      if (validateOnly || body.mode === 'file') assert.ok(matches(schemas, value), `${label}: live body violates writable request schema`);
      else output = construct(schemas, value, true, 0, label);
      if (!validateOnly && form) {
        const emitted = new Set();
        body[body.mode] = rows.flatMap(row => {
          if (row.disabled) return !hasBodySentinel(row) && writable(schemas, { [row.key]: row.value }) ? [row] : [];
          if (!own(output, row.key)) return [];
          if (fileArrays.has(row.key)) {
            if (emitted.has(row.key)) return [];
            emitted.add(row.key);
            const existing = rows.filter(entry => !entry.disabled && entry.key === row.key && entry.type === 'file');
            return output[row.key].map((_, index) => existing[index] ?? { key: row.key, type: 'file', src: '',
              ...(row.description ? { description: row.description } : {}) });
          }
          emitted.add(row.key);
          return [row.type === 'file' || isDeepStrictEqual(value[row.key], output[row.key]) ? row :
            { ...row, value: typeof output[row.key] === 'string' ? output[row.key] : JSON.stringify(output[row.key]) }];
        });
        for (const [key, child] of Object.entries(output)) if (!emitted.has(key)) {
          if (fileArrays.has(key)) body[body.mode].push(...child.map(() => ({ key, type: 'file', src: '' })));
          else body[body.mode].push({ key, ...(body.mode === 'formdata' ? { type: 'text' } : {}),
            value: typeof child === 'string' ? child : JSON.stringify(child) });
        }
      } else if (!validateOnly && body.mode === 'raw') body.raw = output;
      if (!matches(schemas, output, 0, { compatibility: false })) classification = 'ambiguous-oneOf';
    }
    assertNoBodySentinel(body, label);
    return finish(request, operation, classification, validateOnly);
  }

  return {
    normalize: (request, operation) => apply(request, operation),
    validate: (request, operation) => apply(request, operation, true),
    normalizeValue: (schema, value, required = true) => { reset(); return construct([schema], value, required); },
    validateValue: (schema, value, policy = {}) => { reset(); return matches([schema], value, 0, policy); },
    classifyValue: (schema, value) => {
      reset();
      const strict = matches([schema], value, 0, { compatibility: false });
      return strict ? 'valid' : matches([schema], value) ? 'ambiguous-oneOf' : 'invalid';
    }
  };
}
