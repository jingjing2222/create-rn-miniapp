import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import {
  resolveTemplatesPackageRoot,
  copyDirectoryWithTokens,
  copyFileWithTokens,
} from './filesystem.js'
import {
  resolveEnabledWorkspaceFeatures,
  resolveSelectedOptionalSkillDefinitions,
} from './feature-catalog.js'
import { renderFrontendPolicyMarkdown } from './frontend-policy.js'
import { resolveGeneratedWorkspaceOptions } from './generated-workspace.js'
import { createRootTemplateExtraTokens, renderRootVerifyStepsMarkdown } from './root.js'
import { CORE_SKILL_DEFINITIONS } from './skills.js'
import type { GeneratedWorkspaceHints, GeneratedWorkspaceOptions, TemplateTokens } from './types.js'

const CODE_OWNED_DOCS_INSIDE_DOCS = new Set([
  'index.md',
  'engineering/frontend-policy.md',
  'engineering/workspace-topology.md',
])

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

function renderAgentsSkillRoutingSection(options: GeneratedWorkspaceOptions) {
  const items = [
    ...CORE_SKILL_DEFINITIONS.map((skill) => `${skill.agentsLabel}: \`${skill.docsPath}\``),
    ...resolveSelectedOptionalSkillDefinitions(options).map(
      (skill) => `${skill.agentsLabel}: \`${skill.docsPath}\``,
    ),
  ]

  return renderBulletList(items)
}

function renderDocsIndexSkillStructureSection(options: GeneratedWorkspaceOptions) {
  const optionalSkills = resolveSelectedOptionalSkillDefinitions(options)
  const lines = [
    '- canonical source: `.agents/skills/`',
    '- Claude mirror: `.claude/skills/`',
    '',
    'core skills:',
    ...CORE_SKILL_DEFINITIONS.map((skill) => `- \`${skill.docsPath}\``),
  ]

  if (optionalSkills.length > 0) {
    lines.push('', 'optional skills:', ...optionalSkills.map((skill) => `- \`${skill.docsPath}\``))
  }

  return `${lines.join('\n')}\n`
}

function renderTopologyRootSection(options: GeneratedWorkspaceOptions) {
  return renderBulletList(
    resolveEnabledWorkspaceFeatures(options).flatMap((feature) => feature.topologyRootLines ?? []),
  )
}

