# Generated request-body correction audit

Comparison baseline: PR #12 head `f6508369519b02dc79bc03e29e994bd3944af1ae`. The schema pin, toolchain pins, Ajv architecture, finite primitive policy and compatibility categories are unchanged. Generated artifacts are comparison evidence only, never construction inputs.

## Corrections and attribution

Generation parses a separate request-body authority directly from the same pinned bytes before any converter runs. The complete graph is recursively frozen, and its deterministic hash is checked after all partitions finish. Each partition derives its body contract from this source. The primary converter working graph, shallow partition views and full secondary query-conversion behavior retain their existing semantics.

Construction also preserves composed object intent when child annotations are scalar or array values, without changing Ajv structural semantics. Complete authoritative examples remain usable if the full contract validates. Optional union repair preserves surviving declared property paths across retries; compatible branches may be completed, unsafe optional subtrees are omitted, and required unconstructible branches fail closed. Already valid overlapping unions remain unchanged.

All five reviewed operations are corrected: the email-routing plan retains its complete source example; account load-balancer create/update retain the three-pool example; zone settings retain identifiable id/value objects; and the Pipeline sink omits unsafe optional config instead of putting Data Catalog config beneath type r2.

The complete diff contains **30 changed live bodies**, including **25 beyond the five reviewed operations**. A counterfactual comparison applies the baseline constructor to the identical primary inputs, preserving the existing working-graph conversion order while supplying pristine request contracts:

- **3** entire final bodies are reproduced by request-authority isolation alone.
- **26** bodies incorporate optional-union omission: the reviewed Pipeline sink plus **25 additional operations**. All 27 omitted subtrees contain only converter sentinels, with no surviving value that identifies a branch.
- **1** body is the reviewed zone-settings object-intent correction.

Every changed operation and path is listed below. No response, SDK, rendered-documentation, sibling-endpoint or generated-artifact value supplies construction data. There are no endpoint-specific allowlists.

## Complete distribution

| Measurement | Baseline | Corrected |
| --- | ---: | ---: |
| Exactly-once reference operations | 3,540 | 3,540 |
| Live bodies | 1,254 | 1,254 |
| Native request files including bootstrap | 3,543 | 3,543 |
| valid | 1,202 | 1,206 |
| ambiguous-oneOf | 34 | 30 |
| source-incomplete | 16 | 16 |
| source-conflict | 2 | 2 |
| Without bodies | 2,286 | 2,286 |
| Live-body sentinels, either format | 0 | 0 |

Modes remain **1,212 raw / 32 form-data / 9 file / 1 URL-encoded**. All 3,543 Native bodies independently match v2. File sets, partitioning, environments, operation accounting and all eight multipart binary-array bodies remain unchanged.

**71 saved request snapshots** change correspondingly. The diff contains 9 v2 files, 30 Native request files, 71 Native example files and 0 other Native files.

The four requests moving from ambiguous-oneOf to valid are device-posture create/update, device-posture integration patch, and token-validation rule patch. The source-incomplete and source-conflict memberships are unchanged. The 56-case regression retains 52 strict-valid / 2 ambiguous-oneOf / 2 source-conflict.

## Non-body immutability

Independent complete comparisons against the baseline find:

- **0 response-payload changes and 0 response-record changes**, excluding saved request bodies.
- **0 query changes**, including keys, values and enabled state.
- **0 unrelated request-header changes; 0 URL changes; 0 authentication changes.**
- **0 unrelated generated-field changes**, including collection/folder metadata, request/example metadata, saved request fields other than body, environments and partitioning.

The v2 comparison removes only live/saved body fields and the permitted collection/Native file hashes and request-body manifest diagnostics before comparing complete JSON trees. The Native comparison checks every changed YAML tree after removing only live/saved body fields. Response fields are compared in full in both formats. Neither check copies baseline artifacts into generated output.

## Deferred global converter isolation

The converter mutates nested objects received through shallow partition views. Those path/component references are shared across the converter working graph, making later conversion results dependent on previous partitions. This remains a separate generator defect.

A rejected local experiment that cloned every converter input changed 311 response payloads, query values on 360 operations and two request headers. Those output changes are excluded from PR #12. A dedicated follow-up must isolate the complete converter graph, test conversion-order behavior, and independently review the resulting non-body differences. PR #12 isolates only request-body source authority; it does not replay mutations, restore old response files, or globally change `convert()` or `subsetSchema()`.

## Regression and validation evidence

Permanent tests cover deep immutability, deterministic before/after authority hashes, identical-input normalization after either partition order, non-body output equivalence with and without authority isolation, full pinned generation, the five reviewed operations, composed object candidates and optional/required union affinity. Existing Ajv and finite construction regressions remain, including all 56 inventoried cases.

