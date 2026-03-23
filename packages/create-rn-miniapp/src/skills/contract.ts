import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const packageJson = require('../../package.json') as {
  repository?: {
    url?: string
  }
}

export const SKILLS_SOURCE_REPO = resolveGitHubRepositorySlug(packageJson.repository?.url)
export const PROJECT_SKILLS_CANONICAL_DIR = '.agents/skills'
export const PROJECT_SKILLS_MIRROR_DIR = '.claude/skills'
export const PROJECT_SKILLS_LOCAL_DIR = 'skills'
export const PROJECT_SKILLS_DIR_CANDIDATES = [
  PROJECT_SKILLS_CANONICAL_DIR,
  PROJECT_SKILLS_LOCAL_DIR,
  PROJECT_SKILLS_MIRROR_DIR,
] as const
export const SKILLS_LIST_COMMAND = 'npx skills list'
export const SKILLS_CHECK_COMMAND = 'npx skills check'
export const SKILLS_UPDATE_COMMAND = 'npx skills update'

function resolveGitHubRepositorySlug(repositoryUrl: string | undefined) {
  if (!repositoryUrl) {
    throw new Error('repository.url이 비어 있어 skills source repo를 계산할 수 없어요.')
  }

  const normalizedUrl = repositoryUrl.replace(/^git\+/, '').replace(/\.git$/, '')
  const match = /^https:\/\/github\.com\/([^/]+\/[^/]+)$/.exec(normalizedUrl)

  if (!match?.[1]) {
    throw new Error(`GitHub repository url을 slug로 바꿀 수 없어요: ${repositoryUrl}`)
  }

  return match[1]
}

export function createProjectSkillDocPath(
  skillId: string,
  skillsRoot = PROJECT_SKILLS_CANONICAL_DIR,
) {
  return `${skillsRoot}/${skillId}/SKILL.md`
}

export function createProjectSkillDirectoryPath(
  skillId: string,
  skillsRoot = PROJECT_SKILLS_CANONICAL_DIR,
) {
  return `${skillsRoot}/${skillId}`
}

export function createProjectSkillGeneratedPath(
  skillId: string,
  relativePath: string,
  skillsRoot = PROJECT_SKILLS_CANONICAL_DIR,
) {
  return `${skillsRoot}/${skillId}/${relativePath}`
}

export function createSkillsAddArgs(options: {
  source: string
  skillIds: readonly string[]
  copy?: boolean
  yes?: boolean
}) {
  return [
    'add',
    options.source,
    ...options.skillIds.flatMap((skillId) => ['--skill', skillId]),
    ...(options.copy === false ? [] : ['--copy']),
    ...(options.yes === true ? ['-y'] : []),
  ]
}
