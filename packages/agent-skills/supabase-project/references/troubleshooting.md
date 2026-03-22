# Supabase Project Troubleshooting

- `state.json`의 `remoteInitialization`이 `skipped` 또는 `not-run`이면 원격 DB나 함수 반영을 가정하지 않는다.
- `node ./server/scripts/check-env.mjs`와 `node ./server/scripts/check-client-links.mjs` 출력부터 확인한다.
- `frontend`/`backoffice` env와 `server/.env.local`의 project ref가 같은 프로젝트를 가리키는지 본다.
- 원격 mutate가 필요하면 Skill이 아니라 `server/README.md`의 `Remote Ops`를 따른다.
