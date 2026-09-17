# Postman Native Git and Local Mode

## Generated formats

The pinned Cloudflare OpenAPI schema is the sole API-definition authority. Generation produces both:

```text
dist/v2.1/   portable Collection v2.1 JSON for import/Newman
postman/     Postman v3 YAML for Native Git / Local View
```

`postman/` contains generated `collections/`, `environments/`, and an intentionally empty `globals/` entity. No v2 JSON or generator metadata is placed in the Native Git tree.

## Use in Postman Local View

1. Clone the repository and open its root in Postman v12+ desktop.
2. Switch to **Local View** and select **Cloudflare API — Template**.
3. Enter credentials and resource selectors only in local **Value** fields.
4. Confirm `git status` remains clean after setting local values.

`base_url = https://api.cloudflare.com/client/v4` is intentionally populated and may remain Shared/tracked. **Never Share or commit credentials, API keys/tokens, authentication email values, or real account/zone/tenant/organization IDs.** Those values must remain local only.

Postman Cloud is not required. If Postman creates `.postman/resources.yaml` for an optional workspace binding, `.postman/` remains local and ignored.

Import users can use the JSON files under `dist/v2.1/`; see the [README](../README.md).

## Empty Globals

Local View materializes `postman/globals/workspace.globals.yaml`, so generation owns this exact empty entity:

```yaml
name: Globals
values: []
```

The project uses collection/environment variables and defines no shared workspace globals. Validation rejects added Globals variables or values.

## Toolchain and generation

Use Node.js 24 and `npm ci`. The exact `postman-cli@1.56.3` dependency supplies the migration/lint binary and is verified before generation.

```sh
npm run generate
npm run check
```

Generation builds both formats in temporary directories and publishes them only after success. The upstream updater uses the same generator and stages both `dist/` and `postman/`; it never auto-merges.

Each v2 collection is migrated twice into independent clean directories. Raw and normalized v3 output must pass official Postman lint, semantic equivalence, and byte/file-set comparison.

The JSON and YAML environments come from one source model. Credential/resource fields are committed empty; only the public `base_url` is intentionally populated.

## Collection-auth UUID compatibility policy

Postman CLI 1.56.3 generates a fresh collection-auth UUID at `.resources/definition.yaml -> auth[0].id` on migration. The project applies one narrow deterministic normalization to that metadata field only.

Before replacement, validation requires:

- exactly one collection-level Bearer auth entry;
- a valid UUID at the expected scalar location;
- exactly one occurrence of that UUID across the collection directory;
- no UUID reference in another file, comment, filename, or unexpected structure.

Only that UUID's bytes are replaced using the existing deterministic UUID algorithm seeded with `postman-v3:collection-auth:<v2 _postman_id>`. Request, folder, example, environment, variable, and other IDs are untouched.

The two raw migration IDs must differ. If Postman begins generating a stable ID, generation stops for review instead of continuing the compatibility rewrite. Any other migration instability also fails.

## Query semantics

The [query policy](query-policy.md) uses an isolated full secondary conversion and projects only official query rows into the primary collection. Required query Params remain enabled; emitted optional Params are disabled by default. The exact five known optional-array omissions are revision-bound and documented there.

v2/v3 validation compares query keys, values, enabled/disabled state, order/repetition, descriptions where represented, and the full raw URL.

## Validation and provenance

- `npm run generate:check` regenerates both formats and compares them byte-for-byte with committed output.
- `npm run validate` checks v2 schema/auth/accounting, v3 hashes/inventory/lint/semantics, empty public templates, and public-safety rules.
- `npm run check` runs syntax checks, tests, generation checking, and validation.
- Hosted Validate runs the same complete gate.

The manifest records the schema revision/digest, converter and CLI toolchain, compatibility-policy version, v2/v3 hashes, operation counts, environment/Globals hashes, and query-projection provenance. Missing, extra, stale, or edited generated output fails validation.

## Desktop verification

Before release, verify in Postman Local View:

1. Ten reference collections, bootstrap, template environment, and empty Globals appear with no **Upgrade files** warning.
2. Optional query Params are unchecked by default; required Params remain checked.
3. Local credentials/selectors work without changing tracked files.
4. Closing/reopening Local View creates no untracked Globals file.

CLI lint proves generated-format validity; this check covers Postman desktop behavior.

## Public-release scan

For the full public secret/PII gate, install checksum-verified Gitleaks 8.30.1 and run:

```sh
npm run generate:check
GITLEAKS_BIN=/path/to/gitleaks npm run scan:release
```

The scan covers all generated YAML, including hidden example resources, and fails on unexplained candidates. No Gitleaks rules are globally disabled.
