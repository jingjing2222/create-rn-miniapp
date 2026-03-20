import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import remarkParse from 'remark-parse'
import remarkStringify from 'remark-stringify'
import { unified } from 'unified'
import { patchRootPackageJsonSource } from '../patching/package-json.js'
import { getPackageManagerAdapter, type PackageManager } from '../package-manager.js'
import {
  createFirebaseServerScriptCatalog,
  createServerScriptRecord,
  createSupabaseServerScriptCatalog,
  renderFirebaseFunctionsInstallCommand,
} from '../server-script-catalog.js'
import {
  APP_ROUTER_WORKSPACE_PATH,
  CONTRACTS_WORKSPACE_PATH,
  applyTrpcWorkspaceTemplate as applyTrpcWorkspaceTemplateImpl,
} from './trpc.js'

const ROOT_WORKSPACE_ORDER = [
  'frontend',
  'server',
  CONTRACTS_WORKSPACE_PATH,
  APP_ROUTER_WORKSPACE_PATH,
  'backoffice',
] as const

export type WorkspaceName = (typeof ROOT_WORKSPACE_ORDER)[number]

export type TemplateTokens = {
  appName: string
  displayName: string
  packageManager: PackageManager
  packageManagerField?: string
  packageManagerCommand: string
  packageManagerRunCommand: string
  packageManagerExecCommand: string
  verifyCommand: string
}

type GeneratedSkillsServerProvider = 'supabase' | 'cloudflare' | 'firebase'

export type GeneratedWorkspaceHints = {
  serverProvider: GeneratedSkillsServerProvider | null
}

export type GeneratedWorkspaceOptions = {
  hasBackoffice: boolean
  serverProvider: GeneratedSkillsServerProvider | null
  hasTrpc: boolean
}

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

