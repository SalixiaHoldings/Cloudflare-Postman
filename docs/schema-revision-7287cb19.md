# Cloudflare schema revision 7287cb19

Review of [cloudflare/api-schemas@7287cb19ea4c5feb93f8dd0a4d8d12872692a802](https://github.com/cloudflare/api-schemas/tree/7287cb19ea4c5feb93f8dd0a4d8d12872692a802), SHA-256 `5caecbd20ea45ee1a2b73c9939168977244e96e85e21b4df4ba8c48ec3c05290`, against repository `main` at `7f2c5f61ea9c0cdc6b9f2f9e4be7389ce8122ded` (schema `73947ddceec8571140469a90a1a35078e10fa054`). Both exact sources passed byte-count and digest verification. The source is unmodified; the pin has not advanced beyond the requested target.

The [machine-readable audit](schema-revision-7287cb19-audit.json) records all 3,594 classifications, all 35 additions and six removals, source closure digests, every changed body/query/header/response representation, compatibility decisions, and verification evidence. PR #15 remains draft/open for human review.

## Operations and partition taxonomy

3,565 → **3,594 operations**: **35 added, six removed, 125 changed, six newly deprecated**, net +29. The 125 count compares operation objects; the audit additionally follows referenced components when determining whether an emitted representation's authority changed.

Calls deliberately moves from Media & Communications to Workers & Developer Platform, alongside Realtime. Workers now explicitly describes Realtime/Calls and matches only the account-scoped Calls path family through `^/accounts/\{account_id\}/calls(?:/|$)`. Media no longer describes Calls and no longer uses the generic calls word matcher. The general overlap model is unchanged.

Full recomputation proves **exactly ten retained operations change ownership**, all five Calls Apps and all five Calls TURN operations. No unrelated operation changes owner. The new Calls match set is Accounts + Workers. Removing Media's broad matcher also removes incidental Media matches from three MCP tool-call analytics routes, without changing their Zero Trust ownership. Their now-empty four-way declaration is retired. The 25 existing Realtime Kit operations remain in Workers.

All **19 overlapping additions** are explicitly declared, and all **six removed overlap entries** are gone. No retained operation newly overlaps or ceases to overlap. Final overlap count: **2,550**, up from 2,537; declarations: **53**, down from 54. Classification covers every operation exactly once, with no stale or undeclared match sets.

| Partition | Main | Target |
| --- | ---: | ---: |
| Zero Trust | 594 | 595 |
| Workers & Developer Platform | 512 | 516 |
| Storage & Data | 128 | 128 |
| Application Security & Rulesets | 370 | 379 |
| Analytics & Observability | 435 | 441 |
| Zones, DNS & Domains | 436 | 446 |
| Network Services | 286 | 286 |
| Media & Communications | 183 | 173 |
| Accounts, Identity & Billing | 620 | 629 |
| Other Cloudflare Services | 1 | 1 |

The six removed account-scoped tracing routes under `/accounts/{account_id}/workers/observability/zones/{zone_id}/...` were Workers-owned and matched Accounts + Analytics + Workers. Their six new `/zones/{zone_id}/observability/tracing/...` replacements have Observability tags and zone tracing operation IDs. They match **Analytics + Zones**, and are assigned to **Analytics & Observability**. Prior Workers ownership is not copied.

## Added and removed operation audit

Every addition has independently checked partition ownership, effective OpenAPI security, all query contracts and required/optional rows, body media/mode and pristine-source validation, and exactly one reference request in each distribution. Every removed operation has zero v2 requests, zero v3 requests, and zero overlap declarations. The audit lists each operation and its Native Git file.

Added ownership is six Analytics, ten Zones, nine Application Security, nine Accounts, and one Zero Trust (AI Gateway web search, consistent with the existing navigation). Fourteen additions have valid raw bodies: thirteen JSON and one text/plain usage report. Twenty-one have no body. The removed tracing set contains two raw bodies, producing a net increase of twelve live bodies.

## Authentication

Added operations: **one bearer-only, 17 bearer-alternative, 17 legacy-only**. Each declaration and selected requirement is recorded. The six new tracing operations omit operation-level security and therefore inherit the root's three OR alternatives: email+key, token, and user-service-key. Their standalone token alternative is selected. The other 29 have explicit operation-level declarations. Pay Per Use and the organization invitation update retain their declared email+key requirement; no token support is inferred from neighboring APIs.

No retained operation's authentication contract changes. Final categories: **572 bearer-only, 1,662 bearer-alternative, 233 legacy-only, 1,116 multi-scheme-or-other, seven anonymous, four manual-unresolved**. The four unresolved operations remain blocked by the existing guard.

## Query contracts and warning fingerprints

The target has **139 required and 5,559 optional contracts**, represented by **147 enabled and 8,143 disabled rows**. Required rows remain enabled; emitted optional rows remain disabled.

The one Cloudforce One events `search` omission persists with exact SHA-256 `97be6fa16b6124b7a7217c1fead4c42aaa9e0657d6337cd3ccd7a152d6b73ffb`. No omission is added or removed. Full isolated secondary conversion and independent operation-attributed warning capture reproduce **every partition's prior fingerprint unchanged**: 452 diagnostics (450 allOf, two unknown-format). Primary conversion remains 47 warnings. No warning fingerprint or serialization rule changes.

There are 115 changed retained query representations: three follow structural upstream changes (Threat Signals article arrays/category filter, device profile_type, Observability issue type), one changes only an upstream status description, and 111 are converter samples. Of those 111, 110 have identical query authority; Magic connector telemetry adds only x-fern metadata while its three emitted changes are sample values. These are not upstream query-semantic changes.

## Request bodies and revision-bound policies

| Classification | Main | Target |
| --- | ---: | ---: |
| ambiguous-oneOf | 33 | 33 |
| not-applicable | 2302 | 2319 |
| source-conflict | 2 | 2 |
| source-incomplete | 12 | 12 |
| valid | 1216 | 1228 |

There are **1,275 live bodies**: **1,232 raw, 33 multipart, nine file, one URL-encoded**. No retained body changes mode. Live converter sentinels: **zero in both formats**.

- All twelve source-incomplete contracts and referenced source conditions are unchanged and independently reclassified. Previously retired bulk-firewall and Email Routing cases remain fixed.
- Both load-balancer scalar/object conflicts retain identical complete request-contract hashes. Exact-shape tests independently prove root-only Ajv type failure, valid existing notification_email, preserved primary bytes, and the required diagnostic. Only after that review is their revision binding advanced.
- All 33 ambiguous-oneOf classifications remain proven. Thirty-two request contracts are unchanged. Bot Management adds the boolean jsd_api_results_enabled property; all four alternatives still independently match the reviewed objects and strict Ajv rejects only oneOf exclusivity. A nonboolean value is rejected. No ambiguity exception is added.
- Reapplying the byte-identical historical preconstruction diagnostic at `f3c6f54ecab08ce7649cd445160b4fe66ee9f99c` reproduces all 57 baseline failures and finds **61** target cases. The four additions are both pay-per-crawl/pay-per-use zones_can_be_enabled PATCH bodies, AI websearch, and pay-per-crawl zone configuration POST. No case retires. The unchanged constructor yields **57 valid, two ambiguous, two source-conflict** outcomes.
- All twelve PR #12 corrections pass against pristine target authority. Subscription writable/readOnly semantics, numeric service-token secret version, Hyperdrive variables, multipart/file boundaries, schema-less JSON, and optional-union precedence remain covered.

Upstream consequences include Threat Signals category → category_id and event source titles; browser-extension device-profile fields; required zone arrays and price multiples for pay-per-crawl; the new Queue notification-consumer branch/example; and an authoritative Workers deployment versions example. The two Queue consumer primary inputs remain entirely sentinel-valued, so there is no surviving worker branch affinity; the existing source-candidate rules select the newly declared valid notification example. No constructor change is made.

The device-profile descriptions say browser_extension_config is invalid for WARP profiles, but the schema does not encode that conditional relationship. Generated templates follow the declared structural schema, as the existing architecture requires; this review does not invent a conditional constraint from prose.

## Generated differences and converter artifacts

The audit accounts for **199 body differences**: 14 added bodies, two removed bodies, 14 direct upstream request-template consequences, and **169 converter artifacts**. Of those artifacts, 167 retain identical complete request contracts and referenced schemas, and fresh full primary conversions independently change in every case. The other two are Magic connector PATCH/PUT: upstream removes primary/site_id, neither emitted in either template; the only emitted change is an unrelated provision_license boolean sample.

Excluding additions/removals and saved originalRequest snapshots, **228 response representations** change: seven follow upstream response-shape changes, five update source description labels, and **216 are sample artifacts**. Of the artifacts, 208 have unchanged complete response authority. Eight have unrelated source changes: pagination samples instead of new indicator source titles; request booleans/token counts instead of new status enum values; article pagination instead of a new applied_by value; Magic error-success samples instead of changed 200-interface properties; and a pay-per-crawl success sample instead of price constraints. The audit records exact changed source and emitted value paths.

The one changed retained header is Stream upload's Upload-Length sample under unchanged authority. All request/folder ID churn follows the existing partition/commit/breadcrumb UUID algorithm; every old and new reference request ID was independently verified. Collection provenance, migrated metadata, hashes, and saved request snapshots follow the revision and live requests. These are not upstream API semantics.

The known shared converter working graph and conversion-order behavior is documented, not redesigned. Fixed-pin reproducibility is required despite sample differences across revisions.

## Strict OpenAPI validation

Cloudflare corrected all three Spectrum analytics response keys from lowercase `4xx` to valid `4XX`. Strict Swagger Parser validation now succeeds. All three obsolete exception entries are removed; **zero validation exceptions remain**. No source patch or relaxed validator is used.

## Verification

| Gate | Result |
| --- | --- |
| Node / npm | 24.20.0 / 11.19.0 |
| npm ci | passed |
| Focused partition/body/construction/query tests | passed |
| npm test | 139/139 passed |
| npm run generate | passed |
| npm run generate:check | passed |
| npm run validate | passed; 3,594/3,594 exact-once; zero OpenAPI exceptions |
| npm run check | passed |
| git diff --check | passed |
| Complete two-run distribution comparison | passed; 14 v2 files, 13,619 Native Git files |
| Native Git raw/normalized lint and semantic equivalence | passed for all reference collections, bootstrap, environment and Globals |
| Checksum-verified Gitleaks 8.30.1 | passed; 3784 findings adjudicated, 0 unresolved |

The independently rebuilt distribution comparison covers the complete file set and all bytes. Each generation also performs two raw migrations per collection and permits only the existing guarded collection-auth UUID normalization. Gitleaks archive bytes were checked against the official v8.30.1 checksums and the installed executable was verified against that archive. npm ci reports three high-severity findings in the existing pinned build dependency chain; dependencies and the toolchain are unchanged.

No live Cloudflare operation, upstream refresh, merge, tag, release, general overlap-model redesign, or issue #16 environment-persistence change was performed.
