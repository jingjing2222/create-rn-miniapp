# server provider guide: Supabase

이 문서는 server가 Supabase workspace일 때 먼저 보는 운영 가이드예요.
현재 server는 전통적인 API 서버라기보다, Supabase 프로젝트를 다루는 운영 workspace에 가까워요.

## server가 맡는 역할
- Supabase 프로젝트 선택 또는 생성
- database migration 적용
- Edge Functions 로컬 실행과 배포
- frontend, backoffice가 붙을 Supabase 프로젝트 연결

## 가장 먼저 볼 파일
- `server/supabase/config.toml`
- `server/supabase/migrations/`
- `server/supabase/functions/api/index.ts`
- `server/package.json`
- `server/.env.local`
- `server/README.md`

## 가장 먼저 쓸 명령
- `cd server && {{packageManagerRunCommand}} db:apply`
- `cd server && {{packageManagerRunCommand}} db:apply:local`
- `cd server && {{packageManagerRunCommand}} functions:serve`
- `cd server && {{packageManagerRunCommand}} functions:deploy`

## frontend와 backoffice는 어떻게 연결되나요
- `frontend/src/lib/supabase.ts`
- `backoffice/src/lib/supabase.ts`
- 각 workspace의 `.env.local`

클라이언트는 위 파일을 통해 같은 Supabase 프로젝트에 붙어요.
DB schema와 Edge Functions를 server workspace에서 관리하고, 앱은 publishable key와 URL을 써서 접근해요.

## tRPC를 같이 골랐다면
- `packages/trpc`가 router와 `AppRouter` 타입의 canonical source예요.
- `server/scripts/trpc-sync.mjs`가 shared router를 `server/supabase/functions/_shared/trpc`로 sync해요.
- `frontend/src/lib/trpc.ts`, `backoffice/src/lib/trpc.ts`가 같은 `AppRouter` 타입을 기준으로 Edge Function `/api/trpc` endpoint를 호출해요.
- `server/supabase/functions/api/index.ts`는 Supabase Edge Functions fetch adapter로 tRPC handler를 연결해요.

## 작업할 때 먼저 확인할 것
- `server/.env.local`에 `SUPABASE_PROJECT_REF`가 있는가
- 원격 DB 반영이 필요하면 `db:apply`를 먼저 해야 하는가
- 함수 변경이면 `functions:deploy`까지 같이 해야 하는가

자세한 구조와 스크립트는 `server/README.md`를 같이 봐요.
