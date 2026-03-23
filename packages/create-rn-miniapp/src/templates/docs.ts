import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { listInstalledProjectSkillEntries, type InstalledProjectSkill } from '../skills/install.js'
import {
  GENERATED_REPO_SKILLS_STRATEGY_README_LINES,
  renderSkillsInstallExample,
  renderSkillsStandardCommandSummary,
} from '../docs/root-readme.js'
import {
  resolveTemplatesPackageRoot,
  copyDirectoryWithTokens,
  copyFileWithTokens,
} from './filesystem.js'
import {
  resolveEnabledWorkspaceFeatures,
  resolveRecommendedSkillDefinitions,
} from './feature-catalog.js'
import { renderFrontendPolicyMarkdown } from './frontend-policy.js'
import { resolveGeneratedWorkspaceOptions } from './generated-workspace.js'
import { createRootTemplateExtraTokens, renderRootVerifyStepsMarkdown } from './root.js'
import { SKILL_CATALOG } from './skill-catalog.js'
import type { GeneratedWorkspaceOptions, TemplateTokens } from './types.js'
import dedent, { dedentWithTrailingNewline } from '../runtime/dedent.js'

type DocumentDefinition = {
  relativePath: string
  ownership: 'code' | 'template'
  render?: (context: DocsRenderContext) => string | Promise<string>
  startHereOrder?: number
  engineeringDoc?: {
    agentsRepositoryLabel: string
  }
}

type CodeOwnedDocDefinition = DocumentDefinition & {
  ownership: 'code'
  render: (context: DocsRenderContext) => string | Promise<string>
}

type DocsRenderContext = {
  targetRoot: string
  tokens: TemplateTokens
  options: GeneratedWorkspaceOptions
  installedSkills: readonly InstalledProjectSkill[]
}

function renderBulletList(items: string[]) {
  if (items.length === 0) {
    return ''
  }

  return `${items.map((item) => `- ${item}`).join('\n')}\n`
}

function renderSection(title: string, body: string) {
  return `## ${title}\n${body.trimEnd()}`
}

function renderAgentsWorkspaceModelSection(options: GeneratedWorkspaceOptions) {
  return renderBulletList([
    ...resolveEnabledWorkspaceFeatures(options).flatMap((feature) => feature.agentsLines ?? []),
    '`docs`: 계약, 정책, 제품, 상태 문서',
  ])
}

function renderTopologyRootSection(options: GeneratedWorkspaceOptions) {
  return renderBulletList(
    resolveEnabledWorkspaceFeatures(options).flatMap((feature) => feature.topologyRootLines ?? []),
  )
}

function renderTopologyRolesSection(options: GeneratedWorkspaceOptions) {
  const blocks = resolveEnabledWorkspaceFeatures(options).flatMap((feature) =>
    (feature.roleSections ?? []).map(
      (section) =>
        dedent`
        ### ${section.heading}
        ${(section.lines(options)).join('\n')}
      `,
    ),
  )

  return `${blocks.join('\n\n')}\n`
}

function renderTopologyOwnershipSection(options: GeneratedWorkspaceOptions) {
  const lines = [
    '- env ownership: 각 workspace의 `.env.local`',
    ...resolveEnabledWorkspaceFeatures(options).flatMap(
      (feature) => feature.ownershipLines?.(options) ?? [],
    ),
  ]
  const importBoundaryRules = resolveEnabledWorkspaceFeatures(options).flatMap(
    (feature) => feature.importBoundaryRules?.(options) ?? [],
  )

  if (importBoundaryRules.length > 0) {
    lines.push('- import boundary:')
    lines.push(...importBoundaryRules.map((rule) => `  - ${rule}`))
  }

  return `${lines.join('\n')}\n`
}

function formatDocumentPath(relativePath: string) {
  return `\`${relativePath}\``
}

