# Cloudflare API schema update — reviewed 7287cb19

Updates the pinned Cloudflare schema from `73947ddceec8571140469a90a1a35078e10fa054` to `7287cb19ea4c5feb93f8dd0a4d8d12872692a802` (SHA-256 `5caecbd20ea45ee1a2b73c9939168977244e96e85e21b4df4ba8c48ec3c05290`). Baseline: `main` at `7f2c5f61ea9c0cdc6b9f2f9e4be7389ce8122ded`. Both generated distributions represent **3,594/3,594 operations exactly once**: 3,565 → 3,594, net +29; 35 added, six removed, 125 changed, six newly deprecated.

## Reviewed taxonomy and overlaps

Calls is deliberately grouped with Cloudflare Realtime under Workers & Developer Platform. Workers gains a narrow account-scoped Calls path matcher and explicitly includes Realtime/Calls; Media loses its generic calls matcher and Calls description. The full classifier comparison proves **exactly ten retained ownership changes**, all Calls Apps/TURN. No unrelated operation changes owner. Three MCP tool-call analytics routes lose incidental Media matches and remain Zero Trust-owned.

All 19 overlapping additions and six removed overlaps are reconciled in one pass. The now-empty MCP four-way declaration is retired. **2,550 overlapping operations in 53 declarations**, versus 2,537 in 54. No retained operation newly overlaps or ceases to overlap. The general overlap architecture is unchanged.

The six new zone-scoped tracing APIs match Analytics + Zones and belong to **Analytics & Observability**. Their removed account-scoped Workers predecessors have no remaining v2 request, v3 request, or overlap entry.

| Partition | Operations |
| --- | ---: |
| accounts-identity-billing | 629 |
| analytics-observability | 441 |
| application-security-rulesets | 379 |
| media-communications | 173 |
| network-services | 286 |
| other-cloudflare-services | 1 |
| storage-data | 128 |
| workers-developer-platform | 516 |
| zero-trust | 595 |
| zones-dns-domains | 446 |

## Source and compatibility review

- **Auth:** 572 bearer-only; 1,662 bearer-alternative; 233 legacy-only; 1,116 multi-scheme-or-other; seven anonymous; four manual-unresolved. No retained auth contract changes. The 35 additions comprise one bearer-only, 17 bearer-alternative, and 17 legacy-only. Six tracing operations inherit root security because they have no operation override; all other additions use their explicit security. No neighboring-API assumptions.
- **Queries:** 139 required and 5,559 optional contracts → 147 enabled and 8,143 disabled rows. The single Cloudforce One search omission and its fingerprint remain unchanged. All secondary-warning fingerprints remain unchanged: 452 diagnostics (450 allOf, two unknown-format); 47 primary warnings. No serializer or warning exception changes.
- **Bodies:** 1,228 valid; 33 ambiguous-oneOf; 12 source-incomplete; two source-conflict; 2,319 without applicable bodies. Modes: 1,232 raw, 33 multipart, nine file, one URL-encoded. **Zero live sentinels in v2 and v3.** All prior compatibility conditions were independently re-evaluated. The twelve incomplete contracts and both conflicts persist. Bot Management adds one boolean property but its ambiguity remains independently proven; the other 32 ambiguous contracts are unchanged.
- **Construction:** the complete historical diagnostic reproduces all 57 baseline cases and finds 61 target cases (four additions, no removals), handled by existing policy: 57 valid, two ambiguous, two source-conflict. All twelve PR #12 corrections and source/media/writable/union boundaries pass on the target pin. No construction redesign or endpoint override.
- **Strict OpenAPI:** Cloudflare fixed the three Spectrum analytics 4xx keys to 4XX. The obsolete exception entries are retired; **zero exceptions remain**.
- **Added/removed audit:** every added operation has source-derived ownership/auth/query/body checks and exactly one occurrence in each format; every removed operation has zero occurrences and no stale overlap declaration.

## Generated-difference attribution

Against current main, 199 body differences comprise 14 added bodies, two removed bodies, 14 direct request-template consequences, and 169 converter artifacts (167 with identical source authority; two Magic connector boolean samples despite unrelated source removals). There are 115 retained query changes: three structural, one source-description change, and 111 sample artifacts. The 228 changed retained response representations comprise seven upstream shape changes, five description-label changes, and 216 sample artifacts. The one header change is a Stream Upload-Length sample. All old/new reference request IDs were verified against the existing revision/breadcrumb UUID algorithm; provenance/identity churn is reported separately.

The known converter shared-working-graph/order issue remains deferred. The review distinguishes source changes from unrelated emitted sample changes, including when both occur on one operation. General overlap-policy redesign and issue #16 environment persistence remain separate work.

## Validation

- Node 24.20.0 / npm 11.19.0; `npm ci` passed.
- Focused partition/body/construction/query tests passed; `npm test`: **139/139**.
- `npm run generate`, `npm run generate:check`, `npm run validate`, and `npm run check`: passed.
- `git diff --check`: passed.
- Complete independent two-run comparison: byte-identical **14 v2 files and 13,619 Native Git files**.
- All 11 collections pass two raw migrations, raw/normalized CLI lint, guarded auth-UUID normalization, semantic equivalence, and full file/byte comparison; environment/Globals validation passed.
- Checksum-verified **Gitleaks 8.30.1**: **3,784 findings adjudicated, zero unresolved** (3,597 auth fingerprints, 161 upstream examples, 26 deterministic synthetic token IDs). Email scan: 403 upstream and 12 synthetic occurrences, zero unexplained.
- npm audit still reports the existing three high-severity entries in the pinned Faker/converter dependency chain; dependency pins and lockfile are unchanged.

Detailed [revision review](docs/schema-revision-7287cb19.md) and [machine-readable audit](docs/schema-revision-7287cb19-audit.json) include complete classification, per-operation evidence, compatibility review, and artifact attribution.

**Leave PR #15 draft/open for human review.** No live Cloudflare operations, upstream refresh beyond the target, merge, tag, or release.
