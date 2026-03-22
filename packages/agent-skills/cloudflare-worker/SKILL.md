---
name: cloudflare-worker
description: Use when you need Cloudflare Worker runtime layout, bindings, local dev, or client connection checks. Do not use for tRPC contract order or remote deploy and repair procedures.
---

# Cloudflare Worker Skill

`server`가 Cloudflare Worker일 때 사용하는 Skill입니다.

## Use when

- Worker runtime layout, D1/R2 binding, local dev 기준을 확인할 때
- `frontend`/`backoffice`가 어떤 env와 client entry를 써야 하는지 점검할 때
- 작업 전에 현재 scaffold state와 client 연결 상태를 읽어야 할 때

## Do not use for

- contracts/app-router/client-server 변경 순서: `trpc-boundary`
- MiniApp route/page/navigation 설계: `granite-routing`
- remote deploy, binding repair, seed 같은 원격 mutate 절차 실행

## 읽는 순서

1. `server/.create-rn-miniapp/state.json`과 `server/README.md`를 먼저 확인한다.
2. `references/overview.md`를 본다.
3. 로컬 실행은 `references/local-dev.md`, client 연결은 `references/client-connection.md`, 이상 징후는 `references/troubleshooting.md`로 이동한다.
4. 구조/ownership 규칙은 `docs/engineering/workspace-topology.md`를 같이 확인한다.

## 체크 포인트

- state.json의 `remoteInitialization`이 현재 상황과 맞는가
- `frontend`/`backoffice`의 API base URL과 Worker 배포 대상이 같이 맞는가
- tRPC schema/router 변경이면 이 Skill에서 계속하지 말고 `trpc-boundary`로 넘긴다.
