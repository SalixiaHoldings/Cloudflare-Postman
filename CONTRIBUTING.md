# Contributing

Thank you for helping maintain this independent Cloudflare Postman reference library.

## Before opening a pull request

1. Use Node.js 24.
2. Install with `npm ci`.
3. Make changes in source, configuration, tests, or documentation—not directly in generated Postman artifacts.
4. Run `npm run generate` when generation inputs change.
5. Run `npm run check` and include relevant results in the pull request.

Every upstream HTTP operation must continue to be represented exactly once. New unclassified or duplicated operations are hard failures. A residual assignment must remain visible and should be narrowed when a stable product mapping is available.

Every non-residual partition match is evaluated. New overlaps need explicit method/path entries, the exact matching partition set, an intended owner, and a reason in `config/partition-overlaps.json`; unused or stale declarations fail validation. Do not bulk-approve future operations via implicit ordering.

Preserve upstream authentication semantics, including inherited security, AND requirements, and non-Bearer alternatives. Update generated auth inventories through the generator, never by hand. Bearer is preferred where supported, not a substitute for an incompatible upstream declaration.

Do not add credentials, real account or zone identifiers, customer-specific data or automation, or non-public operational logic. Do not identify non-public repositories, products, infrastructure, or operating arrangements. Fixtures must use conspicuously fictional values; populated environments must remain local/private.

Cloudflare schema changes should normally arrive through the scheduled upstream-update pull request. Never silently modify Cloudflare's operation definitions in generated output. If compatibility handling is necessary, isolate it, add a focused test, document the exact upstream behavior, and link an upstream issue when one exists.

All changes require human review. Automation does not merge pull requests.
