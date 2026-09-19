# Request-body generation audit

## Problem statement

Generated request bodies are not consistently faithful to the writable request shape declared by Cloudflare's OpenAPI schema.

A confirmed example is:

`POST /accounts/{account_id}/subscriptions`

The generated Postman body currently contains root-level fields such as `app`, `component_values`, `currency`, `current_period_end`, `current_period_start`, `id`, `price`, `state`, and `zone`, plus repeated converter placeholders:

`<Error: Too many levels of nesting to fake this schema>`

Cloudflare's official TypeScript SDK and rendered API documentation expose only `frequency` and `rate_plan` as body parameters for account subscription creation. The pinned `cloudflare/api-schemas` source disagrees: some additional properties are not marked `readOnly`. Treat that as an upstream contract discrepancy, not permission to silently replace the pinned schema with SDK/docs-derived allowlists.

Codex's checked-out full-distribution scan measured **512 generated `.request.yaml` files** whose live request bodies contain the exact nesting-error placeholder: 507 JSON bodies and 5 form-data bodies. Use the checked-out parsed measurement rather than the earlier GitHub-search estimate.

## Current generation boundary

The primary `openapi-to-postmanv2@6.3.3` conversion owns request bodies. `src/postman.mjs` currently normalizes auth, query rows, URLs, identifiers, IDs, descriptions, and response snapshots, but it does not independently validate or normalize generated request-body semantics against each operation's `requestBody` schema.

The primary converter uses:

- `optimizeConversion: true`
- `requestParametersResolution: 'Example'`
- `exampleParametersResolution: 'Example'`
- `schemaFaker: false`

Do not assume changing one converter option is sufficient. Previous work established that converter-option changes can cause large unrelated drift.

## Required outcome

Implement a generic request-body correctness layer. Do **not** special-case subscriptions or hand-author request payloads.

For generated request bodies:

1. Respect the exact OpenAPI operation/media-type request schema.
2. Exclude properties marked `readOnly: true`, including through local `$ref`, nested objects, arrays, `allOf`, `oneOf`, and `anyOf` structures where applicable.
3. Preserve writable fields, including `writeOnly` fields.
4. Never emit `<Error: Too many levels of nesting to fake this schema>` or similar converter-error sentinel text in a live request body.
5. Never silently invent a field that is not writable according to the request schema.
6. If an optional field cannot be represented safely, prefer omission over an invalid placeholder. If a required body/value cannot be represented safely, fail generation for explicit review rather than emitting a misleading request.
7. Preserve request media types and non-JSON body modes such as form-data unless a reviewed generic fix is necessary for them.
8. Do not modify response examples merely to make request validation pass.
9. Do not patch Cloudflare's upstream schema and do not add endpoint-specific serialization.
10. Preserve deterministic generation and v2.1/v3 semantic equivalence.

## Required regression coverage

At minimum:

- Add a synthetic OpenAPI fixture with a shared request/response component containing writable and `readOnly` properties, nested refs, arrays, and composition.
- Prove generated request JSON excludes read-only properties while retaining writable properties.
- Prove generated request bodies contain no converter error sentinel.
- Add a pinned-distribution regression for `POST /accounts/{account_id}/subscriptions` that follows the pinned OpenAPI contract: confirmed `readOnly` fields must not appear in the live request body; no converter-error sentinel may appear; writable fields must not be removed solely because the SDK/docs expose a narrower public surface.
- Add a full-distribution validation gate that scans **request bodies**, not response examples, for converter error sentinels.
- Where practical, semantically validate generated JSON request bodies against the applicable OpenAPI request schema after applying request/read-only semantics.
- Confirm Native Git v3 carries the corrected body semantics exactly.


## Authoritative resolution for the subscription discrepancy

Do not wait for an upstream schema correction and do not add a subscription-specific two-field allowlist.

For this project, the pinned `cloudflare/api-schemas` revision remains the authority for request-schema semantics. Cloudflare's rendered docs and generated SDK are corroborating evidence of an upstream mismatch, but they are not a second automatic schema source.

For `POST /accounts/{account_id}/subscriptions` specifically:

- recursively remove properties that resolve to `readOnly: true`;
- if an optional object becomes empty after read-only pruning, omit that object;
- never emit the converter nesting-error sentinel;
- if an optional writable property/subtree cannot be represented without a converter-error sentinel, omit that unsafe optional property/subtree rather than emitting bogus data;
- if a required writable value cannot be represented safely, fail generation for explicit review;
- `deprecated: true` alone does not make a property non-writable;
- do not remove `app` or `component_values` merely because the SDK/docs omit them when the pinned schema still declares them writable;
- do not create endpoint-specific compatibility overrides in this PR.

The narrower SDK/docs contract should be documented as an upstream discrepancy for later reconciliation. The body-correctness fix can and should proceed independently.

## Scope discipline

