# Cloudflare schema revision 73947dd

> Historical revision review. The current review is [7287cb19](schema-revision-7287cb19.md).

This review advances the v0.1.0 distribution from
`49731bd0592b0c8c2c781b8d15d9f27c7293b210` to
`73947ddceec8571140469a90a1a35078e10fa054`, using the unmodified official
`openapi.json`, SHA-256
`66259004b9ee38da435ec59992dbb73a7740d4249971bb80f3fa1f0a9ee1c344`.
The review baseline is repository `main` at `4882dc0e8fb7c8ef2d012f4c792f41368741e1bb`.

The [complete review evidence](schema-revision-73947dd-audit.json) records all
added/removed/changed operations, new-operation security declarations and actual
classifier matches, every warning delta, every prior body diagnostic, all 132
changed bodies with value paths/digests, and response/query/header change lists.
It contains source and generated-template metadata, not live API responses.

## Operation accounting and partition ownership

Independent comparison of the two pinned operation objects confirms 3,540 →
3,565 operations: 26 added, one removed, 261 changed, zero newly deprecated.
Changes are measured on operation objects, as in the updater; referenced
component changes are also included in the separate body/non-body audit.

All 26 new operations match existing overlap families using their actual path,
operationId and tags. No expected family differs from the classifier result.
Partition regexes and existing owners remain unchanged. The declarations add
26 exact keys and remove `GET /accounts/{account_id}/security-center/insights/count`:
2,512 → 2,537 overlapping operations across the same 54 declarations. Calling
`classifyOperations()` over all 3,565 operations proves no undeclared, stale,
duplicate or unused declarations and exactly one owner per operation.

| Partition | Operations |
| --- | ---: |
| Zero Trust | 594 |
| Workers & developer platform | 512 |
| Storage & data | 128 |
| Application security & rulesets | 370 |
| Analytics & observability | 435 |
| Zones, DNS & domains | 436 |
| Network services | 286 |
| Media & communications | 183 |
| Accounts, identity & billing | 620 |
| Other Cloudflare services | 1 |

The five affected overlap families add 4 Workers Observability operations,
19 Browser Rendering/Builds/Workers operations, one Durable Objects query,
one account Security Center partner count, and one zone partner count. The
exact 19 are listed below; their owner is `workers-developer-platform` and their
match set is `accounts-identity-billing+workers-developer-platform`.

- `DELETE /accounts/{account_id}/workers/workers/{worker_id}/previews/{preview_id}`
- `DELETE /accounts/{account_id}/workers/workers/{worker_id}/previews/{preview_id}/deployments/{deployment_id}`
- `GET /accounts/{account_id}/browser-rendering/recording/{session_id}`
- `GET /accounts/{account_id}/browser-rendering/recording/{session_id}/network`
- `GET /accounts/{account_id}/builds/workers/{script_tag}/previews`
- `GET /accounts/{account_id}/builds/workers/{script_tag}/previews/{preview_id}`
- `GET /accounts/{account_id}/builds/workers/{script_tag}/previews/{preview_id}/builds`
- `GET /accounts/{account_id}/workers/workers/{worker_id}/previews`
- `GET /accounts/{account_id}/workers/workers/{worker_id}/previews/{preview_id}`
- `GET /accounts/{account_id}/workers/workers/{worker_id}/previews/{preview_id}/deployments`
- `GET /accounts/{account_id}/workers/workers/{worker_id}/previews/{preview_id}/deployments/{deployment_id}`
- `PATCH /accounts/{account_id}/builds/workers/{script_tag}/previews/{preview_id}`
- `PATCH /accounts/{account_id}/workers/workers/{worker_id}/previews/{preview_id}`
- `PATCH /accounts/{account_id}/workers/workers/{worker_id}/previews/{preview_id}/deployments/latest`
- `POST /accounts/{account_id}/builds/workers/{script_tag}/migrate_to_previews`
- `POST /accounts/{account_id}/builds/workers/{script_tag}/previews/{preview_id}/builds`
- `POST /accounts/{account_id}/workers/workers/{worker_id}/previews`
- `POST /accounts/{account_id}/workers/workers/{worker_id}/previews/{preview_id}/deployments`
- `PUT /accounts/{account_id}/workers/workers/{worker_id}/previews/{preview_id}`

## Authentication

