# Supabase Project Client Connection

- frontend client: `frontend/src/lib/supabase.ts`
- backoffice client: `backoffice/src/lib/supabase.ts`
- frontend env: `frontend/.env.local`의 `MINIAPP_SUPABASE_URL`, `MINIAPP_SUPABASE_PUBLISHABLE_KEY`
- backoffice env: `backoffice/.env.local`의 `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`
- Edge Function 호출 surface는 `supabase.functions.invoke(...)` 기준으로 본다.
