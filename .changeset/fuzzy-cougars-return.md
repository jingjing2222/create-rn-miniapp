---
'create-rn-miniapp': patch
---

추천 agent skills 설치 뒤 `tds-ui` 후처리가 `.agents/skills` mirror에서 `metadata.json`을 바로 읽다가 실패하던 문제를 고쳤습니다.
이제 canonical `skills/tds-ui` metadata를 기준으로 agent mirror에도 필요한 metadata와 llms mirror를 함께 동기화합니다.
