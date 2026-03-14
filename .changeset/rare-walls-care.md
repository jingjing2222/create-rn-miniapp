---
'create-rn-miniapp': patch
'@create-rn-miniapp/scaffold-templates': patch
---

Stop generating an unused `resolveOptionalMiniappEnv()` helper in
`frontend/granite.config.ts` for providers that only need required env values.

Supabase and Cloudflare scaffolds now emit a cleaner Granite config, while
Firebase keeps the optional helper for `MINIAPP_FIREBASE_MEASUREMENT_ID`.
