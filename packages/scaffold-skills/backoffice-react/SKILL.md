---
name: backoffice-react
description: Backoffice React/Vite state, rendering, async flow, and bundle discipline
---

# Backoffice React Skill

`backoffice`를 수정할 때 사용하는 Skill입니다.

## 읽는 순서

1. `references/best-practices.md`를 먼저 읽는다.
2. 화면 역할과 import boundary는 `docs/engineering/workspace-topology.md`를 같이 확인한다.

## 체크 포인트

- state를 실제로 쓰는 곳 근처에 뒀는가
- `useEffect`를 동기화 용도로만 쓰고 있는가
- 검색/테이블/폼처럼 무거운 화면은 경계를 나눴는가
- 번들 큰 의존성은 lazy import 대상인지 봤는가
