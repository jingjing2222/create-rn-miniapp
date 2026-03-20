import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { access, constants, mkdtemp, readFile, rm, stat } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import type { CliPrompter } from '../cli.js'
import {
  createPostMergeHook,
  createWorktreeLayoutNote,
  initBareWorktreeLayout,
  MAIN_WORKTREE_DIRECTORY,
  resolveCreateWorktreeLayout,
} from './worktree.js'

function runGit(cwd: string, args: string[]) {
  const result = spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
  })

  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed: ${result.stderr || result.stdout}`)
  }

  return result.stdout.trim()
}

test('resolveCreateWorktreeLayout returns explicit worktree selection without prompting', async () => {
  const prompt: CliPrompter = {
    async text() {
      throw new Error('text prompt should not be called')
    },
    async select() {
      throw new Error('select prompt should not be called')
    },
  }

  assert.equal(
    await resolveCreateWorktreeLayout({
      prompt,
      noGit: false,
      yes: false,
      explicitWorktree: true,
    }),
    true,
  )
})

test('resolveCreateWorktreeLayout skips worktree conversion when no-git is enabled', async () => {
  const prompt: CliPrompter = {
    async text() {
      throw new Error('text prompt should not be called')
    },
    async select() {
      throw new Error('select prompt should not be called')
    },
  }

  assert.equal(
    await resolveCreateWorktreeLayout({
      prompt,
      noGit: true,
      yes: false,
      explicitWorktree: true,
    }),
    false,
  )
})

test('resolveCreateWorktreeLayout asks at the last git step when no explicit flag is provided', async () => {
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

  const resolved = await resolveCreateWorktreeLayout({
    prompt,
    noGit: false,
    yes: false,
  })

  assert.equal(resolved, true)
  assert.deepEqual(selectMessages, [
    '`main` 브랜치로 마무리하기 전에 worktree 레이아웃으로 바꿔둘까요?',
  ])
})

test('createWorktreeLayoutNote points users at the control root and main worktree', () => {
  const note = createWorktreeLayoutNote({
    controlRoot: '/tmp/ebook',
    workspaceRoot: '/tmp/ebook/main',
  })

  assert.equal(note.title, 'worktree 레이아웃으로 준비했어요')
  assert.match(note.body, /control root: \/tmp\/ebook/)
  assert.match(note.body, /main worktree: \/tmp\/ebook\/main/)
  assert.match(note.body, /git worktree list/)
  assert.match(note.body, /git worktree add/)
})

test('createPostMergeHook generates valid bash syntax', () => {
  const hook = createPostMergeHook()
  const result = spawnSync('bash', ['-n', '-c', hook], { encoding: 'utf8' })
  assert.equal(result.status, 0, `bash syntax error: ${result.stderr}`)
})

test('initBareWorktreeLayout creates a bare repo with a main worktree and control root shims', async () => {
  const controlRoot = await mkdtemp(path.join(os.tmpdir(), 'create-rn-miniapp-worktree-'))

  try {
    await initBareWorktreeLayout(controlRoot)
    const workspaceRoot = path.join(controlRoot, MAIN_WORKTREE_DIRECTORY)

    assert.equal(await readFile(path.join(controlRoot, '.git'), 'utf8'), 'gitdir: ./.bare\n')
    assert.ok((await stat(path.join(controlRoot, '.bare'))).isDirectory())
    assert.ok((await stat(workspaceRoot)).isDirectory())
    assert.match(await readFile(path.join(controlRoot, 'AGENTS.md'), 'utf8'), /cd main/)
    assert.match(await readFile(path.join(controlRoot, 'AGENTS.md'), 'utf8'), /git worktree list/)
    assert.match(
      await readFile(path.join(controlRoot, 'README.md'), 'utf8'),
      /실제 MiniApp repo는 `main\/` 아래에 있어요/,
    )
    assert.equal(runGit(workspaceRoot, ['symbolic-ref', '--short', 'HEAD']), 'main')
    assert.equal(
      runGit(path.join(controlRoot, '.bare'), ['symbolic-ref', '--short', 'HEAD']),
      'main',
    )
    assert.match(runGit(controlRoot, ['worktree', 'list', '--porcelain']), /main$/m)

    const hookPath = path.join(controlRoot, '.bare', 'hooks', 'post-merge')
    assert.ok(await stat(hookPath), 'post-merge hook이 존재해야 해요')
    await access(hookPath, constants.X_OK)
    assert.match(await readFile(hookPath, 'utf8'), /git worktree remove/)
  } finally {
    await rm(controlRoot, { recursive: true, force: true })
  }
})
