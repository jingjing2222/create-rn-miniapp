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
- `server/scripts/supabase-functions-typecheck.mjs`
- `server/package.json`
- `server/.env.local`
- `server/README.md`

## 가장 먼저 쓸 명령
- `cd server && {{packageManagerRunCommand}} typecheck`
- `cd server && {{packageManagerRunCommand}} db:apply`
- `cd server && {{packageManagerRunCommand}} db:apply:local`
- `cd server && {{packageManagerRunCommand}} functions:serve`
- `cd server && {{packageManagerRunCommand}} functions:deploy`

`typecheck`는 `supabase/functions/*/index.ts` entrypoint를 `deno check`로 정적 검사해요.

## frontend와 backoffice는 어떻게 연결되나요
- `frontend/src/lib/supabase.ts`
- `backoffice/src/lib/supabase.ts`
- 각 workspace의 `.env.local`

클라이언트는 위 파일을 통해 같은 Supabase 프로젝트에 붙어요.
DB schema와 Edge Functions를 server workspace에서 관리하고, 앱은 publishable key와 URL을 써서 접근해요.

## 작업할 때 먼저 확인할 것
- `server/.env.local`에 `SUPABASE_PROJECT_REF`가 있는가
- 기존 프로젝트에 연결했다면 원격 초기화를 건너뛰었는가, 아니면 지금 실행에서 `db:apply`, `functions:deploy`까지 반영했는가
- 함수 변경이면 `functions:deploy`까지 같이 해야 하는가

자세한 구조와 스크립트는 `server/README.md`를 같이 봐요.
