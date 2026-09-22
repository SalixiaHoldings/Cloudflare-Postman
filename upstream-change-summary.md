# Cloudflare API schema update

Completes PR #14's prepared schema update after reviewing every overlap,
revision-bound request/query policy, and generated distribution change.

- Previous schema: `49731bd0592b0c8c2c781b8d15d9f27c7293b210`.
- New schema: `73947ddceec8571140469a90a1a35078e10fa054`.
- Schema SHA-256: `66259004b9ee38da435ec59992dbb73a7740d4249971bb80f3fa1f0a9ee1c344`.
- Operations: 3,540 → 3,565; net +25; 26 added, one removed, 261 changed,
  zero newly deprecated. All 3,565 represented exactly once in both formats.
- Removed: `GET /accounts/{account_id}/security-center/insights/count`;
  absent from both regenerated distributions.
- Partition overlap declarations: 26 keys added, one removed; 2,537 operations
  in the same 54 families. No regex, owner, or generator architecture changes.
  No undeclared, stale, duplicate, or unused overlap entries.

[Human-readable review](docs/schema-revision-73947dd.md) and
[complete operation/policy/artifact evidence](docs/schema-revision-73947dd-audit.json)
include the exact 26 added operations, 261 changed operations, 19-operation
Workers overlap subset, security declarations, all body changes, and warning attribution.

## Final partition and authentication counts

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

Authentication: 571 bearer-only; 1,651 bearer-alternative; 216 legacy-only;
1,116 multi-scheme-or-other; seven anonymous; four manual-unresolved.
Of the 26 new operations, 24 declare a standalone Bearer alternative and the two
Browser Rendering recording operations require all three declared credentials
(`api_email`, `api_key`, `api_token`) together. Existing upstream authentication
changes are retained literally, including Email Routing/Sending token alternatives.

## Reviewed query and request-body policies

- Query: 135 required and 5,538 optional contracts; 143 enabled and 8,121 disabled
  rows. The one Cloudforce One `search` omission and its parameter fingerprint
  remain unchanged; zero new or removed omissions.
- Secondary warnings: 530 → 452 (450 allOf, two unknown-format). Operation-level
  tracing explains all changes: Zero Trust 236 → 190, application security
  64 → 41, zones 94 → 85, media 3 → 1, Workers 7 → 9. Other fingerprints unchanged.
  Primary warnings remain 47. Exact fail-closed checks remain enabled.
- Bodies: 1,216 valid, 33 ambiguous-oneOf, 12 source-incomplete, two source-conflict,
  and 2,302 without an applicable body. Total 1,263 bodies; zero live sentinels.
- Bulk firewall PATCH/PUT now supply a required string `id` and validate normally.
  Email Routing enable/disable no longer declare bodies. These retire four
  incomplete classifications; the remaining twelve were re-evaluated unchanged.
- Both load-balancer source conflicts remain independently proven and warned;
  their revision/digest binding advances. All 33 prior overlapping-oneOf
  conditions remain proven under the same strict-first policy.
- Fresh primary conversion reproduces the historical 56-case baseline exactly
  and finds 57 cases on the new pin: 53 valid, two ambiguous, two source-conflict.
  The sole addition is the Durable Objects namespace query/v2 operation; none
  are removed. Its existing-policy construction validates, and the fixture
  advances with that reviewed addition. All twelve PR #12 corrections,
  subscription/service-token authority, file/multipart and schema-less boundaries pass.
- Body modes: 1,220 raw, 33 formdata, nine file, one urlencoded. No retained-body
  mode changes, read-only leakage, stale saved-request bodies, or invalid warnings.
- Strict OpenAPI validation reproduces exactly the same three Spectrum lowercase
  `4xx` diagnostics; the source schema is unmodified and no exception is added.

## Generated artifacts and converter drift

Both `dist/v2.1/` and `postman/` are regenerated. Native Git has 13,461 files
(previously 13,326), including 169 additions and 34 removals; no case-only path
mismatches. The v2.1 distribution retains 14 files. Collection metadata and saved
requests carry the new pin. Generic environment values and empty Globals remain valid.

All 132 changed bodies are classified: 11 new-operation bodies, ten following
upstream request-contract changes, and 111 resulting converter/construction
template changes. Of the latter, 110 have unchanged request authority; the AI
Gateway PUT changes only a non-emitted nested default upstream. Fresh primary
conversions reproduce the input changes;
the existing policy preserves valid converter values and independently validates
the final bodies. The audit explicitly records optional sample-map/cardinality
changes as well as seeded primitive choices.

The deferred converter mutation/order issue remains visible: among retained
operations, 153 of 285 changed response representations, 317 of 321 changed query
representations, and one of 37 changed headers have unchanged relevant source
contracts. These are documented as converter artifacts, not upstream semantics
changes. PR #14 does not redesign converter isolation or introduce another
migration normalization.

## Complete repository gate

- Node.js 24.20.0; `npm ci`: passed with pinned dependencies unchanged.
- Focused request-body diagnostics: passed, including the fresh construction inventory comparison.
- Full `npm test`: 138/138 passed, including the 57-case inventory and all twelve PR #12 corrections.
- `npm run generate`: passed, both formats.
- `npm run generate:check`: passed, byte-for-byte reproducible.
- `npm run validate`: passed, including 3,565/3,565 accounting, authentication,
  body/query contracts, public safety and v2/v3 semantic equivalence.
- `npm run check`: passed after the reviewed inventory addition (syntax, 138 tests, deterministic generation, complete validation).
- `git diff --check` and staged whitespace/scope audit: passed.
- Native Git: raw and normalized collection/environment/Globals lint, guarded
  auth-UUID normalization, semantic equivalence and two-run migration bytes passed.
- Complete two-run generation: passed, identical file sets and bytes.
- Checksum-verified Gitleaks 8.30.1: passed, zero unresolved findings. Of 3,752
  detections, 3,568 are auth fingerprints, 158 verified public upstream examples,
  and 26 deterministic synthetic token IDs; 397 public upstream email occurrences
  and 12 synthetic email occurrences are accounted for. Official archive SHA-256:
  `dfe101a4db2255fc85120ac7f3d25e4342c3c20cf749f2c20a18081af1952709`.
- Hosted Validate: reported by PR #14 checks for the published head; the PR description records the final run.

No upstream updater rerun, schema patch, toolchain/dependency change, live
Cloudflare operation, merge, tag, or release is part of this update commit. The
changes are prepared for human review; v0.1.0 remains unchanged.
