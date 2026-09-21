# Schema revision a0eceeef

> Historical revision review. The current reviewed schema revision is documented in [schema-revision-73947dd.md](schema-revision-73947dd.md).

## Source and review boundary

This revision advances Cloudflare's authoritative schema from `1cf9b4dcf3241bef73d3300b045cb01543cc7a5f` to `a0eceeef8288f2fea2c3115a232ddf23e43d8540`, SHA-256 `edd52fdafe20ff355b335943db19c1dc4e03a2383f6351644bea209e44edd0c3`. The upstream JSON is unmodified. Converter `6.3.3`, Postman CLI `1.56.3`, partition rules, authentication selection, full-secondary/query-only projection, and guarded Native Git auth-UUID normalization remain unchanged.

The [PR #7 implementation handoff](https://github.com/SalixiaHoldings/Cloudflare-Postman/pull/7#issuecomment-5731450946) preserves the reviewed overlap additions; the [superseding query-policy decision](https://github.com/SalixiaHoldings/Cloudflare-Postman/pull/7#issuecomment-5731810896) approves exactly one omission and overrides the earlier zero-omission instruction. The pinned schema contains 3,540 operations, up from 3,522: 18 added, none removed, 310 changed, and 13 newly deprecated.

## Partition ownership

All 3,522 existing operations retain their owner and complete classification match set. The 16 added overlaps use existing owners and match sets: one R2 lock deletion belongs to storage-data, 13 Workers Observability operations and one latest-version operation belong to workers-developer-platform, and one browser-extension log search belongs to analytics-observability. Billable metrics and SCIM Group PUT are single-match operations. There are 2,512 overlapping operations (previously 2,496) across the same 54 declarations. Exact-once accounting remains independent of overlap ownership.

| Partition | Previous operations | New operations |
| --- | ---: | ---: |
| zero-trust | 594 | 594 |
| workers-developer-platform | 474 | 488 |
| storage-data | 127 | 128 |
| application-security-rulesets | 369 | 369 |
| analytics-observability | 434 | 435 |
| zones-dns-domains | 436 | 436 |
| network-services | 286 | 286 |
| media-communications | 183 | 183 |
| accounts-identity-billing | 618 | 620 |
| other-cloudflare-services | 1 | 1 |

The residual collection remains one operation.

## Warning review

A separate measurement used the production secondary worker with the full verified schema, component context, partition sequence, and pinned secondary options. Comparison with the previous contract found no new messages, incompatible-value combinations, or warning categories. Only these occurrence counts changed:

| Partition | Diagnostic at `properties.result.type` | Previous | New |
| --- | --- | ---: | ---: |
| workers-developer-platform | array / object | 4 | 2 |
| workers-developer-platform | object / array | 9 | 4 |
| zones-dns-domains | array / object | 41 | 40 |
| accounts-identity-billing | array / object | 18 | 17 |

The primary converter retains 47 recoverable example-generation warnings, with unchanged per-partition counts. The secondary total falls from 539 to 530: 528 allOf-resolution warnings and the same two unknown-format warnings. The exact records and hashes for these three partitions are updated in `config/query-projection.json`; every other partition record is unchanged. These are response/example schema-resolution diagnostics, not permission to omit or invent query parameters. The exact diagnostic gate remains enabled.

## Strict OpenAPI validation

`@apidevtools/swagger-parser@13.0.0` independently reports exactly the same three `additionalProperties` diagnostics for lowercase `4xx` response keys at the Spectrum analytics aggregate/current, events/bytime, and events/summary GET operations. The existing revision-bound exception set requires no additions or removals. No schema correction is applied locally.

## Authentication

| Category | Previous | New |
| --- | ---: | ---: |
| bearer-only | 568 | 571 |
| bearer-alternative | 1,576 | 1,592 |
| legacy-only | 253 | 252 |
| multi-scheme-or-other | 1,114 | 1,114 |
| anonymous | 7 | 7 |
| manual-unresolved | 4 | 4 |

The only changed authentication contract among existing operations is `POST /accounts/{account_id}/request-tracer/trace`: upstream now declares `[{api_token: []}, {api_email: [], api_key: []}]` instead of the email/key requirement alone. The existing policy selects the explicit standalone Bearer alternative and retains the legacy alternative in provenance. Its declaration fingerprint changes from `a9720528d5568ee0454de8ee346c99dd84fa50a430a5033cc320160dae1660d9` to `4844622a422ead8f8ff95dad7881ac91bb3b64cd78aae19a345e1aaa5456fdd3`. The 18 additions comprise three bearer-only and 15 bearer-alternative operations. The four unresolved upload-auth operations retain their blocking guards.

## Queries

The new schema declares 133 required and 5,511 optional query contracts (previously 133 and 5,495), represented by 141 enabled and 8,094 disabled rows. Two independent full-secondary measurements found exactly one omission: optional `search` on `GET /accounts/{account_id}/cloudforce-one/events`. Its parameter SHA-256, remeasured after approval, is `97be6fa16b6124b7a7217c1fead4c42aaa9e0657d6337cd3ccd7a152d6b73ffb`. This optional array has `default: []` and is unchanged from the previous pin.

The superseding decision approves this exact omission. All four previous Gateway filter omissions and both new device registration-type filters are emitted. Required rows remain enabled and optional rows disabled. Required omissions remain forbidden; `assertOmissions()` still rejects any difference from the exact approved set. No converter strategy change, schema patch, fabricated row, or endpoint-specific serialization is introduced.

The revision-bound tests bind the one approved identity/fingerprint and reject removed, added, or changed omission records. Distribution tests cover all 3,540 requests, row counts, requiredness, and the existing query-identity repairs.

## Validation and release safety

On Node 24.20.0, `npm ci`, `npm test` (43/43), `npm run generate`, `npm run generate:check`, `npm run validate`, `npm run check`, and `git diff --check` passed. Both explicit and aggregate generation checks reproduced the complete v2.1/v3 file sets byte-for-byte. Official CLI lint, semantic equivalence, and independent two-run migration checks passed for all ten reference collections and bootstrap; environment, empty Globals, public-template, auth, and accounting gates passed.

Checksum-verified Gitleaks 8.30.1 passed `scan:release` with zero unresolved candidates. Its 3,727 findings comprised 3,543 auth fingerprints, 158 upstream examples, and 26 seeded synthetic token IDs. The additional email review classified 291 upstream occurrences and 12 synthetic occurrences. No scanner rule or candidate-classification exception changed.

Remaining limitations are the one approved optional query omission, existing converter diagnostics, three upstream OpenAPI exceptions, and four guarded unresolved upload-auth contracts. The documented build-only Faker dependency advisory remains; no dependency versions changed. Live Cloudflare smoke testing and Postman Desktop UI verification were not run.

`upstream-change-summary.md` retains the initial automation report and operation diff; this review records the completed revision results. The upstream-drift workflow was not rerun, and no converter, partition precedence, serialization, or upstream-source changes were introduced.

The first hosted run exposed three case-only filenames retained by Git on the case-insensitive macOS worktree. The generator and manifest emit `Create an Account` for account creation, while Git retained `Create an account` for its request and two examples. The tracked names were corrected to the generated spelling with zero byte changes; the complete 13,326-file Native Git index was then compared case-sensitively with the generated disk inventory. No migration normalization or generator behavior changed.
