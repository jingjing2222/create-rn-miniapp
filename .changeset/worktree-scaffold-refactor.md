---
"create-rn-miniapp": patch
"@create-rn-miniapp/scaffold-templates": patch
---

`--worktree`는 single-root policy 플래그가 아니라, local control root를 만들고 `.gitdata + main/ + sibling worktree` 구조로 운영하게 하는 옵션이에요.

- `--worktree` scaffold는 root에 `.gitdata/`, local stub `AGENTS.md`, `.claude/CLAUDE.md`, `README.md`, 그리고 실제 기본 checkout `main/`을 함께 생성해요.
- `git init --separate-git-dir` 기반으로 control root를 초기화하고, `main/`에 baseline commit을 남겨 표준 `git -C main worktree add -b <branch-name> ../<branch-name> main` 시작 명령을 바로 실행할 수 있게 해요.
- committed `main/README.md` 맨 위에 control-root bootstrap을 넣고, 빈 디렉토리에서 `mkdir`/`cd` 후 `git clone --separate-git-dir=.gitdata <repo-url> main`, `node main/scripts/worktree/bootstrap-control-root.mjs` 순서로 시작하게 맞춰요.
- 새 worktree는 control root 바로 아래 sibling으로 만들고, 브랜치명은 `/` 없는 1-depth kebab-case를 기준으로 안내해요.
- `.gitdata/hooks/post-merge`에 main에 반영된 clean worktree를 정리하는 cleanup hook을 설치해요.
- `--add` 모드에서 control root, `main/`, sibling worktree 입력을 모두 `main/` 작업 루트로 해석하고, worktree 관련 문서를 유지해요.
- legacy control-root 레이아웃을 읽는 최소 호환은 유지해요.
- worktree 선택 시 AGENTS.md golden rule, docs index, 하네스 실행가이드, `worktree-workflow.md`를 control-root 기준 규칙으로 갱신해요.
