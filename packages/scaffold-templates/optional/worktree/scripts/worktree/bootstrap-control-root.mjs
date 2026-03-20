import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const controlRoot = path.resolve(workspaceRoot, '..')

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

await mkdir(path.join(controlRoot, '.claude'), { recursive: true })
await writeFile(path.join(controlRoot, 'AGENTS.md'), controlRootAgents, 'utf8')
await writeFile(path.join(controlRoot, 'README.md'), controlRootReadme, 'utf8')
await writeFile(
  path.join(controlRoot, '.claude', 'CLAUDE.md'),
  '프로젝트 안내는 `../AGENTS.md`와 `../main/AGENTS.md`를 먼저 읽어주세요.\n',
  'utf8',
)
