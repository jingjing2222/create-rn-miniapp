# docs index

문서 루트는 얇게 유지하고, 상세 규칙은 하위 문서와 Skill로 분리합니다.

## 문서 구조
- `ai/`: `Plan`, `Status`, `Decisions`, `Prompt`
- `product/`: 제품 요구사항
- `engineering/`: 강제 규칙과 구조 정책

## engineering 문서
- `engineering/repo-contract.md`
- `engineering/frontend-policy.md`
- `engineering/workspace-topology.md`

## Skill 구조

## verify
{{rootVerifyStepsMarkdown}}

## 운영 메모
- 새 규칙은 먼저 `engineering/*`에 들어갈지, Skill로 분리할지 구분한다.
- 문서 경로를 바꾸면 `AGENTS.md`, `CLAUDE.md`, Copilot instructions, Skill 경로를 같이 갱신한다.
