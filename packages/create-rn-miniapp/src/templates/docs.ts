import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import remarkParse from 'remark-parse'
import remarkStringify from 'remark-stringify'
import { unified } from 'unified'
import {
  copyDirectoryWithTokens,
  copyFileWithTokens,
  replaceTemplateTokens,
  resolveTemplatesPackageRoot,
} from './filesystem.js'
import { resolveGeneratedWorkspaceOptions } from './generated-workspace.js'
import { createRootTemplateExtraTokens } from './root.js'
import { CORE_SKILL_DEFINITIONS, resolveSelectedOptionalSkillDefinitions } from './skills.js'
import type { GeneratedWorkspaceHints, GeneratedWorkspaceOptions, TemplateTokens } from './types.js'

type MarkdownNode = {
  type: string
  depth?: number
  children?: MarkdownNode[]
}

type MarkdownRoot = MarkdownNode & {
  children: MarkdownNode[]
}

type MarkdownSectionDefinition = {
  render: (options: GeneratedWorkspaceOptions) => string
}

type DynamicDocDefinition = {
  relativePath: string
  sections: MarkdownSectionDefinition[]
}

type WorkspaceRoleSectionDefinition = {
  heading: string
  lines: (options: GeneratedWorkspaceOptions) => string[]
}

type WorkspaceFeatureDefinition = {
  enabled: (options: GeneratedWorkspaceOptions) => boolean
  agentsLines?: string[]
  topologyRootLines?: string[]
  roleSections?: WorkspaceRoleSectionDefinition[]
  ownershipLines?: (options: GeneratedWorkspaceOptions) => string[]
  importBoundaryRules?: (options: GeneratedWorkspaceOptions) => string[]
}

const MARKDOWN_RENDERER = unified().use(remarkParse).use(remarkStringify, {
  bullet: '-',
  listItemIndent: 'one',
})

const WORKSPACE_FEATURE_DEFINITIONS: WorkspaceFeatureDefinition[] = [
  {
    enabled: () => true,
    agentsLines: ['`frontend`: AppInToss + Granite 기반 MiniApp'],
    topologyRootLines: ['`frontend`: AppInToss + Granite 기반 MiniApp'],
    roleSections: [
      {
        heading: 'frontend',
        lines: (options) => [
          '- MiniApp UI, route, client integration을 담당한다.',
          ...(options.serverProvider !== null
            ? [
                '- provider 연결값은 각 workspace의 `.env.local`에서 읽는다.',
                '- server runtime 구현을 직접 import하지 않는다.',
              ]
            : []),
        ],
      },
    ],
    importBoundaryRules: (options) =>
      options.serverProvider !== null ? ['`frontend` ↔ `server` 직접 import 금지'] : [],
  },
  {
    enabled: (options) => options.serverProvider !== null,
    agentsLines: ['`server`: optional provider workspace'],
    topologyRootLines: ['`server`: optional provider workspace'],
    roleSections: [
      {
        heading: 'server',
        lines: (options) => [
          '- provider별 원격 리소스 운영과 server-side runtime을 담당한다.',
          '- deploy, db/functions, rules/indexes 같은 운영 스크립트의 source다.',
          '- frontend가 기대하는 env와 연결값을 제공한다.',
          ...(options.hasBackoffice ? ['- backoffice가 기대하는 env와 연결값을 제공한다.'] : []),
        ],
      },
    ],
    ownershipLines: () => [
      '- API / base URL ownership: provider workspace가 값을 정의하고 consumer workspace가 읽는다.',
    ],
  },
  {
    enabled: (options) => options.hasBackoffice,
    agentsLines: ['`backoffice`: optional Vite 기반 운영 도구'],
    topologyRootLines: ['`backoffice`: optional Vite + React 운영 도구'],
    roleSections: [
      {
        heading: 'backoffice',
        lines: (options) => [
          '- 브라우저 기반 운영 화면을 담당한다.',
          '- MiniApp 전용 runtime 대신 browser/client 패턴을 따른다.',
          ...(options.serverProvider !== null
            ? ['- server runtime 구현을 직접 import하지 않는다.']
            : []),
        ],
      },
    ],
    importBoundaryRules: (options) =>
      options.serverProvider !== null ? ['`backoffice` ↔ `server` 직접 import 금지'] : [],
  },
  {
    enabled: (options) => options.hasTrpc,
    agentsLines: [
      '`packages/contracts`, `packages/app-router`: optional shared tRPC boundary packages',
    ],
    topologyRootLines: [
      '`packages/contracts`: optional tRPC boundary schema / type source',
      '`packages/app-router`: optional tRPC router / `AppRouter` source',
    ],
    roleSections: [
      {
        heading: 'packages/contracts',
        lines: () => [
          '- boundary input/output schema와 경계 타입의 source of truth다.',
          '- consumer는 root import만 사용하고 src 상대 경로를 내려가지 않는다.',
        ],
      },
      {
        heading: 'packages/app-router',
        lines: () => [
          '- route shape와 `AppRouter` 타입의 source of truth다.',
          '- Worker runtime과 client는 이 package를 기준으로 타입을 맞춘다.',
        ],
      },
    ],
    importBoundaryRules: () => [
      'shared contract가 필요하면 `packages/contracts`, `packages/app-router`로 올린다.',
    ],
  },
]

