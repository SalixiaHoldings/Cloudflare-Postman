# Postman Native Git and Local Mode

The planned Local Mode feature will support Postman in two complementary ways. Implementation is currently blocked by the official migration tool’s nondeterministic output (see below):

- Collection v2.1 JSON remains the portable, importable representation and the compatibility target for tooling that still requires v2.1, including Newman.
- Collection v3 YAML is generated as an optional compatibility layer for Postman v12 Native Git / Local Mode.

The v3 representation is derived from the same generated Cloudflare API library; it is not an independently maintained source of truth. Changes must continue to originate from the pinned Cloudflare schema and deterministic generator rather than by hand-editing one representation independently of the other.

Postman workspace bindings in `.postman/` are local/workspace-specific and are intentionally ignored. This public repository must not contain a workspace ID, Postman Cloud resource IDs, API keys, local secrets, or other user-specific Native Git state.

The final repository layout, generation commands, pinned Postman CLI version, validation rules, and user instructions are established by the Local Mode implementation and must keep both representations reproducible and public-safe.

## Migration determinism blocker

The compatibility implementation is paused at its required determinism gate. The existing v2.1 distribution and generation pipeline remain in place; the proposed dual-format layout is not yet shipped.

The probe uses **Postman CLI 1.56.3**, installed with an exact npm pin in an ignored local directory:

```sh
npm install --prefix .cache/postman-cli-probe --save-exact postman-cli@1.56.3
.cache/postman-cli-probe/node_modules/.bin/postman --version
```

This is the [official npm installation mechanism](https://learning.postman.com/docs/postman-cli/postman-cli-installation). The package pins its platform-specific binary dependencies to the same version. Version 1.56.3 exposes collection migration, collection lint, and environment lint; no login or API key was used. This is a tested candidate, not an integrated repository toolchain pin.

### Reproduction

Run the following from the repository root. Both output directories must be new and empty; use a fresh temporary parent on each attempt.

```sh
probe_dir=$(mktemp -d)
.cache/postman-cli-probe/node_modules/.bin/postman collection migrate \
  postman/workflows/bootstrap.postman_collection.json -o "$probe_dir/a"
.cache/postman-cli-probe/node_modules/.bin/postman collection migrate \
  postman/workflows/bootstrap.postman_collection.json -o "$probe_dir/b"
diff -ru "$probe_dir/a" "$probe_dir/b"
```

The same source collection produces different values at **`.resources/definition.yaml` → `auth[0].id`**. Both values have UUID-v4 form. Migration creates a fresh collection-level auth identifier on each invocation rather than retaining stable output for the existing collection auth. This describes the observed behavior; the closed-source binary’s internal implementation has not been inspected.

The [official migration command](https://learning.postman.com/docs/postman-cli/postman-cli-collections) exposes only an output-directory option, with no documented deterministic-ID or seed option. No generated UUID has been stripped, replaced, or normalized. Request semantics have not been rewritten.

### Full collection probe results

All ten reference collections and the three-request bootstrap were migrated twice into separate clean temporary directories on macOS arm64 with Node.js 24.20.0 and Postman CLI 1.56.3. Across each run’s **13,206 files**, file sets were identical. Exactly **11 files** differed: every collection’s `.resources/definition.yaml`, solely at `auth[0].id`. All remaining files were byte-identical.

| Collection | Request files | Official collection lint |
| --- | ---: | --- |
| accounts-identity-billing | 618 | 0 errors, 0 warnings |
| analytics-observability | 434 | 0 errors, 0 warnings |
| application-security-rulesets | 369 | 0 errors, 0 warnings |
| media-communications | 183 | 0 errors, 0 warnings |
| network-services | 286 | 0 errors, 0 warnings |
| other-cloudflare-services | 1 | 0 errors, 0 warnings |
| storage-data | 127 | 0 errors, 0 warnings |
| workers-developer-platform | 474 | 0 errors, 0 warnings |
| zero-trust | 594 | 0 errors, 0 warnings |
| zones-dns-domains | 436 | 0 errors, 0 warnings |
| bootstrap | 3 | 0 errors, 0 warnings |

The temporary v3 reference output contains 3,522 request files, plus three bootstrap request files. This count and successful lint do not establish full semantic equivalence; the implementation stopped before adding the independent v2/v3 operation and semantics validator. None of the temporary v3 output is committed.

Baseline `npm ci`, `npm run generate`, and `npm run check` pass. The latter includes lint, all 18 tests, byte-for-byte generation checking, and validation. The existing 3,522 exact-once operations, 2,496 overlaps, partition counts, auth categories, three revision-bound schema exceptions, and 47 converter warnings are unchanged. Existing public-safety validation passes; `.postman/resources.yaml` is ignored and no `.postman/` file is tracked. Full v3 release secret/PII scanning remains pending because no v3 distribution is being published.

### Resuming implementation

Proceed only after a compatible official tool produces deterministic output, or after maintainers explicitly approve a documented compatibility approach to the unstable identifier. Re-run the two-clean-directory comparison before integrating migration into generation, manifests, validation, and upstream drift. Until then, v3 environment generation/validation, the final directory move, v3 release scanning, and desktop Local Mode acceptance remain outstanding.
