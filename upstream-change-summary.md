# Cloudflare API schema update

- Previous revision: `ff63b6a722de89a1c19074b1f9749d98ef6633bd`
- New revision: `1cf9b4dcf3241bef73d3300b045cb01543cc7a5f`
- Previous operations: 3444
- New operations: 3522
- Operation delta: +78
- Added: 81
- Removed: 3
- Changed: 792
- Newly deprecated: 10
- Generation: passed; complete distribution regenerated from the fixed revision
- Validation: passed; full local checks and byte-identical regeneration (Node 24)
- Read-only live smoke test: not run; protected credentials are not exposed to this update job

## Added operations

- `DELETE /accounts/{account_id}/addressing/address_maps/{address_map_id}/accounts/{member_account_id}`
- `DELETE /accounts/{account_id}/artifacts/namespaces/{namespace}`
- `DELETE /accounts/{account_id}/cloudforce-one/events/datasets/{dataset_id}/events`
- `DELETE /accounts/{account_id}/cloudforce-one/events/event-categories/by-id/{category_id}`
- `DELETE /accounts/{account_id}/cloudforce-one/events/tag-categories/{category_uuid}`
- `DELETE /accounts/{account_id}/cloudforce-one/v2/credential-monitor/domains/{id}`
- `DELETE /accounts/{account_id}/cloudforce-one/v2/priority-intelligence/interests/{interest_id}`
- `DELETE /accounts/{account_id}/cloudforce-one/v2/priority-intelligence/{priority_id}`
- `DELETE /accounts/{account_id}/field_extractors/{extractor}`
- `GET /accounts/{account_id}/agent-memory/namespaces/{namespace_name}/profiles`
- `GET /accounts/{account_id}/browser-extension/config/inventories`
- `GET /accounts/{account_id}/browser-extension/config/inventories/{registration_id}`
- `GET /accounts/{account_id}/cloudforce-one/events/by-id/{event_id}/relationships`
- `GET /accounts/{account_id}/cloudforce-one/events/datasets/{dataset_id}/events/{event_id}/raw`
- `GET /accounts/{account_id}/cloudforce-one/events/event-categories/by-id/{category_id}`
- `GET /accounts/{account_id}/cloudforce-one/events/tag-categories/{category_uuid}`
- `GET /accounts/{account_id}/cloudforce-one/events/tags/categories/actors`
- `GET /accounts/{account_id}/cloudforce-one/v2/credential-monitor/domains`
- `GET /accounts/{account_id}/cloudforce-one/v2/credential-monitor/matches`
- `GET /accounts/{account_id}/cloudforce-one/v2/priority-intelligence`
- `GET /accounts/{account_id}/cloudforce-one/v2/priority-intelligence/constants`
- `GET /accounts/{account_id}/cloudforce-one/v2/priority-intelligence/interests`
- `GET /accounts/{account_id}/cloudforce-one/v2/priority-intelligence/interests/backtests/{backtest_id}`
- `GET /accounts/{account_id}/cloudforce-one/v2/priority-intelligence/interests/evaluations/{evaluation_id}`
- `GET /accounts/{account_id}/cloudforce-one/v2/priority-intelligence/{priority_id}`
- `GET /accounts/{account_id}/cloudforce-one/v2/requests/legal-response/access-check`
- `GET /accounts/{account_id}/cloudforce-one/v2/requests/{project_type}`
- `GET /accounts/{account_id}/cloudforce-one/v2/requests/{project_type}/constants`
- `GET /accounts/{account_id}/cloudforce-one/v2/requests/{project_type}/metadata`
- `GET /accounts/{account_id}/cloudforce-one/v2/requests/{project_type}/quota`
- `GET /accounts/{account_id}/cloudforce-one/v2/requests/{project_type}/types`
- `GET /accounts/{account_id}/cloudforce-one/v2/requests/{project_type}/user/me`
- `GET /accounts/{account_id}/cloudforce-one/v2/requests/{project_type}/{request_id}`
- `GET /accounts/{account_id}/cloudforce-one/v2/requests/{project_type}/{request_id}/assets/list`
- `GET /accounts/{account_id}/cloudforce-one/v2/requests/{project_type}/{request_id}/assets/{asset_id}/download`
- `GET /accounts/{account_id}/cloudforce-one/v2/requests/{project_type}/{request_id}/messages`
- `GET /accounts/{account_id}/cloudforce-one/v2/requests/{project_type}/{request_id}/messages/{message_id}`
- `GET /accounts/{account_id}/email-security/analytics/monthly_report`
- `GET /accounts/{account_id}/email/sending/reputation`
- `GET /accounts/{account_id}/field_extractors/{extractor}`
- `GET /accounts/{account_id}/r2-catalog/{bucket_name}/namespaces/{namespace}/tables/{table_name}/maintenance-runs`
- `GET /accounts/{account_id}/r2/buckets/{bucket_name}/storage-class-migration-jobs`
- `GET /accounts/{account_id}/r2/buckets/{bucket_name}/storage-class-migration-jobs/{job_id}`
- `GET /accounts/{account_id}/security-center/insights/count`
- `GET /accounts/{account_id}/workers/observability/zones/{zone_id}/observability/tracing/rules`
- `GET /accounts/{account_id}/workers/observability/zones/{zone_id}/observability/tracing/settings`
- `GET /analytics/sql`
- `GET /analytics/sql/introspection`
- `GET /radar/annotations/{id}`
- `GET /radar/traffic_anomalies/{uuid}`
- `PATCH /accounts/{account_id}/cloudforce-one/events/event-categories/by-id/{category_id}`
- `PATCH /accounts/{account_id}/cloudforce-one/events/tag-categories/{category_uuid}`
- `PATCH /accounts/{account_id}/cloudforce-one/v2/priority-intelligence/interests/{interest_id}`
- `PATCH /accounts/{account_id}/workers/observability/zones/{zone_id}/observability/tracing/settings`
- `POST /accounts/{account_id}/artifacts/namespaces`
- `POST /accounts/{account_id}/cloudforce-one/events`
- `POST /accounts/{account_id}/cloudforce-one/events/event-categories/by-id/{category_id}`
- `POST /accounts/{account_id}/cloudforce-one/v2/brand-protection/domain/matches/bulk-dismiss`
- `POST /accounts/{account_id}/cloudforce-one/v2/brand-protection/domain/trial`
- `POST /accounts/{account_id}/cloudforce-one/v2/brand-protection/queries/{query_id}/matches/{domain_id}/dismiss`
- `POST /accounts/{account_id}/cloudforce-one/v2/brand-protection/queries/{query_id}/matches/{domain_id}/undismiss`
- `POST /accounts/{account_id}/cloudforce-one/v2/credential-monitor/domains`
- `POST /accounts/{account_id}/cloudforce-one/v2/priority-intelligence`
- `POST /accounts/{account_id}/cloudforce-one/v2/priority-intelligence/interests`
- `POST /accounts/{account_id}/cloudforce-one/v2/priority-intelligence/interests/backtests`
- `POST /accounts/{account_id}/cloudforce-one/v2/priority-intelligence/interests/evaluations`
- `POST /accounts/{account_id}/cloudforce-one/v2/priority-intelligence/quota`
- `POST /accounts/{account_id}/cloudforce-one/v2/requests/{project_type}`
- `POST /accounts/{account_id}/cloudforce-one/v2/requests/{project_type}/{request_id}/assets/upload`
- `POST /accounts/{account_id}/cloudforce-one/v2/requests/{project_type}/{request_id}/messages/new`
- `POST /accounts/{account_id}/cloudforce-one/v2/threat-signals/articles/{article_id}/skills/{skill_id}/diagnostic`
- `POST /accounts/{account_id}/infrastructure/targets/batch_tags`
- `POST /accounts/{account_id}/r2-catalog/{bucket_name}/namespaces/{namespace}/tables/{table_name}/maintenance-configs/{configuration_type}/queue`
- `POST /accounts/{account_id}/r2/buckets/{bucket_name}/storage-class-migration-jobs`
- `POST /analytics/sql`
- ...and 6 more

