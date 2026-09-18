# Cloudflare API schema update

- Previous revision: `1cf9b4dcf3241bef73d3300b045cb01543cc7a5f`
- New revision: `a0eceeef8288f2fea2c3115a232ddf23e43d8540`
- Previous operations: 3522
- New operations: 3540
- Operation delta: +18
- Added: 18
- Removed: 0
- Changed: 310
- Newly deprecated: 13
- Generation: failed: Undeclared partition overlap: DELETE /accounts/{account_id}/r2/buckets/{bucket_name}/lock (accounts-identity-billing, storage-data)
- Validation: not run
- Read-only live smoke test: not run; protected credentials are not exposed to this update job

## Added operations

- `DELETE /accounts/{account_id}/r2/buckets/{bucket_name}/lock`
- `DELETE /accounts/{account_id}/workers/observability/issues/automations/{automationId}`
- `DELETE /accounts/{account_id}/workers/observability/zones/{zone_id}/observability/tracing/rules`
- `DELETE /accounts/{account_id}/workers/observability/zones/{zone_id}/observability/tracing/settings`
- `GET /accounts/{account_id}/billable/usage/billable-metrics`
- `GET /accounts/{account_id}/workers/observability/issues`
- `GET /accounts/{account_id}/workers/observability/issues/automations`
- `GET /accounts/{account_id}/workers/observability/issues/automations/{automationId}`
- `GET /accounts/{account_id}/workers/observability/issues/summary`
- `GET /accounts/{account_id}/workers/observability/issues/{issueId}`
- `GET /accounts/{account_id}/workers/observability/issues/{issueId}/occurrences`
- `GET /accounts/{account_id}/workers/workers/{worker_id}/versions/latest`
- `PATCH /accounts/{account_id}/workers/observability/issues/{issueId}`
- `POST /accounts/{account_id}/browser-extension/config/logs/extension-events/search`
- `POST /accounts/{account_id}/workers/observability/issues/automations`
- `POST /accounts/{account_id}/workers/observability/issues/{issueId}/notification-runs`
- `PUT /accounts/{account_id}/scim/v2/Groups/{group_id}`
- `PUT /accounts/{account_id}/workers/observability/issues/automations/{automationId}`

## Removed operations

None.

## Changed operations

