# Cloudflare API schema update

- Previous revision: `49731bd0592b0c8c2c781b8d15d9f27c7293b210`
- New revision: `efeb8ebf9cf8c844a208cdd0620ac9fd3d97c3ac`
- Previous operations: 3540
- New operations: 3540
- Operation delta: +0
- Added: 0
- Removed: 0
- Changed: 102
- Newly deprecated: 0
- Generation: passed
- Validation: passed
- Read-only live smoke test: not run; protected credentials are not exposed to this update job

## Added operations

None.

## Removed operations

None.

## Changed operations

- `DELETE /accounts/{account_id}/ai-gateway/billing/topup/config`
- `DELETE /accounts/{account_id}/ai-gateway/gateways/{gateway_id}/logs`
- `DELETE /accounts/{account_id}/ai-gateway/gateways/{id}`
- `DELETE /accounts/{account_id}/realtime/kit/{app_id}/meetings/{meeting_id}/participants/{participant_id}`
- `DELETE /accounts/{account_id}/realtime/kit/{app_id}/presets/{preset_id}`
- `DELETE /accounts/{account_id}/realtime/kit/{app_id}/webhooks/{webhook_id}`
- `GET /accounts/{account_id}/ai-gateway/gateways`
- `GET /accounts/{account_id}/ai-gateway/gateways/{gateway_id}/logs`
- `GET /accounts/{account_id}/ai-gateway/gateways/{id}`
- `GET /accounts/{account_id}/ai-search/namespaces`
- `GET /accounts/{account_id}/ai-search/namespaces/{name}`
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
- `GET /accounts/{account_id}/realtime/kit/apps`
- `GET /accounts/{account_id}/realtime/kit/apps/{app_id}`
- `GET /accounts/{account_id}/realtime/kit/{app_id}/analytics/daywise`
- `GET /accounts/{account_id}/realtime/kit/{app_id}/analytics/livestreams/daywise`
- `GET /accounts/{account_id}/realtime/kit/{app_id}/analytics/livestreams/overall`
- `GET /accounts/{account_id}/realtime/kit/{app_id}/livestreams`
- `GET /accounts/{account_id}/realtime/kit/{app_id}/livestreams/sessions/{livestream-session-id}`
- `GET /accounts/{account_id}/realtime/kit/{app_id}/livestreams/{livestream_id}`
- `GET /accounts/{account_id}/realtime/kit/{app_id}/livestreams/{livestream_id}/active-livestream-session`
- `GET /accounts/{account_id}/realtime/kit/{app_id}/meetings`
- `GET /accounts/{account_id}/realtime/kit/{app_id}/meetings/{meeting_id}`
- `GET /accounts/{account_id}/realtime/kit/{app_id}/meetings/{meeting_id}/active-livestream`
- `GET /accounts/{account_id}/realtime/kit/{app_id}/meetings/{meeting_id}/active-session`
- `GET /accounts/{account_id}/realtime/kit/{app_id}/meetings/{meeting_id}/livestream`
- `GET /accounts/{account_id}/realtime/kit/{app_id}/meetings/{meeting_id}/participants`
- `GET /accounts/{account_id}/realtime/kit/{app_id}/meetings/{meeting_id}/participants/{participant_id}`
- `GET /accounts/{account_id}/realtime/kit/{app_id}/presets`
- `GET /accounts/{account_id}/realtime/kit/{app_id}/presets/{preset_id}`
- `GET /accounts/{account_id}/realtime/kit/{app_id}/recordings`
- `GET /accounts/{account_id}/realtime/kit/{app_id}/recordings/active-recording/{meeting_id}`
- `GET /accounts/{account_id}/realtime/kit/{app_id}/recordings/{recording_id}`
- `GET /accounts/{account_id}/realtime/kit/{app_id}/sessions`
- `GET /accounts/{account_id}/realtime/kit/{app_id}/sessions/peer-report/{peer_id}`
- `GET /accounts/{account_id}/realtime/kit/{app_id}/sessions/{session_id}`
- `GET /accounts/{account_id}/realtime/kit/{app_id}/sessions/{session_id}/chat`
- `GET /accounts/{account_id}/realtime/kit/{app_id}/sessions/{session_id}/livestream-sessions`
- `GET /accounts/{account_id}/realtime/kit/{app_id}/sessions/{session_id}/participants`
- `GET /accounts/{account_id}/realtime/kit/{app_id}/sessions/{session_id}/participants/{participant_id}`
- `GET /accounts/{account_id}/realtime/kit/{app_id}/sessions/{session_id}/summary`
- `GET /accounts/{account_id}/realtime/kit/{app_id}/sessions/{session_id}/transcript`
- `GET /accounts/{account_id}/realtime/kit/{app_id}/webhooks`
- `GET /accounts/{account_id}/realtime/kit/{app_id}/webhooks/all`
- `GET /accounts/{account_id}/realtime/kit/{app_id}/webhooks/{webhook_id}`
- `GET /analytics/sql/introspection`
- `GET /user/communication_preferences`
- `PATCH /accounts/{account_id}/realtime/kit/{app_id}/meetings/{meeting_id}`
- `PATCH /accounts/{account_id}/realtime/kit/{app_id}/meetings/{meeting_id}/participants/{participant_id}`
- `PATCH /accounts/{account_id}/realtime/kit/{app_id}/presets/{preset_id}`
- `PATCH /accounts/{account_id}/realtime/kit/{app_id}/webhooks/{webhook_id}`
- `POST /accounts/{account_id}/ai-gateway/billing/topup/config`
- `POST /accounts/{account_id}/ai-gateway/gateways`
- `POST /accounts/{account_id}/ai-search/namespaces`
- `POST /accounts/{account_id}/data-security/posture/findings/export`
- `POST /accounts/{account_id}/data-security/posture/findings/ignore`
- `POST /accounts/{account_id}/data-security/posture/findings/unignore`
- `POST /accounts/{account_id}/data-security/posture/findings/{finding_id}/instances/archive`
- `POST /accounts/{account_id}/data-security/posture/findings/{finding_id}/instances/unarchive`
- `POST /accounts/{account_id}/data-security/posture/findings/{finding_id}/reset_finding_severity`
- `POST /accounts/{account_id}/data-security/posture/findings/{finding_id}/tune_finding_severity`
- `POST /accounts/{account_id}/data-security/posture/findings/{storage_namespace_id}/instances/export`
- `POST /accounts/{account_id}/data-security/posture/remediations/jobs`
- `POST /accounts/{account_id}/data-security/posture/remediations/jobs/export`
- `POST /accounts/{account_id}/data-security/posture/webhooks`
- ...and 27 more

## Newly deprecated operations

None.


## Complete repository gate

- `npm run check`: failed