## Removed operations

- `DELETE /accounts/{account_id}/addressing/address_maps/{address_map_id}/accounts/{account_id}`
- `DELETE /accounts/{account_id}/workers/observability/metricsexport`
- `PUT /accounts/{account_id}/addressing/address_maps/{address_map_id}/accounts/{account_id}`

## Changed operations

- `DELETE /accounts/{account_id}/access/ai-controls/mcp/portals/{id}`
- `DELETE /accounts/{account_id}/access/ai-controls/mcp/servers/{id}`
- `DELETE /accounts/{account_id}/access/bookmarks/{bookmark_id}`
- `DELETE /accounts/{account_id}/addressing/address_maps/{address_map_id}`
- `DELETE /accounts/{account_id}/addressing/address_maps/{address_map_id}/ips/{ip_address}`
- `DELETE /accounts/{account_id}/addressing/address_maps/{address_map_id}/zones/{zone_id}`
- `DELETE /accounts/{account_id}/addressing/prefixes/{prefix_id}`
- `DELETE /accounts/{account_id}/addressing/prefixes/{prefix_id}/bgp/prefixes/{bgp_prefix_id}`
- `DELETE /accounts/{account_id}/addressing/prefixes/{prefix_id}/bindings/{binding_id}`
- `DELETE /accounts/{account_id}/addressing/prefixes/{prefix_id}/delegations/{delegation_id}`
- `DELETE /accounts/{account_id}/agent-memory/namespaces/{namespace_name}`
- `DELETE /accounts/{account_id}/agent-memory/namespaces/{namespace_name}/profiles/{profile_name}`
- `DELETE /accounts/{account_id}/agent-memory/namespaces/{namespace_name}/profiles/{profile_name}/memories/{memory_id}`
- `DELETE /accounts/{account_id}/agent-memory/namespaces/{namespace_name}/profiles/{profile_name}/sessions/{session_id}`
- `DELETE /accounts/{account_id}/ai-gateway/gateways/{gateway_id}/routes/{id}`
- `DELETE /accounts/{account_id}/ai-gateway/gateways/{id}`
- `DELETE /accounts/{account_id}/ai-search/instances/{id}`
- `DELETE /accounts/{account_id}/ai-search/namespaces/{name}/instances/{id}`
- `DELETE /accounts/{account_id}/artifacts/namespaces/{namespace}/repos/{name}`
- `DELETE /accounts/{account_id}/artifacts/namespaces/{namespace}/tokens/{id}`
- `DELETE /accounts/{account_id}/builds/repos/connections/{repo_connection_uuid}`
- `DELETE /accounts/{account_id}/builds/tokens/{build_token_uuid}`
- `DELETE /accounts/{account_id}/builds/triggers/{trigger_uuid}`
- `DELETE /accounts/{account_id}/builds/triggers/{trigger_uuid}/environment_variables/{environment_variable_key}`
- `DELETE /accounts/{account_id}/builds/workers/{script_name}/deploy_hooks/{deploy_hook_uuid}`
- `DELETE /accounts/{account_id}/builds/workers/{script_tag}`
- `DELETE /accounts/{account_id}/cloudforce-one/events/categories/{category_id}`
- `DELETE /accounts/{account_id}/cloudforce-one/events/tags/categories/{category_uuid}`
- `DELETE /accounts/{account_id}/cloudforce-one/events/{dataset_id}/delete`
- `DELETE /accounts/{account_id}/cloudforce-one/v2/brand-protection/domain/queries/{query_id}`
- `DELETE /accounts/{account_id}/cloudforce-one/v2/brand-protection/letter/templates/{template_id}`
- `DELETE /accounts/{account_id}/cloudforce-one/v2/brand-protection/logo/queries/{query_id}`
- `DELETE /accounts/{account_id}/cloudforce-one/v2/brand-protection/takedown-notices/{notice_id}`
- `DELETE /accounts/{account_id}/cloudforce-one/v2/brand-protection/takedown-notices/{notice_id}/letters/{letter_id}`
- `DELETE /accounts/{account_id}/cloudforce-one/v2/collections/{collection_id}`
- `DELETE /accounts/{account_id}/cloudforce-one/v2/collections/{collection_id}/columns/{column_id}`
- `DELETE /accounts/{account_id}/cloudforce-one/v2/collections/{collection_id}/items/{item_id}`
- `DELETE /accounts/{account_id}/connectivity/directory/services/{service_id}`
- `DELETE /accounts/{account_id}/custom_ns/{custom_ns_id}`
- `DELETE /accounts/{account_id}/data-security/posture/policies/{policy_id}`
- `DELETE /accounts/{account_id}/data-security/posture/webhooks/{webhook_id}`
- `DELETE /accounts/{account_id}/devices/deployment-groups/{group_id}`
- `DELETE /accounts/{account_id}/devices/ip-profiles/{profile_id}`
- `DELETE /accounts/{account_id}/devices/networks/{network_id}`
- `DELETE /accounts/{account_id}/devices/physical-devices/{device_id}`
- `DELETE /accounts/{account_id}/devices/policy/{policy_id}`
- `DELETE /accounts/{account_id}/devices/posture/integration/{integration_id}`
- `DELETE /accounts/{account_id}/devices/posture/{rule_id}`
- `DELETE /accounts/{account_id}/devices/registrations`
- `DELETE /accounts/{account_id}/devices/registrations/{registration_id}`
- `DELETE /accounts/{account_id}/dns_firewall/{dns_firewall_id}`
- `DELETE /accounts/{account_id}/dns_settings/views/{view_id}`
- `DELETE /accounts/{account_id}/email/routing/suppression/{suppression_id}`
- `DELETE /accounts/{account_id}/email/sending/suppression/{suppression_id}`
- `DELETE /accounts/{account_id}/email/sending/suppressions/{suppression_id}`
- `DELETE /accounts/{account_id}/event_subscriptions/subscriptions/{subscription_id}`
- `DELETE /accounts/{account_id}/iam/resource_groups/{resource_group_id}`
- `DELETE /accounts/{account_id}/images/v1/variants/{variant_id}`
- `DELETE /accounts/{account_id}/images/v1/{image_id}`
- `DELETE /accounts/{account_id}/load_balancers/monitors/{monitor_id}`
- `DELETE /accounts/{account_id}/load_balancers/pools/{pool_id}`
- `DELETE /accounts/{account_id}/logpush/jobs/{job_id}`
- `DELETE /accounts/{account_id}/logs/control/cmb/config`
- `DELETE /accounts/{account_id}/members/{member_id}`
- `DELETE /accounts/{account_id}/pcaps/ownership/{ownership_id}`
- `DELETE /accounts/{account_id}/secondary_dns/acls/{acl_id}`
- `DELETE /accounts/{account_id}/secondary_dns/peers/{peer_id}`
- `DELETE /accounts/{account_id}/secondary_dns/tsigs/{tsig_id}`
- `DELETE /accounts/{account_id}/stream/keys/{identifier}`
- `DELETE /accounts/{account_id}/stream/live_inputs/{live_input_identifier}`
- `DELETE /accounts/{account_id}/stream/live_inputs/{live_input_identifier}/outputs/{output_identifier}`
- `DELETE /accounts/{account_id}/stream/watermarks/{identifier}`
- `DELETE /accounts/{account_id}/stream/webhook`
- `DELETE /accounts/{account_id}/stream/{identifier}`
- `DELETE /accounts/{account_id}/stream/{identifier}/audio/{audio_identifier}`
- ...and 717 more

