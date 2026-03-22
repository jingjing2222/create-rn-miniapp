# Cloudflare Worker Local Dev

- 먼저 `server/.create-rn-miniapp/state.json`으로 `trpc` 여부를 확인한다.
- 로컬 실행 기준은 `server/package.json`의 `dev`, `typecheck`, `test` 스크립트다.
- env/binding 점검은 `node ./server/scripts/check-env.mjs`를 먼저 실행한다.
- 원격 deploy나 binding repair 절차는 여기 두지 않고 `server/README.md`의 `Remote Ops`로 넘긴다.
