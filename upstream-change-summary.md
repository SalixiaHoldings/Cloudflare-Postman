# Cloudflare API schema update

- Previous revision: `73947ddceec8571140469a90a1a35078e10fa054`
- New revision: `7287cb19ea4c5feb93f8dd0a4d8d12872692a802`
- Previous operations: 3565
- New operations: 3594
- Operation delta: +29
- Added: 35
- Removed: 6
- Changed: 125
- Newly deprecated: 6
- Generation: failed: Stale overlap matches: DELETE /accounts/{account_id}/calls/apps/{app_id}
- Validation: not run
- Read-only live smoke test: not run; protected credentials are not exposed to this update job

## Added operations

- `DELETE /zones/{zone_id}/observability/tracing/rules`
- `DELETE /zones/{zone_id}/observability/tracing/settings`
- `DELETE /zones/{zone_id}/pay-per-use/operators/{operator_id}/price`
- `GET /accounts/{account_id}/cloudforce-one/v2/threat-signals/categories`
- `GET /accounts/{account_id}/managed-defense/vulnerability-discovery/repos`
- `GET /accounts/{account_id}/managed-defense/vulnerability-discovery/repos/{repo_id}`
- `GET /accounts/{account_id}/managed-defense/vulnerability-discovery/repos/{repo_id}/scans/{scan_id}/report`
- `GET /accounts/{account_id}/managed-defense/vulnerability-discovery/scans`
- `GET /accounts/{account_id}/managed-defense/vulnerability-discovery/scans/{scan_id}`
- `GET /accounts/{account_id}/managed-defense/vulnerability-discovery/scans/{scan_id}/report`
- `GET /accounts/{account_id}/pay-per-use/enabled-domains`
- `GET /accounts/{account_id}/pay-per-use/operator/configuration`
- `GET /accounts/{account_id}/pay-per-use/proposals`
- `GET /accounts/{account_id}/pay-per-use/usage-stats`
- `GET /accounts/{account_id}/registrar/registrations/{domain_name}/transfer-in-status`
- `GET /zones/{zone_id}/observability/tracing/rules`
- `GET /zones/{zone_id}/observability/tracing/settings`
- `GET /zones/{zone_id}/pay-per-use/can_be_enabled`
- `GET /zones/{zone_id}/pay-per-use/configuration`
- `GET /zones/{zone_id}/pay-per-use/operators`
- `GET /zones/{zone_id}/pay-per-use/usage-stats`
- `PATCH /accounts/{account_id}/pay-per-use/operator/configuration`
- `PATCH /accounts/{account_id}/pay-per-use/zones_can_be_enabled`
- `PATCH /zones/{zone_id}/observability/tracing/settings`
- `PATCH /zones/{zone_id}/pay-per-use/configuration`
- `POST /accounts/{account_id}/ai/websearch`
- `POST /accounts/{account_id}/managed-defense/vulnerability-discovery/repos`
- `POST /accounts/{account_id}/managed-defense/vulnerability-discovery/scans`
- `POST /accounts/{account_id}/pay-per-use/proposals`
- `POST /accounts/{account_id}/pay-per-use/usage-reports`
- `POST /accounts/{account_id}/registrar/registrations/{domain_name}/transfer-in`
- `POST /zones/{zone_id}/pay-per-use/operators/{operator_id}/price`
- `PUT /accounts/{account_id}/pay-per-use/operator/configuration`
- `PUT /organizations/{organization_id}/invites/{member_code}`
- `PUT /zones/{zone_id}/observability/tracing/rules`

## Removed operations

- `DELETE /accounts/{account_id}/workers/observability/zones/{zone_id}/observability/tracing/rules`
- `DELETE /accounts/{account_id}/workers/observability/zones/{zone_id}/observability/tracing/settings`
- `GET /accounts/{account_id}/workers/observability/zones/{zone_id}/observability/tracing/rules`
- `GET /accounts/{account_id}/workers/observability/zones/{zone_id}/observability/tracing/settings`
- `PATCH /accounts/{account_id}/workers/observability/zones/{zone_id}/observability/tracing/settings`
- `PUT /accounts/{account_id}/workers/observability/zones/{zone_id}/observability/tracing/rules`

## Changed operations

