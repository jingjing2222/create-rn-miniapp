---
"create-rn-miniapp": patch
"@create-rn-miniapp/scaffold-templates": patch
---

Add an optional tRPC overlay for Supabase and Cloudflare server providers.

- Prompt for optional tRPC setup when `supabase` or `cloudflare` is selected, and support the same flow with `--trpc`
- Generate a shared `packages/trpc` workspace so clients import `AppRouter` types from a workspace package instead of reaching into `server` with relative paths
- Wire Cloudflare Workers to import `@workspace/trpc` directly at runtime and connect Supabase Edge Functions through function-local `deno.json` import aliases instead of a sync step
- Generate provider-specific `src/lib/trpc.ts` clients for `frontend` and `backoffice`
- When tRPC is enabled, let Granite frontend workspaces typecheck shared source exports by enabling `allowImportingTsExtensions`
- When Cloudflare tRPC is enabled, treat `src/lib/trpc.ts` as the primary client and avoid generating `src/lib/api.ts`; in `--add --trpc`, ask whether existing Cloudflare API helpers should be removed
- Generate Cloudflare `wrangler.vitest.jsonc` and `vitest.config.mts` so Worker tests use local D1/R2 bindings instead of deploy-time remote bindings
- Only add tRPC API source-of-truth guidance to generated `AGENTS.md` and `server/README.md` when tRPC is actually scaffolded
- Normalize generated root workspace manifests to use `packages/*` so future shared packages can be added without changing the root workspace shape
- Update generated server guides and root README to explain the new tRPC workspace and provider-specific behavior