## Newly deprecated operations

- `DELETE /accounts/{account_id}/cloudforce-one/events/categories/{category_id}`
- `DELETE /accounts/{account_id}/cloudforce-one/events/tags/categories/{category_uuid}`
- `DELETE /accounts/{account_id}/cloudforce-one/events/{dataset_id}/delete`
- `GET /accounts/{account_id}/cloudforce-one/events/categories/{category_id}`
- `GET /accounts/{account_id}/cloudforce-one/events/raw/{dataset_id}/{event_id}`
- `GET /accounts/{account_id}/cloudforce-one/events/tags/categories/{category_uuid}`
- `GET /accounts/{account_id}/cloudforce-one/events/{event_id}/relationships`
- `PATCH /accounts/{account_id}/cloudforce-one/events/categories/{category_id}`
- `PATCH /accounts/{account_id}/cloudforce-one/events/tags/categories/{category_uuid}`
- `POST /accounts/{account_id}/cloudforce-one/events/categories/{category_id}`


## Completed revision review

Every surviving operation retains its previous partition owner and match set. The classifier and partition rules are unchanged. Explicitly added 25 reviewed operation entries to existing groups and removed three stale entries: 2,474 − 3 + 25 = 2,496 overlap operations across 54 declarations. No wildcard approvals or implicit precedence were added.

