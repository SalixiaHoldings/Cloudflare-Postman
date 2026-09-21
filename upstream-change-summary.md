# Cloudflare API schema update

- Previous revision: `49731bd0592b0c8c2c781b8d15d9f27c7293b210`
- New revision: `73947ddceec8571140469a90a1a35078e10fa054`
- Previous operations: 3540
- New operations: 3565
- Operation delta: +25
- Added: 26
- Removed: 1
- Changed: 261
- Newly deprecated: 0
- Generation: failed: Undeclared partition overlap: DELETE /accounts/{account_id}/workers/observability/issues/groups/{groupId} (accounts-identity-billing, analytics-observability, workers-developer-platform)
- Validation: not run
- Read-only live smoke test: not run; protected credentials are not exposed to this update job

## Added operations

- `DELETE /accounts/{account_id}/workers/observability/issues/groups/{groupId}`
- `DELETE /accounts/{account_id}/workers/observability/issues/groups/{groupId}/members/{issueId}`
- `DELETE /accounts/{account_id}/workers/workers/{worker_id}/previews/{preview_id}`
- `DELETE /accounts/{account_id}/workers/workers/{worker_id}/previews/{preview_id}/deployments/{deployment_id}`
- `GET /accounts/{account_id}/browser-rendering/recording/{session_id}`
- `GET /accounts/{account_id}/browser-rendering/recording/{session_id}/network`
- `GET /accounts/{account_id}/builds/workers/{script_tag}/previews`
- `GET /accounts/{account_id}/builds/workers/{script_tag}/previews/{preview_id}`
- `GET /accounts/{account_id}/builds/workers/{script_tag}/previews/{preview_id}/builds`
- `GET /accounts/{account_id}/security-center/insights/partner-count`
- `GET /accounts/{account_id}/workers/workers/{worker_id}/previews`
- `GET /accounts/{account_id}/workers/workers/{worker_id}/previews/{preview_id}`
- `GET /accounts/{account_id}/workers/workers/{worker_id}/previews/{preview_id}/deployments`
- `GET /accounts/{account_id}/workers/workers/{worker_id}/previews/{preview_id}/deployments/{deployment_id}`
- `GET /zones/{zone_id}/security-center/insights/partner-count`
- `PATCH /accounts/{account_id}/builds/workers/{script_tag}/previews/{preview_id}`
- `PATCH /accounts/{account_id}/workers/workers/{worker_id}/previews/{preview_id}`
- `PATCH /accounts/{account_id}/workers/workers/{worker_id}/previews/{preview_id}/deployments/latest`
- `POST /accounts/{account_id}/builds/workers/{script_tag}/migrate_to_previews`
- `POST /accounts/{account_id}/builds/workers/{script_tag}/previews/{preview_id}/builds`
- `POST /accounts/{account_id}/workers/durable_objects/namespaces/{id}/query/v2`
- `POST /accounts/{account_id}/workers/observability/issues/groups`
- `POST /accounts/{account_id}/workers/observability/issues/groups/{groupId}/members`
- `POST /accounts/{account_id}/workers/workers/{worker_id}/previews`
- `POST /accounts/{account_id}/workers/workers/{worker_id}/previews/{preview_id}/deployments`
- `PUT /accounts/{account_id}/workers/workers/{worker_id}/previews/{preview_id}`

## Removed operations

- `GET /accounts/{account_id}/security-center/insights/count`

## Changed operations

