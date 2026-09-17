# Query-default policy: converter blocker

> Historical investigation. The maintainer subsequently approved and the generator now implements the full-secondary query-only projection. See [current query policy](query-policy.md) for the implemented behavior, approved limitations, and validation. The stop/pending statements below describe the experiment at that time.

The [live-test follow-up on PR #4](https://github.com/SalixiaHoldings/Cloudflare-Postman/pull/4#issuecomment-5715345457) requests a global optional-query policy. The subsequent [official-options experiment](query-options-experiment.md) fixes all five query-identity defects below using supported converter settings. Global adoption is paused because those settings also change 735 non-query requests and 3,268 response-example bodies. A query-only candidate preserves those fields, but five optional array parameters remain absent. No production converter change, query serialization workaround, or schema edit has been applied.

## Reproduced failure

With Node.js 24 and the pinned `openapi-to-postmanv2@6.3.3`, raw converter output loses scalar query-parameter identity before this project's normalization or v3 migration:

| Operation | OpenAPI query names lost | Emitted query keys instead |
| --- | --- | --- |
| `GET /accounts/{account_id}/iam/resource_groups` | `id` | `description`, `value` |
| `GET /accounts/{account_id}/iam/user_groups` | `id` | `description`, `title`, `value` |
| `GET /user/spectrum_analytics/zones/report` | `since`, `until` | repeated `description`, `value` |
| `GET /zones/{zone_id}/spectrum/analytics/events/bytime` | `since`, `until` | repeated `description`, `value` |
| `GET /zones/{zone_id}/spectrum/analytics/events/summary` | `since`, `until` | repeated `description`, `value` |

The IAM identifiers resolve through `allOf` and local references to a string schema. Spectrum timestamps similarly resolve to strings with `date-time` format. The emitted `value` is `<Error: Too many levels of nesting to fake this schema>`. These are not legitimate exploded object properties. The [OpenAPI parameter contract](https://spec.openapis.org/oas/v3.0.3#parameter-object) identifies a parameter by its name and location; scalar serialization cannot substitute schema metadata for that name.

The failure is present in the existing generated v2 collections and is reproduced by invoking the official converter directly. It is independent of the proposed enabled/disabled policy. A simple shallow synthetic `allOf` fixture succeeds, so reproductions must retain the pinned schema context and converter options rather than assuming all `allOf` parameters fail.

## Reproduction

Run `npm ci`, then this command from the repository root. It uses the existing checksum-verified schema fetcher, retains the full components context, selects two affected operations, and prints only their query representation. No credentials or API calls are involved.

```sh
node --input-type=module <<'JS'
import { readFile } from 'node:fs/promises';
import converter from 'openapi-to-postmanv2';
import { fetchPinnedSchema } from './src/upstream.mjs';

const { destination, lock } = await fetchPinnedSchema();
const schema = JSON.parse(await readFile(destination, 'utf8'));
const paths = [
  '/accounts/{account_id}/iam/resource_groups',
  '/user/spectrum_analytics/zones/report'
];
const input = {
  ...schema,
  paths: Object.fromEntries(paths.map(p => [p, { get: schema.paths[p].get }]))
};
const options = {
  folderStrategy: 'Paths', includeAuthInfoInExample: false,
  includeDeprecated: true, keepImplicitHeaders: false,
  optimizeConversion: true, requestNameSource: 'Fallback',
  requestParametersResolution: 'Example',
  exampleParametersResolution: 'Example', schemaFaker: false
};
converter.convert({ type: 'json', data: input }, options, (error, result) => {
  if (error) throw error;
  if (!result.result) throw new Error(result.reason);
  const requests = items => items.flatMap(i => i.item ? requests(i.item) : [i]);
  console.log('Schema commit:', lock.commit);
  console.log(JSON.stringify(requests(result.output[0].data.item).map(i => ({
    path: i.request.url.path, query: i.request.url.query
  })), null, 2));
});
JS
```

Verified schema commit: `1cf9b4dcf3241bef73d3300b045cb01543cc7a5f`; SHA-256: `20d85f3117a64afdaa4319516cce3079517377d89469817e8fae0c4821060bac`.

## Why this blocks the requested policy

Requiredness must map to the pinned operation/path parameter contract, with local references resolved. Mapping a generated `description` or `value` entry back to `id`, `since`, or `until` would require an additional repair policy. Merely disabling these entries would leave the real parameters undiscoverable and would not satisfy preservation. Silently allowing unmatched entries would violate fail-closed validation.

An initial schema audit counts 133 required and 5,495 optional query-parameter contracts across the 3,522 operations (inherited parameters merged with operation overrides by name/location). These are contract counts, not serialized Postman row counts: arrays may produce repeated rows and objects may legitimately produce property keys. Exact string-key matching alone is therefore insufficient. The audit also found omitted empty-array representations, which require review before promising that every optional parameter remains visible.

## Remaining work

Review the measured [query-only candidate and optional-array visibility gap](query-options-experiment.md) before resuming. The original nesting failure has a supported converter remedy; its global non-query effects exceed the authorized adoption gate. Do not introduce endpoint-specific rewriting, another URL builder, a toolchain upgrade, or a schema patch implicitly.

Both empty environment additions (`tenant_id`, `organization_id`), the global query policy and required-value priorities, fail-closed validation, v2/v3 query equivalence, focused regression tests, dual-format regeneration, and the complete local/hosted acceptance gate remain pending. The current generated artifacts have not been changed by this investigation. Existing Globals, auth-ID normalization, bootstrap, schema/toolchain pins, and operation accounting remain unchanged.

After the implementation gate passes, human Postman Desktop acceptance must verify both Organizations requests start with their bare URLs and optional Params unchecked, required Params remain checked with usable values, optional Params can be deliberately enabled, the new empty variables support local Values without tracked-file changes, and the existing Local View/Globals/bootstrap checks still pass. Hosted validation of this blocker documentation alone does not prove those new behaviors.