type SkillReferenceDefinition = {
  templateDir: string
  docsPath: string
  agentsLabel: string
  topologyLabel: string
  enabled?: (options: GeneratedWorkspaceOptions) => boolean
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

type CopyDirectoryWithTokensOptions = {
  relativeDir?: string
  skipRelativePaths?: Set<string>
}

type WorkspaceProjectJson = {
  targets?: Record<string, { command?: string }>
}

type ServerPackageJson = {
  scripts?: Record<string, string>
}

type FirebaseFunctionsPackageJson = {
  name: string
  private: boolean
  main: string
  packageManager?: string
  engines: {
    node: string
  }
  scripts: Record<string, string>
  dependencies: Record<string, string>
  devDependencies: Record<string, string>
}

export const SUPABASE_DEFAULT_FUNCTION_NAME = 'api'
export const FIREBASE_DEFAULT_FUNCTION_NAME = 'api'
export const FIREBASE_DEFAULT_FUNCTION_REGION = 'asia-northeast3'
const FIREBASE_NODE_ENGINE = '22'
const FIREBASE_WEB_SDK_VERSION = '^12.10.0'
const FIREBASE_ADMIN_VERSION = '^13.6.0'
const FIREBASE_FUNCTIONS_VERSION = '^7.0.0'
const GOOGLE_CLOUD_FUNCTIONS_FRAMEWORK_VERSION = '^3.4.5'
const FIREBASE_FUNCTIONS_TYPESCRIPT_VERSION = '^5.7.3'
const NPMRC_SOURCE = 'legacy-peer-deps=true\n'
const FRONTEND_POLICY_CHECK_SCRIPT = 'node ./scripts/verify-frontend-routes.mjs'
const SKILLS_SYNC_SCRIPT = 'node ./scripts/sync-skills.mjs'
const SKILLS_CHECK_SCRIPT = 'node ./scripts/check-skills.mjs'
const ROOT_VERIFY_STEP_SCRIPT_NAMES = [
  'format:check',
  'lint',
  'typecheck',
  'test',
  'frontend:policy:check',
  'skills:check',
] as const
const ROOT_VERIFY_STEPS_TOKEN = '{{rootVerifyStepsMarkdown}}'
const BINARY_TEMPLATE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif'])
const MARKDOWN_RENDERER = unified().use(remarkParse).use(remarkStringify, {
  bullet: '-',
  listItemIndent: 'one',
})
const ROOT_BIOME_REACT_NATIVE_MESSAGE =
  '`react-native` 기본 UI 컴포넌트는 바로 쓰지 말고 TDS나 Granite가 제공하는 컴포넌트를 먼저 써 주세요. 특히 `Text` 대신 TDS `Txt`를 써 주세요. `Pressable`이 정말 필요하면 `biome-ignore`에 이유를 같이 남겨 주세요. 먼저 `.agents/skills/core/tds/references/catalog.md`와 `docs/engineering/frontend-policy.md`를 확인해 주세요.'

const require = createRequire(import.meta.url)
const NORMALIZED_PACKAGE_WORKSPACE = 'packages/*' as const
const NORMALIZED_ROOT_WORKSPACE_ORDER = [
  'frontend',
  'server',
  NORMALIZED_PACKAGE_WORKSPACE,
  'backoffice',
] as const
type NormalizedRootWorkspaceName = (typeof NORMALIZED_ROOT_WORKSPACE_ORDER)[number]

const CORE_SKILL_DEFINITIONS: SkillReferenceDefinition[] = [
  {
    templateDir: 'core/miniapp',
    docsPath: '.agents/skills/core/miniapp/SKILL.md',
    agentsLabel: 'MiniApp capability / 공식 API 탐색',
    topologyLabel: 'MiniApp capability',
  },
  {
    templateDir: 'core/granite',
    docsPath: '.agents/skills/core/granite/SKILL.md',
    agentsLabel: 'route / page / navigation 패턴',
    topologyLabel: 'Granite page/route patterns',
  },
  {
    templateDir: 'core/tds',
    docsPath: '.agents/skills/core/tds/SKILL.md',
    agentsLabel: 'TDS UI 선택과 form 패턴',
    topologyLabel: 'TDS UI selection',
  },
]

const OPTIONAL_SKILL_DEFINITIONS: SkillReferenceDefinition[] = [
  {
    templateDir: 'optional/backoffice-react',
    docsPath: '.agents/skills/optional/backoffice-react/SKILL.md',
    agentsLabel: 'backoffice React 작업',
    topologyLabel: 'Backoffice React workflow',
    enabled: (options) => options.hasBackoffice,
  },
  {
    templateDir: 'optional/server-cloudflare',
    docsPath: '.agents/skills/optional/server-cloudflare/SKILL.md',
    agentsLabel: 'Cloudflare provider 작업',
    topologyLabel: 'Cloudflare provider 운영 가이드',
    enabled: (options) => options.serverProvider === 'cloudflare',
  },
  {
    templateDir: 'optional/server-supabase',
    docsPath: '.agents/skills/optional/server-supabase/SKILL.md',
    agentsLabel: 'Supabase provider 작업',
    topologyLabel: 'Supabase provider 운영 가이드',
    enabled: (options) => options.serverProvider === 'supabase',
  },
  {
    templateDir: 'optional/server-firebase',
    docsPath: '.agents/skills/optional/server-firebase/SKILL.md',
    agentsLabel: 'Firebase provider 작업',
    topologyLabel: 'Firebase provider 운영 가이드',
    enabled: (options) => options.serverProvider === 'firebase',
  },
  {
    templateDir: 'optional/trpc-boundary',
    docsPath: '.agents/skills/optional/trpc-boundary/SKILL.md',
    agentsLabel: 'tRPC boundary 변경',
    topologyLabel: 'tRPC boundary change flow',
    enabled: (options) => options.hasTrpc,
  },
]

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

function resolveTemplatesPackageRoot() {
  const packageJsonPath = require.resolve('@create-rn-miniapp/scaffold-templates/package.json')
  return path.dirname(packageJsonPath)
}

function resolveSkillsPackageRoot() {
  const packageJsonPath = require.resolve('@create-rn-miniapp/scaffold-skills/package.json')
  return path.dirname(packageJsonPath)
}

function resolveRootVerifyStepCommands(packageManager: PackageManager) {
  const adapter = getPackageManagerAdapter(packageManager)
  return ROOT_VERIFY_STEP_SCRIPT_NAMES.map((scriptName) => adapter.runScript(scriptName))
}

export function renderRootVerifyScript(packageManager: PackageManager) {
  return resolveRootVerifyStepCommands(packageManager).join(' && ')
}

function renderRootVerifyStepsMarkdown(packageManager: PackageManager) {
  return resolveRootVerifyStepCommands(packageManager)
    .map((command) => `- \`${command}\``)
    .join('\n')
}

function replaceTemplateTokens(source: string, tokens: TemplateTokens) {
  const packageManagerField =
    tokens.packageManagerField ??
    getPackageManagerAdapter(tokens.packageManager).packageManagerField

  return source
    .replaceAll('{{appName}}', tokens.appName)
    .replaceAll('{{displayName}}', tokens.displayName)
    .replaceAll('{{packageManager}}', tokens.packageManager)
    .replaceAll('{{packageManagerField}}', packageManagerField)
    .replaceAll('{{packageManagerCommand}}', tokens.packageManagerCommand)
    .replaceAll('{{packageManagerRunCommand}}', tokens.packageManagerRunCommand)
    .replaceAll('{{packageManagerExecCommand}}', tokens.packageManagerExecCommand)
    .replaceAll('{{verifyCommand}}', tokens.verifyCommand)
    .replaceAll(ROOT_VERIFY_STEPS_TOKEN, renderRootVerifyStepsMarkdown(tokens.packageManager))
}

function resolveSelectedOptionalSkillDefinitions(options: GeneratedWorkspaceOptions) {
  return OPTIONAL_SKILL_DEFINITIONS.filter((skill) => skill.enabled?.(options) ?? true)
}

function resolveEnabledWorkspaceFeatures(options: GeneratedWorkspaceOptions) {
  return WORKSPACE_FEATURE_DEFINITIONS.filter((feature) => feature.enabled(options))
}

function renderRootScripts(packageManager: PackageManager) {
  const adapter = getPackageManagerAdapter(packageManager)

  return {
    build: 'nx run-many -t build --all',
    typecheck: 'nx run-many -t typecheck --all',
    test: 'nx run-many -t test --all',
    format: adapter.rootFormatScript(),
    'format:check': adapter.rootFormatCheckScript(),
    lint: adapter.rootLintScript(),
    'frontend:policy:check': FRONTEND_POLICY_CHECK_SCRIPT,
    'skills:sync': SKILLS_SYNC_SCRIPT,
    'skills:check': SKILLS_CHECK_SCRIPT,
    verify: renderRootVerifyScript(packageManager),
  }
}

function renderRootBiomeSource(adapter: ReturnType<typeof getPackageManagerAdapter>) {
  return `${JSON.stringify(
    {
      $schema: 'https://biomejs.dev/schemas/2.4.8/schema.json',
      files: {
        includes: adapter.rootBiomeIncludes,
      },
      formatter: {
        enabled: true,
        indentStyle: 'space',
        indentWidth: 2,
        lineWidth: 100,
      },
      linter: {
        enabled: true,
        rules: {
          recommended: true,
          style: {
            noRestrictedImports: {
              level: 'error',
              options: {
                paths: {
                  '@react-native-async-storage/async-storage':
                    'AsyncStorage는 쓰면 안 돼요. 대신 `@apps-in-toss/framework` storage API를 써 주세요. 자세한 기준은 `docs/engineering/frontend-policy.md`를 먼저 봐 주세요.',
                  '@granite-js/native/@react-native-async-storage/async-storage':
                    'AsyncStorage는 쓰면 안 돼요. 대신 `@apps-in-toss/framework` storage API를 써 주세요. 자세한 기준은 `docs/engineering/frontend-policy.md`를 먼저 봐 주세요.',
                  'react-native': {
                    message: ROOT_BIOME_REACT_NATIVE_MESSAGE,
                    importNames: [
                      'Button',
                      'Modal',
                      'Switch',
                      'TextInput',
                      'Text',
                      'ActivityIndicator',
                      'Alert',
                      'TouchableOpacity',
                      'TouchableHighlight',
                      'TouchableWithoutFeedback',
                      'Pressable',
                    ],
                  },
                },
                patterns: [
                  {
                    group: ['@react-navigation/*'],
                    message:
                      'react-navigation 패키지는 직접 import하지 말고 `@granite-js/native` 경로를 써 주세요. 자세한 기준은 `docs/engineering/frontend-policy.md`를 먼저 봐 주세요.',
                  },
                  {
                    group: ['@react-native-community/*'],
                    message:
                      'react-native community 패키지는 직접 import하지 말고 `@granite-js/native` 경로를 써 주세요. 자세한 기준은 `docs/engineering/frontend-policy.md`를 먼저 봐 주세요.',
                  },
                  {
                    group: ['react-native-*'],
                    message:
                      'react-native 네이티브 패키지는 직접 import하지 말고 `@granite-js/native` 경로를 써 주세요. 자세한 기준은 `docs/engineering/frontend-policy.md`를 먼저 봐 주세요.',
                  },
                  {
                    group: ['@shopify/flash-list', 'lottie-react-native', 'fingerprint'],
                    message:
                      '이 네이티브 모듈은 직접 import하지 말고 `@granite-js/native` 경로를 써 주세요. 자세한 기준은 `docs/engineering/frontend-policy.md`를 먼저 봐 주세요.',
                  },
                ],
              },
            },
          },
        },
      },
      javascript: {
        formatter: {
          quoteStyle: 'single',
          semicolons: 'asNeeded',
        },
      },
    },
    null,
    2,
  )}\n`
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

async function copyFileWithTokens(sourcePath: string, targetPath: string, tokens: TemplateTokens) {
  if (BINARY_TEMPLATE_EXTENSIONS.has(path.extname(sourcePath).toLowerCase())) {
    await mkdir(path.dirname(targetPath), { recursive: true })
    await cp(sourcePath, targetPath)
    return
  }

  const contents = await readFile(sourcePath, 'utf8')
  await mkdir(path.dirname(targetPath), { recursive: true })
  await writeFile(targetPath, replaceTemplateTokens(contents, tokens), 'utf8')
}

async function copyDirectoryWithTokens(
  sourceDir: string,
  targetDir: string,
  tokens: TemplateTokens,
  options?: CopyDirectoryWithTokensOptions,
) {
  const entries = await readdir(sourceDir, { withFileTypes: true })
  const relativeDir = options?.relativeDir ?? ''

  await mkdir(targetDir, { recursive: true })

  for (const entry of entries) {
    const sourcePath = path.join(sourceDir, entry.name)
    const targetPath = path.join(targetDir, entry.name)
    const relativePath = (relativeDir ? path.join(relativeDir, entry.name) : entry.name)
      .split(path.sep)
      .join('/')

    if (options?.skipRelativePaths?.has(relativePath)) {
      continue
    }

    if (entry.isDirectory()) {
      await copyDirectoryWithTokens(sourcePath, targetPath, tokens, {
        ...options,
        relativeDir: relativePath,
      })
      continue
    }

    await copyFileWithTokens(sourcePath, targetPath, tokens)
  }
}

async function copyOptionalTemplateFile(
  sourcePath: string,
  targetPath: string,
  tokens: TemplateTokens,
) {
  await copyFileWithTokens(sourcePath, targetPath, tokens)
}

async function readJsonTemplate<T>(sourcePath: string, tokens: TemplateTokens) {
  const contents = replaceTemplateTokens(await readFile(sourcePath, 'utf8'), tokens)
  return JSON.parse(contents) as T
}

async function writeJsonFile(targetPath: string, value: unknown) {
  await mkdir(path.dirname(targetPath), { recursive: true })
  await writeFile(targetPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

export async function writeWorkspaceNpmrc(targetRoot: string) {
  await mkdir(targetRoot, { recursive: true })
  await writeFile(path.join(targetRoot, '.npmrc'), NPMRC_SOURCE, 'utf8')
}

function renderSupabaseDbApplyScript(tokens: TemplateTokens) {
  const packageManager = getPackageManagerAdapter(tokens.packageManager)
  const command = packageManager.dlx('supabase', [
    'db',
    'push',
    '--workdir',
    '.',
    '--linked',
    '--password',
    '__SUPABASE_DB_PASSWORD__',
    '--yes',
  ])
  const passwordPlaceholderIndex = command.args.indexOf('__SUPABASE_DB_PASSWORD__')

  return [
    "import { spawnSync } from 'node:child_process'",
    "import { existsSync, readFileSync } from 'node:fs'",
    "import path from 'node:path'",
    "import process from 'node:process'",
    "import { fileURLToPath } from 'node:url'",
    '',
    "const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')",
    "const envPath = path.join(serverRoot, '.env.local')",
    '',
    'function stripWrappingQuotes(value) {',
    `  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {`,
    '    return value.slice(1, -1)',
    '  }',
    '',
    '  return value',
    '}',
    '',
    'function loadLocalEnv(filePath) {',
    '  if (!existsSync(filePath)) {',
    '    return',
    '  }',
    '',
    "  const source = readFileSync(filePath, 'utf8')",
    '',
    '  for (const line of source.split(/\\r?\\n/)) {',
    '    const trimmed = line.trim()',
    '',
    "    if (!trimmed || trimmed.startsWith('#')) {",
    '      continue',
    '    }',
    '',
    "    const separatorIndex = trimmed.indexOf('=')",
    '    if (separatorIndex <= 0) {',
    '      continue',
    '    }',
    '',
    '    const key = trimmed.slice(0, separatorIndex).trim()',
    '    const value = stripWrappingQuotes(trimmed.slice(separatorIndex + 1).trim())',
    '',
    '    if (process.env[key] === undefined) {',
    '      process.env[key] = value',
    '    }',
    '  }',
    '}',
    '',
    'loadLocalEnv(envPath)',
    '',
    "const password = process.env.SUPABASE_DB_PASSWORD?.trim() ?? ''",
    'if (!password) {',
    "  console.error('[server] SUPABASE_DB_PASSWORD is required. Set server/.env.local before running db:apply.')",
    '  process.exit(1)',
    '}',
    '',
    `const packageManagerCommand = process.platform === 'win32' ? '${command.command}.cmd' : '${command.command}'`,
    `const baseArgs = ${JSON.stringify(command.args)};`,
    'const result = spawnSync(',
    '  packageManagerCommand,',
    '  [',
    `    ...baseArgs.slice(0, ${passwordPlaceholderIndex}),`,
    '    password,',
    `    ...baseArgs.slice(${passwordPlaceholderIndex + 1}),`,
    '  ],',
    '  {',
    '    cwd: serverRoot,',
    "    stdio: 'inherit',",
    '    env: process.env,',
    '  },',
    ')',
    '',
    "if (typeof result.status === 'number') {",
    '  process.exit(result.status)',
    '}',
    '',
    'if (result.error) {',
    '  throw result.error',
    '}',
    '',
    'process.exit(1)',
    '',
  ].join('\n')
}

function renderSupabaseFunctionsDeployScript(tokens: TemplateTokens) {
  const packageManager = getPackageManagerAdapter(tokens.packageManager)
  const command = packageManager.dlx('supabase', [
    'functions',
    'deploy',
    '__REQUESTED_FUNCTIONS__',
    '--project-ref',
    '__SUPABASE_PROJECT_REF__',
    '--workdir',
    '.',
    '--yes',
  ])
  const requestedFunctionsPlaceholderIndex = command.args.indexOf('__REQUESTED_FUNCTIONS__')
  const projectRefPlaceholderIndex = command.args.indexOf('__SUPABASE_PROJECT_REF__')

  return [
    "import { spawnSync } from 'node:child_process'",
    "import { existsSync, readFileSync } from 'node:fs'",
    "import path from 'node:path'",
    "import process from 'node:process'",
    "import { fileURLToPath } from 'node:url'",
    '',
    "const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')",
    "const envPath = path.join(serverRoot, '.env.local')",
    '',
    'function stripWrappingQuotes(value) {',
    `  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {`,
    '    return value.slice(1, -1)',
    '  }',
    '',
    '  return value',
    '}',
    '',
    'function loadLocalEnv(filePath) {',
    '  if (!existsSync(filePath)) {',
    '    return',
    '  }',
    '',
    "  const source = readFileSync(filePath, 'utf8')",
    '',
    '  for (const line of source.split(/\\r?\\n/)) {',
    '    const trimmed = line.trim()',
    '',
    "    if (!trimmed || trimmed.startsWith('#')) {",
    '      continue',
    '    }',
    '',
    "    const separatorIndex = trimmed.indexOf('=')",
    '    if (separatorIndex <= 0) {',
    '      continue',
    '    }',
    '',
    '    const key = trimmed.slice(0, separatorIndex).trim()',
    '    const value = stripWrappingQuotes(trimmed.slice(separatorIndex + 1).trim())',
    '',
    '    if (process.env[key] === undefined) {',
    '      process.env[key] = value',
    '    }',
    '  }',
    '}',
    '',
    'loadLocalEnv(envPath)',
    '',
    "const projectRef = process.env.SUPABASE_PROJECT_REF?.trim() ?? ''",
    'if (!projectRef) {',
    "  console.error('[server] SUPABASE_PROJECT_REF is required. Set server/.env.local before running functions:deploy.')",
    '  process.exit(1)',
    '}',
    '',
    `const packageManagerCommand = process.platform === 'win32' ? '${command.command}.cmd' : '${command.command}'`,
    `const baseArgs = ${JSON.stringify(command.args)};`,
    'const requestedFunctions = process.argv.slice(2).map((value) => value.trim()).filter(Boolean)',
    'const result = spawnSync(',
    '  packageManagerCommand,',
    '  [',
    `    ...baseArgs.slice(0, ${requestedFunctionsPlaceholderIndex}),`,
    '    ...requestedFunctions,',
    `    ...baseArgs.slice(${requestedFunctionsPlaceholderIndex + 1}, ${projectRefPlaceholderIndex}),`,
    '    projectRef,',
    `    ...baseArgs.slice(${projectRefPlaceholderIndex + 1}),`,
    '  ],',
    '  {',
    '    cwd: serverRoot,',
    "    stdio: 'inherit',",
    '    env: process.env,',
    '  },',
    ')',
    '',
    "if (typeof result.status === 'number') {",
    '  process.exit(result.status)',
    '}',
    '',
    'if (result.error) {',
    '  throw result.error',
    '}',
    '',
    'process.exit(1)',
    '',
  ].join('\n')
}

function renderSupabaseFunctionsTypecheckScript() {
  return [
    "import { spawnSync } from 'node:child_process'",
    "import { existsSync, readdirSync } from 'node:fs'",
    "import path from 'node:path'",
    "import process from 'node:process'",
    "import { fileURLToPath } from 'node:url'",
    '',
    "const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')",
    "const functionsRoot = path.join(serverRoot, 'supabase', 'functions')",
    '',
    'function collectFunctionEntrypoints(rootDir) {',
    '  if (!existsSync(rootDir)) {',
    '    return []',
    '  }',
    '',
    '  return readdirSync(rootDir, { withFileTypes: true })',
    "    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('_'))",
    "    .map((entry) => path.join(rootDir, entry.name, 'index.ts'))",
    '    .filter((entrypoint) => existsSync(entrypoint))',
    '    .sort((left, right) => left.localeCompare(right))',
    '}',
    '',
    'const entrypoints = collectFunctionEntrypoints(functionsRoot)',
    'if (entrypoints.length === 0) {',
    "  console.log('[server] typecheck할 Supabase Edge Function entrypoint를 찾지 못했어요.')",
    '  process.exit(0)',
    '}',
    '',
    "const denoCommand = process.platform === 'win32' ? 'deno.cmd' : 'deno'",
    'for (const entrypoint of entrypoints) {',
    '  const functionRoot = path.dirname(entrypoint)',
    "  const denoConfigPath = path.join(functionRoot, 'deno.json')",
    "  const args = existsSync(denoConfigPath) ? ['check', '--config', denoConfigPath, entrypoint] : ['check', entrypoint]",
    '  const result = spawnSync(denoCommand, args, {',
    '    cwd: serverRoot,',
    "    stdio: 'inherit',",
    '    env: process.env,',
    '  })',
    '',
    "  if (typeof result.status === 'number' && result.status !== 0) {",
    '    process.exit(result.status)',
    '  }',
    '',
    '  if (result.error) {',
    "    if (typeof result.error === 'object' && result.error !== null && 'code' in result.error && result.error.code === 'ENOENT') {",
    "      console.error('[server] Supabase Edge Function typecheck에는 Deno가 필요해요. https://supabase.com/docs/guides/functions/development-environment#step-1-install-deno 를 먼저 확인해 주세요.')",
    '      process.exit(1)',
    '    }',
    '',
    '    throw result.error',
    '  }',
    '}',
    '',
  ].join('\n')
}

function renderFirebaseFunctionsDeployScript(tokens: TemplateTokens) {
  const packageManager = getPackageManagerAdapter(tokens.packageManager)
  const command = packageManager.dlx('firebase-tools', [
    'deploy',
    '--only',
    '__FIREBASE_DEPLOY_ONLY__',
    '--config',
    'firebase.json',
    '--project',
    '__FIREBASE_PROJECT_ID__',
  ])
  const onlyPlaceholderIndex = command.args.indexOf('__FIREBASE_DEPLOY_ONLY__')
  const projectPlaceholderIndex = command.args.indexOf('__FIREBASE_PROJECT_ID__')

  return [
    "import { spawnSync } from 'node:child_process'",
    "import { existsSync, readFileSync } from 'node:fs'",
    "import path from 'node:path'",
    "import process from 'node:process'",
    "import { fileURLToPath } from 'node:url'",
    '',
    "const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')",
    "const envPath = path.join(serverRoot, '.env.local')",
    '',
    'function stripWrappingQuotes(value) {',
    `  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {`,
    '    return value.slice(1, -1)',
    '  }',
    '',
    '  return value',
    '}',
    '',
    'function loadLocalEnv(filePath) {',
    '  if (!existsSync(filePath)) {',
    '    return',
    '  }',
    '',
    "  const source = readFileSync(filePath, 'utf8')",
    '',
    '  for (const line of source.split(/\\r?\\n/)) {',
    '    const trimmed = line.trim()',
    '',
    "    if (!trimmed || trimmed.startsWith('#')) {",
    '      continue',
    '    }',
    '',
    "    const separatorIndex = trimmed.indexOf('=')",
    '    if (separatorIndex <= 0) {',
    '      continue',
    '    }',
    '',
    '    const key = trimmed.slice(0, separatorIndex).trim()',
    '    const value = stripWrappingQuotes(trimmed.slice(separatorIndex + 1).trim())',
    '',
    '    if (process.env[key] === undefined) {',
    '      process.env[key] = value',
    '    }',
    '  }',
    '}',
    '',
    'loadLocalEnv(envPath)',
    '',
    "const projectId = process.env.FIREBASE_PROJECT_ID?.trim() ?? ''",
    'if (!projectId) {',
    "  console.error('[server] FIREBASE_PROJECT_ID is required. Set server/.env.local before running deploy.')",
    '  process.exit(1)',
    '}',
    '',
    "const firebaseToken = process.env.FIREBASE_TOKEN?.trim() ?? ''",
    "const credentials = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim() ?? ''",
    'const commandEnv = { ...process.env }',
    '',
    'if (credentials) {',
    '  const resolvedCredentials = path.isAbsolute(credentials)',
    '    ? credentials',
    '    : path.resolve(serverRoot, credentials)',
    '',
    '  if (!existsSync(resolvedCredentials)) {',
    "    console.error('[server] GOOGLE_APPLICATION_CREDENTIALS file not found: ' + resolvedCredentials)",
    '    process.exit(1)',
    '  }',
    '',
    '  commandEnv.GOOGLE_APPLICATION_CREDENTIALS = resolvedCredentials',
    '} else {',
    '  delete commandEnv.GOOGLE_APPLICATION_CREDENTIALS',
    '}',
    '',
    "const onlyTarget = process.argv.includes('--only')",
    "  ? (process.argv[process.argv.indexOf('--only') + 1]?.trim() ?? '')",
    "  : 'functions,firestore:rules,firestore:indexes'",
    '',
    'if (!onlyTarget) {',
    "  console.error('[server] --only requires a Firebase deploy target.')",
    '  process.exit(1)',
    '}',
    '',
    `const packageManagerCommand = process.platform === 'win32' ? '${command.command}.cmd' : '${command.command}'`,
    `const baseArgs = ${JSON.stringify(command.args)};`,
    'const finalArgs = [',
    `  ...baseArgs.slice(0, ${onlyPlaceholderIndex}),`,
    '  onlyTarget,',
    `  ...baseArgs.slice(${onlyPlaceholderIndex + 1}, ${projectPlaceholderIndex}),`,
    '  projectId,',
    `  ...baseArgs.slice(${projectPlaceholderIndex + 1}),`,
    ']',
    '',
    'if (firebaseToken) {',
    "  finalArgs.push('--token', firebaseToken, '--non-interactive')",
    '}',
    '',
    'const result = spawnSync(packageManagerCommand, finalArgs, {',
    '  cwd: serverRoot,',
    "  stdio: 'inherit',",
    '  env: commandEnv,',
    '})',
    '',
    "if (typeof result.status === 'number') {",
    '  process.exit(result.status)',
    '}',
    '',
    'if (result.error) {',
    '  throw result.error',
    '}',
    '',
    'process.exit(1)',
    '',
  ].join('\n')
}

function renderFirebaseFirebaserc(projectId?: string | null) {
  return `${JSON.stringify(
    {
      projects: {
        default: projectId ?? '',
      },
    },
    null,
    2,
  )}\n`
}

function renderFirebaseJson(tokens: TemplateTokens) {
  const packageManager = getPackageManagerAdapter(tokens.packageManager)
  const installCommand = renderFirebaseFunctionsInstallCommand(
    tokens.packageManager,
    '"$RESOURCE_DIR"',
  )
  const predeployCommand = `${installCommand} && ${packageManager.runScriptInDirectoryCommand('"$RESOURCE_DIR"', 'build')}`

  return `${JSON.stringify(
    {
      functions: [
        {
          source: 'functions',
          codebase: 'default',
          ignore: ['node_modules', '.git', 'firebase-debug.log', 'firebase-debug.*.log', '*.local'],
          predeploy: [predeployCommand],
        },
      ],
      firestore: {
        rules: 'firestore.rules',
        indexes: 'firestore.indexes.json',
      },
    },
    null,
    2,
  )}\n`
}

function renderFirebaseFirestoreRules() {
  return [
    "rules_version = '2';",
    'service cloud.firestore {',
    '  match /databases/{database}/documents {',
    '    match /{document=**} {',
    '      allow read, write: if false;',
    '    }',
    '  }',
    '}',
    '',
  ].join('\n')
}

function renderFirebaseFirestoreIndexes() {
  return `${JSON.stringify(
    {
      indexes: [],
      fieldOverrides: [],
    },
    null,
    2,
  )}\n`
}

function renderFirebaseServerGitignore() {
  return [
    '# Firebase cache',
    '.firebase/',
    'firebase-debug.log*',
    '',
    '# Local env',
    '.env.local',
    '',
    '# Functions output',
    'functions/lib/',
    'functions/node_modules/',
    '',
  ].join('\n')
}

function renderFirebaseFunctionsGitignore(packageManager: PackageManager) {
  const lines = ['lib/', 'node_modules/']

  if (packageManager === 'yarn') {
    lines.push('.yarn/', '.pnp.*')
  }

  lines.push('')

  return lines.join('\n')
}

function renderFirebaseFunctionsYarnrc() {
  return ['nodeLinker: node-modules', ''].join('\n')
}

function renderFirebaseFunctionsPackageJson(
  packageManager: PackageManager,
): FirebaseFunctionsPackageJson {
  return {
    name: 'functions',
    private: true,
    main: 'lib/index.js',
    ...(packageManager === 'yarn'
      ? { packageManager: getPackageManagerAdapter('yarn').packageManagerField }
      : {}),
    engines: {
      node: FIREBASE_NODE_ENGINE,
    },
    scripts: {
      build: 'tsc -p tsconfig.json',
      typecheck: 'tsc --noEmit -p tsconfig.json',
      test: 'tsx --test src/**/*.test.ts',
      'seed:public-status': 'tsx src/seed-public-status.ts',
    },
    dependencies: {
      '@google-cloud/functions-framework': GOOGLE_CLOUD_FUNCTIONS_FRAMEWORK_VERSION,
      'firebase-admin': FIREBASE_ADMIN_VERSION,
      'firebase-functions': FIREBASE_FUNCTIONS_VERSION,
    },
    devDependencies: {
      '@types/node': '^24.10.1',
      tsx: '^4.20.5',
      typescript: FIREBASE_FUNCTIONS_TYPESCRIPT_VERSION,
    },
  }
}

function renderFirebaseFunctionsTsconfig() {
  return `${JSON.stringify(
    {
      compilerOptions: {
        module: 'NodeNext',
        esModuleInterop: true,
        moduleResolution: 'nodenext',
        noImplicitReturns: true,
        noUnusedLocals: true,
        skipLibCheck: true,
        outDir: 'lib',
        sourceMap: true,
        strict: true,
        target: 'es2017',
      },
      compileOnSave: true,
      include: ['src'],
    },
    null,
    2,
  )}\n`
}

function renderFirebaseFunctionsIndex(region = FIREBASE_DEFAULT_FUNCTION_REGION) {
  return [
    "import { getApps, initializeApp } from 'firebase-admin/app'",
    "import { getFirestore } from 'firebase-admin/firestore'",
    "import { setGlobalOptions } from 'firebase-functions'",
    "import { HttpsError, onCall, onRequest } from 'firebase-functions/https'",
    'import {',
    '  buildPublicAppStatusDocument,',
    '  publicAppStatusCollection,',
    '  publicAppStatusDocumentId,',
    "} from './public-status'",
    '',
    'if (getApps().length === 0) {',
    '  initializeApp()',
    '}',
    '',
    'setGlobalOptions({',
    `  region: '${region}',`,
    '  maxInstances: 10,',
    '})',
    '',
    `export const ${FIREBASE_DEFAULT_FUNCTION_NAME} = onRequest(async (request, response) => {`,
    '  const firestore = getFirestore()',
    "  const normalizedPath = request.path === '/' ? '/' : request.path.replace(/\\/$/, '')",
    '',
    '  try {',
    "    if (request.method === 'GET' && (normalizedPath === '/' || normalizedPath === '/health')) {",
    '      response.json({',
    '        ok: true,',
    "        provider: 'firebase',",
    '        path: request.path,',
    '      })',
    '      return',
    '    }',
    '',
    "    if (request.method === 'GET' && normalizedPath === '/public-status') {",
    '      const snapshot = await firestore',
    '        .collection(publicAppStatusCollection)',
    '        .doc(publicAppStatusDocumentId)',
    '        .get()',
    '',
    '      if (!snapshot.exists) {',
    '        response.status(404).json({',
    '          ok: false,',
    "          error: 'public app status document not found',",
    '        })',
    '        return',
    '      }',
    '',
    '      response.json({',
    '        ok: true,',
    '        data: snapshot.data(),',
    '      })',
    '      return',
    '    }',
    '',
    "    if (request.method === 'POST' && normalizedPath === '/seed-public-status') {",
    '      const document = buildPublicAppStatusDocument()',
    '',
    '      await firestore',
    '        .collection(publicAppStatusCollection)',
    '        .doc(publicAppStatusDocumentId)',
    '        .set(document)',
    '',
    '      response.json({',
    '        ok: true,',
    '        data: document,',
    '      })',
    '      return',
    '    }',
    '',
    '    response.status(404).json({',
    '      ok: false,',
    "      error: 'not found',",
    '      path: request.path,',
    '    })',
    '  } catch (error: unknown) {',
    "    const message = error instanceof Error ? error.message : 'unexpected error'",
    '',
    '    response.status(500).json({',
    '      ok: false,',
    '      error: message,',
    '    })',
    '  }',
    '})',
    '',
    'export const getPublicStatus = onCall(async () => {',
    '  const snapshot = await getFirestore()',
    '    .collection(publicAppStatusCollection)',
    '    .doc(publicAppStatusDocumentId)',
    '    .get()',
    '',
    '  if (!snapshot.exists) {',
    "    throw new HttpsError('not-found', 'public app status document not found')",
    '  }',
    '',
    '  return snapshot.data()',
    '})',
    '',
  ].join('\n')
}

function renderFirebasePublicStatusSource() {
  return [
    'export interface PublicStatusItem {',
    '  label: string',
    '  value: string',
    '}',
    '',
    'export interface PublicAppStatusDocument {',
    '  title: string',
    '  message: string',
    "  source: 'server/functions'",
    '  updatedAtIso: string',
    '  updatedAtLabel: string',
    '  items: PublicStatusItem[]',
    '}',
    '',
    "export const publicAppStatusCollection = 'publicAppStatus'",
    "export const publicAppStatusDocumentId = 'current'",
    '',
    'export function buildPublicAppStatusDocument(now: Date = new Date()): PublicAppStatusDocument {',
    '  return {',
    "    title: 'Firebase 연결 준비 완료',",
    "    message: 'frontend가 Firestore 문서를 직접 읽고 있어요.',",
    "    source: 'server/functions',",
    '    updatedAtIso: now.toISOString(),',
    '    updatedAtLabel: formatSeoulDateTime(now),',
    '    items: [',
    "      { label: 'DB', value: 'Cloud Firestore' },",
    "      { label: '읽기 경로', value: 'frontend -> Firestore Web SDK' },",
    "      { label: '시드 경로', value: 'server/functions -> Admin SDK' },",
    '    ],',
    '  }',
    '}',
    '',
    'function formatSeoulDateTime(date: Date): string {',
    '  const seoulTime = new Date(date.getTime() + 9 * 60 * 60 * 1000)',
    '  const year = seoulTime.getUTCFullYear()',
    "  const month = String(seoulTime.getUTCMonth() + 1).padStart(2, '0')",
    "  const day = String(seoulTime.getUTCDate()).padStart(2, '0')",
    "  const hour = String(seoulTime.getUTCHours()).padStart(2, '0')",
    "  const minute = String(seoulTime.getUTCMinutes()).padStart(2, '0')",
    '',
    `  return \`\${year}-\${month}-\${day} \${hour}:\${minute} KST\``,
    '}',
    '',
  ].join('\n')
}

function renderFirebaseSeedPublicStatusScript() {
  return [
    "import { readFileSync } from 'node:fs'",
    "import path from 'node:path'",
    "import process from 'node:process'",
    "import { cert, getApps, initializeApp } from 'firebase-admin/app'",
    "import { getFirestore } from 'firebase-admin/firestore'",
    'import {',
    '  buildPublicAppStatusDocument,',
    '  publicAppStatusCollection,',
    '  publicAppStatusDocumentId,',
    "} from './public-status'",
    '',
    'function stripWrappingQuotes(value: string) {',
    `  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {`,
    '    return value.slice(1, -1)',
    '  }',
    '',
    '  return value',
    '}',
    '',
    'function loadLocalEnv(filePath: string): Record<string, string> {',
    "  const source = readFileSync(filePath, 'utf8')",
    '  const result: Record<string, string> = {}',
    '',
    '  for (const line of source.split(/\\r?\\n/)) {',
    '    const trimmed = line.trim()',
    '',
    "    if (!trimmed || trimmed.startsWith('#')) {",
    '      continue',
    '    }',
    '',
    "    const separatorIndex = trimmed.indexOf('=')",
    '    if (separatorIndex <= 0) {',
    '      continue',
    '    }',
    '',
    '    const key = trimmed.slice(0, separatorIndex).trim()',
    '    const value = stripWrappingQuotes(trimmed.slice(separatorIndex + 1).trim())',
    '',
    '    result[key] = value',
    '  }',
    '',
    '  return result',
    '}',
    '',
    'async function main() {',
    "  const serverRoot = path.resolve(process.cwd(), '..')",
    "  const env = loadLocalEnv(path.join(serverRoot, '.env.local'))",
    "  const projectId = env.FIREBASE_PROJECT_ID?.trim() ?? ''",
    "  const credentials = env.GOOGLE_APPLICATION_CREDENTIALS?.trim() ?? ''",
    '',
    '  if (!projectId) {',
    "    throw new Error('FIREBASE_PROJECT_ID is required in server/.env.local.')",
    '  }',
    '',
    '  if (!credentials) {',
    "    throw new Error('GOOGLE_APPLICATION_CREDENTIALS is required in server/.env.local.')",
    '  }',
    '',
    '  const resolvedCredentials = path.isAbsolute(credentials)',
    '    ? credentials',
    '    : path.resolve(serverRoot, credentials)',
    "  const serviceAccount = JSON.parse(readFileSync(resolvedCredentials, 'utf8'))",
    '',
    '  if (getApps().length === 0) {',
    '    initializeApp({',
    '      credential: cert(serviceAccount),',
    '      projectId,',
    '    })',
    '  }',
    '',
    '  const document = buildPublicAppStatusDocument()',
    '',
    '  await getFirestore()',
    '    .collection(publicAppStatusCollection)',
    '    .doc(publicAppStatusDocumentId)',
    '    .set(document)',
    '',
    `  process.stdout.write(\`\${JSON.stringify(document, null, 2)}\\n\`)`,
    '}',
    '',
    'void main().catch((error: unknown) => {',
    '  const message = error instanceof Error ? error.message : String(error)',
    `  process.stderr.write(\`\${message}\\n\`)`,
    '  process.exit(1)',
    '})',
    '',
  ].join('\n')
}

function renderFirebaseEnsureFirestoreScript(tokens: TemplateTokens) {
  const packageManager = getPackageManagerAdapter(tokens.packageManager)
  const getCommand = packageManager.dlx('firebase-tools', [
    'firestore:databases:get',
    '(default)',
    '--project',
    '__FIREBASE_PROJECT_ID__',
    '--json',
  ])
  const createCommand = packageManager.dlx('firebase-tools', [
    'firestore:databases:create',
    '(default)',
    '--project',
    '__FIREBASE_PROJECT_ID__',
    '--location',
    '__FIREBASE_REGION__',
    '--json',
  ])
  const projectPlaceholderIndex = getCommand.args.indexOf('__FIREBASE_PROJECT_ID__')
  const createProjectPlaceholderIndex = createCommand.args.indexOf('__FIREBASE_PROJECT_ID__')
  const createRegionPlaceholderIndex = createCommand.args.indexOf('__FIREBASE_REGION__')

  return [
    "import { spawnSync } from 'node:child_process'",
    "import { existsSync, readFileSync } from 'node:fs'",
    "import path from 'node:path'",
    "import process from 'node:process'",
    "import { fileURLToPath } from 'node:url'",
    "import { GoogleAuth } from 'google-auth-library'",
    '',
    "const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')",
    "const envPath = path.join(serverRoot, '.env.local')",
    `const packageManagerCommand = process.platform === 'win32' ? '${getCommand.command}.cmd' : '${getCommand.command}'`,
    '',
    'function stripWrappingQuotes(value) {',
    `  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {`,
    '    return value.slice(1, -1)',
    '  }',
    '',
    '  return value',
    '}',
    '',
    'function loadLocalEnv(filePath) {',
    '  if (!existsSync(filePath)) {',
    '    return',
    '  }',
    '',
    "  const source = readFileSync(filePath, 'utf8')",
    '',
    '  for (const line of source.split(/\\r?\\n/)) {',
    '    const trimmed = line.trim()',
    '',
    "    if (!trimmed || trimmed.startsWith('#')) {",
    '      continue',
    '    }',
    '',
    "    const separatorIndex = trimmed.indexOf('=')",
    '    if (separatorIndex <= 0) {',
    '      continue',
    '    }',
    '',
    '    const key = trimmed.slice(0, separatorIndex).trim()',
    '    const value = stripWrappingQuotes(trimmed.slice(separatorIndex + 1).trim())',
    '',
    '    if (process.env[key] === undefined) {',
    '      process.env[key] = value',
    '    }',
    '  }',
    '}',
    '',
    'function runFirebaseCommand(args, env) {',
    '  return spawnSync(packageManagerCommand, args, {',
    '    cwd: serverRoot,',
    '    env,',
    "    encoding: 'utf8',",
    '  })',
    '}',
    '',
    'async function enableFirestoreApi(projectId, credentialsPath) {',
    '  const auth = new GoogleAuth({',
    '    keyFile: credentialsPath,',
    "    scopes: ['https://www.googleapis.com/auth/cloud-platform'],",
    '  })',
    '  const client = await auth.getClient()',
    '',
    '  await client.request({',
    `    url: \`https://serviceusage.googleapis.com/v1/projects/\${projectId}/services/firestore.googleapis.com:enable\`,`,
    "    method: 'POST',",
    '  })',
    '}',
    '',
    'async function main() {',
    '  loadLocalEnv(envPath)',
    '',
    "  const projectId = process.env.FIREBASE_PROJECT_ID?.trim() ?? ''",
    "  const firebaseToken = process.env.FIREBASE_TOKEN?.trim() ?? ''",
    "  const credentials = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim() ?? ''",
    "  const databaseLocation = process.env.FIREBASE_FUNCTION_REGION?.trim() || 'asia-northeast3'",
    '  const commandEnv = { ...process.env }',
    '',
    '  if (!projectId) {',
    "    console.error('[server] FIREBASE_PROJECT_ID is required. Set server/.env.local before running firestore:ensure.')",
    '    process.exit(1)',
    '  }',
    '',
    '  const resolvedCredentials = credentials',
    '    ? path.isAbsolute(credentials)',
    '      ? credentials',
    '      : path.resolve(serverRoot, credentials)',
    "    : ''",
    '',
    '  if (resolvedCredentials) {',
    '    commandEnv.GOOGLE_APPLICATION_CREDENTIALS = resolvedCredentials',
    '  }',
    '',
    "  const baseAuthArgs = firebaseToken ? ['--token', firebaseToken, '--non-interactive'] : []",
    `  const baseGetArgs = ${JSON.stringify(getCommand.args)}`,
    `  const baseCreateArgs = ${JSON.stringify(createCommand.args)}`,
    '  let getResult = runFirebaseCommand(',
    '    [',
    `      ...baseGetArgs.slice(0, ${projectPlaceholderIndex}),`,
    '      projectId,',
    `      ...baseGetArgs.slice(${projectPlaceholderIndex + 1}),`,
    '      ...baseAuthArgs,',
    '    ],',
    '    commandEnv,',
    '  )',
    '',
    '  if (getResult.status === 0) {',
    '    process.stdout.write(getResult.stdout)',
    '    process.exit(0)',
    '  }',
    '',
    '  const disabledApiPattern = /Cloud Firestore API has not been used|it is disabled/i',
    `  const getErrorText = \`\${getResult.stderr ?? ''}\${getResult.stdout ?? ''}\``,
    '',
    '  if (disabledApiPattern.test(getErrorText) && resolvedCredentials) {',
    '    await enableFirestoreApi(projectId, resolvedCredentials)',
    '',
    '    getResult = runFirebaseCommand(',
    '      [',
    `        ...baseGetArgs.slice(0, ${projectPlaceholderIndex}),`,
    '        projectId,',
    `        ...baseGetArgs.slice(${projectPlaceholderIndex + 1}),`,
    '        ...baseAuthArgs,',
    '      ],',
    '      commandEnv,',
    '    )',
    '',
    '    if (getResult.status === 0) {',
    '      process.stdout.write(getResult.stdout)',
    '      process.exit(0)',
    '    }',
    '  }',
    '',
    '  const createResult = runFirebaseCommand(',
    '    [',
    `      ...baseCreateArgs.slice(0, ${createProjectPlaceholderIndex}),`,
    '      projectId,',
    `      ...baseCreateArgs.slice(${createProjectPlaceholderIndex + 1}, ${createRegionPlaceholderIndex}),`,
    '      databaseLocation,',
    `      ...baseCreateArgs.slice(${createRegionPlaceholderIndex + 1}),`,
    '      ...baseAuthArgs,',
    '    ],',
    '    commandEnv,',
    '  )',
    '',
    '  if (createResult.status === 0) {',
    '    process.stdout.write(createResult.stdout)',
    '    process.exit(0)',
    '  }',
    '',
    '  process.stderr.write(getResult.stderr || getResult.stdout)',
    '  process.stderr.write(createResult.stderr || createResult.stdout)',
    '  process.exit(createResult.status ?? 1)',
    '}',
    '',
    'void main().catch((error) => {',
    '  const message = error instanceof Error ? error.message : String(error)',
    `  process.stderr.write(\`\${message}\\n\`)`,
    '  process.exit(1)',
    '})',
    '',
  ].join('\n')
}

function renderFirebaseServerPackageJson(tokens: TemplateTokens) {
  const scripts = createServerScriptRecord(
    createFirebaseServerScriptCatalog({
      packageManager: tokens.packageManager,
      firestoreRegion: FIREBASE_DEFAULT_FUNCTION_REGION,
    }),
  )

  return {
    name: 'server',
    private: true,
    dependencies: {
      'google-auth-library': '^10.6.1',
    },
    scripts,
  }
}

function normalizeRootWorkspaces(workspaces: WorkspaceName[]): NormalizedRootWorkspaceName[] {
  const included = new Set<string>()

  for (const workspace of workspaces) {
    if (workspace.startsWith('packages/')) {
      included.add(NORMALIZED_PACKAGE_WORKSPACE)
      continue
    }

    included.add(workspace)
  }

  return NORMALIZED_ROOT_WORKSPACE_ORDER.filter((workspace) => included.has(workspace))
}

function renderPnpmWorkspaceManifest(workspaces: NormalizedRootWorkspaceName[]) {
  const lines = ['packages:', ...workspaces.map((workspace) => `  - ${workspace}`)]
  return `${lines.join('\n')}\n`
}

export async function syncRootWorkspaceManifest(
  targetRoot: string,
  packageManager: PackageManager,
  workspaces: WorkspaceName[],
) {
  const adapter = getPackageManagerAdapter(packageManager)
  const normalizedWorkspaces = normalizeRootWorkspaces(workspaces)

  if (adapter.workspaceManifestFile) {
    await writeFile(
      path.join(targetRoot, adapter.workspaceManifestFile),
      renderPnpmWorkspaceManifest(normalizedWorkspaces),
      'utf8',
    )
    return
  }

  const rootPackageJsonPath = path.join(targetRoot, 'package.json')
  const rootPackageJsonSource = await readFile(rootPackageJsonPath, 'utf8')
  const nextRootPackageJsonSource = patchRootPackageJsonSource(rootPackageJsonSource, {
    packageManagerField: adapter.packageManagerField,
    scripts: {},
    workspaces: normalizedWorkspaces,
  })

  await writeFile(rootPackageJsonPath, nextRootPackageJsonSource, 'utf8')
}

export async function applyRootTemplates(
  targetRoot: string,
  tokens: TemplateTokens,
  workspaces: WorkspaceName[],
) {
  const templatesRoot = resolveTemplatesPackageRoot()
  const rootTemplateDir = path.join(templatesRoot, 'root')
  const packageManager = getPackageManagerAdapter(tokens.packageManager)
  const normalizedWorkspaces = normalizeRootWorkspaces(workspaces)

  const fileMappings = [
    ['nx.json', 'nx.json'],
    ['verify-frontend-routes.mjs', 'scripts/verify-frontend-routes.mjs'],
    ['sync-skills.mjs', 'scripts/sync-skills.mjs'],
    ['check-skills.mjs', 'scripts/check-skills.mjs'],
  ] as const

  for (const [sourceName, targetName] of fileMappings) {
    await copyFileWithTokens(
      path.join(rootTemplateDir, sourceName),
      path.join(targetRoot, targetName),
      tokens,
    )
  }

  for (const rootTemplateFile of packageManager.rootTemplateFiles) {
    await copyFileWithTokens(
      path.join(rootTemplateDir, rootTemplateFile.sourceName),
      path.join(targetRoot, rootTemplateFile.targetName),
      tokens,
    )
  }

  await mkdir(targetRoot, { recursive: true })
  await writeFile(
    path.join(targetRoot, 'biome.json'),
    renderRootBiomeSource(packageManager),
    'utf8',
  )

  const rootPackageJsonSource = replaceTemplateTokens(
    await readFile(path.join(rootTemplateDir, 'package.json'), 'utf8'),
    tokens,
  )
  const nextRootPackageJsonSource = patchRootPackageJsonSource(rootPackageJsonSource, {
    packageManagerField: packageManager.packageManagerField,
    scripts: renderRootScripts(tokens.packageManager),
    workspaces: packageManager.workspaceManifestFile === null ? normalizedWorkspaces : null,
  })

  await writeFile(path.join(targetRoot, 'package.json'), nextRootPackageJsonSource, 'utf8')

  if (packageManager.workspaceManifestFile) {
    await writeFile(
      path.join(targetRoot, packageManager.workspaceManifestFile),
      renderPnpmWorkspaceManifest(normalizedWorkspaces),
      'utf8',
    )
  }

  for (const extraRootFile of packageManager.extraRootFiles) {
    await copyOptionalTemplateFile(
      path.join(rootTemplateDir, extraRootFile.sourceName),
      path.join(targetRoot, extraRootFile.targetName),
      tokens,
    )
  }
}

export async function applyTrpcWorkspaceTemplate(
  targetRoot: string,
  tokens: TemplateTokens,
  options: {
    serverProvider: 'cloudflare'
  },
) {
  await applyTrpcWorkspaceTemplateImpl(targetRoot, tokens, options)
}

export async function resolveGeneratedWorkspaceOptions(
  targetRoot: string,
  hints: GeneratedWorkspaceHints,
): Promise<GeneratedWorkspaceOptions> {
  const hasBackoffice = await pathExists(path.join(targetRoot, 'backoffice'))
  const hasServerWorkspace = await pathExists(path.join(targetRoot, 'server'))
  const hasContractsWorkspace = await pathExists(path.join(targetRoot, CONTRACTS_WORKSPACE_PATH))
  const hasAppRouterWorkspace = await pathExists(path.join(targetRoot, APP_ROUTER_WORKSPACE_PATH))

  return {
    hasBackoffice,
    serverProvider: hasServerWorkspace ? hints.serverProvider : null,
    hasTrpc: hasContractsWorkspace && hasAppRouterWorkspace,
  }
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
    replaceTemplateTokens(contents, tokens),
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

  await copyFileWithTokens(
    path.join(baseTemplateDir, 'CLAUDE.md'),
    path.join(targetRoot, 'CLAUDE.md'),
    tokens,
  )
  await copyDirectoryWithTokens(
    path.join(baseTemplateDir, '.github'),
    path.join(targetRoot, '.github'),
    tokens,
  )
  await copyDirectoryWithTokens(
    path.join(baseTemplateDir, 'docs'),
    path.join(targetRoot, 'docs'),
    tokens,
    { skipRelativePaths: DYNAMIC_DOCS_INSIDE_DOCS },
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

function resolveGeneratedSkillTemplates(options: GeneratedWorkspaceOptions) {
  return [
    ...CORE_SKILL_DEFINITIONS.map((skill) => skill.templateDir),
    ...resolveSelectedOptionalSkillDefinitions(options).map((skill) => skill.templateDir),
  ]
}

export async function syncGeneratedSkills(
  targetRoot: string,
  tokens: TemplateTokens,
  hints: GeneratedWorkspaceHints,
) {
  const options = await resolveGeneratedWorkspaceOptions(targetRoot, hints)
  const skillsRoot = resolveSkillsPackageRoot()
  const canonicalTargetRoot = path.join(targetRoot, '.agents', 'skills')
  const claudeMirrorRoot = path.join(targetRoot, '.claude', 'skills')

  await rm(canonicalTargetRoot, { recursive: true, force: true })
  await mkdir(canonicalTargetRoot, { recursive: true })

  for (const templateDir of resolveGeneratedSkillTemplates(options)) {
    await copyDirectoryWithTokens(
      path.join(skillsRoot, templateDir),
      path.join(canonicalTargetRoot, templateDir),
      tokens,
    )
  }

  await rm(claudeMirrorRoot, { recursive: true, force: true })
  await mkdir(path.dirname(claudeMirrorRoot), { recursive: true })
  await copyDirectory(canonicalTargetRoot, claudeMirrorRoot)
}

export async function applyWorkspaceProjectTemplate(
  targetRoot: string,
  workspace: WorkspaceName,
  tokens: TemplateTokens,
) {
  const templatesRoot = resolveTemplatesPackageRoot()
  const templateName = `${workspace}.project.json`
  const packageManager = getPackageManagerAdapter(tokens.packageManager)
  const projectJson = await readJsonTemplate<WorkspaceProjectJson>(
    path.join(templatesRoot, 'root', templateName),
    tokens,
  )

  projectJson.targets ??= {}
  projectJson.targets.build ??= {}
  projectJson.targets.typecheck ??= {}
  projectJson.targets.test ??= {}
  projectJson.targets.build.command = packageManager.workspaceRunCommand(workspace, 'build')
  projectJson.targets.typecheck.command = packageManager.workspaceRunCommand(workspace, 'typecheck')
  projectJson.targets.test.command = packageManager.workspaceRunCommand(workspace, 'test')

  await writeJsonFile(path.join(targetRoot, workspace, 'project.json'), projectJson)
}

export async function applyServerPackageTemplate(targetRoot: string, tokens: TemplateTokens) {
  const templatesRoot = resolveTemplatesPackageRoot()
  const serverRoot = path.join(targetRoot, 'server')
  const packageJson = await readJsonTemplate<ServerPackageJson>(
    path.join(templatesRoot, 'root', 'server.package.json'),
    tokens,
  )
  const scripts = createServerScriptRecord(createSupabaseServerScriptCatalog(tokens.packageManager))

  packageJson.scripts = {
    ...(packageJson.scripts ?? {}),
    ...scripts,
  }

  await writeJsonFile(path.join(serverRoot, 'package.json'), packageJson)
  if (tokens.packageManager === 'npm') {
    await writeWorkspaceNpmrc(serverRoot)
  }
  await mkdir(path.join(serverRoot, 'scripts'), { recursive: true })
  await writeFile(
    path.join(serverRoot, 'scripts', 'supabase-db-apply.mjs'),
    renderSupabaseDbApplyScript(tokens),
    'utf8',
  )
  await writeFile(
    path.join(serverRoot, 'scripts', 'supabase-functions-typecheck.mjs'),
    renderSupabaseFunctionsTypecheckScript(),
    'utf8',
  )
  await writeFile(
    path.join(serverRoot, 'scripts', 'supabase-functions-deploy.mjs'),
    renderSupabaseFunctionsDeployScript(tokens),
    'utf8',
  )
}

export async function applyFirebaseServerWorkspaceTemplate(
  targetRoot: string,
  tokens: TemplateTokens,
  options?: {
    projectId?: string | null
    functionRegion?: string
  },
) {
  const serverRoot = path.join(targetRoot, 'server')
  const functionsRoot = path.join(serverRoot, 'functions')

  await mkdir(path.join(functionsRoot, 'src'), { recursive: true })
  await writeFile(
    path.join(serverRoot, '.firebaserc'),
    renderFirebaseFirebaserc(options?.projectId),
    'utf8',
  )
  await writeFile(path.join(serverRoot, 'firebase.json'), renderFirebaseJson(tokens), 'utf8')
  await writeFile(path.join(serverRoot, 'firestore.rules'), renderFirebaseFirestoreRules(), 'utf8')
  await writeFile(
    path.join(serverRoot, 'firestore.indexes.json'),
    renderFirebaseFirestoreIndexes(),
    'utf8',
  )
  await writeFile(path.join(serverRoot, '.gitignore'), renderFirebaseServerGitignore(), 'utf8')
  await writeJsonFile(
    path.join(serverRoot, 'package.json'),
    renderFirebaseServerPackageJson(tokens),
  )
  await mkdir(path.join(serverRoot, 'scripts'), { recursive: true })
  await writeFile(
    path.join(serverRoot, 'scripts', 'firebase-functions-deploy.mjs'),
    renderFirebaseFunctionsDeployScript(tokens),
    'utf8',
  )
  await writeFile(
    path.join(serverRoot, 'scripts', 'firebase-ensure-firestore.mjs'),
    renderFirebaseEnsureFirestoreScript(tokens),
    'utf8',
  )
  if (tokens.packageManager === 'npm') {
    await writeWorkspaceNpmrc(serverRoot)
    await writeWorkspaceNpmrc(functionsRoot)
  }
  await writeFile(
    path.join(functionsRoot, '.gitignore'),
    renderFirebaseFunctionsGitignore(tokens.packageManager),
    'utf8',
  )
  await writeJsonFile(
    path.join(functionsRoot, 'package.json'),
    renderFirebaseFunctionsPackageJson(tokens.packageManager),
  )
  if (tokens.packageManager === 'yarn') {
    await writeFile(
      path.join(functionsRoot, '.yarnrc.yml'),
      renderFirebaseFunctionsYarnrc(),
      'utf8',
    )
    await writeFile(path.join(functionsRoot, 'yarn.lock'), '', 'utf8')
  }
  await writeFile(
    path.join(functionsRoot, 'tsconfig.json'),
    renderFirebaseFunctionsTsconfig(),
    'utf8',
  )
  await writeFile(
    path.join(functionsRoot, 'src', 'index.ts'),
    renderFirebaseFunctionsIndex(options?.functionRegion),
    'utf8',
  )
  await writeFile(
    path.join(functionsRoot, 'src', 'public-status.ts'),
    renderFirebasePublicStatusSource(),
    'utf8',
  )
  await writeFile(
    path.join(functionsRoot, 'src', 'seed-public-status.ts'),
    renderFirebaseSeedPublicStatusScript(),
    'utf8',
  )
}

export async function patchFirebaseServerProjectId(targetRoot: string, projectId: string) {
  await writeFile(
    path.join(targetRoot, 'server', '.firebaserc'),
    renderFirebaseFirebaserc(projectId),
    'utf8',
  )
}

export async function patchFirebaseFunctionRegion(targetRoot: string, region: string) {
  await writeFile(
    path.join(targetRoot, 'server', 'functions', 'src', 'index.ts'),
    renderFirebaseFunctionsIndex(region),
    'utf8',
  )
}

export function getFirebaseWebSdkVersion() {
  return FIREBASE_WEB_SDK_VERSION
}

export async function removePathIfExists(targetPath: string) {
  try {
    await rm(targetPath, { recursive: true, force: true })
  } catch {
    // noop
  }
}

export async function ensureEmptyDirectory(targetRoot: string) {
  await mkdir(targetRoot, { recursive: true })
  const entries = await readdir(targetRoot)

  if (entries.length > 0) {
    throw new Error(`대상 디렉터리가 비어 있지 않습니다: ${targetRoot}`)
  }
}

export async function pathExists(targetPath: string) {
  try {
    await stat(targetPath)
    return true
  } catch {
    return false
  }
}

export async function copyDirectory(sourceDir: string, targetDir: string) {
  await cp(sourceDir, targetDir, { recursive: true })
}
