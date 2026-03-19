import { mkdir, readdir, rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { CliPrompter } from '../cli.js'
import { runCommand } from '../commands.js'

const WORKTREE_BOOTSTRAP_STAGING_DIR = '.create-rn-miniapp-worktree-bootstrap'
export const MAIN_WORKTREE_DIRECTORY = 'main'

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

export async function convertSingleRootToWorktreeLayout(targetRoot: string) {
  const controlRoot = path.resolve(targetRoot)
  const stagingRoot = path.join(controlRoot, WORKTREE_BOOTSTRAP_STAGING_DIR)
  const workspaceRoot = path.join(controlRoot, MAIN_WORKTREE_DIRECTORY)

  await mkdir(stagingRoot, { recursive: true })

  const existingEntries = await readdir(controlRoot, { withFileTypes: true })

  for (const entry of existingEntries) {
    if (entry.name === WORKTREE_BOOTSTRAP_STAGING_DIR) {
      continue
    }

    await rename(path.join(controlRoot, entry.name), path.join(stagingRoot, entry.name))
  }

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
    args: ['worktree', 'add', '--orphan', MAIN_WORKTREE_DIRECTORY],
    label: '`main` worktree 만들기',
  })

  const stagedEntries = await readdir(stagingRoot, { withFileTypes: true })

  for (const entry of stagedEntries) {
    await rename(path.join(stagingRoot, entry.name), path.join(workspaceRoot, entry.name))
  }

  await rm(stagingRoot, { recursive: true, force: true })

  return {
    controlRoot,
    workspaceRoot,
  }
}
