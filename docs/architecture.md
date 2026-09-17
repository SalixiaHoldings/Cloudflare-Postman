# Architecture and operations

## Trust boundary

Cloudflare's `cloudflare/api-schemas` repository is the sole API-definition authority. `schema-lock.json` pins the exact `openapi.json` revision, byte size, SHA-256 digest, and upstream license. Generation refuses content that does not match the lock.

The upstream schema is not silently patched. Strict-validation deviations must be exact, revision-bound entries in `config/upstream-validation-exceptions.json`; changed diagnostics fail closed.

## Generation flow

```text
schema-lock.json
      |
      v
fetch + verify pinned Cloudflare OpenAPI
      |
      v
enumerate method/path operations
      |
      v
classify into product partitions + explicit overlap ownership
      |
      +-------------------------------+
      |                               |
      v                               v
primary converter                 isolated secondary converter
(existing settings)              enableOptionalParameters=false
      |                           optimizeConversion=false
      |                           stackLimit=50
      |                               |
      |                               v
      |                           official query rows only
      |                               |
      +---------------+---------------+
                      v
query-only projection + deterministic normalization
                      |
                      v
v2.1 validation + exact-once accounting
                      |
                      v
Postman CLI 1.56.3 migration
                      |
                      v
v3 lint + semantic equivalence + two-run byte comparison
```

The primary conversion remains authoritative for collection structure, bodies, headers, auth, names, descriptions, scripts, IDs, and response examples. The secondary converter runs in a separate Node process and returns only query rows. No secondary body/header/auth/example structure crosses that boundary. See [query policy](query-policy.md).

`config/partitions.json` defines independent match rules. Every non-residual rule is evaluated before ownership is assigned: one match owns the operation, zero matches use the explicit residual, and multiple matches require an exact declaration in `config/partition-overlaps.json`. Array ordering is not a conflict resolver.

At the pinned revision, 54 declarations cover 2,496 overlapping operations. New or changed overlap sets, invalid owners, stale declarations, or newly ambiguous operations fail validation.

Postman's `Tags` folder strategy duplicates multi-tag operations, so the project uses `Paths`. Product navigation is provided by the top-level modular partitions. Stable SHA-derived IDs, seeded examples, a fixed conversion clock, sorted JSON keys, fixed metadata, and commit-specific provenance remove nondeterministic output.

## Partitions

The generated inventory contains:

- Zero Trust
- Workers & Developer Platform
- Storage & Data
- Application Security & Rulesets
- Analytics & Observability
- Zones, DNS & Domains
- Network Services
- Media & Communications
- Accounts, Identity & Billing
- Other Cloudflare Services (explicit residual)

`dist/v2.1/manifest.json` records current counts and digests. The residual currently contains only Cloudflare's `GET /signed-url` internal test route so upstream accounting remains complete.

## Validation layers

`npm run check` runs:

1. Node.js syntax checks.
2. Fixture/regression tests.
3. Full deterministic regeneration and byte comparison.
4. Strict pinned OpenAPI validation with only revision-bound exceptions.
5. Postman Collection v2.1 schema validation.
6. Manifest/artifact digest validation.
7. Independent exact-once operation traversal.
8. Authentication metadata and generated request-auth validation.
9. Partition overlap/ownership recomputation.
10. Query-contract validation against the pinned schema, including required/optional state, exact known omissions, identifier substitution, raw URLs, and secondary warning fingerprints.
11. v3 migration/lint, semantic equivalence, environment/Globals checks, and two-run file/byte comparison.
12. Public-safety checks for populated credentials/identifiers, local filesystem paths, and unexplained release-scan candidates.

The current pin validates **3,522/3,522 operations**, 2,496 declared overlaps, three upstream OpenAPI exceptions, and 47 primary converter warnings.

## Authentication contract

The pinned Cloudflare OpenAPI `security` declaration determines each request's auth. Separate security-array entries are OR alternatives; multiple schemes inside one object form an AND requirement. Operation-level `security` overrides root security; an empty array disables auth; an empty object permits anonymous access.

`src/auth.mjs` builds a deterministic contract for every operation. Selection prefers a standalone `api_token` Bearer alternative, then anonymous access, then the supported alternative requiring the fewest credential schemes. Current categories are:

