# AGENTS.md

이 문서는 생성물 루트 계약서입니다. 강제 규칙은 여기와 `docs/engineering/*`에 남기고, 반복 작업법과 외부 플랫폼 카탈로그는 `.agents/skills/*`로 분리합니다.

## Repository Contract
- 루트 툴체인: `{{packageManagerCommand}} + nx + biome`
- 단일 검증 진입점: `{{verifyCommand}}`
- 계약/정책 문서: `AGENTS.md`, `docs/index.md`, `docs/engineering/*`
- canonical skills: `.agents/skills/*`
- Claude mirror: `.claude/skills/*`

## Hard Rules
1. Plan first: 작업 전 `docs/ai/Plan.md`를 먼저 갱신한다.
2. TDD first: 로직 변경과 버그 수정은 실패 테스트나 재현 절차부터 남긴다.
3. Self-verify first: `{{verifyCommand}}`를 통과해야 완료로 본다.
4. Small diffs: 한 커밋과 한 PR은 하나의 목적만 가진다.
5. Docs first: 구조, 경로, 규칙이 바뀌면 코드보다 문서와 Skill 경로를 먼저 맞춘다.
6. No secrets: 키, 토큰, 내부 URL 같은 민감정보를 코드, 로그, PR에 남기지 않는다.
7. Official scaffold first: Granite, `@apps-in-toss/framework`, Vite, provider 공식 CLI와 공식 문서를 먼저 확인한다.

## Start Here
1. `docs/ai/Plan.md`
2. `docs/ai/Status.md`
3. `docs/ai/Decisions.md`
4. `docs/index.md`
5. `docs/product/기능명세서.md`

## Workspace Model

## Skill Routing

## Done
- `Plan`과 필요 시 `Status`, `Decisions`가 최신이다.
- 테스트 또는 재현 절차가 먼저 남아 있다.
- 문서/Skill 경로 설명과 실파일이 일치한다.
- `{{verifyCommand}}`가 통과한다.
