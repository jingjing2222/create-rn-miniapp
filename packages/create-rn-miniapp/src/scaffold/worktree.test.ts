import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import test from 'node:test'
import type { CliPrompter } from '../cli.js'
import {
  convertSingleRootToWorktreeLayout,
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

test('convertSingleRootToWorktreeLayout moves the scaffolded workspace into main/', async () => {
  const targetRoot = await mkdtemp(path.join(os.tmpdir(), 'create-rn-miniapp-worktree-'))

  try {
    await mkdir(path.join(targetRoot, 'docs', 'ai'), { recursive: true })
    await writeFile(path.join(targetRoot, 'package.json'), '{"name":"ebook-miniapp"}\n', 'utf8')
    await writeFile(path.join(targetRoot, 'docs', 'ai', 'Plan.md'), '# plan\n', 'utf8')

    const result = await convertSingleRootToWorktreeLayout(targetRoot)

    assert.equal(result.controlRoot, targetRoot)
    assert.equal(result.workspaceRoot, path.join(targetRoot, MAIN_WORKTREE_DIRECTORY))
    assert.equal(await readFile(path.join(targetRoot, '.git'), 'utf8'), 'gitdir: ./.bare\n')
    assert.equal(
      await readFile(path.join(result.workspaceRoot, 'package.json'), 'utf8'),
      '{"name":"ebook-miniapp"}\n',
    )
    assert.equal(
      await readFile(path.join(result.workspaceRoot, 'docs', 'ai', 'Plan.md'), 'utf8'),
      '# plan\n',
    )
    await assert.rejects(() => stat(path.join(targetRoot, 'package.json')))
    assert.equal(runGit(result.workspaceRoot, ['symbolic-ref', '--short', 'HEAD']), 'main')
    assert.match(runGit(targetRoot, ['worktree', 'list', '--porcelain']), /main$/m)
  } finally {
    await rm(targetRoot, { recursive: true, force: true })
  }
})
