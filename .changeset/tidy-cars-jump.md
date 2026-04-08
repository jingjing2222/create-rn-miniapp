---
"create-rn-miniapp": patch
---

`tds-ui` skill이 스캐폴딩 시 공식 TDS React Native `llms.txt`, `llms-full.txt` 스냅샷을 함께 복사하도록 정리했습니다.

- source repo의 `skills/tds-ui/generated/`에 공식 snapshot을 vendoring했습니다.
- skill metadata, AGENTS, references는 로컬 snapshot을 canonical truth source로 읽고 upstream URL은 refresh source로만 유지합니다.
- 관련 템플릿 테스트를 갱신해 bundled snapshot 계약이 깨지면 바로 실패하도록 고정했습니다.
