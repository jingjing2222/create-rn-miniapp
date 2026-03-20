---
"create-rn-miniapp": patch
"@create-rn-miniapp/scaffold-templates": patch
---

`--worktree`는 scaffold 레이아웃을 바꾸지 않고, single-root repo 위에서 worktree workflow를 기본 규칙으로 켜는 정책 플래그예요.

- scaffold 시 `.claude/CLAUDE.md` → AGENTS.md 포인터 자동 생성 (worktree 여부 무관)
- `--worktree` CLI 플래그 및 interactive prompt 추가
- `--worktree` repo는 생성 직후 `main`에 baseline commit을 남겨 표준 `git worktree add -b <branch> ../<branch> main` 시작 명령이 바로 동작
- repo root `.git/hooks/post-merge`에 main에 반영된 clean worktree를 정리하는 cleanup hook 설치
- `--add` 모드에서 기존 worktree 정책 repo를 감지하고 관련 AGENTS / optional docs 규칙 유지
- legacy control-root 레이아웃을 읽는 최소 호환은 유지
- worktree 선택 시 AGENTS.md golden rule, docs index, 하네스 실행가이드에 worktree 안내 삽입
- scaffold-templates에 `worktree-workflow.md` optional doc 추가
