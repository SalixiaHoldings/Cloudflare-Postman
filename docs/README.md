# Documentation

This directory contains both **current project policy** and **historical engineering audits**. Start with the current documents below; historical files preserve the evidence behind earlier decisions and intentionally retain the counts and conditions from the revisions they audited.

## Current documentation

- [Architecture and operations](architecture.md) — generation flow, partitioning, validation, authentication, automation, and known converter limitations.
- [Postman Native Git and Local Mode](native-git.md) — using the generated v3 YAML in Postman Desktop and how v2/v3 equivalence is validated.
- [Generated query parameters](query-policy.md) — current required/optional query behavior, the isolated secondary conversion, and the one approved omission.
- [Finite request-template construction](request-template-construction.md) — current request-body authority, bounded construction, compatibility classifications, and the reviewed 61-case inventory.
- [Cloudflare schema revision 7287cb19](schema-revision-7287cb19.md) — human-readable review of that upstream revision, including operation, auth, query, body, and converter-drift changes.
- [7287cb19 audit evidence](schema-revision-7287cb19-audit.json) — machine-readable evidence supporting that revision review.

The authoritative current revision and generated counts are also recorded in `schema-lock.json` and `dist/v2.1/manifest.json`.

## Historical engineering records

These files are retained because they explain why the current safeguards exist. Their old operation counts, warning counts, PR status, and endpoint conditions describe the audited point in time rather than the current distribution.

- [Query-default policy blocker](query-policy-blocker.md) — original query-default investigation before the current projection was approved.
- [Official query-options experiment](query-options-experiment.md) — experiment that led to the isolated query-only projection.
- [Request-body generation audit](request-body-generation-audit.md) — PR #12 diagnosis and implementation evidence that led to the current request-body validation policy.
- [Optional-union construction precedence audit](request-template-construction-diff.md) — final PR #12/v0.1.0 body-only correction audit.
- [Schema revision 73947dd](schema-revision-73947dd.md) and [audit evidence](schema-revision-73947dd-audit.json) — previous reviewed upstream update.
- [Schema revision a0eceeef](schema-revision-a0eceeef.md) — earlier upstream-schema revision review.

When a historical document conflicts with a current policy document or the pinned generated manifest, the current policy and pinned artifacts are authoritative.
