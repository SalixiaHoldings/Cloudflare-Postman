# Finite request-template construction

This policy completes the construction work left blocked at PR #12 head
`f3c6f54ecab08ce7649cd445160b4fe66ee9f99c`. It does not change the request
validation architecture or the upstream pin. The primary converter and the
operation's own OpenAPI request/media schemas are the only construction sources.
SDKs, rendered docs, responses, sibling operations and existing generated files
are not construction inputs. The operation list in the regression fixture is
an exhaustive test target, not a production allowlist.

## Authority and precedence

Ajv still owns structural assertions through the existing OpenAPI 3.0 request
view. The separate annotation pass rejects read-only leakage. Source schemas
are immutable. A valid, writable, sentinel-free primary value wins; otherwise
use media/schema examples, then defaults, then enums, then bounded construction.
Complete request validation is required after selecting children. If a locally
valid choice fails the enclosing request, bounded retries can try the next
candidate. No emitted value is certified to have business meaning.

Before any conversion, generation parses a separate request-body authority from
exactly the same pinned bytes and recursively freezes it. Each partition supplies
a view of this graph to `createBodyContract()` for normalization and validation.
A deterministic before/after hash checks that the complete authority remains
unchanged. Converter-added defaults or cardinality are never source facts.

The primary converter working graph and full secondary query pass retain their
existing behavior. Neither receives the authority graph. Shared converter
mutation/order dependence is a separate generator concern; see the
[follow-up boundary](request-template-construction-diff.md#deferred-global-converter-isolation).

The existing structural format policy is unchanged. String-variable witnesses
add their own Ajv/ajv-formats checks for the supported string constraints; this
does not extend format enforcement to unrelated preserved converter values.
Strict validity below means validity under that request-validation contract.

## Finite candidates

- **Strings:** emit a quoted unresolved variable, using a deterministic property
  path (for example `{{origin__password}}` or `{{participant_ids__0}}`). Preserve
  existing variable names. Candidate witnesses come from request sources first,
  then repeated `a` characters satisfying the applicable minimum length, the
  fixed UUID `00000000-0000-4000-8000-000000000000`, or
  `https://example.invalid/` for URI. Witnesses are never emitted. Ajv checks
  maximum/minimum length, patterns, format, enum, negation and composition.
  Supported generated patterns are exactly
  `^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$` and `^[a-zA-Z0-9_-]+$`.
  There is no general regex generator. Length-derived candidates stop at 4,096
  characters. Unsupported constraints or unsuccessful candidates fail closed.
- **Variable coherence:** every occurrence of a variable in a request receives
  one common witness; the complete substituted request must validate. Literal
  braces passing a length check are not a proof. Existing quoted privacy
  variables in permissive maps can receive string witnesses, but an untyped
  missing required value is not thereby constructible. A witness proves only
  that a permitted string exists. The eventual runtime value remains unverified.
- **Objects:** construct required writable children and only enough additional
  declared writable properties to meet `minProperties`; honor `maxProperties`,
  `additionalProperties`, read-only annotations and composition. Safe existing
  converter properties and authoritative examples retain precedence. Do not
  fill optional properties merely because a fallback is available.
  Object intent declared through properties, required keys or object cardinality
  survives composition even without an explicit object type. Child scalar/array
  annotations cannot replace that structure. A complete authoritative media or
  schema example may still supply another representation if the whole request
  validates; Ajv's structural interpretation is unchanged.
- **Arrays:** preserve safe converter arrays; otherwise try their minimum
  required prefix and a minimally constructed array. Recursively construct the
  required items, with at most 256 new items. Complete Ajv validation enforces
  cardinality, uniqueness, items and composition. Empty containers are accepted
  only through validation. Recursive required-only cycles fail closed.
- **Booleans:** after request examples/defaults/enums, test `false`, then `true`.
- **Numbers/integers:** derive at most 256 finite candidates from `0`, `1`, `-1`,
  schema bounds, inclusive/exclusive neighbors, integer rounding and nearby
  multiples of declared `multipleOf` values. Emit only a complete-request-valid
  candidate. These literals are explicitly synthetic template values. No quoted
  numeric/boolean placeholders or unbounded search is used.
- **Composition:** source order makes candidate enumeration deterministic;
  independent validation of the complete request decides acceptance. The existing
  `ambiguous-oneOf` exception still requires Ajv-proven multiple matches and
  successful complete validation after relaxing only those reported sites in a
  temporary view. Other contradictions remain errors. At most 256 construction
  attempts and 256 alternative combinations are allowed; existing depth and
  evaluation bounds remain in place.
  During union repair, surviving declared property paths constrain branch choice.
  Repair may complete that shape, but cannot discard it to manufacture a different
  alternative. Affinity survives ancestor retries: an unconstructible required
  subtree fails, while an optional subtree may be omitted. With no usable primary
  footprint, an optional union first tries the exact schema/component's own
  example, default and enum after local reference resolution. Candidates must
  already satisfy that subtree and writable semantics, and then pass the complete
  containing request. Examples found only inside competing alternatives cannot
  establish authority. If no exact candidate works, a union with exactly one
  structural alternative may use the existing bounded construction policy,
  including branch-local source candidates. An unaffined multi-alternative union
  is otherwise omitted. Bounded retries try later candidates or omission when a
  locally valid optional choice fails its enclosing request; unrelated surviving
  values are retained. Normal credential sanitization still applies. Already valid
  input, including proven overlapping unions, remains unchanged.
- **Multipart file arrays:** repeated enabled file rows represent array elements.
  Construction emits the minimum required rows, with at least one row for a
  represented required file property, each with empty `src`. No file content or
  path is fabricated. Validate logical cardinality and the entire surrounding
  object. Unknown contents cannot establish `uniqueItems` or content-dependent
  assertions. Existing valid single-file behavior is unchanged. The pinned
  official Postman CLI preserves repeated file rows through Native Git migration,
  lint and body equivalence; a permanent regression exercises that conversion.

## Revision-bound source conflicts

`source-conflict` is distinct from `source-incomplete` and is **not schema-valid**.
The only recognized pattern is a plain string schema that also declares object
properties, with no additional structural assertions, no usable authoritative
root value, and an already safe primary object. This is a request-shape conflict,
not a claim that JSON Schema's `type: string` plus `properties` is mathematically
unsatisfiable: a scalar can satisfy that schema, but fabricating one discards the
source's object-property intent.

The primary object must be nonempty, sentinel-free, writable, contain only
declared properties whose existing values independently validate, and fail the
original request view only at the root type. Correct media/body mode is mandatory.
The body is preserved byte-for-byte and receives a visible warning. Exact type
and properties pointers, operation, upstream commit and digest are recorded in
the generated manifest. No fabricated replacement object or relaxed validity
schema is used. Ordinary failures, unsafe primary values, negation/cardinality
conflicts and read-only leakage cannot use this classification.

[The policy revision](../config/request-body-conflicts.json) binds the generic
pattern to commit `49731bd0592b0c8c2c781b8d15d9f27c7293b210` and SHA-256
`3a7ba0e10e3b84f36e9ba6d6135a99d69177c2c3501711bcb367cb8b462bc627`.
A different pin or digest rejects these cases until reviewed. PR #13 remains
independent and is not incorporated.

The two exact conflict sites are:

- `PATCH /accounts/{account_id}/load_balancers/pools`:
  `#/paths/~1accounts~1{account_id}~1load_balancers~1pools/patch/requestBody/content/application~1json/schema/type`
  and the sibling `/properties` pointer.
- `PATCH /user/load_balancers/pools`:
  `#/paths/~1user~1load_balancers~1pools/patch/requestBody/content/application~1json/schema/type`
  and the sibling `/properties` pointer.

Both preserve the primary `{"notification_email":""}` object. The old fabricated
root string is not used as evidence or as a repair.

## Exhaustive 56-case result

Fresh primary conversion of every complete pinned partition supplies the inputs
for the permanent exhaustive regression. Every case is normalized and then
independently validated. Result: **52 strict-valid, 2 ambiguous-oneOf, 2
source-conflict, 0 still fail-closed**. No case is newly classified
source-incomplete. All prior boundary regressions, including the nine adversarial
findings and F1–F6, remain covered. Old tests forbidding all scalar construction
now assert the specifically authorized finite policy and its rejection bounds.

| Case | Operation | Outcome |
| ---: | --- | --- |
| 1 | `POST /accounts/{account_id}/dlp/entries` | strict-valid |
| 2 | `PUT /accounts/{account_id}/dlp/entries/custom/{entry_id}` | strict-valid |
| 3 | `POST /accounts/{account_id}/hyperdrive/configs` | strict-valid |
| 4 | `PUT /accounts/{account_id}/hyperdrive/configs/{hyperdrive_id}` | strict-valid |
| 5 | `POST /accounts/{account_id}/pipelines` | ambiguous-oneOf |
| 6 | `PUT /accounts/{account_id}/pipelines/{pipeline_name}` | ambiguous-oneOf |
| 7 | `POST /accounts/{account_id}/realtime/kit/{app_id}/meetings/{meeting_id}/active-session/kick` | strict-valid |
| 8 | `POST /accounts/{account_id}/realtime/kit/{app_id}/meetings/{meeting_id}/active-session/mute` | strict-valid |
| 9 | `POST /accounts/{account_id}/realtime/kit/{app_id}/presets` | strict-valid |
| 10 | `PUT /accounts/{account_id}/realtime/kit/{app_id}/presets/{preset_id}` | strict-valid |
| 11 | `PUT /zones/{zone_id}/snippets/{snippet_name}` | strict-valid |
| 12 | `PUT /accounts/{account_id}/slurper/source/connectivity-precheck` | strict-valid |
| 13 | `PUT /accounts/{account_id}/slurper/target/connectivity-precheck` | strict-valid |
| 14 | `POST /accounts/{account_id}/abuse-reports/{report_param}` | strict-valid |
| 15 | `PATCH /accounts/{account_id}/brand-protection/queries` | strict-valid |
| 16 | `POST /accounts/{account_id}/cloudforce-one/v2/brand-protection/domain/queries` | strict-valid |
| 17 | `PATCH /accounts/{account_id}/cloudforce-one/v2/brand-protection/domain/queries/{query_id}` | strict-valid |
| 18 | `POST /accounts/{account_id}/cloudforce-one/v2/threat-signals/curated-feeds/bulk` | strict-valid |
| 19 | `POST /accounts/{account_id}/vuln_scanner/scans` | strict-valid |
| 20 | `PUT /zones/{zone_id}/api_gateway/labels/managed/{name}/resources/operation` | strict-valid |
| 21 | `PUT /zones/{zone_id}/api_gateway/labels/user/{name}/resources/operation` | strict-valid |
| 22 | `DELETE /zones/{zone_id}/api_gateway/operations/labels` | strict-valid |
| 23 | `POST /zones/{zone_id}/api_gateway/operations/labels` | strict-valid |
| 24 | `PUT /zones/{zone_id}/api_gateway/operations/labels` | strict-valid |
| 25 | `POST /accounts/{account_id}/dns_settings/views` | strict-valid |
| 26 | `POST /zones/{zone_id}/token_validation/config` | strict-valid |
| 27 | `PATCH /zones/{zone_id}/token_validation/config/{config_id}/credentials` | strict-valid |
| 28 | `PUT /zones/{zone_id}/token_validation/config/{config_id}/credentials` | strict-valid |
| 29 | `POST /accounts/{account_id}/load_balancers` | strict-valid |
| 30 | `PATCH /accounts/{account_id}/load_balancers/pools` | source-conflict |
| 31 | `PUT /accounts/{account_id}/load_balancers/{load_balancer_id}` | strict-valid |
| 32 | `POST /accounts/{account_id}/magic/apps` | strict-valid |
| 33 | `POST /accounts/{account_id}/magic/connectors` | strict-valid |
| 34 | `PUT /accounts/{account_id}/magic/routes/{route_id}` | strict-valid |
| 35 | `POST /accounts/{account_id}/magic/sites/{site_id}/acls` | strict-valid |
| 36 | `POST /accounts/{account_id}/mnm/rules/bulk` | strict-valid |
| 37 | `PUT /accounts/{account_id}/mnm/rules/bulk` | strict-valid |
| 38 | `PATCH /user/load_balancers/pools` | source-conflict |
| 39 | `POST /accounts/{account_id}/cloudforce-one/rules/structured` | strict-valid |
| 40 | `PUT /accounts/{account_id}/cloudforce-one/rules/structured/approvals/{id}` | strict-valid |
| 41 | `POST /accounts/{account_id}/cloudforce-one/rules/structured/approvals/{id}/resubmit` | strict-valid |
| 42 | `POST /accounts/{account_id}/cloudforce-one/rules/structured/validate` | strict-valid |
| 43 | `POST /accounts/{account_id}/browser-extension/config` | strict-valid |
| 44 | `PUT /accounts/{account_id}/browser-extension/config` | strict-valid |
| 45 | `POST /accounts/{account_id}/cni/cnis` | strict-valid |
| 46 | `PUT /accounts/{account_id}/cni/cnis/{cni}` | strict-valid |
| 47 | `POST /accounts/{account_id}/cni/interconnects` | strict-valid |
| 48 | `POST /accounts/{account_id}/containers/applications` | strict-valid |
| 49 | `POST /accounts/{account_id}/data-security/posture/policies` | strict-valid |
| 50 | `PUT /accounts/{account_id}/data-security/posture/policies/{policy_id}` | strict-valid |
| 51 | `PUT /accounts/{account_id}/field_extractors/{extractor}` | strict-valid |
| 52 | `POST /accounts/{account_id}/iam/resource_groups` | strict-valid |
| 53 | `POST /accounts/{account_id}/members` | strict-valid |
| 54 | `PUT /accounts/{account_id}/tokens/{token_id}` | strict-valid |
| 55 | `POST /organizations/{organization_id}/members` | strict-valid |
| 56 | `PUT /user/tokens/{token_id}` | strict-valid |

## Verification history

At the original finite-policy head `f6508369519b02dc79bc03e29e994bd3944af1ae`,
on Node 24, `npm ci`, the 81 focused request-body/Native Git tests, all 113
repository tests, `npm run generate`, `npm run generate:check`,
`npm run validate`, the complete `npm run check`, and `git diff --check` pass.
The final complete check reruns the tests, deterministic regeneration and
validation on the finalized implementation. Both formats regenerate together;
each collection also passes the official CLI's raw/normalized lint, semantic
comparison and two-migration byte comparison. The final generated manifest
independently reproduces the exhaustive 52/2/2 disposition.

Checksum-verified Gitleaks 8.30.1 reports 3,727 attributed findings and zero
unresolved findings: 3,543 auth fingerprints, 158 upstream examples and 26
synthetic token IDs. Email occurrences are also attributed: 381 upstream and 12
synthetic occurrences. The official Darwin x64 archive SHA-256 is
`dfe101a4db2255fc85120ac7f3d25e4342c3c20cf749f2c20a18081af1952709`.

The historical audit at that commit records 135 individual body changes, identical
file sets, and zero response-payload changes in both formats. Hosted Validate
passed for that commit; PR #12 remains draft.

The subsequent three construction corrections use a pristine request-body
source while preserving the existing non-body converter behavior. The
[historical correction audit](https://github.com/SalixiaHoldings/Cloudflare-Postman/blob/1e5a960ab832ba11a87f0ed27308c68591981a8d/docs/request-template-construction-diff.md) records all changes
relative to `f6508369519b02dc79bc03e29e994bd3944af1ae`, including the complete
response/query/header immutability comparison. The schema pin, finite primitive
policy and compatibility categories remain unchanged.

For those authority corrections, 93 focused tests and 125 full tests passed, together with
installation, generation, deterministic regeneration, validation, the complete
check and checksum-verified Gitleaks. Both formats retain zero response, query,
header and unrelated generated-field changes relative to that baseline. All 30
live-body changes and 71 corresponding saved request bodies are documented in
the correction audit.

The subsequent optional-union precedence correction tries exact-schema authority
and safe sole-alternative construction before omission. The
[current diff audit](request-template-construction-diff.md) compares that change
against `1e5a960ab832ba11a87f0ed27308c68591981a8d` and records every changed body,
source justification and complete non-body comparison.
