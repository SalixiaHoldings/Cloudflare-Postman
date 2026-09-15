# Postman Native Git and Local Mode

This project supports Postman in two complementary ways:

- Collection v2.1 JSON remains the portable, importable representation and the compatibility target for tooling that still requires v2.1, including Newman.
- Collection v3 YAML is generated as an optional compatibility layer for Postman v12 Native Git / Local Mode.

The v3 representation is derived from the same generated Cloudflare API library; it is not an independently maintained source of truth. Changes must continue to originate from the pinned Cloudflare schema and deterministic generator rather than by hand-editing one representation independently of the other.

Postman workspace bindings in `.postman/` are local/workspace-specific and are intentionally ignored. This public repository must not contain a workspace ID, Postman Cloud resource IDs, API keys, local secrets, or other user-specific Native Git state.

The final repository layout, generation commands, pinned Postman CLI version, validation rules, and user instructions are established by the Local Mode implementation and must keep both representations reproducible and public-safe.