### Reviewed new overlaps

| Operation | Selected owner | Review rationale |
| --- | --- | --- |
| `DELETE /accounts/{account_id}/addressing/address_maps/{address_map_id}/accounts/{member_account_id}` | `network-services` | Same address-map membership operation ID and description as the removed path; only the member parameter is renamed. |
| `DELETE /accounts/{account_id}/cloudforce-one/v2/credential-monitor/domains/{id}` | `zones-dns-domains` | Domain credential-monitor removal; retain the existing domain-oriented overlap policy. |
| `GET /accounts/{account_id}/cloudforce-one/v2/credential-monitor/domains` | `zones-dns-domains` | Domain credential-monitor listing; retain the existing domain-oriented overlap policy. |
| `GET /accounts/{account_id}/cloudforce-one/v2/requests/legal-response/access-check` | `zero-trust` | Allowlist access check; use the existing access-oriented navigation policy. This placement does not assert that Cloudforce One is a Zero Trust product. |
| `GET /accounts/{account_id}/email-security/analytics/monthly_report` | `analytics-observability` | Aggregated email analytics; consistent with the existing email investigation trace overlap. |
| `GET /accounts/{account_id}/email/sending/reputation` | `media-communications` | Email Sending reputation belongs with email operations. |
| `GET /accounts/{account_id}/r2-catalog/{bucket_name}/namespaces/{namespace}/tables/{table_name}/maintenance-runs` | `storage-data` | R2 catalog table maintenance history belongs with existing catalog storage operations. |
| `GET /accounts/{account_id}/r2/buckets/{bucket_name}/storage-class-migration-jobs` | `storage-data` | R2 bucket migration listing belongs with bucket storage operations. |
| `GET /accounts/{account_id}/r2/buckets/{bucket_name}/storage-class-migration-jobs/{job_id}` | `storage-data` | R2 bucket migration status belongs with bucket storage operations. |
| `GET /accounts/{account_id}/security-center/insights/count` | `application-security-rulesets` | Security Center risk insight count belongs with application security. |
| `GET /accounts/{account_id}/workers/observability/zones/{zone_id}/observability/tracing/rules` | `workers-developer-platform` | Keep Workers observability trace-rule retrieval beside existing Workers observability operations. |
| `GET /accounts/{account_id}/workers/observability/zones/{zone_id}/observability/tracing/settings` | `workers-developer-platform` | Keep Workers observability trace settings beside existing Workers observability operations. |
| `GET /radar/traffic_anomalies/{uuid}` | `analytics-observability` | Radar anomaly lookup belongs with the existing Radar traffic-anomaly analytics endpoints. |
| `PATCH /accounts/{account_id}/workers/observability/zones/{zone_id}/observability/tracing/settings` | `workers-developer-platform` | Keep Workers observability trace settings updates beside existing Workers observability operations. |
| `POST /accounts/{account_id}/cloudforce-one/v2/brand-protection/domain/matches/bulk-dismiss` | `application-security-rulesets` | Brand-protection domain match dismissal follows existing brand-protection ownership. |
| `POST /accounts/{account_id}/cloudforce-one/v2/brand-protection/domain/trial` | `application-security-rulesets` | Brand impersonation analysis follows existing brand-protection ownership. |
| `POST /accounts/{account_id}/cloudforce-one/v2/brand-protection/queries/{query_id}/matches/{domain_id}/dismiss` | `application-security-rulesets` | Brand-protection domain match dismissal follows existing brand-protection ownership. |
| `POST /accounts/{account_id}/cloudforce-one/v2/brand-protection/queries/{query_id}/matches/{domain_id}/undismiss` | `application-security-rulesets` | Brand-protection domain match undismissal follows existing brand-protection ownership. |
| `POST /accounts/{account_id}/cloudforce-one/v2/credential-monitor/domains` | `zones-dns-domains` | Domain credential-monitor registration; retain the existing domain-oriented overlap policy. |
| `POST /accounts/{account_id}/cloudforce-one/v2/threat-signals/articles/{article_id}/skills/{skill_id}/diagnostic` | `application-security-rulesets` | Threat Signals diagnostic remains with application security despite the diagnostic keyword. |
| `POST /accounts/{account_id}/infrastructure/targets/batch_tags` | `zero-trust` | Infrastructure access target tagging belongs with existing access targets in Zero Trust. |
| `POST /accounts/{account_id}/r2-catalog/{bucket_name}/namespaces/{namespace}/tables/{table_name}/maintenance-configs/{configuration_type}/queue` | `workers-developer-platform` | R2 maintenance enqueueing matches storage and queue rules. Explicitly retain the existing storage/Workers overlap owner for navigation; this is R2 maintenance, not a claim that it uses the Queues API. |
| `POST /accounts/{account_id}/r2/buckets/{bucket_name}/storage-class-migration-jobs` | `storage-data` | R2 bucket migration creation belongs with bucket storage operations. |
| `PUT /accounts/{account_id}/addressing/address_maps/{address_map_id}/accounts/{member_account_id}` | `network-services` | Same address-map membership operation ID and description as the removed path; only the member parameter is renamed. |
| `PUT /accounts/{account_id}/workers/observability/zones/{zone_id}/observability/tracing/rules` | `workers-developer-platform` | Keep Workers observability trace-rule replacement beside existing Workers observability operations. |

