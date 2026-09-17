# Official query options: full-partition experiment

> Historical investigation. The maintainer subsequently approved and the generator now implements the full-secondary query-only projection. See [current query policy](query-policy.md) for the implemented behavior, approved limitations, and validation. The stop/pending statements below describe the experiment at that time.

## Decision

The [maintainer follow-up](https://github.com/SalixiaHoldings/Cloudflare-Postman/pull/4#issuecomment-5716166995) requires testing official converter controls before any custom normalization. **The settings fix all five documented query-identity defects, but are not adopted globally:** they change substantial unrelated request and response content. This is the explicit stop/report boundary in the follow-up.

A bounded secondary-pass candidate taking only official converter query output preserves the existing non-query request fields and all response examples. It is evaluated, not implemented. It still omits five optional array parameters, so the requested guarantee that every optional parameter remains visible is not established.

## Controlled setup

- Baseline: commit `eacd16495c69633fd3f6b23ac82ae713cc94b237`.
- Node.js `24.20.0`; unchanged `openapi-to-postmanv2@6.3.3`.
- Pinned schema `1cf9b4dcf3241bef73d3300b045cb01543cc7a5f`, SHA-256 `20d85f3117a64afdaa4319516cce3079517377d89469817e8fae0c4821060bac`.
- All ten partitions used the existing `listOperations`, `classifyOperations`, and `subsetSchema` functions, retaining the complete components context.
- An isolated copy of `src/postman.mjs` retained all seeding, normalization, and conversion options except these three settings:

```js
enableOptionalParameters: false,
optimizeConversion: false,
stackLimit: 50
```

The installed package's `README.md` documents `optimizeConversion=false,stackLimit=50` for the nesting-error placeholder, and `OPTIONS.md` describes all three controls. No upstream schema mutation or local array/object serializer was used. Output stayed in ignored experiment directories. Tracked distributions and the user's local environment edit were not overwritten.

Comparison matches requests by stable ID within each existing partition. It compares structured values without object-property-order sensitivity; raw body/example strings remain byte-sensitive. Non-query request comparison removes only `url.query` and the query suffix of `url.raw`. Response comparison includes saved original requests as well as response bodies. Categories overlap and must not be summed.

## Diff classification

| Partition | Operations | Query changed | Non-query request changed | Request body changed | Response body changed | Warnings |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| zero-trust | 594 | 82 | 148 | 142 | 583 | 236 |
| workers-developer-platform | 474 | 107 | 105 | 97 | 429 | 14 |
| storage-data | 127 | 25 | 48 | 20 | 127 | 7 |
| application-security-rulesets | 369 | 105 | 86 | 86 | 337 | 64 |
| analytics-observability | 434 | 310 | 17 | 17 | 419 | 14 |
| zones-dns-domains | 436 | 53 | 86 | 82 | 384 | 95 |
| network-services | 286 | 28 | 77 | 74 | 266 | 42 |
| media-communications | 183 | 29 | 41 | 39 | 173 | 3 |
| accounts-identity-billing | 618 | 119 | 127 | 124 | 550 | 64 |
| other-cloudflare-services | 1 | 0 | 0 | 0 | 0 | 0 |
| **Total** | **3,522** | **858** | **735** | **681** | **3,268** | **539** |

Additional totals: 79 requests have changed headers; 3,334 operations have changed response/example structures. No operation is query-only when response/example changes are included. Environment/template changes: zero (the experiment does not generate environments). Method and request-auth differences: zero. Exact-once coverage and partition ownership are unchanged.

Warnings increase from 47 to 539: 537 `allOf` resolution warnings and two unknown-format warnings. The deeper pass exposes incompatible schema combinations, including object/array result types and number/integer count types. These warnings were classified, not suppressed or accepted as a new production baseline. The full pass demonstrably changes far more than query defaults and must not replace the existing conversion implicitly.

## Query results

- All five IAM/Spectrum cases retain `id` or `since`/`until` correctly, as disabled optional parameters.
- Zero generated query rows contain `<Error: Too many levels of nesting to fake this schema>`.
- The schema contains 133 required and 5,495 optional query contracts, after local reference resolution and path/operation override handling.
- Official output contains 141 enabled and 8,070 disabled rows. Contract and row counts differ because arrays repeat rows and objects can expand properties.
- All 8,209 rows whose keys directly match parameter names have the correct required/optional state. The remaining two rows are `start` and `end`, the properties of optional `start_end_params` on `GET /accounts/{account_id}/intel/dns`; both are disabled. This is legitimate converter-owned object expansion, not lost scalar identity.
- All 133 required contracts remain represented and enabled. Five optional array contracts are omitted entirely; therefore global optional **visibility** fails even though emitted rows have the correct state.

Representative experimental output:

| Request | Default raw URL | Optional rows |
| --- | --- | ---: |
| `GET /organizations` | `{{base_url}}/organizations` | 11, all disabled |
| `GET /organizations/{organization_id}/accounts` | `{{base_url}}/organizations/{{organization_id}}/accounts` | 14, all disabled |

The missing optional parameters are:

- `filter` on `GET /accounts/{account_id}/gateway/lists`.
- `filter` on `GET /accounts/{account_id}/gateway/locations`.
- `filter` on `GET /accounts/{account_id}/gateway/proxy_endpoints`.
- `filter` on `GET /accounts/{account_id}/gateway/rules`.
- `search` on `GET /accounts/{account_id}/cloudforce-one/events` (schema default `[]`).

Gateway filters are repeated form arrays with constrained item schemas; Cloudforce One search is an array of objects. No placeholder rows, serialization heuristics, or endpoint-specific exceptions were invented to fill these gaps.

## Bounded secondary-pass evaluation

The experimental candidate starts with each unchanged baseline collection and takes only `request.url.query` and the corresponding `request.url.raw` from the official secondary conversion. The raw URL was built by the existing `makeRawUrl()` in the copied generator; no second URL builder exists. Restoring those two fields reproduces every baseline collection exactly as a structured value, including all original response examples. This proves the projection can isolate the query changes from the broad drift.

This is a design experiment, not approval to ship the projection. A production implementation would need a fail-closed operation/identity join, deterministic secondary output, explicit treatment of secondary warnings, query-contract visibility checks, identifier substitution, and regression coverage. Saved response examples remain baseline examples in this candidate and would need an explicit policy if their query defaults should change too.

The candidate's ten collections were migrated with pinned Postman CLI `1.56.3`. Official collection lint passed at `--fail-severity warning` for all ten. Across all 3,522 requests and 8,211 query rows, v2/v3 comparison passed for raw URL, key, value, enabled/disabled state, row order/repetition, and description. This is an experimental check; it has not been wired into production validation. The experiment did not regenerate environments, Globals, bootstrap, or run the two-run Native Git determinism comparison.

## Current acceptance boundary

The committed generator still uses its original settings and retains 47 converter warnings. Its schema pin, 3,522 operations, partition ownership, 2,496 overlaps, auth policy, bootstrap, Globals, and approved v3 auth-ID normalization are unchanged.

The empty `tenant_id`/`organization_id` additions and extended identifier substitution have not been implemented during the stop-gated experiment. Neither has production v2/v3 query validation or a new query regression suite. The complete implementation, release scan, two-run Native Git determinism gate, and Desktop acceptance remain pending review of the query-only design and omitted-array behavior. A green hosted run on this report validates the existing baseline only.
