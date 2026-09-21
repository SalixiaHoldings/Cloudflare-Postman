# Historical optional-union construction precedence audit (PR #12)

> Historical record. This audit documents the final v0.1.0 request-body correction. Current revision-specific request-body status is tracked in the [73947dd schema review](schema-revision-73947dd.md).

Comparison baseline: PR #12 head `1e5a960ab832ba11a87f0ed27308c68591981a8d`.
The upstream pin, toolchain, Ajv architecture, compatibility classifications,
pristine request-body authority and converter behavior are unchanged. The
[preceding authority correction audit](https://github.com/SalixiaHoldings/Cloudflare-Postman/blob/1e5a960ab832ba11a87f0ed27308c68591981a8d/docs/request-template-construction-diff.md)
is preserved at that baseline.

## Narrow correction

Optional union normalization no longer omits sentinel-only converter input before
checking the exact resolved schema's own example, default and enum. These exact
candidates must already satisfy the subtree and writable semantics. Bounded
retries validate the containing request before acceptance, try later candidates
when needed, and omit an optional value when none works. Examples harvested only
from competing union branches cannot select a kind without primary affinity.

If no exact candidate works and there is only one structural alternative, the
existing bounded construction policy may complete it. Existing valid input wins;
surviving branch affinity remains binding; required unconstructible values still
fail closed. Privacy sanitization remains in the normal production path.

There are **13 changed live bodies**: the seven reviewed restorations and six
additional restorations from the same exact-schema rule. Ten use exact-schema
annotations (six examples and four defaults); three use sole-alternative
construction. No operation-specific production rules were added.

Fresh primary conversion of every full partition, in production order, confirms
that all 13 affected values were sentinel-only wrappers. Running the baseline
constructor on those same inputs with pristine authority reproduces all 13 old
bodies exactly. Each final body is independently validated against the pristine
pinned request contract. Every difference is an insertion listed below; all other
body values remain identical. The Worker asset config object survives because its
`run_worker_first` union now retains the exact default `false`; its other absent
optional children are not synthesized.

## Distribution and isolation

| Measurement | Baseline | Corrected |
| --- | ---: | ---: |
| Exactly-once reference operations | 3,540 | 3,540 |
| Live request bodies | 1,254 | 1,254 |
| valid | 1,206 | 1,203 |
| ambiguous-oneOf | 30 | 33 |
| source-incomplete | 16 | 16 |
| source-conflict | 2 | 2 |
| Without bodies | 2,286 | 2,286 |
| Live-body sentinels, either format | 0 | 0 |

The three restored device-posture bodies return to the existing reviewed
ambiguous-oneOf classification. The three firewall requests retain their previous
ambiguous-oneOf classification. The other seven changed bodies are strict-valid.
Incomplete/conflict membership and all compatibility rules are unchanged.
The exhaustive original 56-case test remains **52 valid / 2 ambiguous-oneOf /
2 source-conflict**.

Modes remain **1,212 raw / 32 form-data / 9 file / 1 URL-encoded**. All eight
binary-array request bodies are unchanged. There are **33 corresponding saved
request-body changes**. File sets remain identical: five v2 files (four collections
and the manifest), 13 Native request files and 33 Native example files change;
no other Native files change. All **3,543 Native request bodies** independently
match v2, and all **8,409 Native examples** remain present.

Complete comparisons against the baseline, in both formats, confirm:

| Non-body field group | Changes |
| --- | ---: |
| Response payloads | 0 |
| Response records, excluding saved request bodies | 0 |
| Query keys, values and enabled state | 0 |
| Request headers | 0 |
| URLs | 0 |
| Auth | 0 |
| Environments | 0 |
| Partitioning and operation accounting | 0 |
| Other unrelated generated fields | 0 |

The v2 comparison checks complete trees after removing only live/saved body fields
and manifest body diagnostics/artifact hashes. The Native comparison checks every
changed YAML tree after removing only live/saved body fields. Neither comparison
restores baseline output or uses generated data as construction authority.

## Individual changed bodies

Each listed path was absent at the baseline. The JSON value shown is the complete
inserted subtree; all other body fields are identical. Source paths refer to the
unchanged pinned schema `49731bd0592b0c8c2c781b8d15d9f27c7293b210`, SHA-256
`3a7ba0e10e3b84f36e9ba6d6135a99d69177c2c3501711bcb367cb8b462bc627`.

### 1. `PUT /accounts/{account_id}/devices/networks/{network_id}`

- Body path: `/config`.
- Authority: `#/components/schemas/teams-devices_schemas-config_request/example`.
- Final classification: **valid**.
- The surviving `tls` selector is unchanged and compatible with the exact example.

```json
{
  "sha256": "b5bb9d8014a0f9b1d61e21e796d78dccdf1352f23cd32812f4850b878ae4944c",
  "tls_sockaddr": "foo.bar:1234"
}
```

### 2. `POST /accounts/{account_id}/devices/posture`

- Body path: `/input`.
- Authority: `#/components/schemas/teams-devices_input/example`.
- Final classification: **ambiguous-oneOf**.
- The surviving `file` selector is unchanged and compatible with the exact example.

```json
{
  "operating_system": "linux",
  "path": "/bin/cat",
  "thumbprint": "0aabab210bdb998e9cf45da2c9ce352977ab531c681b74cf1e487be1bbe9fe6e"
}
```

### 3. `PUT /accounts/{account_id}/devices/posture/{rule_id}`

- Body path: `/input`.
- Authority: `#/components/schemas/teams-devices_input/example`.
- Final classification: **ambiguous-oneOf**.
- The surviving `file` selector is unchanged and compatible with the exact example.

```json
{
  "operating_system": "linux",
  "path": "/bin/cat",
  "thumbprint": "0aabab210bdb998e9cf45da2c9ce352977ab531c681b74cf1e487be1bbe9fe6e"
}
```

### 4. `PATCH /accounts/{account_id}/devices/posture/integration/{integration_id}`

- Body path: `/config`.
- Authority: `#/components/schemas/teams-devices_config_request/example`.
- Final classification: **ambiguous-oneOf**.
- The surviving `workspace_one` selector is unchanged; normal privacy handling replaces the source secret example with `{{client_secret}}`.

```json
{
  "api_url": "https://as123.awmdm.com/API",
  "auth_url": "https://na.uemauth.workspaceone.com/connect/token",
  "client_id": "example client id",
  "client_secret": "{{client_secret}}"
}
```

### 5. `POST /accounts/{account_id}/event_subscriptions/subscriptions`

- Body path: `/destination`.
- Authority: `#/components/schemas/mq_event-destination-queue`.
- Final classification: **valid**.
- `mq_event-destination` has exactly one alternative. Its type enum and required string witness construct this template without selecting among competing kinds.

```json
{
  "type": "queues.queue",
  "queue_id": "{{destination__queue_id}}"
}
```

### 6. `PATCH /accounts/{account_id}/event_subscriptions/subscriptions/{subscription_id}`

- Body path: `/destination`.
- Authority: `#/components/schemas/mq_event-destination-queue`.
- Final classification: **valid**.
- `mq_event-destination` has exactly one alternative. Its type enum and required string witness construct this template without selecting among competing kinds.

```json
{
  "type": "queues.queue",
  "queue_id": "{{destination__queue_id}}"
}
```

### 7. `PATCH /accounts/{account_id}/vuln_scanner/target_environments/{target_environment_id}`

- Body path: `/target`.
- Authority: `#/components/schemas/vuln_scanner_zone-target`.
- Final classification: **valid**.
- `vuln_scanner_target-type` has exactly one alternative. Its fixed type enum and source-backed zone-tag example complete the target.

```json
{
  "type": "zone",
  "zone_tag": "d8e8fca2dc0f896fd7cb4cb0031ba249"
}
```

### 8. `POST /accounts/{account_id}/firewall/access_rules/rules`

- Body path: `/notes`.
- Authority: `#/paths/~1accounts~1{account_id}~1firewall~1access_rules~1rules/post/requestBody/content/application~1json/schema/properties/notes/default`.
- Final classification: **ambiguous-oneOf**.

```json
""
```

### 9. `POST /user/firewall/access_rules/rules`

- Body path: `/notes`.
- Authority: `#/paths/~1user~1firewall~1access_rules~1rules/post/requestBody/content/application~1json/schema/properties/notes/default`.
- Final classification: **ambiguous-oneOf**.

```json
""
```

### 10. `POST /zones/{zone_id}/firewall/access_rules/rules`

- Body path: `/notes`.
- Authority: `#/paths/~1zones~1{zone_id}~1firewall~1access_rules~1rules/post/requestBody/content/application~1json/schema/properties/notes/default`.
- Final classification: **ambiguous-oneOf**.

```json
""
```

### 11. `POST /accounts/{account_id}/workers/workers/{worker_id}/versions`

- Body path: `/assets/config`.
- Authority: `#/components/schemas/workers_Version/properties/assets/properties/config/properties/run_worker_first/default`.
- Final classification: **valid**.
- Exact default applies at `/assets/config/run_worker_first`; retaining that child keeps its parent config object.

```json
{
  "run_worker_first": false
}
```

### 12. `POST /accounts/{account_id}/containers/applications/{application_id}/rollouts`

- Body path: `/target_configuration/instance_type`.
- Authority: `#/components/schemas/cc_InstanceType/example`.
- Final classification: **valid**.

```json
"lite"
```

### 13. `POST /accounts/{account_id}/data-security/posture/findings/export`

- Body path: `/product`.
- Authority: `#/components/schemas/posture-api_FindingExportFilterRequest/properties/product/example`.
- Final classification: **valid**.

```json
"SaaS"
```

## Regression and validation evidence

Permanent tests cover all seven reviewed operations through full pinned production
generation, exact component/root annotations, rejected branch-local examples,
valid-input preservation, safe and unsafe singleton unions, required fail-closed
behavior, affinity preservation, credential sanitization, and complete-request
retry/default/omission. The existing Pipeline regression still proves that its R2
selector cannot acquire Data Catalog configuration. Authority and finite-policy
regressions remain intact.

Node 24 validation: **105 focused tests / 137 full tests**, `npm ci`, generation,
standalone `generate:check`, validation, complete `check`, and `git diff --check`.
Independent full regeneration checks both complete output trees byte-for-byte;
each collection also passes official raw/normalized Native lint, semantic/body
equivalence and two-migration byte comparison. Final hosted Validate evidence is
recorded on PR #12 against the signed final commit.

Checksum-verified Gitleaks 8.30.1 passes: **3,727 attributed findings / 0 unresolved**
(3,543 auth fingerprints, 158 upstream examples, 26 synthetic token IDs; 396 upstream
and 12 synthetic email occurrences). The official Darwin x64 archive checksum is
`dfe101a4db2255fc85120ac7f3d25e4342c3c20cf749f2c20a18081af1952709`; the installed
scanner also matches the archive's extracted executable exactly.

## Deferred global converter isolation

The converter's shared working-graph mutation/order dependence remains a separate
follow-up. This correction changes neither `convert()` nor `subsetSchema()`, and
the pristine request-body authority mechanism is unchanged. The earlier rejected
global-isolation experiment and its non-body drift are documented in the
historical audit linked above. This work was completed and merged in PR #12 as part of v0.1.0. The separate upstream-update PR #13 was later closed as superseded and was not incorporated into PR #12.