function renderTopologyRolesSection(options: GeneratedWorkspaceOptions) {
  const blocks = resolveEnabledWorkspaceFeatures(options).flatMap((feature) =>
    (feature.roleSections ?? []).map((section) =>
      [`### ${section.heading}`, ...section.lines(options)].join('\n'),
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

function renderTopologySkillsSection(options: GeneratedWorkspaceOptions) {
  const items = [
    ...CORE_SKILL_DEFINITIONS.map((skill) => `${skill.topologyLabel}: \`${skill.docsPath}\``),
    ...resolveSelectedOptionalSkillDefinitions(options).map(
      (skill) => `${skill.topologyLabel}: \`${skill.docsPath}\``,
    ),
  ]

  return renderBulletList(items)
}

function renderAgentsMarkdown(tokens: TemplateTokens, options: GeneratedWorkspaceOptions) {
  return [
    '# AGENTS.md',
    '',
    '이 문서는 생성물 루트 계약서입니다. 강제 규칙은 여기와 `docs/engineering/*`에 남기고, 반복 작업법과 외부 플랫폼 카탈로그는 `.agents/skills/*`로 분리합니다.',
    '',
    '## Repository Contract',
    `- 루트 툴체인: \`${tokens.packageManagerCommand} + nx + biome\``,
    `- 단일 검증 진입점: \`${tokens.verifyCommand}\``,
    '- 계약/정책 문서: `AGENTS.md`, `docs/index.md`, `docs/engineering/*`',
    '- canonical skills: `.agents/skills/*`',
    '- Claude mirror: `.claude/skills/*`',
    '',
    '## Hard Rules',
    '1. Plan first: 작업 전 `docs/ai/Plan.md`를 먼저 갱신한다.',
    '2. TDD first: 로직 변경과 버그 수정은 실패 테스트나 재현 절차부터 남긴다.',
    `3. Self-verify first: \`${tokens.verifyCommand}\`를 통과해야 완료로 본다.`,
    '4. Small diffs: 한 커밋과 한 PR은 하나의 목적만 가진다.',
    '5. Docs first: 구조, 경로, 규칙이 바뀌면 코드보다 문서와 Skill 경로를 먼저 맞춘다.',
    '6. No secrets: 키, 토큰, 내부 URL 같은 민감정보를 코드, 로그, PR에 남기지 않는다.',
    '7. Official scaffold first: Granite, `@apps-in-toss/framework`, Vite, provider 공식 CLI와 공식 문서를 먼저 확인한다.',
    '',
    '## Start Here',
    '1. `docs/ai/Plan.md`',
    '2. `docs/ai/Status.md`',
    '3. `docs/ai/Decisions.md`',
    '4. `docs/index.md`',
    '5. `docs/product/기능명세서.md`',
    '',
    renderSection('Workspace Model', renderAgentsWorkspaceModelSection(options)),
    '',
    renderSection('Skill Routing', renderAgentsSkillRoutingSection(options)),
    '',
    '## Done',
    '- `Plan`과 필요 시 `Status`, `Decisions`가 최신이다.',
    '- 테스트 또는 재현 절차가 먼저 남아 있다.',
    '- 문서/Skill 경로 설명과 실파일이 일치한다.',
    `- \`${tokens.verifyCommand}\`가 통과한다.`,
    '',
  ].join('\n')
}

function renderDocsIndexMarkdown(tokens: TemplateTokens, options: GeneratedWorkspaceOptions) {
  return [
    '# docs index',
    '',
    '문서 루트는 얇게 유지하고, 상세 규칙은 하위 문서와 Skill로 분리합니다.',
    '',
    '## 문서 구조',
    '- `ai/`: `Plan`, `Status`, `Decisions`, `Prompt`',
    '- `product/`: 제품 요구사항',
    '- `engineering/`: 강제 규칙과 구조 정책',
    '',
    '## engineering 문서',
    '- `engineering/repo-contract.md`',
    '- `engineering/frontend-policy.md`',
    '- `engineering/workspace-topology.md`',
    '',
    renderSection('Skill 구조', renderDocsIndexSkillStructureSection(options)),
    '',
    renderSection('verify', renderRootVerifyStepsMarkdown(tokens.packageManager)),
    '',
    '## 운영 메모',
    '- 새 규칙은 먼저 `engineering/*`에 들어갈지, Skill로 분리할지 구분한다.',
    '- 문서 경로를 바꾸면 `AGENTS.md`, `CLAUDE.md`, Copilot instructions, Skill 경로를 같이 갱신한다.',
    '',
  ].join('\n')
}

function renderWorkspaceTopologyMarkdown(options: GeneratedWorkspaceOptions) {
  return [
    '# Workspace Topology',
    '',
    renderSection('루트 구조', renderTopologyRootSection(options)),
    '',
    renderSection('역할 분리', renderTopologyRolesSection(options)),
    '',
    renderSection('ownership', renderTopologyOwnershipSection(options)),
    '',
    renderSection('참고 Skill', renderTopologySkillsSection(options)),
    '',
  ].join('\n')
}

async function writeCodeOwnedMarkdown(targetRoot: string, relativePath: string, source: string) {
  const targetPath = path.join(targetRoot, ...relativePath.split('/'))
  await mkdir(path.dirname(targetPath), { recursive: true })
  await writeFile(targetPath, source, 'utf8')
}

export async function applyDocsTemplates(
  targetRoot: string,
  tokens: TemplateTokens,
  hints: GeneratedWorkspaceHints,
) {
  const templatesRoot = resolveTemplatesPackageRoot()
  const baseTemplateDir = path.join(templatesRoot, 'base')
  const options = await resolveGeneratedWorkspaceOptions(targetRoot, hints)
  const extraTokens = createRootTemplateExtraTokens(tokens.packageManager)

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
      skipRelativePaths: CODE_OWNED_DOCS_INSIDE_DOCS,
      extraTokens,
    },
  )

  await writeCodeOwnedMarkdown(targetRoot, 'AGENTS.md', renderAgentsMarkdown(tokens, options))
  await writeCodeOwnedMarkdown(
    targetRoot,
    'docs/index.md',
    renderDocsIndexMarkdown(tokens, options),
  )
  await writeCodeOwnedMarkdown(
    targetRoot,
    'docs/engineering/workspace-topology.md',
    renderWorkspaceTopologyMarkdown(options),
  )
  await writeCodeOwnedMarkdown(
    targetRoot,
    'docs/engineering/frontend-policy.md',
    renderFrontendPolicyMarkdown(tokens.packageManagerRunCommand),
  )
}
