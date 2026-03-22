---
'create-rn-miniapp': patch
'@create-rn-miniapp/scaffold-templates': patch
---

frontend policy를 optional skill 설치 상태와 분리했어요.

이제 생성된 workspace의 `biome.json`과 `docs/engineering/frontend-policy.md`는 local skill 설치 여부와 무관하게 항상 같은 TDS/Granite 규칙을 사용해요. optional skill은 lint 정책을 바꾸지 않고 README onboarding에만 영향을 줘요.
