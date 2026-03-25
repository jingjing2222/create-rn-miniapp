---
name: firebase-functions
description: >-
  Diagnose a Firebase-backed server workspace: choose callable, HTTP, or
  trigger surfaces; check project, region, emulator, and client-linkage drift;
  and separate local linkage issues from remote Firestore or IAM readiness. Do
  not use for deploy, seed, or repair procedures.
metadata:
  create-rn-miniapp.agentsLabel: "Firebase Functions 작업"
  create-rn-miniapp.category: "optional"
  create-rn-miniapp.order: "7"
---

# Firebase Functions Skill

Firebase provider를 진단할 때 쓰는 decision skill이다.
목표는 callable/http/trigger surface를 먼저 고르고, region/project drift와 remote readiness 부족을 local 코드 문제와 분리하는 것이다.

## Use when

- callable, http, Firestore trigger 중 어느 surface인지 먼저 정해야 할 때
- project id, region, emulator, client linkage drift를 확인할 때
- Firestore permission 문제와 deploy readiness 문제를 분리할 때

## Do not use for

- deploy, seed, Firestore repair 같은 원격 mutate 절차 실행
- MiniApp/AppInToss capability 탐색: `docs-search` 또는 공식 문서
- route/page/navigation 설계: `granite-routing`

## Read in order

1. `server/.create-rn-miniapp/state.json`
2. `server/README.md`
3. `references/server-common.md`
4. `references/provider-overlay.md`
5. workspace ownership이 헷갈리면 `docs/engineering/workspace-topology.md`

## Default checks

1. callable, http, Firestore trigger 중 어떤 surface인지 먼저 적는다.
2. `FIREBASE_PROJECT_ID`, `FIREBASE_FUNCTION_REGION`이 client env와 같은지 본다.
3. emulator, deployed function, direct Firestore read 중 어디에서만 깨지는지 분리한다.
4. Blaze, IAM, Firestore readiness 부족이면 코드 수정보다 remote readiness로 분류한다.

## Failure signatures

- emulator는 되는데 deployed callable/http가 404 또는 region mismatch로 깨진다.
- direct Firestore read는 permission denied인데 fallback callable은 된다.
- deploy 전에 Blaze, IAM, Cloud Build, Firestore 준비 부족이 걸린다.
- frontend와 backoffice가 다른 Firebase project id를 본다.

## Smoke tests

- `node ./scripts/check-env.mjs`
- `node ./scripts/check-client-links.mjs`
- `server` `build`
- `server` `typecheck`
- `server` `dev`

## Handoff boundary

- deploy, Firestore ensure, seed, repair는 `server/README.md` `Remote Ops`
- 화면 구조는 `backoffice-react`, MiniApp route는 `granite-routing`

## Report evidence

- `state.json` 요약
- chosen surface
- project id / region / emulator 비교 결과
- permission/readiness 문제인지, local linkage 문제인지
