# Generated query parameters

## Official serialization, bounded projection

[Maintainer decision 5716781036](https://github.com/SalixiaHoldings/Cloudflare-Postman/pull/4#issuecomment-5716781036) approves full secondary conversion with pinned `openapi-to-postmanv2@6.3.3`:

```js
enableOptionalParameters: false,
optimizeConversion: false,
stackLimit: 50
```

The primary conversion remains authoritative for collection structure, bodies, headers, auth, names, descriptions, scripts, IDs, and response examples. The secondary pass runs in a separate persistent Node process, so its converter/faker state cannot alter later primary partitions. Both passes retain their partition order, full component context, and existing deterministic random/time controls. Immutable contract snapshots protect validation from converter input mutation. Every expected HTTP method/OpenAPI path must occur exactly once in each pass; missing, duplicate, or unexpected identities stop generation.

Only official secondary `request.url.query` rows are copied into the primary request. The generator substitutes `account_id`/`account.id`, `zone_id`/`zone.id`, `tenant_id`, and `organization_id` with their environment variable references, then uses the existing `makeRawUrl()` to build the final URL from enabled rows. It does not serialize arrays or objects locally. Required rows remain enabled; emitted optional rows remain visible but disabled. Users can deliberately enable optional Params.

Saved response `originalRequest` snapshots are cloned from the final normalized live request. Response bodies and example structure remain primary-owned. Identifier substitution added for tenant/organization query parameters does not rewrite request bodies. Path placeholders already use matching environment variable names.

The reduced-input optimization is not used: stripping bodies/responses changed 2,556 query values across 435 operations, including 12 enabled rows. See the [historical experiment](query-options-experiment.md).

## Revision-bound validation and provenance

`config/query-projection.json` binds the schema commit/digest, converter version, secondary options, omission contracts and their SHA-256 digests, and per-partition secondary warning records. Any drift requires review. Generation verifies those records; the manifest includes query row counts, omissions, and separate secondary warning provenance. Validation checks the manifest against the approved records and independently checks emitted query contracts against the pinned schema.

Validation resolves local parameter/schema references, path inheritance, and operation-level overrides. It maps converter-owned object-property rows back to their declared parameter without generating serialized values. Ambiguous/unmapped identities, wrong requiredness/state, missing required parameters, unexpected omissions, or nesting-error placeholders fail closed.

The current distribution has **133 required and 5,495 optional query contracts**, producing **141 enabled and 8,070 disabled query rows** across **3,522 operations**. Row counts differ from contracts because of repeated array rows and object expansion. The five previously corrupted IAM/Spectrum parameters retain their proper identities.

### Five known optional-array omissions

The official converter omits these exact optional contracts:

- `GET /accounts/{account_id}/gateway/lists`: `filter`.
- `GET /accounts/{account_id}/gateway/locations`: `filter`.
- `GET /accounts/{account_id}/gateway/proxy_endpoints`: `filter`.
- `GET /accounts/{account_id}/gateway/rules`: `filter`.
- `GET /accounts/{account_id}/cloudforce-one/events`: `search`.

These are approved discoverability limitations, not missing operations. No local serializer, fabricated placeholder, or endpoint rewrite fills them. If any starts appearing, its contract changes, or another omission appears, validation fails for explicit review.

### Warning fingerprints

The primary conversion retains **47 warnings**. The secondary pass separately records **539 diagnostics: 537 allOf-resolution warnings and two unknown-format warnings**. Diagnostic messages and incompatible values are retained, grouped with occurrence counts, sorted, and hashed. Only stack frames are excluded because they contain installation paths and runtime line numbers. Unknown diagnostic categories, changed messages/counts, or fingerprint drift fail; secondary warnings never replace or inflate the primary warning baseline.

### Native Git semantics

Production validation compares v2/v3 query keys, values, enabled/disabled state, ordered/repeated rows, descriptions where represented, and the complete raw URL. Official CLI `1.56.3` migration owns v3 serialization. Existing two-run file-set, byte, digest, collection/environment/Globals lint, and public-safety gates cover the result.

## Environments and Desktop acceptance

The single environment model defines empty `tenant_id` and `organization_id` alongside account/zone selectors. JSON and YAML use the same model. Credentials and resource selectors belong in Postman's local **Value** fields; never **Share** sensitive environment or global values. Generated files must not be hand-edited.

In Postman Desktop Local View, check:

1. `GET /organizations` defaults to `{{base_url}}/organizations`, with 11 optional rows unchecked.
2. `GET /organizations/{organization_id}/accounts` defaults to `{{base_url}}/organizations/{{organization_id}}/accounts`, with 14 optional rows unchecked and the path selector supplied through the environment.
3. Required Params are checked, known identifiers use environment variables, and optional Params can be deliberately enabled.
4. Tenant/organization local Values do not change tracked files. Do not Share sensitive values.
5. Existing collection/bootstrap/auth inspection, empty Globals, no Upgrade files warning, and no cloud-binding requirement still hold.

CLI validation does not establish Desktop behavior. Keep PR #4 Draft pending human acceptance; do not merge or tag automatically.
