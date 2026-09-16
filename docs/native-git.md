# Postman Native Git and Local Mode

## Two generated formats

The pinned official Cloudflare OpenAPI schema is the sole API-definition authority. The generator produces portable Collection v2.1 JSON, then uses official Postman CLI migration to derive Collection v3 YAML. Neither representation is hand-maintained. v2.1 remains supported for ordinary import and Newman.

```text
dist/v2.1/
  reference/                 ten v2.1 collections
  workflows/                 three-request bootstrap
  environments/              empty JSON template
  manifest.json              both formats and toolchain provenance
  operation-accounting.json  exact-once upstream ownership
postman/
  collections/               eleven v3 collection directories
  environments/              empty YAML template
  globals/                   generated empty workspace.globals.yaml
```

Each v3 collection uses the official migration layout: a collection-level `.resources/definition.yaml`, folder definitions, request YAML, and response-example resources. No v2.1 JSON or generator metadata is placed in the Native Git tree. Cloudflare notices in the root license/third-party notices and generated collection descriptions apply to both representations.

## Local Mode usage

Clone the repository, open the repository root in Postman v12+ desktop, switch to **Local View**, and select the generated template environment. Enter credentials and resource selectors only as **local Values** in the Postman app. Do not **Share** sensitive values or populate Shared values. Postman documents local values as private to your app instance; Shared values are the values intended for collaboration/synchronization. The tracked YAML template must remain empty. Import users can instead select the JSON files in `dist/v2.1/`; see the [README](../README.md).

Local Mode requires no Postman Cloud connection or push. Cloud workspace binding is optional. Postman may create `.postman/resources.yaml` when a workspace is bound; the entire `.postman/` directory is ignored and must never be committed. After setting a harmless local test value, `git status` should remain clean. If a sensitive value appears in a tracked-file diff, stop and remove it before committing. Do not commit populated environments, workspace IDs, cloud resource IDs, API keys, or local application state. Local deterministic entity UUIDs in generated YAML are not cloud workspace bindings.

