import { execFileSync } from 'node:child_process'
import { chmod, mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { CliPrompter } from '../cli.js'
import { runCommand } from '../commands.js'
import type { ProvisioningNote } from '../server-project.js'

export const MAIN_WORKTREE_DIRECTORY = 'main'

function createControlRootAgentsStub(workspaceDirectory: string) {
  return [
    '# AGENTS.md',
    '',
    '이 경로는 create-rn-miniapp이 만든 worktree control root예요.',
    `실제 repo root와 하네스 문서는 \`${workspaceDirectory}/\` 아래에 있어요.`,
    '',
    '## Start Here',
    `- 지금 기본 브랜치에서 바로 시작하려면 \`cd ${workspaceDirectory}\``,
    '- 상태 확인: `git worktree list`',
    `- 새 worktree 만들기 (control root에서): \`git worktree add -b <branch> ./<branch> ${workspaceDirectory}\``,
    '- 작업할 worktree 안의 `AGENTS.md`를 먼저 읽어요.',
    '',
    '## Cleanup',
    '- 작업이 끝난 worktree 정리: `git worktree remove <path>`',
    `- \`${workspaceDirectory}/\`에서 \`git pull\` 하면 merged된 worktree가 자동으로 정리돼요 (post-merge hook).`,
    '- 변경사항이 남아있는 worktree는 건너뛰어요.',
    '',
    '## Do Not',
    '- control root에서 `git commit`',
    '- control root에서 `git push`',
    '',
  ].join('\n')
}

function createControlRootReadmeStub(workspaceDirectory: string) {
  return [
    '# Worktree Control Root',
    '',
    '이 경로는 로컬 worktree를 관리하는 control root예요.',
    `실제 MiniApp repo는 \`${workspaceDirectory}/\` 아래에 있어요.`,
    '',
    '## Start',
    '- 상태 확인: `git worktree list`',
    `- 새 worktree 만들기 (control root에서): \`git worktree add -b <branch> ./<branch> ${workspaceDirectory}\``,
    '- 정리: `git worktree remove <path>`',
    `- \`${workspaceDirectory}/\`에서 \`git pull\` 하면 merged된 worktree가 자동 정리돼요.`,
    `- 기본 브랜치에서 바로 시작하려면 \`cd ${workspaceDirectory}\``,
    '',
  ].join('\n')
}

export function createPostMergeHook() {
  return `#!/usr/bin/env bash
# post-merge: merged된 worktree 자동 정리
# squash/rebase merge도 감지하기 위해 git cherry를 사용
set -euo pipefail

control_root="$(git rev-parse --show-toplevel)/.."
cd "$control_root"

git worktree list --porcelain | while IFS= read -r line; do
  case "$line" in
    worktree\\ *) current_wt="\${line#worktree }" ;;
    branch\\ refs/heads/*)
      branch="\${line#branch refs/heads/}"
      [ "$branch" = "main" ] && continue

      # git cherry: +는 미반영, -는 반영됨. +가 하나라도 있으면 아직 merge 안 된 것
      if git cherry main "$branch" 2>/dev/null | grep -q '^+'; then
        continue
      fi

      # dirty worktree는 건너뜀
      if [ -n "$(git -C "$current_wt" status --porcelain 2>/dev/null)" ]; then
        echo "post-merge: $branch worktree에 변경사항이 있어서 건너뛰었어요"
        continue
      fi

      echo "post-merge: merged된 worktree 정리 — $branch"
      git worktree remove "$current_wt" 2>/dev/null || true
      git branch -d "$branch" 2>/dev/null || true
      ;;
  esac
done
`
}

async function writeControlRootShims(controlRoot: string) {
  await writeFile(
    path.join(controlRoot, 'AGENTS.md'),
    createControlRootAgentsStub(MAIN_WORKTREE_DIRECTORY),
    'utf8',
  )

  const claudeDir = path.join(controlRoot, '.claude')
  await mkdir(claudeDir, { recursive: true })
  await writeFile(
    path.join(claudeDir, 'CLAUDE.md'),
    '이 경로는 worktree control root예요. 자세한 안내는 `AGENTS.md`를 읽어주세요.\n',
    'utf8',
  )

  await writeFile(
    path.join(controlRoot, 'README.md'),
    createControlRootReadmeStub(MAIN_WORKTREE_DIRECTORY),
    'utf8',
  )

  const hooksDir = path.join(controlRoot, '.bare', 'hooks')
  await mkdir(hooksDir, { recursive: true })
  const hookPath = path.join(hooksDir, 'post-merge')
  await writeFile(hookPath, createPostMergeHook(), 'utf8')
  await chmod(hookPath, 0o755)
}

export function createWorktreeLayoutNote(options: { controlRoot: string; workspaceRoot: string }) {
  return {
    title: 'worktree 레이아웃으로 준비했어요',
    body: [
      `control root: ${options.controlRoot}`,
      `main worktree: ${options.workspaceRoot}`,
      '상태 확인: `git worktree list`',
      '새 worktree 만들기 (control root에서): `git worktree add -b <branch> ./<branch> main`',
      '`main/`에서 `git pull` 하면 merged된 worktree가 자동으로 정리돼요.',
      '실제 repo 작업은 `main/` 또는 추가 worktree 안에서 진행해 주세요.',
    ].join('\n'),
  } satisfies ProvisioningNote
}

export async function resolveCreateWorktreeLayout(options: {
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
      message: '`main` 브랜치로 마무리하기 전에 worktree 레이아웃으로 바꿔둘까요?',
      options: [
        { label: '아니요, 지금은 single-root로 둘게요', value: 'single-root' },
        { label: '네, `main/` worktree로 바꿔둘게요', value: 'worktree' },
      ],
      initialValue: 'single-root',
    })) === 'worktree'
  )
}

function assertMinimumGitVersion(minimum: string) {
  const raw = execFileSync('git', ['--version'], { encoding: 'utf8' }).trim()
  const match = raw.match(/(\d+\.\d+\.\d+)/)
  const current = match?.[1] ?? '0.0.0'

  const [curMajor, curMinor] = current.split('.').map(Number)
  const [minMajor, minMinor] = minimum.split('.').map(Number)

  if (curMajor < minMajor || (curMajor === minMajor && curMinor < minMinor)) {
    throw new Error(`worktree 레이아웃에는 git ${minimum} 이상이 필요해요. 현재: ${current}`)
  }
}

export async function initBareWorktreeLayout(controlRoot: string) {
  assertMinimumGitVersion('2.38.0')

  await runCommand({
    cwd: controlRoot,
    command: 'git',
    args: ['init', '--bare', '.bare'],
    label: 'worktree control root git 저장소 만들기',
  })
  await writeFile(path.join(controlRoot, '.git'), 'gitdir: ./.bare\n', 'utf8')
  await runCommand({
    cwd: controlRoot,
    command: 'git',
    args: ['symbolic-ref', 'HEAD', 'refs/heads/main'],
    label: 'bare repo 기본 브랜치를 main으로 맞추기',
  })
  await runCommand({
    cwd: controlRoot,
    command: 'git',
    args: ['worktree', 'add', '--orphan', MAIN_WORKTREE_DIRECTORY],
    label: '`main` worktree 만들기',
  })
  await writeControlRootShims(controlRoot)
}
