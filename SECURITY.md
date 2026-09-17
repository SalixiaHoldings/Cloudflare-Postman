# Security policy

This repository contains build tooling, generated API references, credential-free templates, and optional read-only smoke-test code. It must not contain live credentials or private identifiers.

`base_url` is intentionally public/tracked. **Never Share or commit API keys/tokens, authentication email values, real account/zone/tenant/organization IDs, customer data, or production response payloads.** Keep sensitive Postman values local only.

Report a suspected vulnerability privately through GitHub's security-advisory feature for `SalixiaHoldings/Cloudflare-Postman`. Do not include sensitive values in a public issue.

Generated reference collections describe both read and write Cloudflare APIs. Review credential scope, endpoint behavior, parameters, and payloads before sending requests. The automated live smoke test is intentionally read-only.
