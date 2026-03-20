import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import {
  access,
  constants,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import type { CliPrompter } from '../cli.js'
import {
  createControlRootStubFiles,
  createWorktreeBaselineCommit,
  ensureWorktreeBootstrapReadme,
  ensureWorkspaceClaudeGuide,
  GITDATA_DIRECTORY,
  initializeWorktreeControlRoot,
  createPostMergeHook,
  createWorktreePolicyNote,
  installWorktreeHooks,
  resolveWorktreePolicySelection,
} from './worktree.js'

const repoRoot = path.resolve(import.meta.dirname, '../../../..')

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

test('createWorktreePolicyNote explains the control-root workflow', () => {
  const note = createWorktreePolicyNote({
    controlRoot: '/tmp/ebook',
    workspaceRoot: '/tmp/ebook/main',
  })

  assert.equal(note.title, 'worktree 워크플로우를 기본 규칙으로 설정했어요')
  assert.match(note.body, /control root: \/tmp\/ebook/)
  assert.match(note.body, /기본 checkout: \/tmp\/ebook\/main/)
  assert.match(note.body, /git -C main worktree add -b <branch-name> \.\.\/<branch-name> main/)
  assert.match(note.body, /브랜치명에는 `\/`를 쓰지 말고 1-depth kebab-case/)
  assert.match(note.body, /`main\/README\.md` 맨 위 bootstrap 절차/)
  assert.match(note.body, /post-merge hook으로 같이 정리돼요/)
  assert.match(note.body, /control root 바로 아래 sibling으로/)
  assert.match(note.body, /구현, 커밋, 푸시, PR 생성은 그 worktree 안에서 진행/)
  assert.match(note.body, /main\/docs\/engineering\/worktree-workflow\.md/)
})

test('createPostMergeHook reads the shared repo-root cleanup hook template', async () => {
  const hook = createPostMergeHook()
  const sharedHookPath = path.join(
    repoRoot,
    'packages',
    'scaffold-templates',
    'optional',
    'worktree',
    'scripts',
    'worktree',
    'post-merge-cleanup.sh',
  )
  const result = spawnSync('bash', ['-n', '-c', hook], { encoding: 'utf8' })

  assert.equal(hook, await readFile(sharedHookPath, 'utf8'))
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

test('bootstrap-control-root script installs the cleanup hook for plain-clone bootstrap', async () => {
  const controlRoot = await mkdtemp(path.join(os.tmpdir(), 'create-rn-miniapp-bootstrap-hook-'))
  const workspaceRoot = path.join(controlRoot, 'main')
  const worktreeScriptsRoot = path.join(workspaceRoot, 'scripts', 'worktree')
  const scriptPath = path.join(worktreeScriptsRoot, 'bootstrap-control-root.mjs')
  const templateScriptsRoot = path.join(
    repoRoot,
    'packages',
    'scaffold-templates',
    'optional',
    'worktree',
    'scripts',
    'worktree',
  )
  const templateScriptPath = path.join(templateScriptsRoot, 'bootstrap-control-root.mjs')
  const sharedHookTemplatePath = path.join(templateScriptsRoot, 'post-merge-cleanup.sh')

  try {
    await mkdir(worktreeScriptsRoot, { recursive: true })
    await initializeWorktreeControlRoot({
      controlRoot,
      workspaceRoot,
    })
    await writeFile(scriptPath, await readFile(templateScriptPath, 'utf8'), 'utf8')
    await writeFile(
      path.join(worktreeScriptsRoot, 'post-merge-cleanup.sh'),
      await readFile(sharedHookTemplatePath, 'utf8'),
      'utf8',
    )

    execFileSync('node', [scriptPath], {
      cwd: workspaceRoot,
      stdio: 'ignore',
    })

    const hookPath = path.join(controlRoot, GITDATA_DIRECTORY, 'hooks', 'post-merge')

    assert.ok((await stat(hookPath)).isFile())
    await access(hookPath, constants.X_OK)
    assert.match(await readFile(hookPath, 'utf8'), /git worktree remove/)
  } finally {
    await rm(controlRoot, { recursive: true, force: true })
  }
})

test('initializeWorktreeControlRoot creates a separated git dir for main/', async () => {
  const controlRoot = await mkdtemp(path.join(os.tmpdir(), 'create-rn-miniapp-worktree-control-'))
  const workspaceRoot = path.join(controlRoot, 'main')

  try {
    await mkdir(workspaceRoot, { recursive: true })
    await writeFile(path.join(workspaceRoot, 'README.md'), '# scaffold\n', 'utf8')

    await initializeWorktreeControlRoot({
      controlRoot,
      workspaceRoot,
    })

    assert.ok((await stat(path.join(controlRoot, GITDATA_DIRECTORY))).isDirectory())
    assert.match(await readFile(path.join(workspaceRoot, '.git'), 'utf8'), /\.gitdata/)
    assert.equal(
      execFileSync('git', ['rev-parse', '--show-toplevel'], {
        cwd: workspaceRoot,
        encoding: 'utf8',
      }).trim(),
      await realpath(workspaceRoot),
    )
  } finally {
    await rm(controlRoot, { recursive: true, force: true })
  }
})

test('createControlRootStubFiles writes local-only stubs into the control root', async () => {
  const controlRoot = await mkdtemp(path.join(os.tmpdir(), 'create-rn-miniapp-worktree-stubs-'))

  try {
    await createControlRootStubFiles(controlRoot)

    assert.match(
      await readFile(path.join(controlRoot, 'AGENTS.md'), 'utf8'),
      /실제 작업 루트는 `main\/`/,
    )
    assert.match(await readFile(path.join(controlRoot, 'README.md'), 'utf8'), /control root/)
    assert.match(
      await readFile(path.join(controlRoot, '.claude', 'CLAUDE.md'), 'utf8'),
      /main\/AGENTS\.md/,
    )
  } finally {
    await rm(controlRoot, { recursive: true, force: true })
  }
})

test('ensureWorkspaceClaudeGuide writes the committed Claude guide into the repo root', async () => {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'create-rn-miniapp-workspace-claude-'))

  try {
    await ensureWorkspaceClaudeGuide(workspaceRoot)

    assert.match(
      await readFile(path.join(workspaceRoot, '.claude', 'CLAUDE.md'), 'utf8'),
      /프로젝트 안내는 `AGENTS\.md`를 읽어주세요\./,
    )
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true })
  }
})

