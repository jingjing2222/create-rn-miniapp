---
"create-rn-miniapp": patch
"@create-rn-miniapp/scaffold-templates": patch
---

Improve provider auth guidance for Supabase and Firebase.

- Add clearer Supabase and Firebase deploy auth guidance to generated notes and `server/README.md`
- Add `SUPABASE_ACCESS_TOKEN` to generated `server/.env.local` so non-interactive redeploy setup is visible
- Copy Supabase and Firebase auth guide screenshots into generated server workspaces when those providers are selected
