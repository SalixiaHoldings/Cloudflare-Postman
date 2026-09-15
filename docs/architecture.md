# Architecture and operations

## Trust boundary

Cloudflare's `cloudflare/api-schemas` repository is the sole API-definition authority. `schema-lock.json` pins a commit-specific `openapi.json` URL, byte size, SHA-256 digest, and the matching upstream license. Generation refuses content that does not match the lock.

The upstream OpenAPI document is cached but not committed as a separately maintained schema. There are no silent schema patches. A validator deviation must be an exact, revision-bound entry in `config/upstream-validation-exceptions.json`; changed diagnostics fail closed.

## Generation flow

```text
schema-lock.json
      |
      v
fetch and verify official OpenAPI bytes
      |
      v
enumerate method + path operations
      |
      v
all-match classification + explicit overlap ownership
      |
      v
openapi-to-postmanv2 6.3.3 conversion per partition
      |
      v
deterministic normalization, schema-derived auth, stable JSON
      |
      v
Collection v2.1 validation + exact-once accounting
```

`config/partitions.json` defines independent match rules. Every non-residual rule is evaluated before ownership is assigned: one match owns the operation, zero matches use the explicit residual, and multiple matches require an exact declaration in `config/partition-overlaps.json`. Array ordering is not a conflict resolver. The generator creates a partition-specific OpenAPI view without modifying operation definitions, root security, or shared components. It then converts that view and maps every emitted request back to its upstream method/path. A converter omission, unrecognized request, or duplicate is fatal.

Overlap declarations are grouped by the sorted matching partition IDs and contain an explicit owner/reason and an exact method/path allowlist. At this pin, 54 declarations cover 2,474 overlapping operations. Broad account/zone paths and shared product words explain the large overlap surface. A newly overlapping operation is rejected even if its matching partition set already has a group. Changed match sets, invalid owners, duplicate declarations, empty groups, removed operations, or no-longer-overlapping entries fail closed. All declarations must be used. Generation/validation print counts, while accounting records every match and overlap-group ID per operation. Update declarations deliberately during upstream review; the scheduled updater cannot grant itself new precedence.

Postman's `Tags` folder strategy duplicates multi-tag operations. The project therefore uses the converter's `Paths` strategy, while product navigation is supplied by the top-level modular partitions. Core account and zone identifiers are normalized to variables in generated request URLs and JSON bodies. Stable SHA-derived IDs, seeded schema examples, a fixed conversion clock, sorted JSON object keys, fixed metadata, and commit-specific provenance remove random or time-dependent output.

## Partitions

The generated inventory currently includes:

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

`postman/manifest.json` contains the current count and digest for each file. The residual is printed by every generation and validation run. At the pinned Phase 1 revision it contains only Cloudflare's `GET /signed-url` internal test route; retaining it preserves complete upstream accounting without pretending it belongs to a public product family.

## Validation layers

`npm run check` runs all of the following:

1. Node.js syntax checks for repository JavaScript.
2. Node fixture tests for classifier behavior, duplicate rejection, deterministic serialization, converter coverage, variable/auth contracts, account/zone chaining, and GitHub Actions safety.
3. A full generation into an isolated temporary directory followed by byte comparison with committed artifacts.
4. Pinned upstream OpenAPI validation. Only the exact revision-bound exceptions in `config/upstream-validation-exceptions.json` are accepted.
5. Postman validation against the SHA-256-pinned official Collection v2.1 JSON Schema.
6. Manifest and artifact digest validation.
7. A second independent method/path traversal proving every upstream operation appears once and only once.
8. Recomputed upstream auth inventories/fingerprints, literal request auth configuration, empty credential/identifier templates, and generic local-filesystem-path detection. Illustrative paths already present in the verified public upstream schema are permitted by exact match; new local paths fail. Public-safety checks do not embed private names. Legacy auth is checked structurally, not forbidden as text.
9. Recomputed partition overlaps/owners and rejection of every undeclared or stale overlap.

## Authentication contract

