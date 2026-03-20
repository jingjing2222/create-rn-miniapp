#!/usr/bin/env bash
set -euo pipefail

repo_root="$(git rev-parse --show-toplevel)"
cd "$repo_root"

current_branch="$(git branch --show-current)"
if [ "$current_branch" != "main" ]; then
  exit 0
fi

git worktree list --porcelain | while IFS= read -r line; do
  case "$line" in
    worktree\ *) current_wt="${line#worktree }" ;;
    branch\ refs/heads/*)
      branch="${line#branch refs/heads/}"
      [ "$branch" = "main" ] && continue

      if git cherry main "$branch" 2>/dev/null | grep -q '^+'; then
        continue
      fi

      if [ -n "$(git -C "$current_wt" status --porcelain 2>/dev/null)" ]; then
        echo "post-merge: $branch worktree에 변경사항이 있어서 건너뛰었어요"
        continue
      fi

      echo "post-merge: merged된 worktree 정리 - $branch"
      git worktree remove "$current_wt" 2>/dev/null || true
      git branch -d "$branch" 2>/dev/null || true
      ;;
  esac
done