Each new operation was classified from its own `security` declaration and the
referenced security schemes. Twenty-four support a standalone Bearer alternative.
The two Browser Rendering recording operations each declare a single AND
requirement containing `api_email`, `api_key`, and `api_token`; they retain
`multi-scheme-or-other`, including all required credentials. No adjacent-API
assumption is used. The evidence records each declaration and selected index.

Final categories: 571 bearer-only, 1,651 bearer-alternative, 216 legacy-only,
1,116 multi-scheme-or-other, seven anonymous, four manual-unresolved. Existing
Email Routing/Sending operations also gain upstream-declared token alternatives.

## Query projection and warning review

The actual full secondary conversion retains the one optional Cloudforce One
`search` omission, with unchanged parameter SHA-256
`97be6fa16b6124b7a7217c1fead4c42aaa9e0657d6337cd3ccd7a152d6b73ffb`.
No omission appears or disappears. The new distribution has 135 required and
5,538 optional contracts, emitted as 143 enabled and 8,121 disabled rows.

Both pins were converted in separate processes with the complete component graph
and the production partition order. An audit-only wrapper around the converter's
`convertRequestToItem()` attributed captured warnings to operation keys without
changing its arguments or results. Every captured event was accounted for; the
aggregate records exactly reproduce both the baseline policy and the independent
new-pin secondary worker results. The wrapper is not part of the generator.

| Partition | Old diagnostics | New diagnostics | Explanation |
| --- | ---: | ---: | --- |
| Zero Trust | 236 | 190 | 23 operation-level failure-response compositions changed; each removes two incompatible result warnings. |
| Application security | 64 | 41 | 11 Firewall/Rate Limits operations change failure-response compositions; exact per-operation reductions are recorded. |
| Zones | 94 | 85 | Four Filters operations remove two failure-response warnings each; Email Routing rules loses one pagination warning. |
| Media | 3 | 1 | Account Email Routing addresses/rules each loses one pagination warning. |
| Workers | 7 | 9 | The two new Builds list operations combine `builds_APIResponse.result` with array results. |
| Accounts | 63 | 63 | Unchanged fingerprint. |
| Analytics | 14 | 14 | Unchanged fingerprint. |
| Network | 42 | 42 | Unchanged fingerprint. |
| Storage | 7 | 7 | Unchanged fingerprint. |
| Other | 0 | 0 | Unchanged fingerprint. |

The three Email Routing collection schemas now explicitly type pagination
`count`, `page`, `per_page`, and `total_count` as numbers; previously their
example-only declarations acquired incompatible object types during conversion.
These are `email_destination_addresses_response_collection`,
`email_account_rules_response_collection`, and `email_rules_response_collection`.
The new Builds warnings belong to `GET .../builds/workers/{script_tag}/previews`
and `GET .../previews/{preview_id}/builds` and retain the existing object/array
warning category. Total secondary diagnostics: 530 → 452 (450 allOf plus the same
two unknown-format warnings). Primary warnings remain 47. Only the five proven
partition fingerprints change; all fail-closed guards remain intact.

## Request-body policy and classifications

| Classification | v0.1.0 | New pin |
| --- | ---: | ---: |
| Valid | 1,203 | 1,216 |
| Ambiguous oneOf | 33 | 33 |
| Source-incomplete | 16 | 12 |
| Source-conflict | 2 | 2 |
| No applicable body | 2,286 | 2,302 |

Both bulk firewall PATCH/PUT contracts now declare `type: object`, a required
string `id`, and its description. They validate normally. Their obsolete
incomplete warning is rejected. Email Routing enable/disable now have no
`requestBody`; their bodies and warnings disappear. All twelve remaining
incomplete request contracts, including all required schema-less cases, were
compared through their referenced schemas and revalidated; they remain unchanged.

All 33 prior ambiguous-oneOf request contracts and referenced schemas are
unchanged and independently reclassified on the new pin. The Bot Management
regression still proves all four alternatives match its reviewed values while
strict Ajv rejects only oneOf exclusivity. No new ambiguity exception is added.

The two load-balancer pool PATCH contracts retain the exact plain string schema
with declared `notification_email` object property. Their full referenced
request contracts are unchanged. The new revision-bound source test independently
checks the exact shape, root-only Ajv type error, valid existing property value,
preserved primary bytes, and required warning. Only then is the conflict policy
binding advanced. They remain explicitly not schema-valid.

