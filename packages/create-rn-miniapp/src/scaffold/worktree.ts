import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { chmod, mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import process from 'node:process'
import type { CliPrompter } from '../cli.js'
import type { ProvisioningNote } from '../server-project.js'

export const MAIN_WORKTREE_DIRECTORY = 'main'
export const GITDATA_DIRECTORY = '.gitdata'
const WORKTREE_BOOTSTRAP_START_MARKER = '<!-- worktree-bootstrap:start -->'
const WORKTREE_BOOTSTRAP_END_MARKER = '<!-- worktree-bootstrap:end -->'
const POST_MERGE_HOOK_TEMPLATE_PATH = path.join(
  'optional',
  'worktree',
  'scripts',
  'worktree',
  'post-merge-cleanup.sh',
)
const require = createRequire(import.meta.url)

function renderControlRootAgentsStub() {
  return [
    '# AGENTS.md',
    '',
    '- 실제 작업 루트는 `main/`이에요.',
    '- 새 작업은 control root에서 `git -C main worktree add -b <branch-name> ../<branch-name> main`으로 시작해요.',
    '- 브랜치명에는 `/`를 쓰지 않고 1-depth kebab-case만 써요. 예: `feat-login`.',
    '- 구현, 커밋, 푸시, PR 생성은 `main/`이 아니라 새 sibling worktree 안에서 진행해요.',
    '- 자세한 규칙은 `main/AGENTS.md`와 `main/docs/engineering/worktree-workflow.md`를 먼저 읽어주세요.',
    '',
  ].join('\n')
}

function renderControlRootReadmeStub() {
  return [
    '# Control Root',
    '',
    '이 디렉토리는 local control root예요.',
    '기본 checkout은 `main/`이고, 새 작업은 control root에서 `git -C main worktree add -b <branch-name> ../<branch-name> main`으로 시작해요.',
    '브랜치명에는 `/`를 쓰지 않고 1-depth kebab-case만 써요. 예: `feat-login`.',
    '자세한 안내는 `main/README.md`, `main/AGENTS.md`, `main/docs/engineering/worktree-workflow.md`를 먼저 확인해 주세요.',
    '',
  ].join('\n')
}

function renderControlRootClaudeStub() {
  return '프로젝트 안내는 `../AGENTS.md`와 `../main/AGENTS.md`를 먼저 읽어주세요.\n'
}

function renderWorkspaceClaudeGuide() {
  return '프로젝트 안내는 `AGENTS.md`를 읽어주세요.\n'
}

function resolveControlRootAppName(workspaceRoot: string) {
  const currentBaseName = path.basename(workspaceRoot)

  if (currentBaseName === MAIN_WORKTREE_DIRECTORY) {
    return path.basename(path.dirname(workspaceRoot))
  }

  return currentBaseName
}

function renderWorktreeBootstrapSection(appName: string) {
  return [
    WORKTREE_BOOTSTRAP_START_MARKER,
    '## Worktree Bootstrap',
    '',
    '이 repo를 AI/멀티-agent용 control root 구조로 운영해야해요, plain clone 대신 빈 디렉토리에서 아래 순서로 시작해요.',
    '',
    '```bash',
    `mkdir ${appName}`,
    `cd ${appName}`,
    'git clone --separate-git-dir=.gitdata <repo-url> main',
    'node main/scripts/worktree/bootstrap-control-root.mjs',
    '```',
    WORKTREE_BOOTSTRAP_END_MARKER,
  ].join('\n')
}

function replaceMarkedSection(source: string, renderedSection: string) {
  const startIndex = source.indexOf(WORKTREE_BOOTSTRAP_START_MARKER)
  const endIndex = source.indexOf(WORKTREE_BOOTSTRAP_END_MARKER)

  if (startIndex >= 0 && endIndex >= startIndex) {
    const withoutMarkedSection = `${source.slice(0, startIndex)}${source.slice(
      endIndex + WORKTREE_BOOTSTRAP_END_MARKER.length,
    )}`.replace(/^\n+/, '')
    const remainingSource = withoutMarkedSection.trimStart()

    return remainingSource.length > 0
      ? `${renderedSection}\n\n${remainingSource}`
      : `${renderedSection}\n`
  }

  return `${renderedSection}\n\n${source}`
}

export async function createControlRootStubFiles(controlRoot: string) {
  const claudeRoot = path.join(controlRoot, '.claude')

  await mkdir(claudeRoot, { recursive: true })
  await writeFile(path.join(controlRoot, 'AGENTS.md'), renderControlRootAgentsStub(), 'utf8')
  await writeFile(path.join(controlRoot, 'README.md'), renderControlRootReadmeStub(), 'utf8')
  await writeFile(path.join(claudeRoot, 'CLAUDE.md'), renderControlRootClaudeStub(), 'utf8')
}

export async function ensureWorkspaceClaudeGuide(workspaceRoot: string) {
  const claudeRoot = path.join(workspaceRoot, '.claude')

  await mkdir(claudeRoot, { recursive: true })
  await writeFile(path.join(claudeRoot, 'CLAUDE.md'), renderWorkspaceClaudeGuide(), 'utf8')
}

export async function ensureWorktreeBootstrapReadme(workspaceRoot: string) {
  const readmePath = path.join(workspaceRoot, 'README.md')
  const appName = resolveControlRootAppName(workspaceRoot)
  let source = '# Project\n'

  try {
    source = await readFile(readmePath, 'utf8')
  } catch {
    // README가 아직 없으면 bootstrap 섹션만 먼저 만들어요.
  }

  await writeFile(
    readmePath,
    replaceMarkedSection(source, renderWorktreeBootstrapSection(appName)),
    'utf8',
  )
}

export async function initializeWorktreeControlRoot(options: {
  controlRoot: string
  workspaceRoot: string
}) {
  await mkdir(options.workspaceRoot, { recursive: true })

  execFileSync(
    'git',
    ['init', '--separate-git-dir', path.join(options.controlRoot, GITDATA_DIRECTORY)],
    {
      cwd: options.workspaceRoot,
      stdio: 'ignore',
    },
  )
  execFileSync('git', ['symbolic-ref', 'HEAD', 'refs/heads/main'], {
    cwd: options.workspaceRoot,
    stdio: 'ignore',
  })
}

export function createWorktreePolicyNote(options: { controlRoot: string; workspaceRoot: string }) {
  return {
    title: 'worktree 워크플로우를 기본 규칙으로 설정했어요',
    body: [
      `control root: ${options.controlRoot}`,
      `기본 checkout: ${options.workspaceRoot}`,
      '`main/`에는 scaffold 결과를 담은 baseline commit을 먼저 만들어 두었어요.',
      'plain clone 상태라면 `main/README.md` 맨 위 bootstrap 절차를 먼저 실행해 주세요.',
      '표준 시작: `git -C main worktree add -b <branch-name> ../<branch-name> main`',
      '브랜치명에는 `/`를 쓰지 말고 1-depth kebab-case만 써 주세요. 예: `feat-login`',
      '새 worktree는 control root 바로 아래 sibling으로 만들어요.',
      '상태 확인: `git -C main worktree list`',
      '`main/` 최신화는 보통 control root에서 `git -C main pull --ff-only`를 써 주세요. 이 표준 경로로 갱신하면 main에 반영된 clean worktree는 post-merge hook으로 같이 정리돼요.',
      '구현, 커밋, 푸시, PR 생성은 그 worktree 안에서 진행해 주세요.',
      '자세한 규칙은 `main/AGENTS.md`와 `main/docs/engineering/worktree-workflow.md`를 먼저 확인해 주세요.',
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
  const packageJsonPath = require.resolve('@create-rn-miniapp/scaffold-templates/package.json')
  const templatesRoot = path.dirname(packageJsonPath)

  return readFileSync(path.join(templatesRoot, POST_MERGE_HOOK_TEMPLATE_PATH), 'utf8')
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
