# Cloudflare API schema update

- Previous revision: `7287cb19ea4c5feb93f8dd0a4d8d12872692a802`
- New revision: `605b68d2b5c385403e8d2667628c86a19a0f2055`
- Previous operations: 3594
- New operations: 3600
- Operation delta: +6
- Added: 24
- Removed: 18
- Changed: 136
- Newly deprecated: 1
- Generation: failed: Undeclared partition overlap: DELETE /accounts/{account_id}/devices/policy/{policy_id}/exclude (accounts-identity-billing, zero-trust)
- Validation: not run
- Read-only live smoke test: not run; protected credentials are not exposed to this update job

## Added operations

- `DELETE /accounts/{account_id}/custom_pages/assets/{asset_name}`
- `DELETE /accounts/{account_id}/devices/policy/exclude`
- `DELETE /accounts/{account_id}/devices/policy/fallback_domains`
- `DELETE /accounts/{account_id}/devices/policy/{policy_id}/exclude`
- `DELETE /accounts/{account_id}/devices/policy/{policy_id}/fallback_domains`
- `DELETE /zones/{zone_id}/custom_pages/assets/{asset_name}`
- `GET /accounts/{account_id}/custom_pages`
- `GET /accounts/{account_id}/custom_pages/assets`
- `GET /accounts/{account_id}/custom_pages/assets/{asset_name}`
- `GET /accounts/{account_id}/custom_pages/{identifier}`
- `GET /zones/{zone_id}/custom_pages`
- `GET /zones/{zone_id}/custom_pages/assets`
- `GET /zones/{zone_id}/custom_pages/assets/{asset_name}`
- `GET /zones/{zone_id}/custom_pages/{identifier}`
- `PATCH /accounts/{account_id}/devices/physical-devices/{device_id}`
- `POST /accounts/{account_id}/custom_pages/assets`
- `POST /accounts/{account_id}/custom_pages/preview_tokens`
- `POST /accounts/{account_id}/devices/override_codes`
- `POST /zones/{zone_id}/custom_pages/assets`
- `POST /zones/{zone_id}/custom_pages/preview_tokens`
- `PUT /accounts/{account_id}/custom_pages/assets/{asset_name}`
- `PUT /accounts/{account_id}/custom_pages/{identifier}`
- `PUT /zones/{zone_id}/custom_pages/assets/{asset_name}`
- `PUT /zones/{zone_id}/custom_pages/{identifier}`

## Removed operations

- `DELETE /accounts/{account_identifier}/custom_pages/assets/{asset_name}`
- `DELETE /zones/{zone_identifier}/custom_pages/assets/{asset_name}`
- `GET /accounts/{account_identifier}/custom_pages`
- `GET /accounts/{account_identifier}/custom_pages/assets`
- `GET /accounts/{account_identifier}/custom_pages/assets/{asset_name}`
- `GET /accounts/{account_identifier}/custom_pages/{identifier}`
- `GET /zones/{zone_identifier}/custom_pages`
- `GET /zones/{zone_identifier}/custom_pages/assets`
- `GET /zones/{zone_identifier}/custom_pages/assets/{asset_name}`
- `GET /zones/{zone_identifier}/custom_pages/{identifier}`
- `POST /accounts/{account_identifier}/custom_pages/assets`
- `POST /accounts/{account_identifier}/custom_pages/preview_tokens`
- `POST /zones/{zone_identifier}/custom_pages/assets`
- `POST /zones/{zone_identifier}/custom_pages/preview_tokens`
- `PUT /accounts/{account_identifier}/custom_pages/assets/{asset_name}`
- `PUT /accounts/{account_identifier}/custom_pages/{identifier}`
- `PUT /zones/{zone_identifier}/custom_pages/assets/{asset_name}`
- `PUT /zones/{zone_identifier}/custom_pages/{identifier}`

## Changed operations

