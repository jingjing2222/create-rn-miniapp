# CLAUDE.md

이 저장소의 기본 계약과 onboarding 순서는 `AGENTS.md`가 소유합니다. Claude 계열 에이전트는 생성물 루트 `AGENTS.md`의 `Start Here`와 `Done`을 그대로 따릅니다.

추가 규칙:
- 상세 저장소 계약과 완료 기준은 `docs/engineering/repo-contract.md`를 따른다.
- workspace별 세부 정책은 `docs/engineering/*`를 따른다.
- 작업 플레이북과 외부 플랫폼 지식은 `.claude/skills/` 아래 mirror된 Skill을 사용한다.
- `.claude/skills/`는 `.agents/skills/`의 mirror이므로, drift가 의심되면 `{{skillsCheckCommand}}` 또는 `{{skillsSyncCommand}}`를 먼저 실행한다.

우선순위:
- 계약/정책: `AGENTS.md`, `docs/index.md`, `docs/engineering/*`
- 작업 상태: `docs/ai/*`
- 플레이북/카탈로그: `.claude/skills/*`

민감정보는 코드, 로그, PR, 문서에 남기지 않는다.