The exact [pinned Cloudflare source](https://github.com/cloudflare/api-schemas/blob/ff63b6a722de89a1c19074b1f9749d98ef6633bd/openapi.json), not website prose or converter defaults, determines each request's auth. The [OpenAPI 3.0.3 security requirement rules](https://spec.openapis.org/oas/v3.0.3.html#security-requirement-object) make separate array entries OR alternatives and multiple keys inside one object an AND requirement. Operation-level `security` overrides root security; an empty array disables auth; an empty object permits anonymous access.

`src/auth.mjs` builds a deterministic contract for every operation. Accounting stores the declaration source, exact effective requirement array (including order and duplicate alternatives), referenced scheme definitions (`null` when missing), their SHA-256, selected requirement index, category, standalone-token support, and manual-configuration flag. The manifest includes global/per-partition category counts. Validation recomputes this from the pinned input and compares the entire metadata object and generated auth/headers/notices/guards; editing an upstream root declaration or scheme definition is detectable even when the operation body is unchanged. The upstream drift summary also treats inherited auth changes as operation changes.

Selection prefers a standalone `api_token` HTTP Bearer alternative, then anonymous access, then the supported alternative requiring the fewest credential schemes (canonical JSON breaks ties). This leaves 504 `bearer-only`, 1,531 `bearer-alternative`, 287 `legacy-only`, 1,111 `multi-scheme-or-other`, 7 `anonymous`, and 4 `manual-unresolved` operations. All 3,444 still appear exactly once. The current multi-scheme group literally requires `api_token` AND `api_email` AND `api_key`; no evidence-backed exception establishes that this is erroneous metadata, so it is not rewritten as OR or silently relaxed to Bearer alone.

Collections retain Bearer as their default, but each request explicitly declares its selected auth. Where tokens are an alternative, legacy headers are removed. Legacy-only requests override inheritance with No Auth and supply empty-variable email/key headers; combined requirements use Bearer plus the required headers. Every request includes a human-readable policy notice and the auth declaration fingerprint. Configure any genuinely required legacy values only in a private local environment. No real credential or identifier is generated.

Four operations reference absent scheme definitions: `POST /accounts/{account_id}/workers/assets/upload` (`assets_jwt`), and `POST /pages/assets/check-missing`, `/pages/assets/upload`, `/pages/assets/upsert-hashes` (`pages_upload_token`). Their upstream descriptions refer to upload JWTs, not the normal API token. Because the actual scheme definitions are absent, generation does not guess their wire format: requests are present, explicitly marked `manual-unresolved`, and blocked by `pm.execution.skipRequest()` with a console diagnostic and null next-request target. Use a current Postman runner supporting this pre-request API. To use one, consult its upstream documentation, configure the appropriate auth in a local copy, and explicitly remove that request's generated pre-request guard. Do not run the entire reference collection as a workflow. No deployment/upload orchestration is introduced.

The account-list declaration is legacy-only in this exact revision, consistent with the current [Cloudflare account-list reference](https://developers.cloudflare.com/api/resources/accounts/methods/list/). Both the reference request and bootstrap account step preserve it. There are no auth compatibility overrides in this revision; live Bearer acceptance for these declarations has not been established by this project.

## Paginated Postman bootstrap

The three-request GET-only workflow uses [Postman's collection-run request routing](https://learning.postman.com/docs/tests-and-scripts/running-collections/building-workflows/) to repeat account/zone list requests by the runtime's current `pm.info.requestId`. Forward transitions use unique request names rather than export-time IDs, which may change on import; the fixture runner deliberately reassigns IDs to test this. `page` advances only after validating the response. Run-local variables hold counters, selector snapshots, and accumulated resource IDs/names; they are initialized by the first token-verification request and cleared after completion/failure. No paging state is persisted into the exported environment.

Each resource list is bounded to 1,000 pages at `per_page=50`. The response must have the expected page, page size, valid/stable total pages and optional total count, no duplicate IDs, no empty intermediate page, and a matching final total count when supplied. Totals changing during enumeration fail with a retry instruction. Cloudflare listings are not transactional snapshots: changes preserving the same totals cannot always be detected. Selection waits for the whole set, then applies ID-first or exact case-sensitive name matching; without selectors exactly one resource must exist. Any HTTP/JSON/envelope/pagination/selection failure sets the next request to null before throwing. Only successfully resolved IDs are persisted.

Run the full workflow from the first request with Collection Runner, Postman CLI, or Newman; individual Send does not follow `setNextRequest`. The fixture harness executes the emitted pre-request/post-response scripts and routing against 51-resource/two-page sets for both accounts and zones, cross-page duplicate names, empty/missing results, repeated pages/IDs, malformed metadata, and the loop cap. Live Postman execution has not been performed with credentials. The existing Node smoke probe remains a token-only live compatibility probe and may fail on `/accounts`; unlike the generated reference/workflow, it is not a declaration of the schema's supported auth modes.

## Converter limitation

`openapi-to-postmanv2` 6.3.3 is the current established converter selected for Phase 1. Its package description and output target Collection v2.x, and upstream Collection v3 support remains unresolved. The converter sometimes reports recoverable example-generation warnings for complex Cloudflare request/response schemas (deep nesting, incompatible `allOf` types, or pattern shapes). Warnings are counted in the generated manifest. They do not permit a missing operation, duplicate operation, invalid collection, or checksum mismatch.

The converter is a build-only dependency and processes the exact pinned Cloudflare schema. Patch-compatible overrides keep its `js-yaml`, `yaml`, and `uuid` dependencies on fixed releases. `npm audit` still reports the [`@faker-js/faker` `helpers.fake` advisory](https://github.com/advisories/GHSA-qxc2-j82w-r537) through Postman's current `postman-collection` dependency. This pipeline does not call `helpers.fake`, and converter input is the SHA-256-pinned official Cloudflare schema. The remaining advisory should be removed when Postman publishes a compatible dependency update; forcing Faker 10 into the legacy Postman SDK would break its API contract and compromise reproducibility.

At the pinned revision, the converter reports 47 recoverable example warnings. The upstream OpenAPI document also has three lowercase `4xx` response-range keys rejected by strict validation. Their exact revision-bound diagnostics are isolated in `config/upstream-validation-exceptions.json`; any new or missing diagnostic fails validation, and the upstream schema is not patched.

## Automation

### Pull-request validation

`.github/workflows/validate.yml` has read-only repository permission, receives no Cloudflare secret, and runs the complete offline/fixture validation on Node.js 24. External GitHub actions are pinned by full commit SHA.

### Daily upstream drift

`.github/workflows/upstream-drift.yml` resolves Cloudflare's current `main` commit, compares operation fingerprints, updates the provenance lock, regenerates, validates, and writes `upstream-change-summary.md`. It pushes only `automation/cloudflare-schema-update` and creates or updates a PR. It deliberately never merges.

The workflow needs repository `contents: write` and `pull-requests: write` permission. If organization policy prevents GitHub Actions from creating pull requests, an administrator must enable that capability or maintainers can run `npm run upstream:update` and open the generated review branch manually.

### Protected read-only smoke test

`.github/workflows/live-smoke.yml` runs only on a schedule or manual dispatch in the canonical repository. It is not triggered by pull requests. It skips cleanly until `CLOUDFLARE_READ_TOKEN` is configured, then treats authentication, envelope, pagination, and chaining failures as job failures.

Optional repository secrets are:

- `CLOUDFLARE_READ_TOKEN` (required to enable the job)
- `CLOUDFLARE_TEST_ACCOUNT_ID` or `CLOUDFLARE_TEST_ACCOUNT_NAME`
- `CLOUDFLARE_TEST_ZONE_ID` or `CLOUDFLARE_TEST_ZONE_NAME`

Use narrowly scoped credentials for maintainer-controlled non-production test resources, with only the read permissions needed to verify the selected account and zone. No Postman API key is required.

For an opt-in local check, set `CLOUDFLARE_API_TOKEN`, plus `CLOUDFLARE_ACCOUNT_ID`/`CLOUDFLARE_ACCOUNT_NAME` and `CLOUDFLARE_ZONE_ID`/`CLOUDFLARE_ZONE_NAME` as needed, then run `npm run smoke:live`. Keep values private; never commit populated environments or live response logs.

## Generated-file policy

Everything under `postman/reference/`, `postman/workflows/`, and `postman/environments/`, plus the manifest and operation-accounting file, is generated. Do not hand-edit it. Change source code, configuration, or the pinned upstream revision, run `npm run generate`, then run `npm run check`.
