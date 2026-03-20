---
name: server-firebase
description: Firebase project and Functions operations, Firestore bootstrap, and env/deploy checks
---

# Server Firebase Skill

`server`가 Firebase Functions workspace일 때 사용하는 Skill입니다.

## 읽는 순서

1. `references/provider-guide.md`를 본다.
2. 구조/ownership 규칙은 `docs/engineering/workspace-topology.md`를 같이 확인한다.

## 체크 포인트

- Blaze, build IAM, Firestore 준비 여부를 확인했는가
- 기존 프로젝트 연결이면 원격 초기화 skip/apply 상태를 구분했는가
- Functions, Firestore rules/indexes, seed 변경이 함께 필요한지 판단했는가
