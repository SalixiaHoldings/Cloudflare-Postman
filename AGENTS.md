# Repository Guidance

## Purpose

This repository is the public, open-source Salixia-maintained Postman distribution of the Cloudflare API. It must be generated from Cloudflare's official `cloudflare/api-schemas` OpenAPI source rather than becoming an independently maintained fork of Cloudflare's API schema.

## Boundaries

- Keep this repository public-safe. Never add credentials, customer or tenant-specific data, private identifiers, or proprietary internal workflows.
- Keep project-specific private operational logic out of this open-source repository. Do not name or describe non-public repositories, products, infrastructure, or operating arrangements in documentation or validation rules.
- Generated reference collections may include generic chaining helpers that are universally useful to Cloudflare API users. Keep fixtures synthetic and populated environments local/private.
- Never commit API tokens, Postman API keys, account IDs, zone IDs, customer names, or other secrets. Environment files must be templates only.

## Upstream authority and provenance

- Treat `https://github.com/cloudflare/api-schemas` as the authoritative upstream API definition.
- Pin the exact upstream commit and SHA-256 digest used for generation in a lock/provenance file.
- Preserve all legally required upstream notices. Cloudflare's schema repository is BSD-3-Clause licensed; generated/redistributed material must retain required notices.
- Do not silently patch the upstream schema in generated output. If a live API mismatch requires a compatibility workaround, isolate and document it explicitly as a project compatibility override with a test and upstream issue/reference when available.

## Engineering requirements

- Standardize on Node.js 24 for repository tooling unless an unavoidable dependency prevents it; document any exception.
- Pin material generator/toolchain versions. Do not rely on `latest` in reproducible generation.
- Generation must be deterministic: the same upstream commit plus the same toolchain must produce byte-stable artifacts except for explicitly documented metadata.
- The complete upstream operation set must be accounted for. Every HTTP operation must map to exactly one generated reference collection or fail validation with a clear unclassified-operation report. No silent omissions or duplicates.
- Prefer config-driven product partitions over fragile handwritten request lists.
- Keep generated artifacts clearly marked as generated and do not hand-edit them.
- Use Cloudflare API tokens/Bearer authentication for normal examples. Do not normalize around Global API Keys.
- Keep `https://api.cloudflare.com/client/v4` configurable via a collection/environment variable.

## Postman format

- Use the current stable, automatable format supported by the selected generator. At staging time `openapi-to-postmanv2` is the established Postman converter and its upstream package is 6.3.3; Collection v3 support in that converter is not yet established. Pin a verified compatible version rather than assuming v3 support.
- Structure collections so they remain practical to navigate; do not emit one monolithic 20+ MB collection if modular output can preserve complete coverage.
- Generic reusable variables should include at minimum the Cloudflare API base URL, account ID, zone ID, and token reference. Secrets must never contain committed values.

## CI and maintenance

- Pull requests must run deterministic generation checks, schema/collection validation, lint/type/tests, and operation-accounting checks.
- A scheduled upstream drift job should check Cloudflare's schema at least daily. When the pinned upstream changes, automation should generate a reviewable branch/PR and a human-readable change summary; it must not auto-merge upstream API changes.
- Live Cloudflare smoke tests must be read-only by default and use narrowly scoped credentials for maintainer-controlled non-production test resources, stored only in GitHub Actions secrets. Do not expose secrets to forked PR execution.
- Scheduled/main-only smoke tests should fail clearly on authentication, response-envelope, pagination, or chaining regressions.

## Change discipline

- Keep implementation scope bounded to the active task.
- Do not merge PRs. Leave the branch and PR ready for human review.
- Update durable documentation when architecture or operating decisions change; do not create documentation churn merely because commands were run.
