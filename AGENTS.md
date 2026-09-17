# Repository Guidance

## Purpose

This repository is the public, open-source Salixia-maintained Postman distribution of the Cloudflare API. Generate it from Cloudflare's official `cloudflare/api-schemas` OpenAPI source; do not turn it into an independently maintained API-schema fork.

## Boundaries

- Keep the repository public-safe. Never add credentials, customer data, private identifiers, proprietary workflows, or non-public operating details.
- Fixtures must use conspicuously fictional values.
- `base_url` is intentionally public/tracked. Credentials and real account/zone/tenant/organization identifiers must remain local only and must never be Shared or committed.
- Never commit API tokens, Global API Keys, Postman API keys, authentication email values, customer names, populated environments, or live response payloads.

## Upstream authority and provenance

- Treat `https://github.com/cloudflare/api-schemas` as the authoritative API definition.
- Pin the exact upstream commit and SHA-256 used for generation.
- Preserve required BSD-3-Clause notices.
- Do not silently patch upstream operation definitions. Compatibility handling must be isolated, documented, revision-bound where appropriate, and covered by tests.

## Engineering requirements

- Use Node.js 24 unless an unavoidable dependency requires otherwise.
- Pin material generator/toolchain versions; do not rely on `latest`.
- Generation must be deterministic.
- Every upstream HTTP operation must map to exactly one generated reference collection or fail validation. No silent omissions or duplicates.
- Prefer config-driven partitions over handwritten request lists.
- Generated artifacts must be clearly marked and never hand-edited.
- Preserve schema-declared authentication. Prefer standalone API-token/Bearer alternatives where supported, but do not rewrite legacy-only or multi-scheme requirements.
- Keep `https://api.cloudflare.com/client/v4` configurable through `base_url`.

## Postman formats and query policy

- Generate v2.1 JSON under `dist/v2.1/` and derive v3 YAML under `postman/` using pinned official Postman CLI migration.
- Never commit `.postman/` workspace bindings. Regenerate and validate both formats together.
- Only the guarded collection-auth UUID normalization documented in `docs/native-git.md` is approved for v3 migration. Additional migration instability requires review.
- Query defaults use the isolated full-secondary/query-only projection documented in `docs/query-policy.md`. Do not replace it with endpoint-specific query rewriting, a local array/object serializer, or the rejected reduced-input optimization.
- Required query Params remain enabled; emitted optional Params remain disabled by default. The five known optional-array omissions are revision-bound limitations.
- Generic environment selectors include `account_id`, `zone_id`, `tenant_id`, and `organization_id`. Their committed values must remain empty. `base_url` is the only intentionally populated shared environment value.
- Keep collections practical to navigate; do not collapse complete coverage into one monolithic collection when modular output preserves exact accounting.

## CI and maintenance

- Pull requests must run deterministic generation checks, schema/collection validation, tests, operation accounting, auth validation, query-policy validation, and v2/v3 semantic checks.
- Scheduled upstream drift must produce a reviewable branch/PR and human-readable summary; it must never auto-merge.
- Live Cloudflare smoke tests must be read-only by default, use narrowly scoped maintainer-controlled credentials, and keep secrets unavailable to PR execution.

## Change discipline

- Keep implementation scope bounded to the active task.
- Do not merge PRs. Leave branches ready for human review.
- Update durable documentation when architecture or operating decisions change; avoid documentation churn that only records command execution.
