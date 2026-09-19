# Request-body generation audit

## Problem statement

Generated request bodies are not consistently faithful to the writable request shape declared by Cloudflare's OpenAPI schema.

A confirmed example is:

`POST /accounts/{account_id}/subscriptions`

The generated Postman body currently contains root-level fields such as `app`, `component_values`, `currency`, `current_period_end`, `current_period_start`, `id`, `price`, `state`, and `zone`, plus repeated converter placeholders:

`<Error: Too many levels of nesting to fake this schema>`

Cloudflare's official TypeScript SDK is generated from the OpenAPI specification and exposes only `frequency` and `rate_plan` as body parameters for account subscription creation. That is consistent with the public API documentation. The extra generated Postman fields are therefore not a usable request template.

At source revision `6ea57057edefe47d0fa548aa6998fedc4e2aa8ba`, GitHub code search finds **573 generated `.request.yaml` files** containing the exact nesting-error placeholder. This is a distribution-wide request-body quality problem.

## Current generation boundary

The primary `openapi-to-postmanv2@6.3.3` conversion owns request bodies. `src/postman.mjs` currently normalizes auth, query rows, URLs, identifiers, IDs, descriptions, and response snapshots, but it does not independently validate or normalize generated request-body semantics against each operation's `requestBody` schema.

The primary converter uses:

- `optimizeConversion: true`
- `requestParametersResolution: 'Example'`
- `exampleParametersResolution: 'Example'`
- `schemaFaker: false`

Do not assume changing one converter option is sufficient. Previous work established that converter-option changes can cause large unrelated drift.

## Required outcome

Implement a generic request-body correctness layer. Do **not** special-case subscriptions or hand-author request payloads.

For generated request bodies:

1. Respect the exact OpenAPI operation/media-type request schema.
2. Exclude properties marked `readOnly: true`, including through local `$ref`, nested objects, arrays, `allOf`, `oneOf`, and `anyOf` structures where applicable.
3. Preserve writable fields, including `writeOnly` fields.
4. Never emit `<Error: Too many levels of nesting to fake this schema>` or similar converter-error sentinel text in a live request body.
5. Never silently invent a field that is not writable according to the request schema.
6. If an optional field cannot be represented safely, prefer omission over an invalid placeholder. If a required body/value cannot be represented safely, fail generation for explicit review rather than emitting a misleading request.
7. Preserve request media types and non-JSON body modes such as form-data unless a reviewed generic fix is necessary for them.
8. Do not modify response examples merely to make request validation pass.
9. Do not patch Cloudflare's upstream schema and do not add endpoint-specific serialization.
10. Preserve deterministic generation and v2.1/v3 semantic equivalence.

## Required regression coverage

At minimum:

- Add a synthetic OpenAPI fixture with a shared request/response component containing writable and `readOnly` properties, nested refs, arrays, and composition.
- Prove generated request JSON excludes read-only properties while retaining writable properties.
- Prove generated request bodies contain no converter error sentinel.
- Add a pinned-distribution regression for `POST /accounts/{account_id}/subscriptions`: root request keys must be only the writable request fields represented by the pinned schema; currently that means `frequency` and `rate_plan`.
- Add a full-distribution validation gate that scans **request bodies**, not response examples, for converter error sentinels.
- Where practical, semantically validate generated JSON request bodies against the applicable OpenAPI request schema after applying request/read-only semantics.
- Confirm Native Git v3 carries the corrected body semantics exactly.

## Scope discipline

This is a correctness fix before `v0.1.0`, not a request-template redesign.

Do not:

- hand-curate thousands of payloads;
- use Cloudflare's rendered docs as an alternate schema authority;
- replace the existing query/auth architecture;
- alter partition ownership;
- weaken existing warning, auth, query, deterministic-generation, Native Git, or public-safety gates.

If the pinned converter cannot be made to produce safe request bodies without broad unrelated drift, introduce the narrowest generic post-conversion request-body normalization necessary and document why it is safe.

## Validation before PR completion

Run and report:

- `npm ci`
- `npm test`
- `npm run generate`
- `npm run generate:check`
- `npm run validate`
- `npm run check`
- `git diff --check`
- release safety scan if the checksum-verified Gitleaks binary is available

Regenerate and commit both `dist/v2.1/` and `postman/`. Do not merge.
