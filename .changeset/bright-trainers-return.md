---
"create-rn-miniapp": patch
"@create-rn-miniapp/scaffold-templates": patch
---

optional skills 전략을 `@vercel-labs/skills` 표준 CLI 중심으로 단순화했습니다.

- canonical skill source를 workspace package가 아니라 repo root `skills/` plain directory로 정리했습니다.
- generated repo는 skill을 기본 포함하지 않고, optional install guide와 `npx skills ...` 표준 흐름만 안내하도록 바꿨습니다.
- skill 설치 상태 판별, frontend policy reference, generated README/contract 문구가 실제 project-local skill 경로에서 파생되도록 SSoT를 정리했습니다.
