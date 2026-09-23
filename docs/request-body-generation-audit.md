# Historical request-body generation audit (PR #12)

> Historical record. This file preserves the pre-v0.1.0 diagnosis and implementation evidence from PR #12. It is not the current distribution status. For current behavior, see the [finite construction policy](request-template-construction.md) and the [current schema-revision review](schema-revision-7287cb19.md).

The measurements and endpoint conditions below are intentionally preserved from
the audited `49731bd` baseline unless a section explicitly says otherwise. The
current construction inventory contains 57 reviewed cases; the
[historical distribution comparison](request-template-construction-diff.md)
records the final PR #12 body-only correction against its original baseline.

## Problem statement

At the audited PR #12 baseline, generated request bodies were not consistently faithful to the writable request shape declared by Cloudflare's OpenAPI schema.

A confirmed example is:

`POST /accounts/{account_id}/subscriptions`

At that baseline, the generated Postman body contained root-level fields such as `app`, `component_values`, `currency`, `current_period_end`, `current_period_start`, `id`, `price`, `state`, and `zone`, plus repeated converter placeholders:

`<Error: Too many levels of nesting to fake this schema>`

Cloudflare's official TypeScript SDK and rendered API documentation expose only `frequency` and `rate_plan` as body parameters for account subscription creation. The pinned `cloudflare/api-schemas` source disagrees: some additional properties are not marked `readOnly`. Treat that as an upstream contract discrepancy, not permission to silently replace the pinned schema with SDK/docs-derived allowlists.

Codex's checked-out full-distribution scan measured **512 generated `.request.yaml` files** whose live request bodies contain the exact nesting-error placeholder: 507 JSON bodies and 5 form-data bodies. Use the checked-out parsed measurement rather than the earlier GitHub-search estimate.

## Implemented generation boundary

The primary `openapi-to-postmanv2@6.3.3` conversion supplies candidate request bodies. The generic `src/request-body.mjs` correctness layer normalizes and validates them against each operation's pinned request/media schema before identifier sanitization and validates them again afterward. `src/validate.mjs` independently reruns request validation over the complete checked-in distribution. Response bodies remain outside this correction boundary.

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
6. If an optional field cannot be represented safely, prefer omission over an invalid placeholder. If a required body/value cannot be represented safely, fail generation unless the mechanically proven, explicitly reported `source-incomplete` policy below applies.
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

## Reviewed compatibility policy: source-incomplete required values

> Historical endpoint finding. At `49731bd`, firewall bulk PATCH/PUT lacked usable semantics for required `id` and were classified `source-incomplete`. At the current `7287cb19` pin, Cloudflare declares `id` as a required string, so those two operations now construct and validate normally. The generic `source-incomplete` policy remains in force for the twelve current cases documented in the [revision review](schema-revision-7287cb19.md).

The overlapping-`oneOf` policy is implemented generically. The service-token failure was a
separate implementation bug: name-based credential sanitization replaced the
numeric `client_secret_version` with a quoted Postman variable. The candidate now
preserves non-string request values during that substitution. This changes
neither the upstream schema nor response-example sanitization.

The distribution probe independently confirmed an incomplete source contract at the
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
of the intended request value. These requests are classified as `source-incomplete`: their original converter
body is preserved byte-for-byte, with no fabricated `id` or inferred body shape.

The generic rule is deliberately separate from successful schema validation:

- Prove that a missing required value has no usable value schema, example,
  default, or other construction semantics in the pinned request contract.
- Preserve the primary converter body rather than infer from responses, sibling
  operations, docs, SDKs, or history. Do not change the pinned schema.
- Require that the preserved body has no other schema failures, read-only
  leakage, or converter sentinels. Zero-match unions cannot be excused.
- Add a generated request-description warning that the pinned OpenAPI cannot
  safely supply the required value and the body template is incomplete.
- Report the operation, missing value path, exact schema pointer, and reason in
  the generation manifest and validation output. Count it separately from valid
  templates. Validation independently reproves the classification and warning.
- Do not apply the classification when authoritative request examples/defaults
  or sufficient schema semantics can supply the value.

`tests/request-body-required-value.test.mjs` is revision-bound and independently
proves the missing semantics with Ajv, then verifies preservation, classification,
exact source paths, warning, and absence of a fabricated `id`. Synthetic tests
verify the policy without endpoint names and reject unrelated violations.

## Implementation boundaries

