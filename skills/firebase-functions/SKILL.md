---
name: firebase-functions
label: Firebase Functions 작업
category: optional
order: 7
description: Use when you need Firebase Functions project layout, local dev context, or client linkage checks. Do not use for deploy, seed, or remote repair procedures.
---

# Firebase Functions Skill

`server`가 Firebase Functions workspace일 때 사용하는 Skill입니다.

## Use when

- Firebase Functions/Firestore workspace 표면을 확인할 때
- 작업 전에 현재 scaffold state와 client linkage를 읽어야 할 때
- local dev, callable/http 진입점, env ownership을 다시 확인할 때

## Do not use for

- deploy, seed, Firestore repair 같은 원격 mutate 절차 실행
- MiniApp/AppInToss capability 탐색: `docs-search` 또는 공식 문서
- route/page/navigation 설계: `granite-routing`

## 읽는 순서

1. `server/.create-rn-miniapp/state.json`과 `server/README.md`를 먼저 확인한다.
2. `references/overview.md`를 본다.
3. 로컬 실행은 `references/local-dev.md`, client 연결은 `references/client-connection.md`, 이상 징후는 `references/troubleshooting.md`로 이동한다.
4. 구조/ownership 규칙은 `docs/engineering/workspace-topology.md`를 같이 확인한다.

## 체크 포인트

- Blaze, build IAM, Firestore 준비 여부를 확인했는가
- state.json의 `remoteInitialization`이 현재 상황과 맞는가
- `frontend`/`backoffice`가 같은 Firebase project config를 읽는가
- 원격 deploy나 seed는 이 Skill이 아니라 `server/README.md`의 Remote Ops로 넘긴다.
