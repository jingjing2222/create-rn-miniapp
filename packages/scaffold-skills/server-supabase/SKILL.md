---
name: server-supabase
description: Supabase workspace operations, db/functions flow, and client connection checks
---

# Server Supabase Skill

`server`가 Supabase workspace일 때 사용하는 Skill입니다.

## 읽는 순서

1. `references/provider-guide.md`를 본다.
2. 구조/ownership 규칙은 `docs/engineering/workspace-topology.md`를 같이 확인한다.

## 체크 포인트

- 기존 프로젝트 연결인지 새 프로젝트 생성인지 구분했는가
- 이번 실행에서 원격 초기화를 건너뛰었는지 문서와 note에 반영했는가
- DB migration과 Edge Function 배포를 언제 직접 실행해야 하는지 명확한가