- 568 bearer-only
- 1,576 bearer-alternative
- 253 legacy-only
- 1,114 multi-scheme-or-other
- 7 anonymous
- 4 manual-unresolved

Collections inherit Bearer by default, but each request explicitly applies its selected requirement. Legacy-only requests override inheritance with No Auth plus `X-Auth-Email` / `X-Auth-Key` variable headers. Combined requirements retain all required schemes.

The four `manual-unresolved` operations reference absent upstream auth-scheme definitions for upload JWT/token flows. They remain represented but are blocked by a generated pre-request guard instead of guessing a wire format.

Credentials are never generated. `base_url` is intentionally public/tracked; API keys/tokens, authentication email values, and real account/zone/tenant/organization identifiers must remain local and must never be Shared or committed.

## Paginated account/zone bootstrap

`dist/v2.1/workflows/bootstrap.postman_collection.json` is a three-request GET-only workflow that verifies a token and resolves account/zone IDs. It uses Postman's collection-run request routing and must be run from the first request as a collection; individual **Send** requests do not follow `setNextRequest`.

Account/zone enumeration is bounded to 1,000 pages at `per_page=50`. The scripts validate pagination metadata, reject repeated pages/IDs and ambiguous selectors, and persist only successfully resolved IDs. Fixture tests cover multi-page data, ambiguity, malformed responses, duplicate IDs, and loop bounds.

The pinned account-list operation is legacy-only; token verification and zone listing use token-supported auth. Users who do not want to provide legacy credentials can set account/zone IDs manually.

## Converter and query limitations

`openapi-to-postmanv2@6.3.3` remains the pinned v2 converter. The primary pass reports 47 recoverable example-generation warnings at this schema revision. Missing operations, duplicates, invalid collections, or checksum drift are never accepted as warnings.

The isolated secondary query pass uses supported converter options that correctly preserve required/optional query state but exposes 539 deeper schema diagnostics. Those diagnostics are stored separately, normalized, fingerprinted, and revision-bound; they do not replace the 47-warning primary baseline.

The official converter omits five exact optional array query contracts. They are documented and fingerprinted in [query-policy.md](query-policy.md); no local serializer fabricates them.

The converter build dependency is pinned and processes only checksum-verified upstream JSON. `js-yaml@4.3.2` is forced through the dependency override to address its patched advisory. The remaining Faker-derived npm audit finding is accepted for this pinned build-only path; the pipeline does not call `helpers.fake` and does not accept arbitrary untrusted schema input.

## Native Git / Local View

Portable v2.1 JSON remains under `dist/v2.1/`. Native Git v3 YAML lives under `postman/` and is generated with pinned Postman CLI 1.56.3. See [Native Git usage and compatibility policy](native-git.md).

The v3 migrator currently emits unstable collection-level auth UUIDs. A narrow compatibility policy normalizes only that single metadata UUID after proving it occurs exactly once at the expected field. Any additional migration instability fails.

The generated environment intentionally shares/tracks only the public `base_url`. Credential and resource-selector fields remain committed empty; users set them only as local Postman Values.

## Automation

### Pull-request validation

`.github/workflows/validate.yml` has read-only repository permission, receives no Cloudflare secret, and runs the complete offline validation on Node.js 24. External GitHub actions are pinned by full commit SHA.

### Daily upstream drift

`.github/workflows/upstream-drift.yml` resolves Cloudflare's current `main` revision, updates the provenance lock, regenerates both formats, validates them, and creates/updates a review PR. It never auto-merges.

### Protected read-only smoke test

`.github/workflows/live-smoke.yml` runs only on schedule/manual dispatch in the canonical repository. It skips until `CLOUDFLARE_READ_TOKEN` is configured and is not exposed to pull requests.

Optional test selectors are supplied only through repository secrets or local environment variables. Never commit populated environments or live response logs.

## Generated-file policy

Everything under `dist/v2.1/` and `postman/` is generated. Do not hand-edit generated artifacts. Change source/configuration or the pinned upstream revision, then run:

```sh
npm run generate
npm run check
```