- `DELETE /accounts/{account_id}/ai-gateway/gateways/{id}`
- `DELETE /accounts/{account_id}/ai-search/instances/{id}`
- `DELETE /accounts/{account_id}/browser-extension/config`
- `DELETE /accounts/{account_id}/email/sending/suppressions/{suppression_id}`
- `DELETE /accounts/{account_id}/event_notifications/r2/{bucket_name}/configuration/queues/{queue_id}`
- `DELETE /accounts/{account_id}/gateway/certificates/{certificate_id}`
- `DELETE /accounts/{account_id}/gateway/lists/{list_id}`
- `DELETE /accounts/{account_id}/gateway/locations/{location_id}`
- `DELETE /accounts/{account_id}/gateway/proxy_endpoints/{proxy_endpoint_id}`
- `DELETE /accounts/{account_id}/gateway/rules/{rule_id}`
- `DELETE /accounts/{account_id}/r2/buckets/{bucket_name}`
- `DELETE /accounts/{account_id}/r2/buckets/{bucket_name}/cors`
- `DELETE /accounts/{account_id}/r2/buckets/{bucket_name}/domains/custom/{domain}`
- `DELETE /accounts/{account_id}/r2/buckets/{bucket_name}/objects`
- `DELETE /accounts/{account_id}/r2/buckets/{bucket_name}/objects/{object_key}`
- `DELETE /accounts/{account_id}/r2/buckets/{bucket_name}/sippy`
- `DELETE /accounts/{account_id}/resource-library/applications/{id}`
- `DELETE /accounts/{account_id}/shares/{share_id}`
- `DELETE /accounts/{account_id}/shares/{share_id}/recipients/{recipient_id}`
- `DELETE /accounts/{account_id}/shares/{share_id}/resources/{share_resource_id}`
- `DELETE /accounts/{account_id}/workers/dispatch/namespaces/{dispatch_namespace}`
- `DELETE /accounts/{account_id}/workers/dispatch/namespaces/{dispatch_namespace}/scripts`
- `DELETE /accounts/{account_id}/workers/dispatch/namespaces/{dispatch_namespace}/scripts/{script_name}`
- `DELETE /accounts/{account_id}/workers/dispatch/namespaces/{dispatch_namespace}/scripts/{script_name}/secrets/{secret_name}`
- `DELETE /accounts/{account_id}/workers/dispatch/namespaces/{dispatch_namespace}/scripts/{script_name}/tags/{tag}`
- `DELETE /accounts/{account_id}/workers/domains/{domain_id}`
- `DELETE /accounts/{account_id}/workers/scripts/{script_name}`
- `DELETE /accounts/{account_id}/workers/scripts/{script_name}/deployments/{deployment_id}`
- `DELETE /accounts/{account_id}/workers/scripts/{script_name}/secrets/{secret_name}`
- `DELETE /accounts/{account_id}/workers/scripts/{script_name}/subdomain`
- `DELETE /accounts/{account_id}/workers/scripts/{script_name}/tails/{id}`
- `DELETE /accounts/{account_id}/workers/subdomain`
- `DELETE /accounts/{account_id}/workers/workers/{worker_id}`
- `DELETE /accounts/{account_id}/workers/workers/{worker_id}/versions/{version_id}`
- `DELETE /zones/{zone_id}/dns_records/{dns_record_id}`
- `DELETE /zones/{zone_id}/workers/routes/{route_id}`
- `GET /accounts/{account_identifier}/custom_pages`
- `GET /accounts/{account_identifier}/custom_pages/assets`
- `GET /accounts/{account_identifier}/custom_pages/assets/{asset_name}`
- `GET /accounts/{account_identifier}/custom_pages/{identifier}`
- `GET /accounts/{account_id}/ai-gateway/gateways`
- `GET /accounts/{account_id}/ai-gateway/gateways/{id}`
- `GET /accounts/{account_id}/ai-search/instances`
- `GET /accounts/{account_id}/ai-search/instances/{id}`
- `GET /accounts/{account_id}/ai-search/instances/{id}/jobs`
- `GET /accounts/{account_id}/ai-search/instances/{id}/jobs/{job_id}`
- `GET /accounts/{account_id}/ai-search/instances/{id}/jobs/{job_id}/logs`
- `GET /accounts/{account_id}/ai-search/instances/{id}/stats`
- `GET /accounts/{account_id}/ai-search/namespaces/{name}/instances/{id}/items`
- `GET /accounts/{account_id}/browser-extension/config`
- `GET /accounts/{account_id}/browser-extension/config/inventories`
- `GET /accounts/{account_id}/browser-extension/config/inventories/{registration_id}`
- `GET /accounts/{account_id}/browser-rendering/devtools/session`
- `GET /accounts/{account_id}/devices/physical-devices`
- `GET /accounts/{account_id}/devices/registrations`
- `GET /accounts/{account_id}/email/sending/suppressions`
- `GET /accounts/{account_id}/email/sending/suppressions/{suppression_id}`
- `GET /accounts/{account_id}/event_notifications/r2/{bucket_name}/configuration`
- `GET /accounts/{account_id}/event_notifications/r2/{bucket_name}/configuration/queues/{queue_id}`
- `GET /accounts/{account_id}/gateway/lists`
- `GET /accounts/{account_id}/gateway/locations`
- `GET /accounts/{account_id}/gateway/proxy_endpoints`
- `GET /accounts/{account_id}/gateway/rules`
- `GET /accounts/{account_id}/gateway/rules/{rule_id}`
- `GET /accounts/{account_id}/one/applications/{application_id}/auth-methods`
- `GET /accounts/{account_id}/one/applications/{application_id}/setup-flows`
- `GET /accounts/{account_id}/r2/buckets`
- `GET /accounts/{account_id}/r2/buckets/{bucket_name}`
- `GET /accounts/{account_id}/r2/buckets/{bucket_name}/cors`
- `GET /accounts/{account_id}/r2/buckets/{bucket_name}/domains/custom`
- `GET /accounts/{account_id}/r2/buckets/{bucket_name}/domains/custom/{domain}`
- `GET /accounts/{account_id}/r2/buckets/{bucket_name}/domains/managed`
- `GET /accounts/{account_id}/r2/buckets/{bucket_name}/jobs`
- `GET /accounts/{account_id}/r2/buckets/{bucket_name}/jobs/{job_id}`
- `GET /accounts/{account_id}/r2/buckets/{bucket_name}/lifecycle`
- ...and 235 more

## Newly deprecated operations

- `DELETE /accounts/{account_id}/ai-search/instances/{id}`
- `GET /accounts/{account_id}/ai-search/instances`
- `GET /accounts/{account_id}/ai-search/instances/{id}`
- `GET /accounts/{account_id}/ai-search/instances/{id}/jobs`
- `GET /accounts/{account_id}/ai-search/instances/{id}/jobs/{job_id}`
- `GET /accounts/{account_id}/ai-search/instances/{id}/jobs/{job_id}/logs`
- `GET /accounts/{account_id}/ai-search/instances/{id}/stats`
- `PATCH /accounts/{account_id}/ai-search/instances/{id}/jobs/{job_id}`
- `POST /accounts/{account_id}/ai-search/instances`
- `POST /accounts/{account_id}/ai-search/instances/{id}/chat/completions`
- `POST /accounts/{account_id}/ai-search/instances/{id}/jobs`
- `POST /accounts/{account_id}/ai-search/instances/{id}/search`
- `PUT /accounts/{account_id}/ai-search/instances/{id}`