On Node 24, `npm ci`, **93 focused tests**, **125 complete tests**, `npm run generate`, standalone `generate:check`, `validate`, the full `check`, and `git diff --check` pass. Independent regeneration reproduces both complete generated trees byte-for-byte. Every collection passes official Native raw/normalized lint, semantic/body equivalence and two-migration byte comparison.

Checksum-verified Gitleaks 8.30.1 passes with 3,727 fully attributed findings and zero unresolved: 3,543 auth fingerprints, 158 upstream examples and 26 synthetic token IDs. Email occurrences are 396 upstream and 12 synthetic. The verified Darwin x64 release archive SHA-256 is `dfe101a4db2255fc85120ac7f3d25e4342c3c20cf749f2c20a18081af1952709`.

The full non-body comparisons, exact operation accounting, unchanged pins/compatibility files and final file-scope audit pass. Hosted Validate status is recorded on PR #12 for the signed correction commit; the PR remains draft.

## Individual changed bodies

| # | Operation | Scope | Changed body paths | Attribution and justification |
| ---: | --- | --- | --- | --- |
| 1 | `PUT /accounts/{account_id}/ai-gateway/gateways/{id}` | additional | `/dlp` | Omit the optional union at the listed path: its primary subtree contains only converter sentinels, so the old constructed alternative had no surviving branch evidence. |
| 2 | `PUT /accounts/{account_id}/devices/networks/{network_id}` | additional | `/config` | Omit the optional union at the listed path: its primary subtree contains only converter sentinels, so the old constructed alternative had no surviving branch evidence. |
| 3 | `POST /accounts/{account_id}/devices/posture` | additional | `/input` | Omit the optional union at the listed path: its primary subtree contains only converter sentinels, so the old constructed alternative had no surviving branch evidence. |
| 4 | `PATCH /accounts/{account_id}/devices/posture/integration/{integration_id}` | additional | `/config` | Omit the optional union at the listed path: its primary subtree contains only converter sentinels, so the old constructed alternative had no surviving branch evidence. |
| 5 | `PUT /accounts/{account_id}/devices/posture/{rule_id}` | additional | `/input` | Omit the optional union at the listed path: its primary subtree contains only converter sentinels, so the old constructed alternative had no surviving branch evidence. |
| 6 | `PUT /accounts/{account_id}/warp_connector/{tunnel_id}/configurations` | additional | `/config` | Omit the optional union at the listed path: its primary subtree contains only converter sentinels, so the old constructed alternative had no surviving branch evidence. |
| 7 | `POST /accounts/{account_id}/autorag/rags/{id}/ai-search` | additional | `/filters` | Omit the optional union at the listed path: its primary subtree contains only converter sentinels, so the old constructed alternative had no surviving branch evidence. |
| 8 | `POST /accounts/{account_id}/event_subscriptions/subscriptions` | additional | `/destination` | Omit the optional union at the listed path: its primary subtree contains only converter sentinels, so the old constructed alternative had no surviving branch evidence. |
| 9 | `PATCH /accounts/{account_id}/event_subscriptions/subscriptions/{subscription_id}` | additional | `/destination` | Omit the optional union at the listed path: its primary subtree contains only converter sentinels, so the old constructed alternative had no surviving branch evidence. |
| 10 | `POST /accounts/{account_id}/pipelines/v1/sinks` | reviewed | `/config`, `/format` | Omit the optional union at the listed path: its primary subtree contains only converter sentinels, so the old constructed alternative had no surviving branch evidence. |
| 11 | `POST /accounts/{account_id}/pipelines/v1/streams` | additional | `/format` | Omit the optional union at the listed path: its primary subtree contains only converter sentinels, so the old constructed alternative had no surviving branch evidence. |
| 12 | `POST /accounts/{account_id}/realtime/kit/{app_id}/meetings` | additional | `/recording_config/storage_config` | Omit the optional union at the listed path: its primary subtree contains only converter sentinels, so the old constructed alternative had no surviving branch evidence. |
| 13 | `PATCH /accounts/{account_id}/realtime/kit/{app_id}/meetings/{meeting_id}` | additional | `/recording_config/storage_config` | Omit the optional union at the listed path: its primary subtree contains only converter sentinels, so the old constructed alternative had no surviving branch evidence. |
| 14 | `PUT /accounts/{account_id}/realtime/kit/{app_id}/meetings/{meeting_id}` | additional | `/recording_config/storage_config` | Omit the optional union at the listed path: its primary subtree contains only converter sentinels, so the old constructed alternative had no surviving branch evidence. |
| 15 | `PATCH /accounts/{account_id}/workers/dispatch/namespaces/{dispatch_namespace}/scripts/{script_name}/secrets-bulk` | additional | `/secrets` | Omit the optional union at the listed path: its primary subtree contains only converter sentinels, so the old constructed alternative had no surviving branch evidence. |
| 16 | `PATCH /accounts/{account_id}/workers/dispatch/namespaces/{dispatch_namespace}/scripts/{script_name}/settings` | additional | `/formdata/0/value` (JSON `/placement` in `settings`) | Omit the optional union at the listed path: its primary subtree contains only converter sentinels, so the old constructed alternative had no surviving branch evidence. |
| 17 | `PATCH /accounts/{account_id}/workers/scripts/{script_name}/secrets-bulk` | additional | `/secrets` | Omit the optional union at the listed path: its primary subtree contains only converter sentinels, so the old constructed alternative had no surviving branch evidence. |
| 18 | `PATCH /accounts/{account_id}/workers/scripts/{script_name}/settings` | additional | `/formdata/0/value` (JSON `/placement` in `settings`) | Omit the optional union at the listed path: its primary subtree contains only converter sentinels, so the old constructed alternative had no surviving branch evidence. |
| 19 | `POST /accounts/{account_id}/workers/workers/{worker_id}/versions` | additional | `/placement` | Omit the optional union at the listed path: its primary subtree contains only converter sentinels, so the old constructed alternative had no surviving branch evidence. |
| 20 | `PATCH /accounts/{account_id}/workers/workers/{worker_id}/versions/latest` | additional | `/placement` | Omit the optional union at the listed path: its primary subtree contains only converter sentinels, so the old constructed alternative had no surviving branch evidence. |
| 21 | `POST /accounts/{account_id}/slurper/jobs` | additional | `/source` | Omit the optional union at the listed path: its primary subtree contains only converter sentinels, so the old constructed alternative had no surviving branch evidence. |
| 22 | `PATCH /accounts/{account_id}/vuln_scanner/target_environments/{target_environment_id}` | additional | `/target` | Omit the optional union at the listed path: its primary subtree contains only converter sentinels, so the old constructed alternative had no surviving branch evidence. |
| 23 | `PATCH /zones/{zone_id}/settings` | reviewed | `/0`, `/1` | Composed object intent preserves setting id/value structure; scalar/array child annotations cannot replace the object. |
| 24 | `PATCH /zones/{zone_id}/token_validation/rules/{rule_id}` | additional | `/position` | Omit the optional union at the listed path: its primary subtree contains only converter sentinels, so the old constructed alternative had no surviving branch evidence. |
| 25 | `POST /accounts/{account_id}/load_balancers` | reviewed | `/default_pools/0`, `/default_pools/1`, `/default_pools/2` | Pristine request authority: the baseline constructor applied to the identical primary converter input under the unmutated pin reproduces this entire body. Authoritative request examples/cardinality are no longer overridden by converter mutation. |
| 26 | `PUT /accounts/{account_id}/load_balancers/{load_balancer_id}` | reviewed | `/default_pools/0`, `/default_pools/1`, `/default_pools/2` | Pristine request authority: the baseline constructor applied to the identical primary converter input under the unmutated pin reproduces this entire body. Authoritative request examples/cardinality are no longer overridden by converter mutation. |
| 27 | `POST /accounts/{account_id}/email/routing/rules/plan` | reviewed | `/catch_all_rules/0/rule/matchers/1`, `/rules/0/matchers/0/field`, `/rules/0/matchers/0/value`, `/rules/0/matchers/1`, `/rules/1/matchers/0/field`, `/rules/1/matchers/0/value`, `/rules/1/matchers/1`, `/rules/2/matchers/0/field`, `/rules/2/matchers/0/value`, `/rules/2/matchers/1` | Pristine request authority: the baseline constructor applied to the identical primary converter input under the unmutated pin reproduces this entire body. Authoritative request examples/cardinality are no longer overridden by converter mutation. |
| 28 | `POST /accounts/{account_id}/autorag/rags/{id}/search` | additional | `/filters` | Omit the optional union at the listed path: its primary subtree contains only converter sentinels, so the old constructed alternative had no surviving branch evidence. |
| 29 | `POST /accounts/{account_id}/cloudforce-one/v2/collections/{collection_id}/search` | additional | `/filter` | Omit the optional union at the listed path: its primary subtree contains only converter sentinels, so the old constructed alternative had no surviving branch evidence. |
| 30 | `POST /accounts/{account_id}/containers/applications` | additional | `/durable_objects` | Omit the optional union at the listed path: its primary subtree contains only converter sentinels, so the old constructed alternative had no surviving branch evidence. |
