import { chmod, mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const controlRoot = path.resolve(workspaceRoot, '..')
const postMergeHookTemplatePath = fileURLToPath(new URL('./post-merge-cleanup.sh', import.meta.url))

const controlRootAgents = [
  '# AGENTS.md',
  '',
  '- 실제 작업 루트는 `main/`이에요.',
  '- 새 작업은 control root에서 `git -C main worktree add -b <branch-name> ../<branch-name> main`으로 시작해요.',
  '- 브랜치명에는 `/`를 쓰지 않고 1-depth kebab-case만 써요. 예: `feat-login`.',
  '- 구현, 커밋, 푸시, PR 생성은 `main/`이 아니라 새 sibling worktree 안에서 진행해요.',
  '- 자세한 규칙은 `main/AGENTS.md`와 `main/docs/engineering/worktree-workflow.md`를 먼저 읽어주세요.',
  '',
].join('\n')

const controlRootReadme = [
  '# Control Root',
  '',
  '이 디렉토리는 local control root예요.',
  '기본 checkout은 `main/`이고, 새 작업은 control root에서 `git -C main worktree add -b <branch-name> ../<branch-name> main`으로 시작해요.',
  '브랜치명에는 `/`를 쓰지 않고 1-depth kebab-case만 써요. 예: `feat-login`.',
  '자세한 안내는 `main/README.md`, `main/AGENTS.md`, `main/docs/engineering/worktree-workflow.md`를 먼저 확인해 주세요.',
  '',
].join('\n')

async function resolveGitDir(targetWorkspaceRoot) {
  const gitPath = path.join(targetWorkspaceRoot, '.git')
  const gitStat = await stat(gitPath)

  if (gitStat.isDirectory()) {
    return gitPath
  }

  const gitPointer = await readFile(gitPath, 'utf8')
  const match = gitPointer.match(/^gitdir:\s*(.+)\s*$/m)

  if (!match) {
    throw new Error(`git dir 포인터를 읽지 못했어요: ${gitPath}`)
  }

  return path.resolve(targetWorkspaceRoot, match[1])
}

async function installWorktreeHooks(targetWorkspaceRoot) {
  const gitDir = await resolveGitDir(targetWorkspaceRoot)
  const hooksDir = path.join(gitDir, 'hooks')
  const hookPath = path.join(hooksDir, 'post-merge')
  const hookSource = await readFile(postMergeHookTemplatePath, 'utf8')

  await mkdir(hooksDir, { recursive: true })
  await writeFile(hookPath, hookSource, 'utf8')
  await chmod(hookPath, 0o755)
}

await mkdir(path.join(controlRoot, '.claude'), { recursive: true })
await writeFile(path.join(controlRoot, 'AGENTS.md'), controlRootAgents, 'utf8')
await writeFile(path.join(controlRoot, 'README.md'), controlRootReadme, 'utf8')
await writeFile(
  path.join(controlRoot, '.claude', 'CLAUDE.md'),
  '프로젝트 안내는 `../AGENTS.md`와 `../main/AGENTS.md`를 먼저 읽어주세요.\n',
  'utf8',
)
await installWorktreeHooks(workspaceRoot)
