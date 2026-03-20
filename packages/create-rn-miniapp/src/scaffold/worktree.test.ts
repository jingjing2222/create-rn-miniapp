import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { access, constants, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import type { CliPrompter } from '../cli.js'
import {
  createWorktreeBaselineCommit,
  createPostMergeHook,
  createWorktreePolicyNote,
  installWorktreeHooks,
  resolveWorktreePolicySelection,
} from './worktree.js'

test('resolveWorktreePolicySelection returns explicit worktree selection without prompting', async () => {
  const prompt: CliPrompter = {
    async text() {
      throw new Error('text prompt should not be called')
    },
    async select() {
      throw new Error('select prompt should not be called')
    },
  }

  assert.equal(
    await resolveWorktreePolicySelection({
      prompt,
      noGit: false,
      yes: false,
      explicitWorktree: true,
    }),
    true,
  )
})

test('resolveWorktreePolicySelection skips worktree activation when no-git is enabled', async () => {
  const prompt: CliPrompter = {
    async text() {
      throw new Error('text prompt should not be called')
    },
    async select() {
      throw new Error('select prompt should not be called')
    },
  }

  assert.equal(
    await resolveWorktreePolicySelection({
      prompt,
      noGit: true,
      yes: false,
      explicitWorktree: true,
    }),
    false,
  )
})

test('resolveWorktreePolicySelection asks whether to enforce the worktree workflow', async () => {
  const selectMessages: string[] = []
  const prompt: CliPrompter = {
    async text() {
      throw new Error('text prompt should not be called')
    },
    async select(options) {
      selectMessages.push(options.message)
      return 'worktree' as (typeof options.options)[number]['value']
    },
  }

  const resolved = await resolveWorktreePolicySelection({
    prompt,
    noGit: false,
    yes: false,
  })

  assert.equal(resolved, true)
  assert.deepEqual(selectMessages, [
    '에이전트가 worktree를 사용하게 할까요? (멀티 에이전트 환경에 유리합니다)',
  ])
})

test('createWorktreePolicyNote explains the repo-root workflow', () => {
  const note = createWorktreePolicyNote({ workspaceRoot: '/tmp/ebook' })

  assert.equal(note.title, 'worktree 워크플로우를 기본 규칙으로 설정했어요')
  assert.match(note.body, /repo root: \/tmp\/ebook/)
  assert.match(note.body, /baseline commit/)
  assert.match(note.body, /git worktree add -b <branch> \.\.\/<branch> main/)
  assert.match(note.body, /post-merge hook으로 같이 정리돼요/)
  assert.match(note.body, /구현, 커밋, 푸시, PR 생성은 그 worktree 안에서 진행/)
  assert.doesNotMatch(note.body, /정리: `git worktree remove <path>`/)
  assert.doesNotMatch(note.body, /control root/)
  assert.doesNotMatch(note.body, /main worktree/)
})

test('createPostMergeHook generates valid bash syntax for repo-root cleanup', () => {
  const hook = createPostMergeHook()
  const result = spawnSync('bash', ['-n', '-c', hook], { encoding: 'utf8' })

  assert.equal(result.status, 0, `bash syntax error: ${result.stderr}`)
  assert.match(hook, /git cherry main "\$branch"/)
  assert.doesNotMatch(hook, /control_root/)
})

test('installWorktreeHooks writes an executable post-merge hook into the repo root', async () => {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'create-rn-miniapp-worktree-'))

  try {
    await writeFile(path.join(workspaceRoot, '.git'), 'gitdir: ./.gitdir\n', 'utf8')
    await installWorktreeHooks(workspaceRoot)

    const hookPath = path.join(workspaceRoot, '.gitdir', 'hooks', 'post-merge')

    assert.ok((await stat(hookPath)).isFile())
    await access(hookPath, constants.X_OK)
    assert.match(await readFile(hookPath, 'utf8'), /git worktree remove/)
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true })
  }
})

test('createWorktreeBaselineCommit makes the standard worktree start command work immediately', async () => {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'create-rn-miniapp-worktree-base-'))
  const branchName = 'feat-worktree'
  const worktreeName = `${path.basename(workspaceRoot)}-${branchName}`
  const worktreeRoot = path.join(path.dirname(workspaceRoot), worktreeName)

  try {
    await writeFile(path.join(workspaceRoot, 'README.md'), '# scaffold\n', 'utf8')
    execFileSync('git', ['init'], { cwd: workspaceRoot, stdio: 'ignore' })
    execFileSync('git', ['symbolic-ref', 'HEAD', 'refs/heads/main'], {
      cwd: workspaceRoot,
      stdio: 'ignore',
    })

    await createWorktreeBaselineCommit(workspaceRoot)

    assert.equal(
      execFileSync('git', ['log', '-1', '--pretty=%s'], {
        cwd: workspaceRoot,
        encoding: 'utf8',
      }).trim(),
      'chore: bootstrap scaffold',
    )

    execFileSync('git', ['worktree', 'add', '-b', branchName, `../${worktreeName}`, 'main'], {
      cwd: workspaceRoot,
      stdio: 'ignore',
    })

    assert.ok((await stat(path.join(worktreeRoot, 'README.md'))).isFile())
  } finally {
    await rm(worktreeRoot, { recursive: true, force: true })
    await rm(workspaceRoot, { recursive: true, force: true })
  }
})
