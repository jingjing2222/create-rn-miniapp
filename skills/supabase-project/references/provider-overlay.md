# Supabase provider overlay

## provider-specific default checks

- 문제를 DB schema, RLS/policy, Edge Function, env, project ref 중 어디에 속하는지 먼저 적는다.
- `server/supabase/config.toml`, `supabase/migrations/`, `supabase/functions/*/index.ts`를 같은 변경 단위로 본다.
- `server/.env.local`의 `SUPABASE_PROJECT_REF`와 frontend/backoffice의 Supabase URL host가 같은 프로젝트인지 확인한다.
- frontend와 backoffice가 서로 다른 `*.supabase.co` host를 쓰면 UI 버그보다 linkage drift를 먼저 의심한다.

## failure signatures

- `supabase.functions.invoke(...)`가 404거나 다른 프로젝트 응답을 받는다.
- local stack에서는 migration이 보이는데 remote DB에서는 안 보이고 `remoteInitialization`이 `skipped` 또는 `not-run`이다.
- browser에서만 auth/RLS 오류가 나고 repo 파일은 맞아 보인다.
- frontend와 backoffice가 서로 다른 project ref를 가리키는 URL을 쓴다.

## smoke tests

- `node ./scripts/check-env.mjs`
- `node ./scripts/check-client-links.mjs`
- `server` `dev`
- `server` `functions:serve`
- `server` `typecheck`
- `server` `db:apply:local`
- `server` `db:reset`

## handoff cues

- remote `db:apply`, `functions:deploy`, seed는 `server/README.md` `Remote Ops`
- 화면 구조나 route 문제는 `backoffice-react`, `granite-routing`

## report evidence

- `SUPABASE_PROJECT_REF`와 client URL host 비교
- DB / RLS / Edge Function / env 중 어떤 축인지
- local stack과 remote project 중 어디에서만 깨지는지
