# Generated query parameters

## Official serialization, bounded projection

The generator uses a full secondary conversion with pinned `openapi-to-postmanv2@6.3.3`:

```js
enableOptionalParameters: false,
optimizeConversion: false,
stackLimit: 50
```

The primary conversion remains authoritative for collection structure, bodies, headers, auth, names, descriptions, scripts, IDs, and response examples. The secondary pass runs in a separate persistent Node process, so its converter/faker state cannot alter later primary partitions. Both passes retain partition order, full component context, and deterministic random/time controls. Every expected HTTP method/OpenAPI path must occur exactly once in each pass; missing, duplicate, or unexpected identities stop generation.

Only official secondary `request.url.query` rows are copied into the primary request. The generator substitutes `account_id`/`account.id`, `zone_id`/`zone.id`, `tenant_id`, and `organization_id` with environment-variable references, then uses the existing `makeRawUrl()` to build the final URL from enabled rows. It does not serialize arrays or objects locally. Required rows remain enabled; emitted optional rows remain visible but disabled. Users can deliberately enable optional Params.

Saved response `originalRequest` snapshots are cloned from the final normalized live request. Response bodies and example structure remain primary-owned. Identifier substitution added for tenant/organization query parameters does not rewrite request bodies. Path placeholders already use matching environment-variable names.

The reduced-input optimization is not used: stripping bodies/responses changed 2,556 query values across 435 operations, including 12 enabled rows. See the [historical experiment](query-options-experiment.md).

## Revision-bound validation and provenance

`config/query-projection.json` binds the schema commit/digest, converter version, secondary options, omission contracts and their SHA-256 digests, and per-partition secondary warning records. Any drift requires review. Generation verifies those records; the manifest includes query row counts, omissions, and separate secondary-warning provenance. Validation checks the manifest against the approved records and independently checks emitted query contracts against the pinned schema.

Validation resolves local parameter/schema references, path inheritance, and operation-level overrides. It maps converter-owned object-property rows back to their declared parameter without generating serialized values. Ambiguous/unmapped identities, wrong requiredness/state, missing required parameters, unexpected omissions, or nesting-error placeholders fail closed.

The current distribution has **133 required and 5,511 optional query contracts**, producing **141 enabled and 8,094 disabled query rows** across **3,540 operations**. Row counts differ from contracts because of repeated array rows and object expansion. The five previously corrupted IAM/Spectrum parameters retain their proper identities.

### One known revision-bound query omission

At revision `a0eceeef8288f2fea2c3115a232ddf23e43d8540`, the official secondary conversion omits only optional `search` on `GET /accounts/{account_id}/cloudforce-one/events`. This array has `default: []`. Its current parameter SHA-256 is `97be6fa16b6124b7a7217c1fead4c42aaa9e0657d6337cd3ccd7a152d6b73ffb`, freshly measured from the pinned schema. The [superseding PR decision](https://github.com/SalixiaHoldings/Cloudflare-Postman/pull/7#issuecomment-5731810896) approves this exact limitation.

The four previous Gateway filter omissions are now emitted, and both new device registration-type filters are emitted as disabled optional Params. `config/query-projection.json` carries exactly one omission. Required omissions are always rejected. Any optional omission is fingerprinted by exact operation, parameter identity, and SHA-256; `assertOmissions()` rejects additions, removals, duplicates, and changed fingerprints. No local serializer, fabricated row, upstream patch, or alternative converter strategy is used.

### Warning fingerprints

The primary conversion retains **47 warnings**. The secondary pass separately records **530 diagnostics: 528 allOf-resolution warnings and two unknown-format warnings**. Diagnostic messages and incompatible values are retained, grouped with occurrence counts, sorted, and hashed. Only stack frames are excluded because they contain installation paths and runtime line numbers. Unknown diagnostic categories, changed messages/counts, or fingerprint drift fail; secondary warnings never replace or inflate the primary warning baseline.

### Native Git semantics

Production validation compares v2/v3 query keys, values, enabled/disabled state, ordered/repeated rows, descriptions where represented, and the complete raw URL. Official CLI `1.56.3` migration owns v3 serialization. Existing two-run file-set, byte, digest, collection/environment/Globals lint, and public-safety gates cover the result.

## Environment values

The single environment model defines empty credential and resource-selector fields for account, zone, tenant, and organization use. JSON and YAML use the same model.

`base_url` is intentionally populated with `https://api.cloudflare.com/client/v4` and may remain Shared/tracked. Credentials and real resource identifiers must stay in Postman's local **Value** fields. **Never Share or commit API keys/tokens, authentication email values, or real account/zone/tenant/organization IDs.** Generated files must not be hand-edited.

## Desktop verification

In Postman Desktop Local View, verify:

1. `GET /organizations` defaults to `{{base_url}}/organizations`, with 11 optional rows unchecked.
2. `GET /organizations/{organization_id}/accounts` defaults to `{{base_url}}/organizations/{{organization_id}}/accounts`, with 14 optional rows unchecked and the path selector supplied through the environment.
3. Required Params are checked, known identifiers use environment variables, and optional Params can be deliberately enabled.
4. Local credential/resource values do not change tracked files.
5. Collections, bootstrap, auth metadata, empty Globals, and Local View open without an Upgrade files warning or required cloud binding.

CLI validation proves generated-format integrity; desktop verification covers Postman UI behavior.
