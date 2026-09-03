# Cloudflare Postman API Library

An independent, Salixia-maintained distribution of modular Postman collections generated from Cloudflare's official [API schema](https://github.com/cloudflare/api-schemas). This is not an official Cloudflare product and is not endorsed by Cloudflare.

## Quick start — Import into Postman

1. Clone or download this repository.
2. Open Postman.
3. Click **Import**.
4. Choose **Files** (or the file picker in the import window).
5. Import one or more collection files from `postman/reference/`; use the table below to choose.
6. Import `postman/environments/cloudflare.template.postman_environment.json`.
7. Select the imported **Cloudflare API — Template** environment.
8. Add your Cloudflare credential values locally; normally begin with `api_token`.
9. Set `account_id` and/or `zone_id` when the request requires them, along with any other request parameters.
10. Open a request, inspect its authentication and payload, and click **Send**.

Keep populated environments local/private. Do not commit them or export them publicly.

## Which collection should I import?

Files below are in `postman/reference/` and end in `.postman_collection.json`.

| File basename | Common uses |
| --- | --- |
| `accounts-identity-billing` | Accounts, identity, memberships, tokens, billing |
| `zones-dns-domains` | Zones, DNS, domains, certificates, caching |
| `workers-developer-platform` | Workers, Pages, AI, Queues, developer APIs |
| `storage-data` | R2, D1, KV, Vectorize, data storage |
| `application-security-rulesets` | WAF, rulesets, API protection, application security |
| `zero-trust` | Access, Gateway, devices, tunnels |
| `analytics-observability` | Analytics, Radar, logs, alerts |
| `network-services` | Networking, IP addressing, traffic services |
| `media-communications` | Images, Stream, email, communications |
| `other-cloudflare-services` | Remaining upstream operations outside the product groups |

## Authentication

Cloudflare API tokens are preferred wherever the official schema supports them. Some operations declare different requirements; each generated request follows the pinned Cloudflare OpenAPI declaration instead of assuming Bearer authentication everywhere. All credential fields in the environment template ship empty.

Read the request's authentication notice before sending it. See the [detailed authentication policy](docs/architecture.md#authentication-contract) for the full matrix and edge cases.

## Optional account/zone bootstrap

Import `postman/workflows/bootstrap.postman_collection.json` to verify a token and resolve account/zone IDs. Run the **whole collection from its first request in Collection Runner**, not individual Send requests, so pagination works.

The pinned account-list operation requires local `api_email` and `api_key` values; token verification and zone listing use `api_token`. If you do not want to supply legacy credentials, set account/zone IDs manually and use token-supported reference requests. See [bootstrap details](docs/architecture.md#paginated-postman-bootstrap).

## Safety

Reference collections include **read and write operations**. Importing them executes nothing. Use least-privilege credentials and inspect the endpoint, authentication, parameters, and payload before sending a request. Do not run an entire reference collection as a workflow.

## Updating / developing

Use Node.js 24:

```sh
npm ci
npm run generate
npm run check
```

Generated files must not be edited by hand. See [CONTRIBUTING.md](CONTRIBUTING.md) and [architecture and maintenance](docs/architecture.md) for provenance, deterministic generation, validation, upstream updates, and known limitations. Report vulnerabilities through the process in [SECURITY.md](SECURITY.md).

## License / provenance

Project code is [BSD-3-Clause licensed](LICENSE). Collections are generated from Cloudflare's BSD-3-Clause API schema, pinned by exact commit and SHA-256 in `schema-lock.json`. Required attribution and tool notices are in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