- `DELETE /accounts/{account_id}/ai-gateway/billing/topup/config`
- `DELETE /accounts/{account_id}/ai-gateway/gateways/{gateway_id}/logs`
- `DELETE /accounts/{account_id}/ai-gateway/gateways/{id}`
- `DELETE /accounts/{account_id}/cfd_tunnel/{tunnel_id}`
- `DELETE /accounts/{account_id}/cfd_tunnel/{tunnel_id}/connections`
- `DELETE /accounts/{account_id}/devices/networks/{network_id}`
- `DELETE /accounts/{account_id}/devices/policy/{policy_id}`
- `DELETE /accounts/{account_id}/devices/posture/integration/{integration_id}`
- `DELETE /accounts/{account_id}/devices/posture/{rule_id}`
- `DELETE /accounts/{account_id}/devices/settings`
- `DELETE /accounts/{account_id}/email/routing/addresses/{destination_address_identifier}`
- `DELETE /accounts/{account_id}/firewall/access_rules/rules/{rule_id}`
- `DELETE /accounts/{account_id}/realtime/kit/{app_id}/meetings/{meeting_id}/participants/{participant_id}`
- `DELETE /accounts/{account_id}/realtime/kit/{app_id}/presets/{preset_id}`
- `DELETE /accounts/{account_id}/realtime/kit/{app_id}/webhooks/{webhook_id}`
- `DELETE /user/firewall/access_rules/rules/{rule_id}`
- `DELETE /zones/{zone_id}/email/routing/dns`
- `DELETE /zones/{zone_id}/email/routing/rules/{rule_identifier}`
- `DELETE /zones/{zone_id}/email/sending/subdomains/{subdomain_id}`
- `DELETE /zones/{zone_id}/filters`
- `DELETE /zones/{zone_id}/filters/{filter_id}`
- `DELETE /zones/{zone_id}/firewall/access_rules/rules/{rule_id}`
- `DELETE /zones/{zone_id}/firewall/lockdowns/{lock_downs_id}`
- `DELETE /zones/{zone_id}/firewall/rules`
- `DELETE /zones/{zone_id}/firewall/rules/{rule_id}`
- `DELETE /zones/{zone_id}/firewall/ua_rules/{ua_rule_id}`
- `DELETE /zones/{zone_id}/firewall/waf/overrides/{overrides_id}`
- `DELETE /zones/{zone_id}/rate_limits/{rate_limit_id}`
- `GET /accounts/{account_id}/ai-gateway/gateways`
- `GET /accounts/{account_id}/ai-gateway/gateways/{gateway_id}/logs`
- `GET /accounts/{account_id}/ai-gateway/gateways/{id}`
- `GET /accounts/{account_id}/ai-search/namespaces`
- `GET /accounts/{account_id}/ai-search/namespaces/{name}`
- `GET /accounts/{account_id}/audit_logs`
- `GET /accounts/{account_id}/cfd_tunnel`
- `GET /accounts/{account_id}/cfd_tunnel/{tunnel_id}`
- `GET /accounts/{account_id}/cfd_tunnel/{tunnel_id}/configurations`
- `GET /accounts/{account_id}/cfd_tunnel/{tunnel_id}/connections`
- `GET /accounts/{account_id}/cfd_tunnel/{tunnel_id}/connectors/{connector_id}`
- `GET /accounts/{account_id}/cfd_tunnel/{tunnel_id}/token`
- `GET /accounts/{account_id}/data-security/posture/exports/{id}`
- `GET /accounts/{account_id}/data-security/posture/finding_types`
- `GET /accounts/{account_id}/data-security/posture/finding_types/{finding_type_id}`
- `GET /accounts/{account_id}/data-security/posture/finding_types/{finding_type_id}/remediation_types`
- `GET /accounts/{account_id}/data-security/posture/findings`
- `GET /accounts/{account_id}/data-security/posture/findings/{finding_id}`
- `GET /accounts/{account_id}/data-security/posture/findings/{finding_id}/instances`
- `GET /accounts/{account_id}/data-security/posture/findings/{finding_id}/instances/{instance_id}`
- `GET /accounts/{account_id}/data-security/posture/remediations/jobs`
- `GET /accounts/{account_id}/data-security/posture/webhooks`
- `GET /accounts/{account_id}/data-security/posture/webhooks/{webhook_id}`
- `GET /accounts/{account_id}/devices`
- `GET /accounts/{account_id}/devices/networks`
- `GET /accounts/{account_id}/devices/networks/{network_id}`
- `GET /accounts/{account_id}/devices/policies`
- `GET /accounts/{account_id}/devices/policy`
- `GET /accounts/{account_id}/devices/policy/exclude`
- `GET /accounts/{account_id}/devices/policy/fallback_domains`
- `GET /accounts/{account_id}/devices/policy/include`
- `GET /accounts/{account_id}/devices/policy/{policy_id}`
- `GET /accounts/{account_id}/devices/policy/{policy_id}/exclude`
- `GET /accounts/{account_id}/devices/policy/{policy_id}/fallback_domains`
- `GET /accounts/{account_id}/devices/policy/{policy_id}/include`
- `GET /accounts/{account_id}/devices/posture`
- `GET /accounts/{account_id}/devices/posture/integration`
- `GET /accounts/{account_id}/devices/posture/integration/{integration_id}`
- `GET /accounts/{account_id}/devices/posture/{rule_id}`
- `GET /accounts/{account_id}/devices/resilience/disconnect`
- `GET /accounts/{account_id}/devices/settings`
- `GET /accounts/{account_id}/devices/{device_id}`
- `GET /accounts/{account_id}/devices/{device_id}/override_codes`
- `GET /accounts/{account_id}/email/routing/addresses`
- `GET /accounts/{account_id}/email/routing/addresses/{destination_address_identifier}`
- `GET /accounts/{account_id}/email/routing/rules`
- `GET /accounts/{account_id}/email/sending/limits`
- ...and 186 more

## Newly deprecated operations

None.


## Complete repository gate

- `npm run check`: not run (updater failed)
