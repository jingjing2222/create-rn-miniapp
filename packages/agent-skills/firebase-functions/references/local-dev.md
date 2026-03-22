# Firebase Functions Local Dev

- `server/package.json`의 `build`, `typecheck`, `logs`를 local 기준으로 본다.
- `server/.create-rn-miniapp/state.json`에서 `serverProjectMode`와 `remoteInitialization`을 먼저 확인한다.
- env 점검은 `node ./server/scripts/check-env.mjs`를 먼저 실행한다.
- deploy, seed, Firestore repair 절차는 여기 두지 않고 `server/README.md`의 `Remote Ops`로 넘긴다.