Fresh primary conversion confirms all original 56 construction inventory cases
retain their outcomes. Reapplying the original preconstruction diagnostic at
`f3c6f54ecab08ce7649cd445160b4fe66ee9f99c` reproduces exactly those 56 on the old
pin and finds 57 on the new pin. The sole addition is
`POST /accounts/{account_id}/workers/durable_objects/namespaces/{id}/query/v2`;
no cases are removed. Existing construction produces a witnessed
`durable_object_id` variable and the declared empty queries array. The fixture
advances only after this complete-set comparison: 53 valid, two ambiguous and
two source-conflict. No new construction policy is needed.
Subscription writable/readOnly authority, numeric service-token secret version,
Hyperdrive unresolved password, multipart/file boundaries, schema-less JSON
boundaries, and all twelve PR #12 corrections are rerun against the new pin.

There are 1,263 bodies: 1,220 raw, 33 multipart formdata, nine file, one urlencoded.
The previous distribution had 1,254: 1,212 raw, 32 formdata, nine file, one
urlencoded. Eleven new operations add ten raw bodies and one multipart body;
the two removed Email Routing body declarations account for the raw decrease.
No retained body's mode changes. The removed Security Center operation had no body.
All live bodies are sentinel-free and pass the unchanged writable-property,
mode, strict-schema/explicit-diagnostic validation boundaries. Saved request
snapshots and Native Git bodies follow the final live body.

## Every changed body and deferred converter effects

The evidence classifies every one of the 132 body changes:

- 11 are new operations, all valid under the new primary contract.
- 10 follow upstream request-contract changes: Builds worker creation,
  Observability issue update, both bulk firewall updates, both
  removed Email Routing bodies, three Email Security move/bulk contracts, and
  Data Security webhook creation. Some also contain seeded example-value drift.
- 111 are resulting converter/construction template changes. Of these, 110
  retain identical request contracts and referenced schemas. Independent
  full primary conversions at both pins prove the converter input body differs
  in every case. The existing construction policy preserves valid converter
  input; these are reviewed resulting template changes, not upstream request
  semantics changes. Every final body is validated against pristine authority.
  The remaining AI Gateway PUT has one changed upstream default under
  `spend_limits.rules.items.properties.id`, but `rules` is absent in both bodies;
  its emitted differences are converter samples, not the changed default.

The Email Security `destination`/`expected_disposition` changes follow new allOf
wrappers and nullable/deprecation metadata. Fresh primary output supplies a
sentinel or invalid enum string at the omitted optional values; the unchanged
normalizer omits them after source validation. Deprecation alone does not remove
a safely representable writable field. The bulk action description says a
destination is needed for MOVE, but the pinned schema does not structurally
require it; this review does not invent that missing condition.

Most of the 110 changes are numeric/boolean/enum/UUID sample choices. Five also
change permissible template shape or nullability: Workers assets upload gains
`key_1`/`key_2` rows; two assets-upload-session manifests lose an optional `key_2`;
Schema Validation's optional mitigation changes from null to `none`; URL Scanner
loses optional custom-header sample keys. These all satisfy the same source
contracts. No new construction rule or endpoint override is introduced.

Excluding added/removed operations and saved `originalRequest` snapshots, 285
response representations change; 153 have unchanged response contracts and
referenced components. Of 321 query changes, 317 have unchanged parameter
contracts. Of 37 header changes, one has unchanged request/response/parameter
authority: `POST /accounts/{account_id}/stream`, whose generated `Upload-Length`
sample changes from `8690` to `6942`. The evidence enumerates every
operation and whether its relevant source changed. These unchanged-source
changes are converter state/order artifacts; they must not be described as
upstream semantics changes. Remaining changes have source changes, which may
coexist with seeded-value drift. Fixing global converter mutation/isolation stays
outside PR #14. Repeated generation must still produce identical final bytes.

## Strict OpenAPI validation

Strict Swagger Parser validation returns exactly the same three lowercase `4xx`
additional-property diagnostics at Spectrum analytics aggregate/current,
events/bytime, and events/summary. No new or stale exception exists. The upstream
schema bytes remain unmodified and the existing exact exception set is retained
under the new commit.

## Validation

See [the final upstream change summary](../upstream-change-summary.md) for the
completed local gate, deterministic distribution checks, release scan, and
artifact totals. No live Cloudflare operations are used for this review.
