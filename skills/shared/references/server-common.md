# server common decision guide

## 먼저 분류한다

1. runtime / layout drift
- provider entrypoint, config file, generated workspace layout이 어긋났다.
2. env / client-linkage drift
- `server/.env.local`, client env, client entry file이 서로 다른 대상을 가리킨다.
3. boundary drift
- tRPC contract, app-router, client import order가 바뀌었다. 이 경우 `trpc-boundary`로 넘긴다.
4. remote state gap
- deploy, db apply, rules/indexes, seed, dashboard repair가 필요하다. 이 경우 skill 본문에서 계속하지 말고 `server/README.md`의 `Remote Ops`로 넘긴다.

## 읽는 순서

1. `server/.create-rn-miniapp/state.json`
2. `server/README.md`
3. `node ./scripts/check-env.mjs`
4. `node ./scripts/check-client-links.mjs`
5. `server/package.json`의 local smoke script
6. provider overlay reference

## state.json 해석 기준

- `serverProvider`: 현재 server workspace의 source of truth provider다.
- `serverProjectMode`: `create`면 새로 만든 remote를 기준으로, `existing`이면 가져온 remote를 기준으로 drift를 의심한다.
- `remoteInitialization`: `applied`만 remote parity가 한 번 맞춰졌다는 신호다.
- `remoteInitialization`이 `skipped` 또는 `not-run`이면 local 파일만 보고 remote 상태를 가정하지 않는다.
- `trpc`, `backoffice`는 어떤 client linkage 파일을 기대해야 하는지 결정한다.

## local truth 와 remote truth

- local truth는 repo 파일, generated README, `state.json`, read-only check script 출력이다.
- remote truth는 실제 provider resource 상태다.
- local truth가 맞아도 remote가 안 맞을 수 있다.
- remote mutate가 필요한 순간부터 skill은 diagnosis까지만 하고 실행은 `server/README.md`로 넘긴다.

## env ownership 과 client linkage

- `server/.env.local`은 deploy/project metadata를 소유한다.
- `frontend/.env.local`, `backoffice/.env.local`은 consumer가 읽는 공개 연결값만 소유한다.
- linkage는 `server/.env.local` -> client env -> client entry file -> 실제 call site 순서로 확인한다.
- frontend와 backoffice가 서로 다른 backend를 가리키면 UI 버그로 넘기지 말고 linkage drift로 분류한다.

## local smoke loop

- read-only check 두 개를 먼저 실행한다.
- 그다음 provider local script (`dev`, `typecheck`, `test`, local-only apply/serve`)를 돈다.
- local smoke가 깨지면 remote 명령으로 건너뛰지 않는다.
- remote 명령은 diagnosis를 끝낸 뒤 `server/README.md`의 `Remote Ops`에서만 고른다.

## handoff boundary

- `trpc-boundary`: contract, app-router, client import order, AppRouter type shape
- `granite-routing`: MiniApp route/page/params/navigation
- `tds-ui`: MiniApp component 선택과 form UI
- `backoffice-react`: backoffice 화면 archetype, state ownership, bulk-action/form 구조

## report evidence

- `state.json` 요약: provider, projectMode, remoteInitialization, trpc, backoffice
- 실행한 read-only check와 local smoke script
- 확인한 env 파일과 linkage 파일 경로
- 문제 분류: runtime/layout, env/linkage, boundary, remote state 중 무엇인지
- remote mutate를 왜 보류했는지, 또는 왜 `server/README.md`로 넘겼는지