The request-schema adapter resolves local Reference Objects into a separate
Ajv Draft 4 validation view. It preserves every structural assertion and the
pinned source graph. Ajv owns type, enum, required, negation, composition,
cardinality, scalar/array constraints, and additional properties together, rather
than receiving a selected list of scalar keywords. See the
[Ajv schema reference](https://ajv.js.org/json-schema.html) and
[OpenAPI 3.0 Schema Object semantics](https://spec.openapis.org/oas/v3.0.3.html#schema-object).
OpenAPI formats remain annotations; format validation is disabled.

Only positive request schemas remove requirements for read-only properties,
including shared `allOf` declarations. Negated schemas retain structural required
semantics and strict composition. Direct read-only leakage checks are separate
from Ajv and examine all applicable union alternatives, including nested
compatible overlaps. `writeOnly` and deprecated writable fields stay writable.
Array-item annotations do not make the containing array property read-only.

Strict Ajv validation runs first. Compatibility is available only when Ajv reports
a multiple-match `oneOf` failure (`passingSchemas` contains at least two indices).
A temporary copy relaxes only those reported sites and must pass whole-schema
Ajv validation, followed by the separate writable/sentinel checks. There is no
global `oneOf` to `anyOf` rewrite, source mutation, custom structural negation,
or recursive structural branch matcher. The remaining bounded composition plans
provide normalization candidates and annotation information, not validity.

Quarantine is intentionally limited to required schema-less JSON bodies with no
examples, and plain missing required-property declarations with no usable value
schema. The latter rejects composition, negation, enclosing enums/examples/defaults,
cardinality, and unfamiliar assertions; Ajv validates the remainder after only
the proven missing requirements are removed. Neither condition certifies a body
as schema-valid. No new source-incomplete category covers generation failures.

Normalization retains safe converter values and prunes unsafe optional output.
It may use source examples/defaults/enums, combine authoritative property values,
or prune existing containers. It cannot invent scalar defaults from a type or
numeric/string constraint. Every candidate must pass Ajv and writable checks.

JSON/form media enforce raw/form-data/URL-encoded modes respectively. Every
nonempty JSON body parses; an empty required body with a usable media example can
be populated from that example during normalization and cannot bypass validation.
Enabled form rows become a logical object, including typed JSON decoding where
the source declares structured or numeric/boolean values. Ajv validates that
entire object, including root assertions. Duplicate enabled keys fail closed
pending encoding review. Non-JSON raw values also pass structural validation.

Unselected files establish only a string representation. Content-dependent
constraints fail closed; a file row cannot bypass `not: {}` or another structural
impossibility. Root assertions on the logical form object remain active. This
does not assert that unknown file contents satisfy a schema.

Unresolved Postman variables retain their emitted bytes. If their literal text
fails structural validation, only a source example/default/enum string can serve
as a logical validation witness. Repeated variable names use the same witness,
and the complete logical body must pass Ajv. Missing or contradictory evidence
fails closed. This replaces the previous blanket string-variable assertion bypass;
it does not validate runtime variable values. The two constrained variable cases
in that audited distribution were custom-domain `zone_id` and registry
`secret_name`. No endpoint-specific rule implements this behavior.

Native Git equivalence now checks live body modes and content as well as the
existing identity/auth/query contracts. JSON/text bytes must match exactly.
Form comparisons account only for the official migration's semantic defaults
(empty descriptions, false disabled flags, and empty unselected file paths).
This comparison does not rewrite any generated YAML or broaden the approved
migration normalization.

## Distribution results at the reviewed pin

Measured against the pre-implementation tree at
`f0c67b40bb4abb8367165c9adfc07f8cfc6a3648`, using parsed live request bodies:

| Measurement | Before | After |
| --- | ---: | ---: |
| Reference operations, exactly once | 3,540 | 3,540 |
| Reference requests with bodies | 1,254 | 1,254 |
| Native Git request files, including bootstrap | 3,543 | 3,543 |
| Live v2.1 bodies containing the nesting sentinel | 512 | 0 |
| Native Git request files with live-body sentinels | 512 | 0 |
| Affected JSON / form-data request files | 507 / 5 | 0 / 0 |

The final report separately counts **1,207 valid body templates**, **31
ambiguous-oneOf requests**, **16 source-incomplete requests**, and **2,286
requests without bodies**. The incomplete set consists of the two firewall
required-property cases plus fourteen operations declaring a required JSON body
without a schema or example. Their converter bodies are preserved, not certified
as valid. Each carries the generated warning. The
[manifest](../dist/v2.1/manifest.json) records every condition by operation and
the exact missing-value schema paths; validation independently reproduces it.

The generated diff changes 576 live bodies: all 512 sentinel-bearing bodies plus
64 corrections involving read-only fields, incorrect converter value types,
required fields, enums, or property-count constraints. The 592 changed Native
Git request files are those 576 bodies plus 16 warning-only changes. The 1,412
changed example files contain corresponding saved **request** snapshots.
Structural comparison of every reference collection confirms **zero response
payload changes and zero unrelated field changes** after excluding corrected
live/saved request bodies and the exact incomplete-source warning. URLs, query
rows, auth, identity, names, partition ownership, and response payloads retain
their baseline semantics. All body modes are unchanged: 1,212 raw, 32 form-data,
9 file, and 1 URL-encoded.

Subscription creation now contains `frequency: "monthly"`; the optional
`rate_plan` and other unsafe optional subtrees were omitted because their
converter values were sentinels. A separate pinned regression proves safely
represented `app` and `component_values` remain writable; no endpoint allowlist
drives generation. Account service-token creation retains numeric
`client_secret_version: 1` and validates normally, without either compatibility
classification.

## Validation at the pre-refactor head

- `npm ci`: passed with the pinned Node 24/toolchain. npm reports three existing
  high-severity dependency advisories; this change does not alter dependencies.
- `npm test`: passed, 69 tests, including the pinned diagnostics and synthetic
  request/body-equivalence tests.
- `npm run generate`: passed; both generated trees regenerated together.
- `npm run generate:check`: passed, byte-for-byte reproducible.
- `npm run validate`: passed all schema, accounting, authentication, query,
  request-body, Native Git, hash, and public-template checks.
- `npm run check`: passed the complete local gate.
- `git diff --check`: passed.
- Release scan with checksum-verified Gitleaks 8.30.1: passed, 3,727 findings
  fully attributed (3,543 auth fingerprints, 158 upstream examples, 26 synthetic
  token IDs), **zero unresolved**. Email occurrences were likewise attributed
  to 375 upstream and 12 synthetic samples.

Cold-cache hosted execution exposed concurrent pinned-schema downloads sharing
one staging filename. Each checksum-verified download now gets a unique atomic
staging path; a 16-way synthetic download regression also verifies that digest
and size mismatches cannot replace the cache. This does not change downloaded
bytes, schema authority, generated output, or test concurrency requirements.

## Ajv refactor history at f3c6f54

The refactor starts from `92839fb03aef326772a0b91dd9150b6cbf7cec1d`.
All six final-review regressions fail on that original implementation and pass
with the adapter: root form assertions, impossible file fields, empty JSON with
media examples, enclosing enum candidates, contradictory missing requirements,
and constrained raw text. The previous negation, media-mode, and schema-less JSON
regressions remain. Two older expectations are deliberately tightened: negated
schemas are never quarantined, and a bare type no longer authorizes a fabricated
required value.

The structural matcher block (`scalarMatches` through `matchesUncached`) shrinks
from 77 lines to the 26-line Ajv wrapper. Custom structural recursion, selected
scalar-keyword validation, per-value policy caches, and type-derived primitive
construction are removed. The full module changes from 481 to 499 lines because
it now includes the derived-schema adapter, complete form decoding, conservative
file handling, and source-backed variable witnesses. Structural assertion
semantics belong to Ajv despite the small increase in total adapter/normalizer
size.

The preserved distribution independently validates at **1,207 valid**, **31
ambiguous-oneOf**, **16 source-incomplete**, and **2,286 without bodies**. It still
contains **3,540** exact-once operations, **1,254** live request bodies, and **zero**
live-body sentinels. Both generated trees and all response payloads remain
byte-identical to the refactor baseline.

**At that head, regeneration was blocked by the stricter construction policy.** A full primary
converter probe initially found 92 failures after removing invented values;
pruning existing array contents resolves 36, leaving 56 required construction
failures. For example, `PUT /accounts/{account_id}/hyperdrive/configs/{hyperdrive_id}`
requires `origin.password`, whose schema has type/string length constraints but
no example, default, or enum. The primary converter supplies a nesting sentinel
for `origin`. The previous generator invented a string and subsequently emitted
`{{password}}`. The committed request is structurally valid, but the new allowed
construction sources cannot reproduce it. The regression at that head required failure rather than inventing a value or
classifying source-incomplete. The subsequently approved finite policy changes
that expectation to a string variable with a non-emitted witness.

The subsequent [finite construction policy](request-template-construction.md)
resolves that generation blocker without changing the Ajv assertion architecture.
It defines bounded string witnesses, minimal containers, typed primitive
candidates, multipart file arrays and the separately warned source-conflict
classification. It supersedes the historical no-synthetic-construction rule above.
The policy report lists all 56 outcomes; the
[generated-diff audit](request-template-construction-diff.md) compares every
changed body with the preserved distribution at `f3c6f54`. Generation continues
to stage both formats before replacing the published trees.