const DYNAMIC_DOC_DEFINITIONS: DynamicDocDefinition[] = [
  {
    relativePath: 'AGENTS.md',
    sections: [
      {
        render: renderAgentsWorkspaceModelSection,
      },
      {
        render: renderAgentsSkillRoutingSection,
      },
    ],
  },
  {
    relativePath: 'docs/index.md',
    sections: [
      {
        render: renderDocsIndexSkillStructureSection,
      },
    ],
  },
  {
    relativePath: 'docs/engineering/workspace-topology.md',
    sections: [
      {
        render: renderTopologyRootSection,
      },
      {
        render: renderTopologyRolesSection,
      },
      {
        render: renderTopologyOwnershipSection,
      },
      {
        render: renderTopologySkillsSection,
      },
    ],
  },
]

const DYNAMIC_DOCS_INSIDE_DOCS = new Set(
  DYNAMIC_DOC_DEFINITIONS.map((definition) => definition.relativePath)
    .filter((relativePath) => relativePath.startsWith('docs/'))
    .map((relativePath) => relativePath.slice('docs/'.length)),
)

function resolveEnabledWorkspaceFeatures(options: GeneratedWorkspaceOptions) {
  return WORKSPACE_FEATURE_DEFINITIONS.filter((feature) => feature.enabled(options))
}

function renderBulletList(items: string[]) {
  if (items.length === 0) {
    return ''
  }

  return `${items.map((item) => `- ${item}`).join('\n')}\n`
}

function renderMarkdownBlocks(blocks: Array<string | null>) {
  return `${blocks.filter((block): block is string => block !== null).join('\n\n')}\n`
}

function parseMarkdownChildren(source: string) {
  return (MARKDOWN_RENDERER.parse(source) as MarkdownRoot).children
}

function collectEmptyHeadingSections(root: MarkdownRoot, depth: number) {
  const sections: Array<{ startIndex: number; endIndex: number }> = []

  for (let index = 0; index < root.children.length; index += 1) {
    const node = root.children[index]
    if (node.type !== 'heading' || node.depth !== depth) {
      continue
    }

    let endIndex = index + 1
    while (endIndex < root.children.length) {
      const nextNode = root.children[endIndex]
      if (
        nextNode.type === 'heading' &&
        typeof nextNode.depth === 'number' &&
        nextNode.depth <= depth
      ) {
        break
      }
      endIndex += 1
    }

    if (endIndex === index + 1) {
      sections.push({ startIndex: index, endIndex })
    }
  }

  return sections
}

function replaceEmptySectionBodies(
  root: MarkdownRoot,
  definition: DynamicDocDefinition,
  options: GeneratedWorkspaceOptions,
) {
  const emptySections = collectEmptyHeadingSections(root, 2)

  if (emptySections.length !== definition.sections.length) {
    throw new Error(
      `동적 문서 섹션 수가 맞지 않습니다: ${definition.relativePath} (expected ${definition.sections.length}, received ${emptySections.length})`,
    )
  }

  for (let index = definition.sections.length - 1; index >= 0; index -= 1) {
    const section = definition.sections[index]
    const targetSection = emptySections[index]
    if (!section || !targetSection) {
      continue
    }

    root.children = [
      ...root.children.slice(0, targetSection.startIndex + 1),
      ...parseMarkdownChildren(section.render(options)),
      ...root.children.slice(targetSection.endIndex),
    ]
  }
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

  return renderMarkdownBlocks(blocks)
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

function renderDynamicMarkdownSource(
  relativePath: string,
  source: string,
  options: GeneratedWorkspaceOptions,
) {
  const definition = DYNAMIC_DOC_DEFINITIONS.find((doc) => doc.relativePath === relativePath)

  if (!definition) {
    return source
  }

  const root = MARKDOWN_RENDERER.parse(source) as MarkdownRoot

  replaceEmptySectionBodies(root, definition, options)

  return String(MARKDOWN_RENDERER.stringify(root as never))
}

async function renderDynamicMarkdownTemplate(
  baseTemplateDir: string,
  sourcePath: string,
  targetPath: string,
  tokens: TemplateTokens,
  options: GeneratedWorkspaceOptions,
) {
  const contents = await readFile(sourcePath, 'utf8')
  const relativePath = path.relative(baseTemplateDir, sourcePath).split(path.sep).join('/')
  const renderedSource = renderDynamicMarkdownSource(
    relativePath,
    replaceTemplateTokens(contents, tokens, createRootTemplateExtraTokens(tokens.packageManager)),
    options,
  )

  await mkdir(path.dirname(targetPath), { recursive: true })
  await writeFile(targetPath, renderedSource, 'utf8')
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
    { skipRelativePaths: DYNAMIC_DOCS_INSIDE_DOCS, extraTokens },
  )

  for (const definition of DYNAMIC_DOC_DEFINITIONS) {
    await renderDynamicMarkdownTemplate(
      baseTemplateDir,
      path.join(baseTemplateDir, ...definition.relativePath.split('/')),
      path.join(targetRoot, ...definition.relativePath.split('/')),
      tokens,
      options,
    )
  }
}