function formatDocsRelativePath(relativePath: string) {
  return formatDocumentPath(relativePath.replace(/^docs\//, ''))
}

function getDocumentDefinition(relativePath: string) {
  const definition = DOCUMENT_DEFINITIONS.find((document) => document.relativePath === relativePath)

  if (!definition) {
    throw new Error(`알 수 없는 document path입니다: ${relativePath}`)
  }

  return definition
}

function resolveStartHereDocuments() {
  return DOCUMENT_DEFINITIONS.filter(
    (document) => typeof document.startHereOrder === 'number',
  ).sort((left, right) => (left.startHereOrder ?? 0) - (right.startHereOrder ?? 0))
}

function resolveEngineeringDocuments() {
  return DOCUMENT_DEFINITIONS.filter((document) => document.engineeringDoc)
}

async function renderAgentsMarkdown(context: DocsRenderContext) {
  const { options } = context
  const repositoryContractLines = resolveEngineeringDocuments().map(
    (document) =>
      `- ${document.engineeringDoc?.agentsRepositoryLabel}: ${formatDocumentPath(document.relativePath)}`,
  )
  const startHereLines = resolveStartHereDocuments().map(
    (document, index) => `${index + 1}. ${formatDocumentPath(document.relativePath)}`,
  )
  const repoContractPath = formatDocumentPath(
    getDocumentDefinition('docs/engineering/repo-contract.md').relativePath,
  )
  const frontendPolicyPath = formatDocumentPath(
    getDocumentDefinition('docs/engineering/frontend-policy.md').relativePath,
  )

  return dedentWithTrailingNewline`
    # AGENTS.md
    
    이 문서는 생성물 루트의 빠른 진입점입니다. 상세 저장소 계약과 완료 기준은 ${repoContractPath}가 소유하고, workspace별 정책은 \`docs/engineering/*\`가 소유합니다.
    
    ## Repository Contract
    ${(repositoryContractLines).join('\n')}
    
    ## Start Here
    ${(startHereLines).join('\n')}
    
    ${renderSection('Workspace Model', renderAgentsWorkspaceModelSection(options))}
    
    ## Done
    - 세부 완료 기준은 ${repoContractPath}를 따른다.
    - frontend 변경은 ${frontendPolicyPath}까지 같이 확인한다.
  `
}

function renderDocsIndexMarkdown(tokens: TemplateTokens) {
  const engineeringDocLines = resolveEngineeringDocuments().map(
    (document) => `- ${formatDocsRelativePath(document.relativePath)}`,
  )

  return dedentWithTrailingNewline`
    # docs index
    
    문서 루트는 얇게 유지하고, 상세 규칙은 하위 문서와 Skill로 분리합니다.
    
    ## 문서 구조
    - \`ai/\`: \`Plan\`, \`Status\`, \`Decisions\`, \`Prompt\`
    - \`product/\`: 제품 요구사항
    - \`engineering/\`: 강제 규칙과 구조 정책
    
    ## engineering 문서
    ${(engineeringDocLines).join('\n')}
    
    ${renderSection('verify', renderRootVerifyStepsMarkdown(tokens.packageManager))}
    
    ## 운영 메모
    - 새 규칙은 먼저 \`engineering/*\`에 들어갈지, README optional guide에 들어갈지 구분한다.
    - agent skill 설치/업데이트 안내는 루트 \`README.md\`를 따른다.
    - 문서 경로를 바꾸면 \`AGENTS.md\`, \`CLAUDE.md\`, Copilot instructions, Skill 경로를 같이 갱신한다.
  `
}

function renderWorkspaceTopologyMarkdown(options: GeneratedWorkspaceOptions) {
  return dedentWithTrailingNewline`
    # Workspace Topology
    
    ${renderSection('루트 구조', renderTopologyRootSection(options))}
    
    ${renderSection('역할 분리', renderTopologyRolesSection(options))}
    
    ${renderSection('ownership', renderTopologyOwnershipSection(options))}
  `
}

function renderInstalledSkillReadmeLines(installedSkillIds: string[]) {
  return installedSkillIds.map((skillId) => {
    const definition = SKILL_CATALOG.find((skill) => skill.id === skillId)

    if (!definition) {
      return `- \`${skillId}\``
    }

    return `- \`${definition.id}\`: ${definition.agentsLabel}`
  })
}

function renderRootReadmeSkillSection(options: {
  installedSkillIds: string[]
  recommendedSkillIds: string[]
  recommendedSkillLabels: string[]
}) {
  if (options.installedSkillIds.length > 0) {
    return dedent`
      현재 project-local skills가 설치되어 있어요.

      ### Installed
      ${renderInstalledSkillReadmeLines(options.installedSkillIds).join('\n')}
    `
  }

  if (options.recommendedSkillLabels.length === 0) {
    return '필요할 때 project-local skills로 설치해서 팀과 같이 쓸 수 있어요.'
  }

  return dedent`
    필요할 때 project-local skills로 설치해서 팀과 같이 쓸 수 있어요.

    추천 skill: ${options.recommendedSkillLabels.join(', ')}

    설치 예시: \`${renderSkillsInstallExample(options.recommendedSkillIds)}\`
  `
}

async function renderRootReadmeMarkdown(context: DocsRenderContext) {
  const { tokens, options, installedSkills } = context
  const recommendedSkillDefinitions = resolveRecommendedSkillDefinitions(options)
  const recommendedSkillIds = recommendedSkillDefinitions.map((skill) => skill.id)
  const recommendedSkillLabels = recommendedSkillDefinitions.map((skill) => `\`${skill.id}\``)
  const installedSkillIds = installedSkills.map((skill) => skill.id)

  return dedentWithTrailingNewline`
    # ${tokens.displayName}
    
    \`create-miniapp\`로 생성한 MiniApp workspace예요.
    
    ## Start Here
    - \`AGENTS.md\`: 에이전트용 빠른 계약과 시작 순서
    - \`docs/index.md\`: 문서 구조와 verify 동선
    - \`docs/product/기능명세서.md\`: 제품 요구사항
    
    ${(GENERATED_REPO_SKILLS_STRATEGY_README_LINES).join('\n')}
    ${renderRootReadmeSkillSection({
      installedSkillIds,
      recommendedSkillIds,
      recommendedSkillLabels,
    })}
    
    ${renderSkillsStandardCommandSummary()}
    
    ## Verify
    ${(renderRootVerifyStepsMarkdown(tokens.packageManager).split('\n').filter(Boolean)).join('\n')}
  `
}

const DOCUMENT_DEFINITIONS: DocumentDefinition[] = [
  {
    relativePath: 'AGENTS.md',
    ownership: 'code',
    render: renderAgentsMarkdown,
  },
  {
    relativePath: 'README.md',
    ownership: 'code',
    render: renderRootReadmeMarkdown,
  },
  {
    relativePath: 'docs/ai/Plan.md',
    ownership: 'template',
    startHereOrder: 1,
  },
  {
    relativePath: 'docs/ai/Status.md',
    ownership: 'template',
    startHereOrder: 2,
  },
  {
    relativePath: 'docs/ai/Decisions.md',
    ownership: 'template',
    startHereOrder: 3,
  },
  {
    relativePath: 'docs/index.md',
    ownership: 'code',
    render: ({ tokens }) => renderDocsIndexMarkdown(tokens),
    startHereOrder: 4,
  },
  {
    relativePath: 'docs/product/기능명세서.md',
    ownership: 'template',
    startHereOrder: 5,
  },
  {
    relativePath: 'docs/engineering/repo-contract.md',
    ownership: 'template',
    engineeringDoc: {
      agentsRepositoryLabel: '상세 저장소 계약',
    },
  },
  {
    relativePath: 'docs/engineering/frontend-policy.md',
    ownership: 'code',
    render: ({ tokens }) => renderFrontendPolicyMarkdown(tokens.packageManager),
    engineeringDoc: {
      agentsRepositoryLabel: 'frontend 정책',
    },
  },
  {
    relativePath: 'docs/engineering/workspace-topology.md',
    ownership: 'code',
    render: ({ options }) => renderWorkspaceTopologyMarkdown(options),
    engineeringDoc: {
      agentsRepositoryLabel: 'workspace 구조',
    },
  },
]

const CODE_OWNED_DOC_DEFINITIONS: CodeOwnedDocDefinition[] = DOCUMENT_DEFINITIONS.filter(
  (document): document is CodeOwnedDocDefinition =>
    document.ownership === 'code' && typeof document.render === 'function',
)

function resolveCodeOwnedDocsInsideDocsSet() {
  return new Set(
    CODE_OWNED_DOC_DEFINITIONS.filter((definition) =>
      definition.relativePath.startsWith('docs/'),
    ).map((definition) => definition.relativePath.slice('docs/'.length)),
  )
}

async function writeCodeOwnedMarkdown(targetRoot: string, relativePath: string, source: string) {
  const targetPath = path.join(targetRoot, ...relativePath.split('/'))
  await mkdir(path.dirname(targetPath), { recursive: true })
  await writeFile(targetPath, source, 'utf8')
}

export async function applyDocsTemplates(targetRoot: string, tokens: TemplateTokens) {
  const templatesRoot = resolveTemplatesPackageRoot()
  const baseTemplateDir = path.join(templatesRoot, 'base')
  const options = await resolveGeneratedWorkspaceOptions(targetRoot)
  const installedSkills = await listInstalledProjectSkillEntries(targetRoot)
  const extraTokens = createRootTemplateExtraTokens(tokens.packageManager)
  const renderContext = {
    targetRoot,
    tokens,
    options,
    installedSkills,
  } satisfies DocsRenderContext

  await copyFileWithTokens(
    path.join(baseTemplateDir, 'CLAUDE.md'),
    path.join(targetRoot, 'CLAUDE.md'),
    tokens,
    extraTokens,
  )
  await copyDirectoryWithTokens(
    path.join(baseTemplateDir, '.github'),
    path.join(targetRoot, '.github'),
    tokens,
    { extraTokens },
  )
  await copyDirectoryWithTokens(
    path.join(baseTemplateDir, 'docs'),
    path.join(targetRoot, 'docs'),
    tokens,
    {
      skipRelativePaths: resolveCodeOwnedDocsInsideDocsSet(),
      extraTokens,
    },
  )

  for (const definition of CODE_OWNED_DOC_DEFINITIONS) {
    const renderedSource = await definition.render(renderContext)

    await writeCodeOwnedMarkdown(targetRoot, definition.relativePath, renderedSource)
  }
}
