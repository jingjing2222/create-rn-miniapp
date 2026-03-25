# Cloudflare provider overlay

## provider-specific default checks

- `state.json`의 `trpc`를 먼저 보고 `api.ts` 경로인지 `trpc.ts` 경로인지 고른다.
- `server/src/index.ts`, `wrangler.jsonc`, `wrangler.vitest.jsonc`, `worker-configuration.d.ts`를 같이 본다.
- `server/.env.local`의 Worker/account/D1/R2 metadata와 `MINIAPP_API_BASE_URL`, `VITE_API_BASE_URL`이 같은 Worker를 가리키는지 맞춘다.
- binding 문제와 client base URL 문제를 한 묶음으로 설명하지 않는다.

## failure signatures

- `Env` 타입에서 D1/R2 binding이 사라지거나 테스트에서 binding lookup이 깨진다.
- Worker local dev는 뜨는데 client에서 HTML, 404, 다른 host 응답을 받는다.
- frontend와 backoffice가 서로 다른 `workers.dev` URL이나 localhost port를 가리킨다.
- plain HTTP route는 되는데 tRPC client/type import가 깨진다. 이 경우 `trpc-boundary`다.
- 문제 재현이 remote 호출에서만 나오고 `remoteInitialization`이 `skipped` 또는 `not-run`이다.

## smoke tests

- `node ./scripts/check-env.mjs`
- `node ./scripts/check-client-links.mjs`
- `server` `dev`
- `server` `typecheck`
- `server` `build`
- `server` `test`가 있으면 local D1/R2 binding까지 같이 본다.

## handoff cues

- AppRouter, contract, client import order가 바뀌면 `trpc-boundary`
- deploy, binding repair, `workers.dev` 활성화 재시도는 `server/README.md` `Remote Ops`

## report evidence

- 현재 API base URL과 어느 client가 어떤 host를 보는지
- D1/R2 binding 문제인지, request surface 문제인지
- local dev, dry-run build, deployed Worker 중 어디에서만 깨지는지