### Removed overlap entries

- `DELETE /accounts/{account_id}/workers/observability/metricsexport`
- `DELETE /accounts/{account_id}/addressing/address_maps/{address_map_id}/accounts/{account_id}`
- `PUT /accounts/{account_id}/addressing/address_maps/{address_map_id}/accounts/{account_id}`

The two address-map entries are replaced by the corresponding `{member_account_id}` paths. The removed Workers metric-export DELETE has no generated request or accounting row. All three removed operations are absent from reference output and overlap configuration.

### Final accounting and authentication

- 3,522 / 3,522 operations represented exactly once; zero missing, duplicate, or unexpected operations.
- 33 surviving addressing operations change from legacy-only to Bearer-alternative. Root security and every security scheme definition are unchanged; the full effective authentication contracts were recomputed. Root-inheriting operations increase from 20 to 23: four new Workers zone-tracing operations inherit root security, while the removed metric-export DELETE also inherited it.
- Final categories: 568 Bearer-only, 1,576 Bearer-alternative, 253 legacy-only, 1,114 multi-scheme/other, 7 anonymous, 4 manual-unresolved. The multi-scheme operations retain literal token AND email AND key requirements; unresolved upload schemes remain guarded.
- Bootstrap auth remains unchanged; regenerated provenance references the new pin.
- All 10 newly deprecated operations retain `deprecated: true` in accounting and upstream replacement instructions, including the November 28, 2026 availability date, in request descriptions.
- 47 recoverable converter warnings; three exact revision-bound lowercase `4xx` validation exceptions, unchanged in content.
- Residual: only `GET /signed-url`.