Postman variable guidance: [local values are private by default](https://learning.postman.com/latest-v-12/docs/use/send-requests/variables/define-variables), while [Shared values are explicitly synchronized](https://learning.postman.com/latest-v-12/docs/use/send-requests/variables/share-variables). Postman's Native Git guidance likewise says to keep local environment values in the app while committing Shared values to Git.

## Empty Globals entity

Postman Local View materializes `postman/globals/workspace.globals.yaml`. It is a legitimate generated Native Git entity, unlike the ignored `.postman/resources.yaml` workspace/cloud binding. Do not ignore `postman/globals/` or hand-edit its generated contents:

```yaml
name: Globals
values: []
```

The project uses collection/environment variables and intentionally defines no shared workspace globals. Generation owns this single model; validation rejects any added variable or value, even an empty-valued variable. Credentials belong only in Postman’s local **Value** fields. Never **Share** sensitive global or environment values.

Both independent generation runs include Globals in file/byte comparisons and the Native Git root digest. The manifest records its path and SHA-256. Pinned CLI 1.56.3 runs `postman globals lint postman/globals/workspace.globals.yaml --fail-severity warning`, requiring zero errors/warnings ([official globals commands](https://learning.postman.com/latest-v-12/docs/postman-cli/postman-cli-globals)). Release and local-path scans include the file. Only `collections/`, `environments/`, and `globals/` are permitted at the Native Git root.

## Toolchain and generation

Use Node.js 24 and `npm ci`. The exact official `postman-cli@1.56.3` npm dependency supplies `node_modules/.bin/postman` and exact-version platform binary packages through `package-lock.json`. The binary version is verified before generation/validation and recorded in `toolchain-lock.json` and the manifest. No login, API key, workspace ID, or cloud resource is needed. See [official installation](https://learning.postman.com/docs/postman-cli/postman-cli-installation) and [collection commands](https://learning.postman.com/docs/postman-cli/postman-cli-collections).

Run `npm run generate` to generate both formats. Output is built in temporary directories; generation failure does not publish a partially migrated distribution. The updater calls this same generator and stages both `dist/` and `postman/` in its review branch. It never auto-merges.

Every collection is migrated twice into independent clean directories. Both raw outputs pass official collection lint before compatibility handling. Both normalized outputs are linted again, then checked for semantic equivalence and identical directory/file sets and bytes. The environment YAML uses exactly the same source model as JSON, including empty credential/resource values and secret flags; both independently generated environments pass official environment lint.

## Narrow collection-auth ID compatibility policy

Postman CLI 1.56.3 assigns a fresh collection-auth UUID on each migration at `.resources/definition.yaml → auth[0].id`. [Postman issue #14052](https://github.com/postmanlabs/postman-app-support/issues/14052#issuecomment-4136642843) also discusses unstable collection-auth IDs in v3/Git workflows. [Independent review approved policy v1](https://github.com/SalixiaHoldings/Cloudflare-Postman/pull/4#issuecomment-5689885557) for this one persistence identifier. This policy does not alter authentication semantics.

Before changing output, the guard requires exactly one collection auth entry, a valid UUID at the expected scalar location, and exactly one occurrence of that UUID across the entire collection directory. References in other files, comments, filenames, unexpected structures, and symlinks fail closed. Only the scalar’s UUID bytes are replaced—YAML is never reserialized.

The ID is derived with the shared existing `deterministicUuid` algorithm using seed `postman-v3:collection-auth:<v2 _postman_id>`. Existing v2 IDs are unchanged. `.gitattributes` disables line-ending conversion and whitespace-style diagnostics only for generated YAML, whose official block scalars retain upstream trailing spaces and tabs. Byte comparisons enforce their exact content; the generator never trims them. Request, folder, example, environment, variable, and other resource IDs and filenames are untouched. Regression tests exercise invalid structures, missing/duplicate/referenced IDs, byte-only replacement, and stable-official-ID detection.

The two raw auth IDs must differ. If official migration starts producing a stable ID, generation stops for explicit compatibility review instead of continuing to rewrite it. Any other difference after the approved replacement also stops generation. Both raw and normalized lint require zero errors **and warnings**.

## Validation and provenance

`npm run generate:check` regenerates both representations (including the two-run comparison) and compares them with checked-in output. `npm run validate` checks v2 schema/auth/accounting plus all v3 hashes, exact file/directory inventory, official lint, and semantic equivalence. `npm run check` runs syntax checks, regression tests, generation checking, and validation. Hosted Validate runs this full gate.

Semantic validation matches collection and request identities, partition ownership, HTTP methods and API paths, request names, auth modes and credential references, auth headers, core variables, pre/post scripts, and complete descriptions containing upstream operation identities. The official migrator uses filenames for ordinary request names and retains an explicit name when needed; filename-backed names trim surrounding whitespace. Validation understands that representation without editing migrated names. Bootstrap remains three requests.

The manifest records the schema commit/digest, converter and CLI toolchain, compatibility-policy version, v2 hashes, v3 per-file hashes and directory/file-set digests, operation-set digests and counts, and environment hashes. Missing, extra, duplicate, stale, or edited v3 output fails validation. Public-safety validation covers the entire YAML tree and empty template values, in addition to the existing v2 checks. Public upstream examples remain attributable to the pinned schema.

## Desktop acceptance boundary

CLI lint proves format validity, not desktop behavior. In Postman v12+ desktop, open this repository root in Local View without a cloud binding; confirm all ten reference collections, the three-request bootstrap, and template environment plus empty Globals appear, and no **Upgrade files** warning appears. Inspect auth/variables and bootstrap scripts without sending requests. Set one harmless local Value and confirm `git status` remains clean. Confirm opening Local View no longer creates an untracked Globals file. This final UI acceptance check requires a human desktop session.

For public-release secret/PII review, install checksum-verified Gitleaks 8.30.1 and run `npm run generate:check`, then `GITLEAKS_BIN=/path/to/gitleaks npm run scan:release`. The scan covers all YAML, including hidden example resources. It reports generated auth fingerprints, exact pinned-upstream examples (including encoded samples), and seeded AI Search UUID fixtures already reproduced in v2 separately; any unexplained candidate fails. Email candidates must occur in the verified upstream source or match a reproduced v2 fixture for an upstream email-format query parameter without an example. No Gitleaks rules are globally disabled, and reports containing candidate values are temporary and removed. Existing local-path and empty-template checks remain part of `npm run validate`.