- `DELETE /accounts/{account_id}/ai-gateway/gateways/{id}`
- `DELETE /accounts/{account_id}/calls/apps/{app_id}`
- `DELETE /accounts/{account_id}/calls/turn_keys/{key_id}`
- `DELETE /accounts/{account_id}/d1/database/{database_id}`
- `DELETE /accounts/{account_id}/devices/posture/integration/{integration_id}`
- `DELETE /accounts/{account_id}/devices/posture/{rule_id}`
- `DELETE /accounts/{account_id}/devices/settings`
- `DELETE /accounts/{account_id}/event_subscriptions/subscriptions/{subscription_id}`
- `DELETE /accounts/{account_id}/moq/relays/{relay_id}`
- `DELETE /accounts/{account_id}/moq/relays/{relay_id}/tokens/{jti}`
- `DELETE /accounts/{account_id}/queues/{queue_id}`
- `DELETE /accounts/{account_id}/queues/{queue_id}/consumers/{consumer_id}`
- `DELETE /accounts/{account_id}/workers/observability/issues/groups/{groupId}/members/{issueId}`
- `DELETE /organizations/{organization_id}`
- `GET /accounts/{account_id}/ai-gateway/gateways`
- `GET /accounts/{account_id}/ai-gateway/gateways/{id}`
- `GET /accounts/{account_id}/calls/apps`
- `GET /accounts/{account_id}/calls/apps/{app_id}`
- `GET /accounts/{account_id}/calls/turn_keys`
- `GET /accounts/{account_id}/calls/turn_keys/{key_id}`
- `GET /accounts/{account_id}/cloudforce-one/events/dataset/{dataset_id}/indicators`
- `GET /accounts/{account_id}/cloudforce-one/events/indicators`
- `GET /accounts/{account_id}/cloudforce-one/v2/requests/{project_type}`
- `GET /accounts/{account_id}/cloudforce-one/v2/requests/{project_type}/{request_id}`
- `GET /accounts/{account_id}/cloudforce-one/v2/threat-signals/articles`
- `GET /accounts/{account_id}/d1/database`
- `GET /accounts/{account_id}/d1/database/{database_id}`
- `GET /accounts/{account_id}/d1/database/{database_id}/time_travel/bookmark`
- `GET /accounts/{account_id}/devices/policies`
- `GET /accounts/{account_id}/devices/posture`
- `GET /accounts/{account_id}/devices/posture/integration`
- `GET /accounts/{account_id}/devices/posture/integration/{integration_id}`
- `GET /accounts/{account_id}/devices/posture/{rule_id}`
- `GET /accounts/{account_id}/devices/resilience/disconnect`
- `GET /accounts/{account_id}/devices/settings`
- `GET /accounts/{account_id}/event_subscriptions/subscriptions`
- `GET /accounts/{account_id}/event_subscriptions/subscriptions/{subscription_id}`
- `GET /accounts/{account_id}/magic/connectors/{connector_id}/telemetry/events`
- `GET /accounts/{account_id}/moq/relays`
- `GET /accounts/{account_id}/moq/relays/{relay_id}`
- `GET /accounts/{account_id}/moq/relays/{relay_id}/tokens`
- `GET /accounts/{account_id}/queues`
- `GET /accounts/{account_id}/queues/{queue_id}`
- `GET /accounts/{account_id}/queues/{queue_id}/consumers`
- `GET /accounts/{account_id}/queues/{queue_id}/consumers/{consumer_id}`
- `GET /accounts/{account_id}/queues/{queue_id}/metrics`
- `GET /accounts/{account_id}/queues/{queue_id}/purge`
- `GET /accounts/{account_id}/registrar-sandbox/registrations/{domain_name}/registration-status`
- `GET /accounts/{account_id}/registrar/registrations/{domain_name}/registration-status`
- `GET /accounts/{account_id}/urlscanner/v2/search`
- `GET /accounts/{account_id}/workers/observability/issues`
- `GET /accounts/{account_id}/workers/observability/issues/{issueId}`
- `GET /user/spectrum_analytics/zones/report`
- `GET /zones/{zone_id}/spectrum/analytics/aggregate/current`
- `GET /zones/{zone_id}/spectrum/analytics/events/bytime`
- `GET /zones/{zone_id}/spectrum/analytics/events/summary`
- `PATCH /accounts/{account_id}/cloudforce-one/v2/threat-signals/curated-feeds/{curated_feed_id}`
- `PATCH /accounts/{account_id}/cloudforce-one/v2/threat-signals/feeds/{feed_id}`
- `PATCH /accounts/{account_id}/cloudforce-one/v2/threat-signals/skills/{skill_id}`
- `PATCH /accounts/{account_id}/d1/database/{database_id}`
- `PATCH /accounts/{account_id}/devices/policy`
- `PATCH /accounts/{account_id}/devices/policy/{policy_id}`
- `PATCH /accounts/{account_id}/devices/posture/integration/{integration_id}`
- `PATCH /accounts/{account_id}/devices/settings`
- `PATCH /accounts/{account_id}/event_subscriptions/subscriptions/{subscription_id}`
- `PATCH /accounts/{account_id}/pay-per-crawl/zones_can_be_enabled`
- `PATCH /accounts/{account_id}/queues/{queue_id}`
- `PATCH /accounts/{account_id}/workers/observability/issues/{issueId}`
- `PATCH /zones/{zone_id}/devices/policy/certificates`
- `POST /accounts/{account_id}/ai-gateway/gateways`
- `POST /accounts/{account_id}/billable/usage`
- `POST /accounts/{account_id}/calls/apps`
- `POST /accounts/{account_id}/calls/turn_keys`
- `POST /accounts/{account_id}/cloudforce-one/events/create`
- `POST /accounts/{account_id}/cloudforce-one/v2/requests/{project_type}`
- ...and 50 more

## Newly deprecated operations

- `POST /accounts/{account_id}/devices/physical-devices/{device_id}/revoke`
- `POST /accounts/{account_id}/devices/registrations/revoke`
- `POST /accounts/{account_id}/devices/registrations/unrevoke`
- `POST /accounts/{account_id}/queues/{queue_id}/messages/preview`
- `POST /accounts/{account_id}/queues/{queue_id}/messages/preview/ack`
- `PUT /accounts/{account_id}/devices/settings`


## Complete repository gate

- `npm run check`: not run (updater failed)
