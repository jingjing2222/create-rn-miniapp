---
"create-rn-miniapp": patch
"@create-rn-miniapp/scaffold-templates": patch
---

`--worktree` 플래그로 scaffold 시 control root + `main/` worktree 레이아웃을 선택할 수 있어요.

- scaffold 시 `.claude/CLAUDE.md` → AGENTS.md 포인터 자동 생성 (worktree 여부 무관)
- `--worktree` CLI 플래그 및 interactive prompt 추가
- worktree 선택 시 bare repo → `.bare/` + `main/` worktree 자동 세팅 (git 2.38+ 필요)
- worktree control root에 AGENTS.md·README.md 안내 shim 생성
- post-merge hook으로 merged worktree 자동 정리
- `--add` 모드에서 worktree control root를 `main/`으로 자동 해석
- worktree 선택 시 AGENTS.md golden rule, docs index, 하네스 실행가이드에 worktree 안내 삽입
- scaffold-templates에 `worktree-workflow.md` optional doc 추가
