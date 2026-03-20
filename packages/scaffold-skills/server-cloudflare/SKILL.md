---
name: server-cloudflare
description: Cloudflare Worker workspace operations, deploy flow, env ownership, and client connection checks
---

# Server Cloudflare Skill

`server`가 Cloudflare Worker일 때 사용하는 Skill입니다.

## 읽는 순서

1. `references/provider-guide.md`를 본다.
2. 구조/ownership 규칙은 `docs/engineering/workspace-topology.md`를 같이 확인한다.

## 체크 포인트

- 기존 Worker 연결인지 새 Worker 생성인지 구분했는가
- 이번 실행에서 원격 초기화를 건너뛰었는지 반영했는가
- `frontend`/`backoffice`의 API base URL과 Worker 배포 대상이 같이 맞는가