test('ensureWorktreeBootstrapReadme prepends the control-root bootstrap section', async () => {
  const controlRoot = await mkdtemp(path.join(os.tmpdir(), 'create-rn-miniapp-worktree-readme-'))
  const workspaceRoot = path.join(controlRoot, 'main')
  const readmePath = path.join(workspaceRoot, 'README.md')

  try {
    await mkdir(workspaceRoot, { recursive: true })
    await writeFile(
      readmePath,
      [
        '# Existing README',
        '',
        'body',
        '',
        '<!-- worktree-bootstrap:start -->',
        'old section',
        '<!-- worktree-bootstrap:end -->',
        '',
        'tail',
        '',
      ].join('\n'),
      'utf8',
    )
    await ensureWorktreeBootstrapReadme(workspaceRoot)

    const readme = await readFile(readmePath, 'utf8')

    assert.equal(
      readme.startsWith(
        '<!-- worktree-bootstrap:start -->\n## Worktree Bootstrap\n\n이 repo를 AI/멀티-agent용 control root 구조로 운영해야해요, plain clone 대신 빈 디렉토리에서 아래 순서로 시작해요.',
      ),
      true,
    )
    assert.match(readme, /mkdir create-rn-miniapp-worktree-readme-[^/\n]+/)
    assert.match(readme, /cd create-rn-miniapp-worktree-readme-[^/\n]+/)
    assert.match(readme, /git clone --separate-git-dir=\.gitdata <repo-url> main/)
    assert.match(readme, /node main\/scripts\/worktree\/bootstrap-control-root\.mjs/)
    assert.doesNotMatch(readme, /bootstrap이 끝나면 local control root에는/)
    assert.doesNotMatch(readme, /이후 새 작업은 control root에서/)
    assert.doesNotMatch(readme, /브랜치명에는 `\/`를 쓰지 않고/)
    assert.match(readme, /# Existing README/)
  } finally {
    await rm(controlRoot, { recursive: true, force: true })
  }
})

test('createWorktreeBaselineCommit makes the standard control-root worktree start command work immediately', async () => {
  const controlRoot = await mkdtemp(path.join(os.tmpdir(), 'create-rn-miniapp-worktree-base-'))
  const workspaceRoot = path.join(controlRoot, 'main')
  const branchName = 'feat-worktree'
  const branchDir = 'feat-worktree'
  const worktreeRoot = path.join(controlRoot, branchDir)

  try {
    await mkdir(workspaceRoot, { recursive: true })
    await writeFile(path.join(workspaceRoot, 'README.md'), '# scaffold\n', 'utf8')
    await initializeWorktreeControlRoot({
      controlRoot,
      workspaceRoot,
    })

    await createWorktreeBaselineCommit(workspaceRoot)

    assert.equal(
      execFileSync('git', ['log', '-1', '--pretty=%s'], {
        cwd: workspaceRoot,
        encoding: 'utf8',
      }).trim(),
      'chore: bootstrap scaffold',
    )

    execFileSync(
      'git',
      ['-C', 'main', 'worktree', 'add', '-b', branchName, `../${branchDir}`, 'main'],
      {
        cwd: controlRoot,
        stdio: 'ignore',
      },
    )

    assert.ok((await stat(path.join(worktreeRoot, 'README.md'))).isFile())
  } finally {
    await rm(controlRoot, { recursive: true, force: true })
  }
})
