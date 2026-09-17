# Cloudflare Postman API Library

An independent distribution of modular Postman collections generated from Cloudflare's official [API schema](https://github.com/cloudflare/api-schemas) and maintained by [**Salixia Web & Cloud**](https://www.salixia.io/), an operating company of Salixia Holdings. This is not an official Cloudflare product and is not endorsed by Cloudflare.

## Quick start — Import into Postman

1. Import one or more collections from `dist/v2.1/reference/`.
2. Import `dist/v2.1/environments/cloudflare.template.postman_environment.json` and select **Cloudflare API — Template**.
3. Set only the local values you need. Prefer `api_token` where supported; some requests require `api_email` + `api_key` or another declared credential.
4. Set required resource selectors such as `account_id`, `zone_id`, `tenant_id`, or `organization_id`.
5. Inspect the request, parameters, authentication, and payload before clicking **Send**.

`base_url` is intentionally populated and may remain Shared/tracked. **Never Share or commit credentials, API keys/tokens, or real resource identifiers.** Keep `api_token`, `api_email`, `api_key`, `user_service_key`, account/zone/tenant/organization IDs, and any other sensitive values local only.

## Local Mode / Native Git (Postman v12+)

1. Clone the repository, open its root in Postman desktop, and switch to **Local View**.
2. Select **Cloudflare API — Template**.
3. Enter credentials and resource selectors only in Postman's local **Value** fields, never **Shared** values.
4. Confirm `git status` stays clean after setting local values.

No Postman Cloud connection is required. `.postman/` workspace-binding state stays local and ignored. See [Native Git usage and generation](docs/native-git.md).

An empty **Globals** entity is generated intentionally. This project uses collection/environment variables and defines no shared workspace globals.

## Which collection should I import?

Files below are in `dist/v2.1/reference/` and end in `.postman_collection.json`.

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

Generated requests follow the pinned Cloudflare OpenAPI authentication declaration. API tokens are preferred where the schema supports them, but some operations require other credentials. All credential fields ship empty.

Read the request's authentication notice before sending it. See the [authentication policy](docs/architecture.md#authentication-contract) for details.

## Query defaults

Required query Params are enabled. Optional Params emitted by the official converter are visible but unchecked, so default URLs contain only required Params. Enable optional filters deliberately. See the [query policy](docs/query-policy.md) for known converter limitations.

## Optional account/zone bootstrap

Import `dist/v2.1/workflows/bootstrap.postman_collection.json` to verify a token and resolve account/zone IDs. Run the **whole collection from its first request in Collection Runner** so pagination and request routing work.

The pinned account-list operation requires local `api_email` and `api_key`; token verification and zone listing use `api_token`. If you do not want to supply legacy credentials, set account/zone IDs manually and use token-supported reference requests. See [bootstrap details](docs/architecture.md#paginated-postman-bootstrap).

## Safety

Reference collections include **read and write operations**. Importing them executes nothing. Use least-privilege credentials and inspect every request before sending it. Do not run an entire reference collection as a workflow.

## Updating / developing

Use Node.js 24:

```sh
npm ci
npm run generate
npm run check
```

Generated files must not be edited by hand. See [CONTRIBUTING.md](CONTRIBUTING.md) and [architecture and maintenance](docs/architecture.md). Report vulnerabilities through [SECURITY.md](SECURITY.md).

## License / provenance

Project code is [BSD-3-Clause licensed](LICENSE). Collections are generated from Cloudflare's BSD-3-Clause API schema, pinned by exact commit and SHA-256 in `schema-lock.json`. Required attribution and tool notices are in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
