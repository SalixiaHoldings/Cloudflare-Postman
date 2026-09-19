import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import Ajv from 'ajv-draft-04';

const OMIT = Symbol('omit');
const own = (value, key) => Object.hasOwn(value, key);
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const variable = value => typeof value === 'string' && /^\{\{[^{}]+\}\}$/u.test(value);
const scalarKeywords = ['type', 'nullable', 'enum', 'minimum', 'maximum', 'exclusiveMinimum',
  'exclusiveMaximum', 'multipleOf', 'minLength', 'maxLength', 'pattern', 'minItems', 'maxItems',
  'uniqueItems', 'minProperties', 'maxProperties'];
export const INCOMPLETE_BODY_WARNING = 'WARNING — source-incomplete: the pinned OpenAPI does not contain sufficient request-body semantics to safely generate the required value. This body template is incomplete; the converter representation has been preserved.';

export function summarizeBodyResults(results) {
  const counts = { valid: 0, 'ambiguous-oneOf': 0, 'source-incomplete': 0, 'not-applicable': 0 };
  for (const result of results) counts[result.classification]++;
  return { counts, conditions: results.filter(result => ['ambiguous-oneOf', 'source-incomplete'].includes(result.classification)) };
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
export function createBodyContract(document) {
  assert.match(document.openapi, /^3\.0\./u, 'Request-body semantics require an OpenAPI version review.');
  const ajv = new Ajv({ strict: false, validateFormats: false, allErrors: false });
  const scalarValidators = new WeakMap();
  const variantCache = new WeakMap();
  const schemaIds = new WeakMap();
  let nextSchemaId = 0;
  let matchCache = new Map();
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
  function reset() { evaluations = 0; matchCache = new Map(); }

  function resolve(schema, seen = new Set()) {
    if (!schema?.$ref) return schema;
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
    return schemas.some(schema => variants(schema).every(nodes => nodes.some(node => node.readOnly === true)));
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

  function scalarMatches(node, value) {
    // Local Postman values are unresolved templates, not populated upstream samples.
    if (variable(value) && (!node.type || node.type === 'string')) return true;
    let validate = scalarValidators.get(node);
    if (!validate) {
      const schema = Object.fromEntries(scalarKeywords.filter(key => own(node, key)).map(key => [key, node[key]]));
      // OAS permits nullable without type; it only takes effect alongside an explicit type.
      if (!schema.type) delete schema.nullable;
      validate = ajv.compile(schema);
      scalarValidators.set(node, validate);
    }
    return validate(value);
  }

  function matchesNodes(nodes, value, depth, policy = {}) {
    if (depth > 64 || value === undefined || hasBodySentinel(value)) return false;
    // OAS 3.0 readOnly applies to property definitions, not an array item's
    // root annotation. Properties inside array objects are still checked.
    if (policy.property && policy.writable !== false && nodes.some(node => node.readOnly === true)) return false;
    if (!nodes.every(node => scalarMatches(node, value))) return false;
    if (object(value)) {
      for (const key of new Set(nodes.flatMap(node => node.required ?? []))) {
        const children = childSchemas(nodes, key);
        if (!children) return false;
        if (children && !readOnly(children) && !own(value, key) && !policy.incomplete?.get(value)?.has(key)) return false;
      }
      for (const [key, child] of Object.entries(value)) {
        const schemas = childSchemas(nodes, key);
        if (!schemas || (policy.writable !== false && readOnly(schemas)) || !matches(schemas, child, depth + 1, { ...policy, property: true })) return false;
      }
    }
    if (Array.isArray(value)) {
      const items = nodes.flatMap(node => node.items ? [node.items] : []);
      if (!value.every(child => matches(items, child, depth + 1, { ...policy, property: false }))) return false;
    }
    return nodes.every(node => !node.not || !matches([node.not], value, depth + 1, { ...policy, compatibility: false }));
  }

  function matches(schemas, value, depth = 0, policy = {}) {
    const key = schemas.map(schema => {
      if (!schemaIds.has(schema)) schemaIds.set(schema, ++nextSchemaId);
      return schemaIds.get(schema);
    }).join(',') + `:${policy.compatibility !== false}:${policy.writable !== false}:${Boolean(policy.incomplete)}:${Boolean(policy.property)}`;
    let cache = matchCache.get(key);
    if (!cache) { cache = new Map(); matchCache.set(key, cache); }
    if (cache.has(value)) return cache.get(value);
    const result = matchesUncached(schemas, value, depth, policy);
    cache.set(value, result);
    return result;
  }

  function matchesUncached(schemas, value, depth = 0, policy = {}) {
    budget();
    if (!combinations(schemas).some(nodes => matchesNodes(nodes, value, depth, policy))) return false;
    // Independently validate alternatives strictly before classifying an overlap.
    // The source is never rewritten, and zero matching alternatives still fail.
    function unions(schema) {
      schema = resolve(schema);
      for (const keyword of ['oneOf', 'anyOf']) {
        if (!schema[keyword]) continue;
        const applicable = schema[keyword].filter(child => matches([child], value, depth + 1,
          { compatibility: false, writable: false, property: policy.property }));
        if (!applicable.length) return false;
        if (keyword === 'oneOf' && applicable.length > 1 && policy.compatibility === false) return false;
        // Read-only annotations cannot be hidden by choosing a more permissive
        // overlapping branch. All structurally applicable branches are checked.
        if (policy.writable !== false && !applicable.every(child => matches([child], value, depth + 1,
          { compatibility: false, writable: true, property: policy.property }))) return false;
      }
      return (schema.allOf ?? []).every(unions);
    }
    return schemas.every(unions);
  }

  function repair(nodes) {
    const candidates = [];
    for (const node of nodes) {
      for (const key of ['example', 'default']) if (own(node, key)) candidates.push(node[key]);
      candidates.push(...(node.enum ?? []));
    }
    const types = nodes.map(node => node.type).filter(Boolean);
    if (types.includes('object') || nodes.some(node => node.properties)) {
      const example = {};
      for (const key of new Set(nodes.flatMap(node => Object.keys(node.properties ?? {})))) {
        const children = childSchemas(nodes, key);
        if (!children || readOnly(children)) continue;
        const child = combinations(children).flatMap(branch => branch.flatMap(node =>
          [...(own(node, 'example') ? [node.example] : []), ...(own(node, 'default') ? [node.default] : []), ...(node.enum ?? [])]))
          .find(value => matches(children, value));
        if (child !== undefined) Object.defineProperty(example, key, { value: child, enumerable: true });
      }
      candidates.push(example, {});
    }
    if (types.includes('array')) {
      const length = Math.max(0, ...nodes.map(node => node.minItems ?? 0));
      if (length <= 100) {
        candidates.push(Array.from({ length }, () => undefined));
      }
    }
    if (types.includes('string')) {
      const length = Math.max(0, ...nodes.map(node => node.minLength ?? 0));
      const maximum = Math.min(10000, ...nodes.map(node => node.maxLength ?? 10000));
      if (length <= maximum) candidates.push('string'.padEnd(length, 'x').slice(0, maximum), '');
    }
    if (types.includes('integer') || types.includes('number')) {
      candidates.push(...nodes.filter(node => own(node, 'minimum')).map(node =>
        node.minimum + (node.exclusiveMinimum ? (node.multipleOf ?? 1) : 0)), 0);
    }
    if (types.includes('boolean')) candidates.push(false);
    if (nodes.some(node => node.nullable === true)) candidates.push(null);
    return candidates;
  }

  function normalizeNodes(nodes, input, depth, location, requiredValue, property) {
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
        const value = normalize(schemas, input[key], required.has(key), depth + 1, `${location}/${key}`, true);
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
            const value = normalize(schemas, undefined, true, depth + 1, `${location}/${key}`, true);
            Object.defineProperty(output, key, { value, enumerable: true, configurable: true, writable: true });
          } catch (error) { if (!(error instanceof UnsafeValue)) throw error; }
        }
      }
    } else if (Array.isArray(input)) {
      const items = nodes.flatMap(node => node.items ? [node.items] : []);
      output = input.map((value, index) => normalize(items, value, true, depth + 1, `${location}/${index}`));
    }
    if (!matchesNodes(nodes, output, depth, { property })) throw new UnsafeValue(`${location}: value violates request schema`);
    return output;
  }

  function normalize(schemas, input, required, depth = 0, location = '$', property = false) {
    budget();
    if (input === undefined && !required) return OMIT;
    if (!required && Array.isArray(input) && hasBodySentinel(input)) return OMIT;
    // A proven overlapping-oneOf condition alone must never change the request.
    if (input !== undefined && matches(schemas, input, depth, { property })) return input;
    const choices = combinations(schemas);
    let failure;
    // Preserve converter values when safe. Optional unsafe values are omitted; required
    // values may use schema examples/defaults/enums or simple constraint-checked templates.
    for (const fallback of [false, true]) {
      if (fallback && !required) break;
      for (const nodes of choices) {
        if (nodes.some(node => node.readOnly && node.writeOnly)) throw new Error(`${location}: both readOnly and writeOnly`);
        for (const candidate of fallback ? repair(nodes) : [input]) {
          try {
            if (candidate === undefined) continue;
            // Never evade an object-only required declaration by switching to a scalar.
            if (fallback && object(input) && !object(candidate) && nodes.some(node => node.required?.length) &&
              !examples(nodes).some(example => isDeepStrictEqual(example, candidate))) continue;
            const output = normalizeNodes(nodes, candidate, depth, location, required, property);
            if (!matches(schemas, output, depth, { property })) continue;
            if (!required && object(output) && !Object.keys(output).length && object(input) && Object.keys(input).length) return OMIT;
            if (!required && Array.isArray(output) && output.some((child, index) => object(child) &&
              !Object.keys(child).length && object(input?.[index]) && Object.keys(input[index]).length)) return OMIT;
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
    return nodes.flatMap(node => ['example', 'default'].filter(key => own(node, key)).map(key => node[key]));
  }

  function mediaExamples(selected) {
    return [
      ...(own(selected, 'example') ? [selected.example] : []),
      ...Object.values(selected.examples ?? {}).map(example => resolve(example)).filter(example => own(example, 'value')).map(example => example.value)
    ];
  }

  function sourceIncomplete(schemas, value, selected, schemaPath) {
    if (hasBodySentinel(value)) return undefined;
    if (mediaExamples(selected).some(example => matches(schemas, example))) return undefined;
    const absent = new WeakMap();
    const issues = [];
    function inspect(children, current, location, fallbackPath, active = new Set()) {
      const choices = combinations(children);
      // Do not use incomplete-source handling to rescue a zero-match union.
      if (choices.length !== 1) return;
      const nodes = choices[0];
      if (nodes.some(node => active.has(node))) return;
      if (examples(nodes).some(example => matches(children, example))) return;
      const next = new Set([...active, ...nodes]);
      if (object(current)) {
        for (const node of nodes) for (const [index, key] of (node.required ?? []).entries()) {
          const property = childSchemas(nodes, key);
          if (!property || readOnly(property) || own(current, key)) continue;
          const unspecified = combinations(property).every(branch => branch.every(part =>
            ![...scalarKeywords, 'format', 'properties', 'required', 'items', 'additionalProperties', 'not', 'oneOf', 'anyOf', 'example', 'default'].some(keyword => own(part, keyword))));
          if (!unspecified) continue;
          const names = absent.get(current) ?? new Set(); names.add(key); absent.set(current, names);
          issues.push({ instancePath: `${location}/${pointerToken(key)}`,
            schemaPath: `${sourcePaths.get(node) ?? fallbackPath}/required/${index}`,
            reason: 'Required property has no value schema, example, or default.' });
        }
        for (const [key, child] of Object.entries(current)) {
          const property = childSchemas(nodes, key);
          if (property) inspect(property, child, `${location}/${pointerToken(key)}`, `${fallbackPath}/properties/${pointerToken(key)}`, next);
        }
      } else if (Array.isArray(current)) {
        const items = nodes.flatMap(node => node.items ? [node.items] : []);
        current.forEach((child, index) => inspect(items, child, `${location}/${index}`, `${fallbackPath}/items`, next));
      }
    }
    inspect(schemas, value, '', schemaPath);
    if (!issues.length || !matches(schemas, value, 0, { incomplete: absent })) return undefined;
    return issues;
  }

  function finish(request, operation, classification, validateOnly, issues = []) {
    const warning = request.description?.includes(INCOMPLETE_BODY_WARNING) ?? false;
    if (classification === 'source-incomplete') {
      if (validateOnly) assert.ok(warning, `${operation.key}: missing source-incomplete body warning`);
      else if (!warning) request.description = `${INCOMPLETE_BODY_WARNING}\n\n${request.description ?? ''}`;
    } else assert.ok(!warning, `${operation.key}: stale source-incomplete body warning`);
    return { operation: operation.key, classification, ...(issues.length ? { issues } : {}) };
  }

  function media(request, operation) {
    const declaration = document.paths?.[operation.path]?.[operation.methodLower] ?? operation.operation;
    const body = resolve(declaration.requestBody);
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

  function apply(request, operation, validateOnly = false) {
    reset();
    const selected = media(request, operation);
    if (!selected) return finish(request, operation, 'not-applicable', validateOnly);
    const body = request.body;
    const schemas = selected.schema ? [selected.schema] : [];
    const label = operation.key;
    if (/(?:\/|\+)json$/iu.test(selected.name)) assert.equal(body.mode, 'raw', `${label}: JSON body mode mismatch`);
    if (validateOnly) assertNoBodySentinel(body, label);
    let classification = 'valid';
    if (body.mode === 'raw' && /(?:\/|\+)json$/iu.test(selected.name)) {
      const schemaPath = sourcePaths.get(selected.schema) ??
        `#/paths/${pointerToken(operation.path)}/${operation.methodLower}/requestBody/content/${pointerToken(selected.name)}/schema`;
      if (!selected.schema) {
        assertNoBodySentinel(body, label);
        if (selected.required && !body.raw && !own(selected, 'example') && !selected.examples) {
          return finish(request, operation, 'source-incomplete', validateOnly,
            [{ instancePath: '', schemaPath, reason: 'Required body has no request schema or example.' }]);
        }
        return finish(request, operation, 'not-applicable', validateOnly);
      }
      let value;
      try { value = JSON.parse(body.raw); }
      catch {
        if (!validateOnly && matches(schemas, body.raw)) {
          body.raw = JSON.stringify(body.raw); value = JSON.parse(body.raw);
        } else throw new Error(`${label}: live JSON body is not parseable`);
      }
      const incomplete = sourceIncomplete(schemas, value, selected, schemaPath);
      if (incomplete) return finish(request, operation, 'source-incomplete', validateOnly, incomplete);
      if (validateOnly) assert.ok(matches(schemas, value), `${label}: live JSON violates writable request schema`);
      else {
        let result;
        try { result = normalize(schemas, value, true, 0, label); }
        catch (error) {
          if (!(error instanceof UnsafeValue)) throw error;
          result = mediaExamples(selected).find(example => matches(schemas, example));
          if (result === undefined) throw error;
        }
        if (!isDeepStrictEqual(value, result)) body.raw = JSON.stringify(result, null, 2);
        value = result;
      }
      if (!matches(schemas, value, 0, { compatibility: false })) classification = 'ambiguous-oneOf';
    } else if (['formdata', 'urlencoded'].includes(body.mode)) {
      const choices = combinations(schemas);
      assert.equal(choices.length, 1, `${label}: composed form body requires encoding review`);
      const nodes = choices[0];
      const required = new Set(nodes.flatMap(node => node.required ?? []));
      const rows = [];
      for (const row of body[body.mode] ?? []) {
        const children = childSchemas(nodes, row.key);
        if (!children || readOnly(children)) {
          assert.ok(!validateOnly, `${label}/${row.key}: non-writable form field`);
          continue;
        }
        if (row.type === 'file') { assertNoBodySentinel(row, label); rows.push(row); continue; }
        const structured = combinations(children).some(branch => branch.some(node =>
          ['object', 'array', 'number', 'integer', 'boolean'].includes(node.type) || node.properties));
        let value = row.value;
        if (structured) { try { value = JSON.parse(value); } catch { value = undefined; } }
        if (validateOnly) {
          assert.ok(matches(children, value, 0, { property: true }), `${label}/${row.key}: invalid form value`);
          rows.push(row);
          continue;
        }
        const output = normalize(children, value, required.has(row.key), 0, `${label}/${row.key}`, true);
        if (output !== OMIT) rows.push({ ...row, value: isDeepStrictEqual(output, value) ? row.value :
          typeof output === 'string' ? output : JSON.stringify(output) });
      }
      for (const key of required) assert.ok(readOnly(childSchemas(nodes, key) ?? []) || rows.some(row => row.key === key && !row.disabled), `${label}/${key}: missing required form field`);
      if (!validateOnly) body[body.mode] = rows;
    }
    assertNoBodySentinel(body, label);
    return finish(request, operation, classification, validateOnly);
  }

  return {
    normalize: (request, operation) => apply(request, operation),
    validate: (request, operation) => apply(request, operation, true),
    normalizeValue: (schema, value, required = true) => { reset(); return normalize([schema], value, required); },
    validateValue: (schema, value, policy = {}) => { reset(); return matches([schema], value, 0, policy); },
    classifyValue: (schema, value) => {
      reset();
      const strict = matches([schema], value, 0, { compatibility: false });
      return strict ? 'valid' : matches([schema], value) ? 'ambiguous-oneOf' : 'invalid';
    }
  };
}