This is a correctness fix before `v0.1.0`, not a request-template redesign.

Do not:

- hand-curate thousands of payloads;
- use Cloudflare's rendered docs as an alternate schema authority;
- replace the existing query/auth architecture;
- alter partition ownership;
- weaken existing warning, auth, query, deterministic-generation, Native Git, or public-safety gates.

If the pinned converter cannot be made to produce safe request bodies without broad unrelated drift, introduce the narrowest generic post-conversion request-body normalization necessary and document why it is safe.

## Validation before PR completion

Run and report:

- `npm ci`
- `npm test`
- `npm run generate`
- `npm run generate:check`
- `npm run validate`
- `npm run check`
- `git diff --check`
- release safety scan if the checksum-verified Gitleaks binary is available

Regenerate and commit both `dist/v2.1/` and `postman/`. Do not merge.

## Reviewed compatibility policy: overlapping `oneOf`

The subscription authority decision above remains in force. Overlapping
composition was independently demonstrated at pin
`49731bd0592b0c8c2c781b8d15d9f27c7293b210` (schema SHA-256
`3a7ba0e10e3b84f36e9ba6d6135a99d69177c2c3501711bcb367cb8b462bc627`).

`PUT /zones/{zone_id}/bot_management` requires an `application/json` body whose
root schema contains four `oneOf` alternatives. They describe different product
configurations, but do not require distinguishing properties or close additional
properties. After resolving their references, independent Ajv Draft 4 validation
accepts each of these bodies in **all four** branches:

- `{}`
- `{ "fight_mode": true }`
- `{ "auto_update_model": true, "bm_cookie_enabled": true, "suppress_session_score": false }`

None contains a read-only field or a converter sentinel. Each fails the complete
schema because `oneOf` requires exactly one matching alternative. The reviewed
generic compatibility rule classifies this exclusive-union multiple-match failure
as an `ambiguous-oneOf` source condition, provided the request independently
validates against at least one applicable branch, every emitted property is
writable in an applicable branch, no emitted property resolves to read-only,
and no sentinel or independent schema error remains. Zero matching branches and
all other independent schema failures remain errors.

Strict validation is the default. This compatibility classification does not
rewrite the pinned schema, select an arbitrary branch to make validation pass,
or manufacture or mutate request values to force exclusivity. A request whose
only failure is a proven overlapping `oneOf` must remain unchanged. This rule
applies generically; it does not grant an endpoint allowlist, SDK-derived shape,
or any other schema override. Read-only checks examine all structurally
applicable alternatives so a permissive branch cannot hide a read-only property.

`tests/request-body-ambiguity.test.mjs` independently proves the strict failure
from checksum-verified source with the pinned Ajv dependency, then verifies
compatibility acceptance without request or source mutation:

```sh
node --test tests/request-body-ambiguity.test.mjs
```

The diagnostic remains revision-bound: a schema pin change must trigger explicit
reevaluation. Implementation proceeds under this policy without waiting for an
upstream correction; any new unresolved semantic conflict still stops the work.

## Current stop condition: required value without a value schema

The overlapping-`oneOf` policy is implemented in the local candidate and the
Bot Management compatibility regressions pass. The service-token failure was a
separate implementation bug: name-based credential sanitization replaced the
numeric `client_secret_version` with a quoted Postman variable. The candidate now
preserves non-string request values during that substitution. This changes
neither the upstream schema nor response-example sanitization.

The resumed distribution probe found a different unresolved contract at the
same pin: both `PATCH /zones/{zone_id}/firewall/rules` and
`PUT /zones/{zone_id}/firewall/rules` declare a required JSON body with exactly:

```json
{ "required": ["id"] }
```

The exact source schema pointers are:

- `#/paths/~1zones~1{zone_id}~1firewall~1rules/patch/requestBody/content/application~1json/schema`
- `#/paths/~1zones~1{zone_id}~1firewall~1rules/put/requestBody/content/application~1json/schema`

In each case the required name is at `/required/0`. There is no `properties/id`,
type, reference, example, default, or media-type example. The existing converter
emits `{}`. Independent Ajv validation rejects that body with `keyword: required`,
`schemaPath: #/required`, and `missingProperty: id`. There is no `oneOf` in either
request schema; the reviewed overlap rule cannot apply.

This source is underspecified rather than contradictory: both a fictional string
and a boolean for `id` satisfy its stated constraints. Neither supplies evidence
of the intended request value. The candidate fails closed at the required `id`
instead of inventing an untyped value, borrowing a response/path schema, or
switching to a scalar body to bypass an object-only `required` keyword.

`tests/request-body-required-value.test.mjs` reproduces these facts independently
from checksum-verified source. The source paths and missing value semantics need
review before implementation can continue. Other probe failures remain
unclassified; this diagnostic does not authorize their suppression. Generated
artifacts remain unchanged, and full regeneration/validation is incomplete.
