import { execFileSync } from 'node:child_process'
import { chmod, mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import type { CliPrompter } from '../cli.js'
import type { ProvisioningNote } from '../server-project.js'

export const MAIN_WORKTREE_DIRECTORY = 'main'

export function createWorktreePolicyNote(options: { workspaceRoot: string }) {
  return {
    title: 'worktree 워크플로우를 기본 규칙으로 설정했어요',
    body: [
      `repo root: ${options.workspaceRoot}`,
      '`main`에는 scaffold 결과를 담은 baseline commit을 먼저 만들어 두었어요.',
      '표준 시작: `git worktree add -b <branch> ../<branch> main`',
      '상태 확인: `git worktree list`',
      '`main`에서 `git pull --ff-only` 하면 merge된 clean worktree는 post-merge hook으로 같이 정리돼요.',
      '구현, 커밋, 푸시, PR 생성은 그 worktree 안에서 진행해 주세요.',
      '자세한 규칙은 `docs/engineering/worktree-workflow.md`를 먼저 확인해 주세요.',
    ].join('\n'),
  } satisfies ProvisioningNote
}

function hasGitCommit(workspaceRoot: string) {
  try {
    execFileSync('git', ['rev-parse', '--verify', 'HEAD'], {
      cwd: workspaceRoot,
      stdio: 'ignore',
    })
    return true
  } catch {
    return false
  }
}

export async function createWorktreeBaselineCommit(workspaceRoot: string) {
  if (hasGitCommit(workspaceRoot)) {
    return false
  }

  execFileSync('git', ['add', '-A'], {
    cwd: workspaceRoot,
    stdio: 'ignore',
  })
  execFileSync('git', ['commit', '-m', 'chore: bootstrap scaffold'], {
    cwd: workspaceRoot,
    stdio: 'ignore',
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: 'create-rn-miniapp',
      GIT_AUTHOR_EMAIL: 'create-rn-miniapp@local',
      GIT_COMMITTER_NAME: 'create-rn-miniapp',
      GIT_COMMITTER_EMAIL: 'create-rn-miniapp@local',
    },
  })

  return true
}

export function createPostMergeHook() {
  return `#!/usr/bin/env bash
set -euo pipefail

repo_root="$(git rev-parse --show-toplevel)"
cd "$repo_root"

current_branch="$(git branch --show-current)"
if [ "$current_branch" != "main" ]; then
  exit 0
fi

git worktree list --porcelain | while IFS= read -r line; do
  case "$line" in
    worktree\\ *) current_wt="\${line#worktree }" ;;
    branch\\ refs/heads/*)
      branch="\${line#branch refs/heads/}"
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
`
}

async function resolveGitDir(workspaceRoot: string) {
  const gitPath = path.join(workspaceRoot, '.git')
  const gitStat = await stat(gitPath)

  if (gitStat.isDirectory()) {
    return gitPath
  }

  const gitPointer = await readFile(gitPath, 'utf8')
  const match = gitPointer.match(/^gitdir:\s*(.+)\s*$/m)

  if (!match) {
    throw new Error(`git dir 포인터를 읽지 못했어요: ${gitPath}`)
  }

  return path.resolve(workspaceRoot, match[1])
}

export async function installWorktreeHooks(workspaceRoot: string) {
  const gitDir = await resolveGitDir(workspaceRoot)
  const hooksDir = path.join(gitDir, 'hooks')

  await mkdir(hooksDir, { recursive: true })

  const hookPath = path.join(hooksDir, 'post-merge')
  await writeFile(hookPath, createPostMergeHook(), 'utf8')
  await chmod(hookPath, 0o755)
}

export async function resolveWorktreePolicySelection(options: {
  prompt: CliPrompter
  noGit: boolean
  yes: boolean
  explicitWorktree?: boolean
}) {
  if (options.noGit) {
    return false
  }

  if (options.explicitWorktree !== undefined) {
    return options.explicitWorktree
  }

  if (options.yes) {
    return false
  }

  return (
    (await options.prompt.select({
      message: '에이전트가 worktree를 사용하게 할까요? (멀티 에이전트 환경에 유리합니다)',
      options: [
        { label: '아니요, 기본 checkout에서 시작할게요', value: 'single-root' },
        { label: '네, worktree를 쓰게 할게요', value: 'worktree' },
      ],
      initialValue: 'single-root',
    })) === 'worktree'
  )
}
