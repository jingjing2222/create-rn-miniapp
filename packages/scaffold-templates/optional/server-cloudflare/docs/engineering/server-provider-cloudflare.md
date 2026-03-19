# server provider guide: Cloudflare

이 문서는 server가 Cloudflare Worker workspace일 때 먼저 보는 운영 가이드예요.
이 경우 server는 실제 배포되는 HTTP API workspace예요.

## server가 맡는 역할
- Cloudflare account와 Worker 연결
- D1 database와 R2 bucket 연결
- Worker 로컬 실행, build, typecheck, deploy
- frontend, backoffice가 호출할 API base URL 관리

## 가장 먼저 볼 파일
- `server/wrangler.jsonc`
- `server/src/index.ts`
- `server/package.json`
- `server/.env.local`
- `server/README.md`

## 가장 먼저 쓸 명령
- `cd server && {{packageManagerRunCommand}} dev`
- `cd server && {{packageManagerRunCommand}} build`
- `cd server && {{packageManagerRunCommand}} typecheck`
- `cd server && {{packageManagerRunCommand}} deploy`

## frontend와 backoffice는 어떻게 연결되나요
- plain mode: `frontend/src/lib/api.ts`, `backoffice/src/lib/api.ts`
- tRPC mode: `frontend/src/lib/trpc.ts`, `backoffice/src/lib/trpc.ts`
- 각 workspace의 `.env.local`

클라이언트는 API base URL을 읽어서 Worker를 호출해요.
Worker URL이 바뀌면 `.env.local`과 배포 경로를 같이 확인해야 해요.

## tRPC를 같이 골랐다면
- `packages/contracts`가 boundary schema와 type의 canonical source예요.
- `packages/app-router`가 route shape와 `AppRouter` 타입의 canonical source예요.
- Worker runtime은 `@workspace/app-router`를 직접 import해서 같은 router를 바로 써요.
- `frontend/src/lib/trpc.ts`, `backoffice/src/lib/trpc.ts`가 Worker `/trpc` endpoint를 호출해요.
- 기존 `api.ts` helper는 기본 진입점이 아니에요. 새 생성물은 `trpc.ts`만 쓰고, 기존 repo에 `--add --trpc`를 붙일 때만 정리 여부를 고르게 돼요.
- `server/src/index.ts`는 Worker fetch handler를 tRPC adapter 기준으로 다시 연결해요.
- `GET /`로 ready JSON을 확인하고, 실제 router 호출은 `/trpc` endpoint로 보면 돼요.

## 작업할 때 먼저 확인할 것
- 기존 Worker에 연결했다면 원격 초기화를 건너뛰었는지, 아니면 이번 실행에서 Worker 재배포와 `workers.dev` 활성화까지 반영했는지
- `server/.env.local`에 `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_WORKER_NAME`, `CLOUDFLARE_D1_DATABASE_ID`, `CLOUDFLARE_R2_BUCKET_NAME`이 있는가
- `server/.env.local`에 `CLOUDFLARE_API_TOKEN`이 필요하면 채워져 있는가
- `wrangler.jsonc`에 `DB`, `STORAGE` binding이 현재 리소스를 가리키는가
- API URL이 바뀌었으면 frontend/backoffice env도 같이 맞췄는가
- `wrangler.jsonc`와 실제 배포 대상이 일치하는가

자세한 구조와 스크립트는 `server/README.md`를 같이 봐요.
