import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import Ajv from 'ajv-draft-04';

const OMIT = Symbol('omit');
const own = (value, key) => Object.hasOwn(value, key);
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const EMPTY = Object.freeze({});
const variable = value => typeof value === 'string' && /^\{\{[^{}]+\}\}$/u.test(value);
const annotations = new Set(['title', 'description', 'readOnly', 'writeOnly', 'deprecated', 'xml', 'externalDocs']);
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
  const ajv = new Ajv({ strict: false, validateFormats: false, allErrors: true, verbose: true, inlineRefs: false });
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
    const logical = structural(schemas, value, compatible) ? value : witness(schemas, value);
    return structural(schemas, logical, compatible) && writable(schemas, logical, policy.property, depth);
  }

  // Postman variables remain unresolved in the emitted body. A source-backed
  // witness proves template construction, never the unknown runtime contents.
  function witness(schemas, input) {
    const replacements = new Map();
    function collect(children, value) {
      const nodes = combinations(children).flat();
      if (variable(value) && !replacements.has(value)) {
        const candidate = examples(nodes).find(example => typeof example === 'string' && !variable(example) &&
          !hasBodySentinel(example) && structural(children, example, false));
        if (candidate !== undefined) replacements.set(value, candidate);
      } else if (object(value)) for (const [key, child] of Object.entries(value)) {
        collect(nodes.flatMap(node => own(node.properties ?? {}, key) ? [node.properties[key]] :
          object(node.additionalProperties) ? [node.additionalProperties] : []), child);
      } else if (Array.isArray(value)) value.forEach(child => collect(nodes.flatMap(node => node.items ? [node.items] : []), child));
    }
    function substitute(value) {
      if (variable(value)) return replacements.get(value) ?? value;
      if (Array.isArray(value)) return value.map(substitute);
      return object(value) ? Object.fromEntries(Object.entries(value).map(([key, child]) => [key, substitute(child)])) : value;
    }
    collect(schemas, input);
    return substitute(input);
  }

  function repair(nodes, input) {
    const candidates = examples(nodes);
    // Emptying an existing converter array prunes values; it invents none.
    if (Array.isArray(input)) candidates.push([]);
    if (nodes.some(node => node.type === 'object' || node.properties)) {
      const example = {};
      for (const key of new Set(nodes.flatMap(node => Object.keys(node.properties ?? {})))) {
        const children = childSchemas(nodes, key);
        if (!children || readOnly(children)) continue;
        const child = combinations(children).flatMap(examples).find(value => matches(children, value));
        if (child !== undefined) Object.defineProperty(example, key, { value: child, enumerable: true });
      }
      if (Object.keys(example).length) candidates.push(example);
      if (object(input)) candidates.push({});
    }
    return candidates;
  }

  function normalizeNodes(nodes, input, depth, location, requiredValue) {
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
    // values may use only schema examples/defaults/enums and existing converter values.
    for (const fallback of [false, true]) {
      if (fallback && !required) break;
      for (const nodes of choices) {
        if (nodes.some(node => node.readOnly && node.writeOnly)) throw new Error(`${location}: both readOnly and writeOnly`);
        for (const candidate of fallback ? repair(nodes, input) : [input]) {
          try {
            if (candidate === undefined) continue;
            const output = normalizeNodes(nodes, candidate, depth, location, required);
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
    return nodes.flatMap(node => [...['example', 'default'].filter(key => own(node, key)).map(key => node[key]), ...(node.enum ?? [])]);
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
      if (path.length) fileShape(childSchemas([schema], path[0]) ?? [], path.slice(1));
    }
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
    } else {
      const form = Boolean(formMode), rows = form ? body[body.mode] ?? [] : [];
      let value = body.raw;
      if (form) {
        value = {};
        const nodes = schemas.flatMap(schema => variants(schema).flat());
        for (const row of rows.filter(row => !row.disabled)) {
          assert.ok(!own(value, row.key), `${label}: duplicate enabled form field requires encoding review`);
          const children = nodes.flatMap(node => own(node.properties ?? {}, row.key) ? [node.properties[row.key]] :
            object(node.additionalProperties) ? [node.additionalProperties] : []);
          let child = row.type === 'file' ? '' : row.value;
          if (row.type === 'file') fileShape(schemas, [row.key]);
          else if (children.some(schema => variants(schema).flat().some(node =>
            ['object', 'array', 'number', 'integer', 'boolean'].includes(node.type) || node.properties))) {
            try { child = JSON.parse(child); } catch { child = undefined; }
          }
          Object.defineProperty(value, row.key, { value: child, enumerable: true });
        }
      } else if (body.mode === 'file') { fileShape(schemas); value = ''; }
      let output = value;
      if (validateOnly || body.mode === 'file') assert.ok(matches(schemas, value), `${label}: live body violates writable request schema`);
      else output = normalize(schemas, value, true, 0, label);
      if (!validateOnly && form) {
        body[body.mode] = rows.filter(row => row.disabled ? !hasBodySentinel(row) &&
          writable(schemas, { [row.key]: row.value }) : own(output, row.key)).map(row => row.disabled || row.type === 'file' ||
          isDeepStrictEqual(value[row.key], output[row.key]) ? row : { ...row, value: typeof output[row.key] === 'string' ? output[row.key] : JSON.stringify(output[row.key]) });
        for (const [key, child] of Object.entries(output)) if (!rows.some(row => !row.disabled && row.key === key)) {
          body[body.mode].push({ key, ...(body.mode === 'formdata' ? { type: 'text' } : {}), value: typeof child === 'string' ? child : JSON.stringify(child) });
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
    normalizeValue: (schema, value, required = true) => { reset(); return normalize([schema], value, required); },
    validateValue: (schema, value, policy = {}) => { reset(); return matches([schema], value, 0, policy); },
    classifyValue: (schema, value) => {
      reset();
      const strict = matches([schema], value, 0, { compatibility: false });
      return strict ? 'valid' : matches([schema], value) ? 'ambiguous-oneOf' : 'invalid';
    }
  };
}
