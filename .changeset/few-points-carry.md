---
"create-rn-miniapp": patch
"@create-rn-miniapp/scaffold-templates": patch
---

Finish the generated frontend TypeScript config for tRPC overlays.

- Add `moduleResolution: "bundler"` and `noEmit: true` alongside `allowImportingTsExtensions`
- Keep the fix scoped to `supabase` and `cloudflare` frontends when tRPC is enabled
- Cover the full tsconfig combination in patching tests
