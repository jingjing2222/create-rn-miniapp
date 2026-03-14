---
'create-rn-miniapp': patch
'@create-rn-miniapp/scaffold-templates': patch
---

Add provider-based server provisioning for Supabase and Cloudflare during scaffold and `--add` flows.

This patch:

- keeps server scaffolding behind provider adapters so `supabase` and `cloudflare` can each own their CLI flow, workspace patching, and follow-up bootstrap behavior
- adds Cloudflare Workers support through C3, normalizes Wrangler schema references to remote URLs, and cleans up generated workspace tooling to fit the root monorepo setup
- runs provider IaC as part of scaffolding by listing existing remote projects/workers, allowing direct selection or creation, and then writing local env files when values can be resolved automatically
- writes provider-specific `server/README.md` files so generated workspaces explain their directory structure, scripts, and how they connect to `frontend` and `backoffice`
- improves generated README/docs context so new MiniApps clearly explain the Granite, `@apps-in-toss/framework`, TDS, and provider setup that this tool patches on top of the official scaffolds