| Partition | Operations |
| --- | ---: |
| zero-trust | 594 |
| workers-developer-platform | 474 |
| storage-data | 127 |
| application-security-rulesets | 369 |
| analytics-observability | 434 |
| zones-dns-domains | 436 |
| network-services | 286 |
| media-communications | 183 |
| accounts-identity-billing | 618 |
| other-cloudflare-services | 1 |

### Dependency audit

`npm audit --json` reports four high-severity affected packages from two distinct advisories. The additional finding is [GHSA-2883-xcg3-v3hh](https://github.com/advisories/GHSA-2883-xcg3-v3hh), affecting the already pinned `openapi-to-postmanv2 → js-yaml@4.3.1` dependency; GitHub indexed/reviewed it on September 8. No dependency resolution changed. Its YAML merge-source CPU-exhaustion condition does not apply to this converter input path: verified official JSON is parsed to an object before conversion. The existing Faker limitation also remains. See [architecture audit rationale](docs/architecture.md#converter-limitation). No forced fixes, dependency overrides, or runtime dependencies were added.

### Validation and public safety

Node 24: `npm ci`, `npm run lint`, `npm test` (18 passing), `npm run generate`, `npm run generate:check`, `npm run validate`, `npm run check`, and `git diff --check` pass. A second generation is byte-identical. Schema/collection checks, artifact hashes, complete auth recomputation, exact-once accounting, unchanged surviving ownership, removals, and deprecation descriptions were verified. Public-safety validation checks empty credential/resource templates and rejects new local filesystem paths; supplied official upstream examples remain attributable to the verified schema. Gitleaks 8.30.1 scanned the full PR diff: all 915 findings were traced to 837 computed auth-fingerprint matches and 78 verified public upstream example matches (including five base64-decoded key examples); zero unexplained findings. No populated environments, private operational material, or maintainer credentials were added. Hosted Validate results are recorded on PR #2 for the pushed commit. Live smoke tests remain unrun because they require protected non-production credentials.