- `DELETE /accounts/{account_id}/ai-gateway/gateways/{id}`
- `DELETE /accounts/{account_id}/browser-rendering/crawl/{job_id}`
- `DELETE /accounts/{account_id}/browser-rendering/devtools/browser/{session_id}`
- `DELETE /accounts/{account_id}/devices/deployment-groups/{group_id}`
- `DELETE /accounts/{account_id}/devices/policy/{policy_id}`
- `DELETE /accounts/{account_id}/images/v1/keys/{signing_key_name}`
- `DELETE /accounts/{account_id}/images/v1/variants/{variant_id}`
- `DELETE /accounts/{account_id}/images/v1/{image_id}`
- `DELETE /accounts/{account_id}/images/v2/sourcingkit/migrations/{migration_id}`
- `DELETE /accounts/{account_id}/images/v2/sourcingkit/sources/{source_id}`
- `DELETE /accounts/{account_id}/logs/explorer/datasets/{dataset_id}`
- `DELETE /accounts/{account_id}/workers/dispatch/namespaces/{dispatch_namespace}/scripts/{script_name}`
- `DELETE /accounts/{account_id}/workers/scripts/{script_name}`
- `DELETE /accounts/{account_id}/workers/workers/{worker_id}`
- `DELETE /accounts/{account_id}/workers/workers/{worker_id}/previews/{preview_id}`
- `DELETE /zones/{zone_id}/logs/explorer/datasets/{dataset_id}`
- `DELETE /zones/{zone_id}/waiting_rooms/{waiting_room_id}`
- `DELETE /zones/{zone_id}/waiting_rooms/{waiting_room_id}/events/{event_id}`
- `DELETE /zones/{zone_id}/waiting_rooms/{waiting_room_id}/rules/{rule_id}`
- `GET /accounts/{account_id}/ai-gateway/gateways`
- `GET /accounts/{account_id}/ai-gateway/gateways/{id}`
- `GET /accounts/{account_id}/browser-rendering/crawl/{job_id}`
- `GET /accounts/{account_id}/browser-rendering/devtools/browser`
- `GET /accounts/{account_id}/browser-rendering/devtools/browser/{session_id}`
- `GET /accounts/{account_id}/browser-rendering/devtools/browser/{session_id}/json`
- `GET /accounts/{account_id}/browser-rendering/devtools/browser/{session_id}/json/activate/{target_id}`
- `GET /accounts/{account_id}/browser-rendering/devtools/browser/{session_id}/json/close/{target_id}`
- `GET /accounts/{account_id}/browser-rendering/devtools/browser/{session_id}/json/list`
- `GET /accounts/{account_id}/browser-rendering/devtools/browser/{session_id}/json/list/{target_id}`
- `GET /accounts/{account_id}/browser-rendering/devtools/browser/{session_id}/json/protocol`
- `GET /accounts/{account_id}/browser-rendering/devtools/browser/{session_id}/json/version`
- `GET /accounts/{account_id}/browser-rendering/devtools/browser/{session_id}/page/{target_id}`
- `GET /accounts/{account_id}/browser-rendering/devtools/session`
- `GET /accounts/{account_id}/browser-rendering/devtools/session/{session_id}`
- `GET /accounts/{account_id}/browser-rendering/recording/{session_id}`
- `GET /accounts/{account_id}/browser-rendering/recording/{session_id}/network`
- `GET /accounts/{account_id}/builds/builds/latest`
- `GET /accounts/{account_id}/cloudforce-one/rules/search`
- `GET /accounts/{account_id}/devices/client-versions`
- `GET /accounts/{account_id}/devices/client-versions/target-environments`
- `GET /accounts/{account_id}/devices/deployment-groups`
- `GET /accounts/{account_id}/devices/deployment-groups/{group_id}`
- `GET /accounts/{account_id}/devices/physical-devices`
- `GET /accounts/{account_id}/devices/policies`
- `GET /accounts/{account_id}/devices/policy`
- `GET /accounts/{account_id}/devices/policy/exclude`
- `GET /accounts/{account_id}/devices/policy/fallback_domains`
- `GET /accounts/{account_id}/devices/policy/include`
- `GET /accounts/{account_id}/devices/policy/{policy_id}`
- `GET /accounts/{account_id}/devices/policy/{policy_id}/exclude`
- `GET /accounts/{account_id}/devices/policy/{policy_id}/fallback_domains`
- `GET /accounts/{account_id}/devices/policy/{policy_id}/include`
- `GET /accounts/{account_id}/images/v1/keys`
- `GET /accounts/{account_id}/images/v1/stats`
- `GET /accounts/{account_id}/images/v1/variants`
- `GET /accounts/{account_id}/images/v1/variants/{variant_id}`
- `GET /accounts/{account_id}/images/v1/variants/{variant_id}/flat`
- `GET /accounts/{account_id}/images/v1/{image_id}`
- `GET /accounts/{account_id}/images/v1/{image_id}/blob`
- `GET /accounts/{account_id}/images/v2`
- `GET /accounts/{account_id}/images/v2/sourcingkit/migrations`
- `GET /accounts/{account_id}/images/v2/sourcingkit/migrations/{migration_id}`
- `GET /accounts/{account_id}/images/v2/sourcingkit/migrations/{migration_id}/lifecycle`
- `GET /accounts/{account_id}/images/v2/sourcingkit/migrations/{migration_id}/logs`
- `GET /accounts/{account_id}/images/v2/sourcingkit/sources`
- `GET /accounts/{account_id}/images/v2/sourcingkit/sources/{source_id}`
- `GET /accounts/{account_id}/images/v2/sourcingkit/sources/{source_id}/connectivity`
- `GET /accounts/{account_id}/logs/explorer/datasets`
- `GET /accounts/{account_id}/logs/explorer/datasets/available`
- `GET /accounts/{account_id}/logs/explorer/datasets/{dataset_id}`
- `GET /accounts/{account_id}/logs/explorer/query/sql`
- `GET /accounts/{account_id}/registrar-sandbox/extensions`
- `GET /accounts/{account_id}/registrar-sandbox/extensions/{extension}`
- `GET /accounts/{account_id}/registrar/extensions`
- `GET /accounts/{account_id}/registrar/extensions/{extension}`
- ...and 61 more

## Newly deprecated operations

- `GET /accounts/{account_id}/images/v1/variants/{variant_id}/flat`


## Complete repository gate

- `npm run check`: not run (updater failed)
