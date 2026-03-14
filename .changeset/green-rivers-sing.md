---
'create-rn-miniapp': patch
'@create-rn-miniapp/scaffold-templates': patch
---

Add Supabase Edge Functions to the Supabase server provider flow and soften user-facing README tone.

This patch:

- scaffolds a default Supabase Edge Function (`api`) right after `supabase init`
- adds `functions:serve` and `functions:deploy` scripts to the generated Supabase `server` workspace
- updates Supabase provisioning to run `link -> db push -> functions deploy` and keeps `server/.env.local` ready for both remote database pushes and function deploys
- expands generated Supabase server documentation so the workspace explains migrations, Edge Functions, and how `frontend` and optional `backoffice` can call `supabase.functions.invoke('api')`
- rewrites root and package README copy into a softer Toss-style `~요` tone for user-facing guidance
