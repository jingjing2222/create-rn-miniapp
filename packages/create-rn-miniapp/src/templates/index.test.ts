import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import {
  getPackageManagerAdapter,
  PACKAGE_MANAGERS,
  type PackageManager,
} from '../package-manager.js'
import {
  ROOT_README_PROVIDER_SECTION_END_MARKER,
  ROOT_README_PROVIDER_SECTION_START_MARKER,
  ROOT_README_SKILLS_SECTION_END_MARKER,
  ROOT_README_SKILLS_SECTION_START_MARKER,
  renderSkillsInstallExample,
  renderSkillsStandardCommandSummary,
  renderRootReadmeProviderSection,
  renderRootReadmeSkillsSection,
} from '../root-readme.js'
import {
  SKILLS_CHECK_COMMAND,
  SKILLS_LIST_COMMAND,
  SKILLS_UPDATE_COMMAND,
} from '../skills-contract.js'
import { CORE_SKILL_DEFINITIONS, SKILL_CATALOG } from './skill-catalog.js'
import { getTestPackageManagerField } from '../test-support/package-manager.js'
import * as templateModule from './index.js'
import {
  applyDocsTemplates,
  applyFirebaseServerWorkspaceTemplate,
  applyRootTemplates,
  applyServerPackageTemplate,
  applyTrpcWorkspaceTemplate,
  applyWorkspaceProjectTemplate,
  FIREBASE_DEFAULT_FUNCTION_REGION,
  pathExists,
  renderRootVerifyScript,
  resolveGeneratedWorkspaceOptions,
  syncRootWorkspaceManifest,
  type TemplateTokens,
} from './index.js'
import { renderSharedFrontendPolicyReferenceMarkdown } from './frontend-policy.js'

async function materializeDocsWorkspaceState(
  targetRoot: string,
  options?: {
    hasBackoffice?: boolean
    hasServer?: boolean
    hasTrpc?: boolean
  },
) {
  const resolvedOptions = {
    hasBackoffice: false,
    hasServer: false,
    hasTrpc: false,
    ...options,
  }

  if (resolvedOptions.hasServer) {
    await mkdir(path.join(targetRoot, 'server'), { recursive: true })
  }

  if (resolvedOptions.hasBackoffice) {
    await mkdir(path.join(targetRoot, 'backoffice'), { recursive: true })
  }

  if (resolvedOptions.hasTrpc) {
    await mkdir(path.join(targetRoot, 'packages', 'contracts'), { recursive: true })
    await mkdir(path.join(targetRoot, 'packages', 'app-router'), { recursive: true })
  }
}

function createDocsHints(overrides?: {
  serverProvider?: 'supabase' | 'cloudflare' | 'firebase' | null
}) {
  return {
    serverProvider: null,
    ...overrides,
  }
}

function createTokens(packageManager: PackageManager): TemplateTokens {
  const adapter = getPackageManagerAdapter(packageManager)

  return {
    appName: 'ebook-miniapp',
    displayName: '전자책 미니앱',
    packageManager,
    packageManagerField: adapter.packageManagerField,
    packageManagerCommand: packageManager,
    packageManagerRunCommand: adapter.runCommandPrefix,
    packageManagerExecCommand: adapter.execCommandPrefix,
    verifyCommand: adapter.verifyCommand(),
  }
}

async function createTempTargetRoot(t: test.TestContext) {
  const targetRoot = await mkdtemp(path.join(os.tmpdir(), 'create-rn-miniapp-templates-'))
  t.after(async () => {
    await rm(targetRoot, { recursive: true, force: true })
  })
  return targetRoot
}

async function listRelativeFiles(root: string, currentDir = ''): Promise<string[]> {
  const absoluteDir = currentDir ? path.join(root, currentDir) : root
  const entries = await readdir(absoluteDir, { withFileTypes: true })
  const files: string[] = []

  for (const entry of [...entries].sort((left, right) => left.name.localeCompare(right.name))) {
    const relativePath = currentDir ? path.join(currentDir, entry.name) : entry.name

    if (entry.isDirectory()) {
      files.push(...(await listRelativeFiles(root, relativePath)))
      continue
    }

    files.push(relativePath.split(path.sep).join('/'))
  }

  return files
}

const TDS_UI_REFERENCE_FILES = [
  'references/decision-matrix.md',
  'references/form-patterns.md',
  'references/layout-and-navigation.md',
  'references/feedback-and-loading.md',
  'references/display-patterns.md',
  'references/export-gaps.md',
  'references/policy-summary.md',
]

const TDS_UI_RULE_FILES = [
  'rules/catalog-doc-backed-first.md',
  'rules/catalog-export-gap-handling.md',
  'rules/state-controlled-uncontrolled.md',
  'rules/screen-states-loading-error-empty.md',
  'rules/no-rn-primitive-when-tds-exists.md',
  'rules/export-only-gated.md',
  'rules/navbar-import-gap.md',
  'rules/accessibility-interactive-elements.md',
]

const TDS_UI_OUTPUT_CONTRACT_LINES = [
  '1. 추천 컴포넌트',
  '2. 선택 이유',
  '3. 가장 가까운 대안과 왜 아닌지',
  '4. controlled / uncontrolled 패턴',
  '5. loading / error / empty / disabled / a11y 체크',
  '6. docs URL + root export module',
  '7. anomaly note 또는 export-only / docs-missing note',
]

const TDS_UI_OUTPUT_CONTRACT_ENFORCEMENT_LINES = [
  '- 위 7항 중 하나라도 빠지면 incomplete answer로 간주한다.',
  '- export-only 추천 시에는 반드시 doc-backed fallback도 같이 적는다.',
]

const TDS_UI_ACCEPTANCE_CHECK_LINES = [
  '- "검색어 입력 후 목록 필터링 화면" -> `search-field + list + list-row`; `text-field` 단독 추천으로 끝내지 않는다.',
  '- "약관 여러 개 동의" -> `checkbox`; `agreement`는 export-only 검증 없이는 기본 추천하지 않는다.',
  '- "알림 설정 on/off" -> `switch`; `checkbox`를 추천하지 않는다.',
  '- "월간 / 연간 전환" -> `segmented-control`을 우선 검토한다.',
  '- "콘텐츠 탭 5개 이상 전환" -> `tab + fluid`를 추천한다.',
  '- "송금 금액 입력" -> `amount-top + keypad`를 우선 추천한다.',
  '- "수량 조절" -> `numeric-spinner`를 우선 추천한다. `slider`는 기본값이 아니다.',
  '- "작업 완료 알림" -> `toast`를 우선 추천한다.',
  '- "성공/실패 전체 화면" -> `result`를 추천한다.',
  '- "404/500 오류 화면" -> `error-page`를 추천한다.',
  '- "FAQ 펼침 목록" -> `board-row`를 추천한다.',
  '- "상단 네비게이션" -> `navbar`를 추천하되 export-gap note를 반드시 붙인다.',
  '- "막대 차트" -> `chart`를 추천하되 docs slug alias note를 반드시 붙인다. (`Chart/bar-chart`)',
  '- "단계형 진행 UI" -> `stepper-row`를 추천하되 docs slug alias note를 반드시 붙인다. (`stepper`)',
]

function renderTdsUiAgentsMarkdown() {
  return [
    '# tds-ui AGENTS (Generated)',
    '',
    '이 파일은 `metadata.json`, `generated/catalog.json`, `generated/anomalies.json`에서 파생된 generated output이다.',
    '수정은 truth source를 바꾼 뒤 재생성된 결과만 반영한다.',
    '',
    '## Truth Sources',
    ...['metadata.json', 'generated/catalog.json', 'generated/anomalies.json'].map(
      (filePath) => `- \`${filePath}\``,
    ),
    '',
    '## Human References',
    ...TDS_UI_REFERENCE_FILES.map((filePath) => `- \`${filePath}\``),
    '',
    '## Review Rules',
    ...TDS_UI_RULE_FILES.map((filePath) => `- \`${filePath}\``),
    '',
    '## Answer Contract',
    ...TDS_UI_OUTPUT_CONTRACT_LINES,
    '',
    '## Contract Enforcement',
    ...TDS_UI_OUTPUT_CONTRACT_ENFORCEMENT_LINES,
    '',
  ].join('\n')
}

function renderTdsUiCatalogProjection(
  catalog: Array<{
    name: string
    cluster: string
    docsSlug: string | null
    rootImportPath: string
    selectionStatus: string
  }>,
  metadata: {
    packageVersion: string
    lastVerifiedAt: string
  },
) {
  const metadataLine = `- package: \`@toss/tds-react-native@${metadata.packageVersion}\``
  const verifiedLine = `- last verified: \`${metadata.lastVerifiedAt}\``
  const truthSourceLine = '- truth source: `generated/catalog.json`'
  const totalLine = `- total components: \`${catalog.length}\``
  const clusterOrder = [
    'input-choice',
    'actions-feedback',
    'list-navigation-layout',
    'content-display',
    'guarded-export-only',
    'blocked-by-default',
  ]
  const clusterNotes: Record<string, string[]> = {
    'list-navigation-layout': [
      '- anomaly: `navbar` is docs-backed, but use the catalog `rootImportPath`',
      '- anomaly: `stepper-row` docs slug is `stepper`',
    ],
    'content-display': ['- anomaly: `chart` docs slug is `Chart/bar-chart`'],
    'guarded-export-only': [
      '- gate these by default and include a doc-backed fallback in the answer',
    ],
    'blocked-by-default': ['- do not recommend by default'],
  }

  return [
    '# tds-ui Catalog Projection (Generated)',
    '',
    metadataLine,
    verifiedLine,
    truthSourceLine,
    totalLine,
    '',
    ...clusterOrder.flatMap((cluster) => {
      const entries = catalog
        .filter((entry) => entry.cluster === cluster)
        .map((entry) => entry.name)
      return [
        `## ${cluster} (${entries.length})`,
        '',
        `- ${entries.map((entry) => `\`${entry}\``).join(', ')}`,
        ...(clusterNotes[cluster] ?? []),
        '',
      ]
    }),
  ].join('\n')
}

const NX_ROOT_SCHEMA_URL =
  'https://raw.githubusercontent.com/nrwl/nx/master/packages/nx/schemas/nx-schema.json'
const NX_PROJECT_SCHEMA_URL =
  'https://raw.githubusercontent.com/nrwl/nx/master/packages/nx/schemas/project-schema.json'
const ROOT_BIOME_BIN = fileURLToPath(
  new URL('../../../../node_modules/.bin/biome', import.meta.url),
)

function escapeRegExp(source: string) {
  return source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function getSourceSlice(source: string, startMarker: string, endMarker?: string) {
  const startIndex = source.indexOf(startMarker)

  assert.notEqual(startIndex, -1, `missing source marker: ${startMarker}`)

  if (!endMarker) {
    return source.slice(startIndex)
  }

  const endIndex = source.indexOf(endMarker, startIndex + startMarker.length)

  assert.notEqual(endIndex, -1, `missing source marker: ${endMarker}`)

  return source.slice(startIndex, endIndex)
}

function getMarkdownSectionBody(source: string, heading: string) {
  const headingPattern = new RegExp(`^## ${escapeRegExp(heading)}\\n`, 'm')
  const match = headingPattern.exec(source)

  assert.ok(match, `missing section: ${heading}`)

  const sectionStart = (match.index ?? 0) + match[0].length
  const nextHeadingMatch = /^## /m.exec(source.slice(sectionStart))
  const sectionEnd =
    nextHeadingMatch && typeof nextHeadingMatch.index === 'number'
      ? sectionStart + nextHeadingMatch.index
      : source.length

  return source.slice(sectionStart, sectionEnd).trim()
}

function getManagedBlock(source: string, startMarker: string, endMarker: string) {
  const startIndex = source.indexOf(startMarker)

  assert.notEqual(startIndex, -1, `missing managed block start marker: ${startMarker}`)

  const contentStart = startIndex + startMarker.length
  const endIndex = source.indexOf(endMarker, contentStart)

  assert.notEqual(endIndex, -1, `missing managed block end marker: ${endMarker}`)

  return source.slice(contentStart, endIndex).trim()
}

test('template module does not expose the legacy optional docs sync entrypoint', () => {
  assert.equal('syncOptionalDocsTemplates' in templateModule, false)
})

test('remaining markdown templates keep source free of optional marker comments', async () => {
  async function collectMarkdownTemplateFiles(
    rootDir: string,
    relativeDir = '',
  ): Promise<string[]> {
    const entries = await readdir(path.join(rootDir, relativeDir), { withFileTypes: true })
    const filePaths: string[] = []

    for (const entry of entries) {
      const nextRelativePath = path.posix.join(relativeDir, entry.name)

      if (entry.isDirectory()) {
        filePaths.push(...(await collectMarkdownTemplateFiles(rootDir, nextRelativePath)))
        continue
      }

      if (entry.isFile() && nextRelativePath.endsWith('.md')) {
        filePaths.push(nextRelativePath)
      }
    }

    return filePaths
  }

  const baseTemplateRoot = fileURLToPath(
    new URL('../../../scaffold-templates/base', import.meta.url),
  )
  const templateFiles = await collectMarkdownTemplateFiles(baseTemplateRoot)

  for (const templateFile of templateFiles) {
    const templateSource = await readFile(path.join(baseTemplateRoot, templateFile), 'utf8')
    assert.doesNotMatch(templateSource, /<!--\s*optional-[a-z-]+:(?:start|end)\s*-->/)
  }
})

test('dynamic docs and frontend policy are code-owned instead of shipped as template markdown', async () => {
  const codeOwnedDocs = [
    'AGENTS.md',
    'docs/index.md',
    'docs/engineering/workspace-topology.md',
    'docs/engineering/frontend-policy.md',
  ]

  for (const templateFile of codeOwnedDocs) {
    assert.equal(
      await pathExists(
        fileURLToPath(new URL(`../../../scaffold-templates/base/${templateFile}`, import.meta.url)),
      ),
      false,
    )
  }
})

test('docs and feature modules do not keep separate skill manifests', async () => {
  const docsSource = await readFile(fileURLToPath(new URL('./docs.ts', import.meta.url)), 'utf8')
  const featureCatalogSource = await readFile(
    fileURLToPath(new URL('./feature-catalog.ts', import.meta.url)),
    'utf8',
  )
  const sharedSkillCatalogSource = await readFile(
    fileURLToPath(new URL('./skill-catalog.ts', import.meta.url)),
    'utf8',
  )

  assert.doesNotMatch(docsSource, /WORKSPACE_FEATURE_DEFINITIONS/)
  assert.doesNotMatch(docsSource, /templateDir: 'backoffice-react'/)
  assert.doesNotMatch(featureCatalogSource, /templateDir: 'backoffice-react'/)
  assert.match(featureCatalogSource, /resolveOptionalSkillDefinition/)
  assert.match(featureCatalogSource, /resolveRecommendedSkillDefinitions/)
  assert.doesNotMatch(sharedSkillCatalogSource, /enabled:\s*\(options\)/)
  assert.doesNotMatch(sharedSkillCatalogSource, /templateDir:/)
  assert.doesNotMatch(sharedSkillCatalogSource, /createProjectSkillDocPath\('backoffice-react'\)/)
  assert.doesNotMatch(sharedSkillCatalogSource, /createProjectSkillDocPath\('cloudflare-worker'\)/)
  assert.doesNotMatch(sharedSkillCatalogSource, /createProjectSkillDocPath\('supabase-project'\)/)
  assert.doesNotMatch(sharedSkillCatalogSource, /createProjectSkillDocPath\('firebase-functions'\)/)
  assert.doesNotMatch(sharedSkillCatalogSource, /createProjectSkillDocPath\('trpc-boundary'\)/)
})

test('skill taxonomy metadata is centralized in a shared catalog', async () => {
  const catalogSource = await readFile(
    fileURLToPath(new URL('./skill-catalog.ts', import.meta.url)),
    'utf8',
  )
  const featureCatalogSource = await readFile(
    fileURLToPath(new URL('./feature-catalog.ts', import.meta.url)),
    'utf8',
  )
  const skillsInstallSource = await readFile(
    fileURLToPath(new URL('../skills-install.ts', import.meta.url)),
    'utf8',
  )
  const docsSource = await readFile(fileURLToPath(new URL('./docs.ts', import.meta.url)), 'utf8')
  const skillsContractSource = await readFile(
    fileURLToPath(new URL('../skills-contract.ts', import.meta.url)),
    'utf8',
  )
  const sharedFeatureSource = await readFile(
    fileURLToPath(new URL('./feature-catalog.ts', import.meta.url)),
    'utf8',
  )

  assert.match(catalogSource, /export const SKILL_CATALOG/)
  assert.match(featureCatalogSource, /from '\.\/skill-catalog\.js'/)
  assert.match(skillsInstallSource, /from '\.\/templates\/feature-catalog\.js'/)
  assert.match(skillsInstallSource, /from '\.\/skills-contract\.js'/)
  assert.match(docsSource, /from '\.\.\/root-readme\.js'/)
  assert.match(skillsContractSource, /PROJECT_SKILLS_CANONICAL_DIR/)
  assert.doesNotMatch(catalogSource, /from '\.\.\/skills-contract\.js'/)
  assert.doesNotMatch(catalogSource, /docsPath:/)
  assert.doesNotMatch(catalogSource, /referenceCatalogPath:/)
  assert.doesNotMatch(catalogSource, /topologyLabel:/)
  assert.doesNotMatch(catalogSource, /frontendPolicyReferenceLabel:/)
  assert.doesNotMatch(catalogSource, /referenceCatalogRelativePath:/)
  assert.doesNotMatch(catalogSource, /createProjectSkillDocPath\(/)
  assert.doesNotMatch(catalogSource, /createProjectSkillGeneratedPath\(/)
  assert.match(sharedFeatureSource, /from '\.\/skill-catalog\.js'/)
  assert.match(sharedFeatureSource, /getServerProviderAdapter/)
  assert.doesNotMatch(sharedFeatureSource, /optionalSkillId:\s*'cloudflare-worker'/)
  assert.doesNotMatch(sharedFeatureSource, /optionalSkillId:\s*'supabase-project'/)
  assert.doesNotMatch(sharedFeatureSource, /optionalSkillId:\s*'firebase-functions'/)
  assert.doesNotMatch(sharedFeatureSource, /templateDir: 'backoffice-react'/)
  assert.doesNotMatch(sharedFeatureSource, /templateDir: 'cloudflare-worker'/)
  assert.doesNotMatch(sharedFeatureSource, /templateDir: 'supabase-project'/)
  assert.doesNotMatch(sharedFeatureSource, /templateDir: 'firebase-functions'/)
  assert.doesNotMatch(sharedFeatureSource, /templateDir: 'trpc-boundary'/)
})

test('skill catalog ids stay aligned with root skills directories', async () => {
  const skillRoot = fileURLToPath(new URL('../../../../skills', import.meta.url))
  const skillDirectories = (await readdir(skillRoot, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
  const installableSkillDirectories: string[] = []

  for (const directory of skillDirectories) {
    if (await pathExists(path.join(skillRoot, directory, 'SKILL.md'))) {
      installableSkillDirectories.push(directory)
    }
  }

  assert.deepEqual(SKILL_CATALOG.map((skill) => skill.id).sort(), installableSkillDirectories)
})

test('skill catalog is generated from skill source frontmatter metadata', async () => {
  const skillCatalogSource = await readFile(
    fileURLToPath(new URL('./skill-catalog.ts', import.meta.url)),
    'utf8',
  )
  const skillRoot = fileURLToPath(new URL('../../../../skills', import.meta.url))
  const installableSkillDirectories: string[] = []

  for (const entry of await readdir(skillRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue
    }

    if (await pathExists(path.join(skillRoot, entry.name, 'SKILL.md'))) {
      installableSkillDirectories.push(entry.name)
    }
  }

  installableSkillDirectories.sort()

  assert.match(skillCatalogSource, /generated by scripts\/sync-skill-catalog\.ts/)

  for (const directory of installableSkillDirectories) {
    const skillSource = await readFile(path.join(skillRoot, directory, 'SKILL.md'), 'utf8')
    const frontmatter = /^---\n([\s\S]*?)\n---/m.exec(skillSource)?.[1] ?? ''
    const nameMatch = /^name:\s*(.+)$/m.exec(frontmatter)
    const labelMatch = /^label:\s*(.+)$/m.exec(frontmatter)
    const categoryMatch = /^category:\s*(core|optional)$/m.exec(frontmatter)

    assert.equal(nameMatch?.[1] ?? '', directory)
    assert.notEqual(labelMatch?.[1] ?? '', '', `${directory} must declare a label in frontmatter`)
    assert.notEqual(
      categoryMatch?.[1] ?? '',
      '',
      `${directory} must declare a category in frontmatter`,
    )
    assert.match(skillCatalogSource, new RegExp(`'${escapeRegExp(directory)}': \\{`))
    assert.match(
      skillCatalogSource,
      new RegExp(`agentsLabel: '${escapeRegExp(labelMatch?.[1] ?? '')}'`),
    )
  }
})

test('skill docs share a single frontend policy path reference', async () => {
  const sharedReferencePath = fileURLToPath(
    new URL('../../../../skills/shared/references/frontend-policy.md', import.meta.url),
  )
  const sharedReferenceSource = await readFile(sharedReferencePath, 'utf8')
  const skillDocs = [
    '../../../../skills/granite-routing/SKILL.md',
    '../../../../skills/miniapp-capabilities/SKILL.md',
    '../../../../skills/granite-routing/references/patterns.md',
    '../../../../skills/miniapp-capabilities/references/feature-map.md',
    '../../../../skills/miniapp-capabilities/references/full-index.md',
  ]

  assert.match(sharedReferenceSource, /docs\/engineering\/frontend-policy\.md/)

  for (const relativePath of skillDocs) {
    const source = await readFile(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8')
    assert.doesNotMatch(source, /docs\/engineering\/frontend-policy\.md/)
    assert.match(source, /shared\/references\/frontend-policy\.md/)
  }
})

test('generated docs and inspectors derive workspace topology from a shared helper', async () => {
  const generatedWorkspaceSource = await readFile(
    fileURLToPath(new URL('./generated-workspace.ts', import.meta.url)),
    'utf8',
  )
  const workspaceInspectorSource = await readFile(
    fileURLToPath(new URL('../workspace-inspector.ts', import.meta.url)),
    'utf8',
  )
  const templateTypesSource = await readFile(
    fileURLToPath(new URL('./types.ts', import.meta.url)),
    'utf8',
  )

  assert.match(generatedWorkspaceSource, /from '\.\.\/workspace-topology\.js'/)
  assert.match(workspaceInspectorSource, /from '\.\/workspace-topology\.js'/)
  assert.match(
    templateTypesSource,
    /import type \{ ServerProvider \} from '\.\.\/providers\/index\.js'/,
  )
  assert.doesNotMatch(templateTypesSource, /GeneratedSkillsServerProvider/)
})

test('frontend policy keeps TDS and Granite guidance as a shared contract', async () => {
  const frontendPolicySource = await readFile(
    fileURLToPath(new URL('./frontend-policy.ts', import.meta.url)),
    'utf8',
  )

  assert.doesNotMatch(frontendPolicySource, /\.agents\/skills\/miniapp\/SKILL\.md/)
  assert.doesNotMatch(frontendPolicySource, /\.agents\/skills\/granite\/SKILL\.md/)
  assert.doesNotMatch(frontendPolicySource, /\.agents\/skills\/tds\/SKILL\.md/)
  assert.doesNotMatch(frontendPolicySource, /\.agents\/skills\/tds\/references\/catalog\.md/)
  assert.doesNotMatch(frontendPolicySource, /\.agents\/skills\/tds-ui\/references\/catalog\.md/)
  assert.doesNotMatch(frontendPolicySource, /getCoreSkillDefinition\(/)
  assert.doesNotMatch(frontendPolicySource, /createProjectSkillDocPath\(/)
  assert.doesNotMatch(frontendPolicySource, /createProjectSkillGeneratedPath\(/)
  assert.match(frontendPolicySource, /TDS를 써 주세요/)
  assert.match(frontendPolicySource, /Granite router 규칙/)
  assert.match(
    frontendPolicySource,
    /정말 이 컴포넌트를 써야 하면 `biome-ignore`에 이유를 같이 남겨 주세요/,
  )
  assert.doesNotMatch(frontendPolicySource, /Granite UI로 보완/)
  assert.doesNotMatch(frontendPolicySource, /TDS `Txt`/)
})

test('tds-ui canonical skill package is self-contained and decision-driven', async () => {
  const tdsUiRoot = fileURLToPath(new URL('../../../../skills/tds-ui', import.meta.url))
  const expectedFiles = [
    'AGENTS.md',
    'generated/anomalies.json',
    'generated/catalog.json',
    'generated/catalog.md',
    'metadata.json',
    'references/decision-matrix.md',
    'references/display-patterns.md',
    'references/export-gaps.md',
    'references/feedback-and-loading.md',
    'references/form-patterns.md',
    'references/layout-and-navigation.md',
    'references/policy-summary.md',
    'rules/accessibility-interactive-elements.md',
    'rules/catalog-doc-backed-first.md',
    'rules/catalog-export-gap-handling.md',
    'rules/export-only-gated.md',
    'rules/navbar-import-gap.md',
    'rules/no-rn-primitive-when-tds-exists.md',
    'rules/screen-states-loading-error-empty.md',
    'rules/state-controlled-uncontrolled.md',
    'SKILL.md',
  ]

  assert.deepEqual(await listRelativeFiles(tdsUiRoot), expectedFiles)

  const skillSource = await readFile(path.join(tdsUiRoot, 'SKILL.md'), 'utf8')
  const agentsSource = await readFile(path.join(tdsUiRoot, 'AGENTS.md'), 'utf8')
  const policySummarySource = await readFile(
    path.join(tdsUiRoot, 'references', 'policy-summary.md'),
    'utf8',
  )
  assert.match(skillSource, /generated\/catalog\.json/)
  assert.match(skillSource, /generated\/anomalies\.json/)
  assert.match(skillSource, /references\/decision-matrix\.md/)
  assert.match(skillSource, /rules\/\*\.md/)
  assert.match(skillSource, /추천 컴포넌트/)
  assert.match(skillSource, /anomaly note/i)
  assert.match(skillSource, /incomplete answer/)
  assert.match(skillSource, /doc-backed fallback/)
  assert.doesNotMatch(skillSource, /ensure-fresh|refresh-catalog/)
  assert.equal(agentsSource, renderTdsUiAgentsMarkdown())

  const metadata = JSON.parse(await readFile(path.join(tdsUiRoot, 'metadata.json'), 'utf8')) as {
    package: { name: string; version: string }
    lastVerifiedAt: string
  }
  assert.equal(metadata.package.name, '@toss/tds-react-native')
  assert.equal(metadata.package.version, '2.0.2')
  assert.equal(metadata.lastVerifiedAt, '2026-03-21')

  const catalog = JSON.parse(
    await readFile(path.join(tdsUiRoot, 'generated', 'catalog.json'), 'utf8'),
  ) as Array<{
    name: string
    cluster: string
    selectionStatus: string
    rootExported: boolean
    componentDirExists: boolean
    rootImportPath: string
    docsStatus: string
    docsSlug: string | null
    docUrl: string | null
    stateModel: {
      controlled: string[]
      uncontrolled: string[]
    }
    useWhen: string[]
    avoidWhen: string[]
    knownCaveats: string[]
    packageVersion: string
    lastVerifiedAt: string
  }>

  const searchField = catalog.find((entry) => entry.name === 'search-field')
  const navbar = catalog.find((entry) => entry.name === 'navbar')
  const agreement = catalog.find((entry) => entry.name === 'agreement')
  const paragraph = catalog.find((entry) => entry.name === 'paragraph')
  const chart = catalog.find((entry) => entry.name === 'chart')
  const stepperRow = catalog.find((entry) => entry.name === 'stepper-row')
  const catalogProjectionSource = await readFile(
    path.join(tdsUiRoot, 'generated', 'catalog.md'),
    'utf8',
  )

  assert.equal(
    catalogProjectionSource,
    renderTdsUiCatalogProjection(catalog, {
      packageVersion: metadata.package.version,
      lastVerifiedAt: metadata.lastVerifiedAt,
    }),
  )

  assert.equal(searchField?.cluster, 'input-choice')
  assert.equal(searchField?.selectionStatus, 'doc-backed')
  assert.equal(searchField?.rootExported, true)
  assert.equal(searchField?.componentDirExists, true)
  assert.equal(searchField?.rootImportPath, '@toss/tds-react-native')
  assert.equal(searchField?.docsStatus, 'public-docs')
  assert.equal(searchField?.docsSlug, 'search-field')
  assert.equal(
    searchField?.docUrl,
    'https://tossmini-docs.toss.im/tds-react-native/components/search-field/',
  )
  assert.deepEqual(searchField?.stateModel, {
    controlled: ['value', 'onChange'],
    uncontrolled: ['defaultValue'],
  })
  assert.ok(searchField?.useWhen.includes('search query input'))
  assert.ok(searchField?.avoidWhen.includes('free-form non-search text entry'))
  assert.ok(
    searchField?.knownCaveats.includes('prefer over text-field when the primary intent is search'),
  )
  assert.equal(searchField?.packageVersion, '2.0.2')
  assert.equal(searchField?.lastVerifiedAt, '2026-03-21')

  assert.equal(navbar?.cluster, 'list-navigation-layout')
  assert.equal(navbar?.selectionStatus, 'export-gap')
  assert.equal(navbar?.rootExported, false)
  assert.equal(navbar?.componentDirExists, true)
  assert.equal(navbar?.rootImportPath, '@toss/tds-react-native/extensions/page-navbar')
  assert.equal(navbar?.docsStatus, 'public-docs')
  assert.equal(navbar?.docsSlug, 'navbar')
  assert.equal(navbar?.docUrl, 'https://tossmini-docs.toss.im/tds-react-native/components/navbar/')
  assert.deepEqual(navbar?.stateModel, {
    controlled: [],
    uncontrolled: [],
  })
  assert.ok(
    navbar?.knownCaveats.includes(
      'docs-backed but import path differs from the package root export',
    ),
  )

  assert.equal(agreement?.cluster, 'guarded-export-only')
  assert.equal(agreement?.selectionStatus, 'export-only')
  assert.equal(agreement?.rootExported, true)
  assert.equal(agreement?.componentDirExists, true)
  assert.equal(agreement?.rootImportPath, '@toss/tds-react-native')
  assert.equal(agreement?.docsStatus, 'no-public-docs')
  assert.equal(agreement?.docsSlug, null)
  assert.equal(agreement?.docUrl, null)
  assert.ok(
    agreement?.knownCaveats.includes('export-only / docs-missing: provide a doc-backed fallback'),
  )

  assert.equal(paragraph?.cluster, 'blocked-by-default')
  assert.equal(paragraph?.selectionStatus, 'blocked')
  assert.equal(paragraph?.rootExported, false)
  assert.equal(paragraph?.componentDirExists, true)
  assert.equal(paragraph?.rootImportPath, '')
  assert.equal(paragraph?.docsStatus, 'no-public-docs')
  assert.equal(paragraph?.docsSlug, null)
  assert.equal(paragraph?.docUrl, null)
  assert.ok(paragraph?.knownCaveats.includes('dir-only-weak: do not recommend by default'))
  assert.equal(chart?.docsSlug, 'Chart/bar-chart')
  assert.equal(stepperRow?.docsSlug, 'stepper')

  const anomalies = JSON.parse(
    await readFile(path.join(tdsUiRoot, 'generated', 'anomalies.json'), 'utf8'),
  ) as Record<string, Array<{ name: string }>>
  assert.deepEqual(Object.keys(anomalies).sort(), [
    'dir-only-weak',
    'docs-slug-alias',
    'root-export-gap',
    'root-export-no-public-docs',
  ])
  assert.deepEqual(anomalies['docs-slug-alias']?.map((entry) => entry.name).sort(), [
    'chart',
    'stepper-row',
  ])
  assert.deepEqual(
    anomalies['root-export-gap']?.map((entry) => entry.name),
    ['navbar'],
  )
  assert.deepEqual(anomalies['root-export-no-public-docs']?.map((entry) => entry.name).sort(), [
    'agreement',
    'bottom-cta',
    'bottom-sheet',
    'fixed-bottom-cta',
    'icon',
    'tooltip',
    'top',
    'txt',
  ])
  assert.deepEqual(
    anomalies['dir-only-weak']?.map((entry) => entry.name),
    ['paragraph'],
  )

  for (const ruleFile of expectedFiles.filter((filePath) => filePath.startsWith('rules/'))) {
    const ruleSource = await readFile(path.join(tdsUiRoot, ruleFile), 'utf8')
    assert.match(ruleSource, /^---\n/m, ruleFile)
    assert.match(ruleSource, /impact:/, ruleFile)
    assert.match(ruleSource, /tags:/, ruleFile)
    assert.match(ruleSource, /reference:/, ruleFile)
    assert.match(ruleSource, /## Incorrect/, ruleFile)
    assert.match(ruleSource, /## Correct/, ruleFile)
  }

  for (const contractEnforcementLine of TDS_UI_OUTPUT_CONTRACT_ENFORCEMENT_LINES) {
    assert.match(policySummarySource, new RegExp(escapeRegExp(contractEnforcementLine)))
  }

  for (const acceptanceCheckLine of TDS_UI_ACCEPTANCE_CHECK_LINES) {
    assert.match(policySummarySource, new RegExp(escapeRegExp(acceptanceCheckLine)))
  }
})

test('frontend route verifier is rendered from frontend policy metadata instead of template source', async () => {
  assert.equal(
    await pathExists(
      fileURLToPath(
        new URL('../../../scaffold-templates/root/verify-frontend-routes.mjs', import.meta.url),
      ),
    ),
    false,
  )

  const frontendPolicySource = await readFile(
    fileURLToPath(new URL('./frontend-policy.ts', import.meta.url)),
    'utf8',
  )

  assert.match(frontendPolicySource, /renderFrontendPolicyVerifierSource/)
})

test('docs module keeps code-owned doc definitions in a single manifest', async () => {
  const docsSource = await readFile(fileURLToPath(new URL('./docs.ts', import.meta.url)), 'utf8')

  assert.match(docsSource, /const CODE_OWNED_DOC_DEFINITIONS/)
  assert.match(docsSource, /for \(const definition of CODE_OWNED_DOC_DEFINITIONS\)/)
  assert.doesNotMatch(docsSource, /const CODE_OWNED_DOCS_INSIDE_DOCS/)
})

test('docs module derives rendered doc lists from shared document metadata', async () => {
  const docsSource = await readFile(fileURLToPath(new URL('./docs.ts', import.meta.url)), 'utf8')
  const agentsSource = getSourceSlice(
    docsSource,
    'function renderAgentsMarkdown',
    'function renderDocsIndexMarkdown',
  )
  const docsIndexSource = getSourceSlice(
    docsSource,
    'function renderDocsIndexMarkdown',
    'function renderWorkspaceTopologyMarkdown',
  )

  assert.match(docsSource, /const DOCUMENT_DEFINITIONS/)
  assert.doesNotMatch(agentsSource, /docs\/ai\/Plan\.md/)
  assert.doesNotMatch(agentsSource, /docs\/ai\/Status\.md/)
  assert.doesNotMatch(agentsSource, /docs\/ai\/Decisions\.md/)
  assert.doesNotMatch(agentsSource, /docs\/index\.md/)
  assert.doesNotMatch(agentsSource, /docs\/product\/기능명세서\.md/)
  assert.doesNotMatch(docsIndexSource, /engineering\/repo-contract\.md/)
  assert.doesNotMatch(docsIndexSource, /engineering\/frontend-policy\.md/)
  assert.doesNotMatch(docsIndexSource, /engineering\/workspace-topology\.md/)
})

test('tRPC workspace descriptors come from templates/trpc metadata', async () => {
  const featureCatalogSource = await readFile(
    fileURLToPath(new URL('./feature-catalog.ts', import.meta.url)),
    'utf8',
  )
  const patchingServerSource = await readFile(
    fileURLToPath(new URL('../patching/server.ts', import.meta.url)),
    'utf8',
  )

  assert.match(featureCatalogSource, /from '\.\/trpc\.js'/)
  assert.doesNotMatch(featureCatalogSource, /`packages\/contracts`/)
  assert.doesNotMatch(featureCatalogSource, /`packages\/app-router`/)
  assert.doesNotMatch(patchingServerSource, /boundary schema의 source of truth예요/)
  assert.doesNotMatch(patchingServerSource, /route shape와 `AppRouter` 타입의 source of truth예요/)
})

test('tRPC workspace paths are not hardcoded outside the shared workspace metadata', async () => {
  const cliSource = await readFile(fileURLToPath(new URL('../index.ts', import.meta.url)), 'utf8')
  const packageManagerSource = await readFile(
    fileURLToPath(new URL('../package-manager.ts', import.meta.url)),
    'utf8',
  )
  const trpcMetadataSource = await readFile(
    fileURLToPath(new URL('../trpc-workspace-metadata.ts', import.meta.url)),
    'utf8',
  )
  const patchingSharedSource = await readFile(
    fileURLToPath(new URL('../patching/shared.ts', import.meta.url)),
    'utf8',
  )
  const workspaceTopologySource = await readFile(
    fileURLToPath(new URL('../workspace-topology.ts', import.meta.url)),
    'utf8',
  )

  assert.doesNotMatch(cliSource, /packages\/contracts/)
  assert.doesNotMatch(cliSource, /packages\/app-router/)
  assert.doesNotMatch(packageManagerSource, /packages\/contracts/)
  assert.doesNotMatch(packageManagerSource, /packages\/app-router/)
  assert.match(trpcMetadataSource, /LEGACY_TRPC_WORKSPACE_PACKAGE_PATH/)
  assert.match(workspaceTopologySource, /LEGACY_TRPC_WORKSPACE_PACKAGE_PATH/)
  assert.doesNotMatch(workspaceTopologySource, /packages\/trpc/)
  assert.doesNotMatch(patchingSharedSource, /\.\.\/packages\/app-router/)
})

test('verify docs templates source uses the shared verify token', async () => {
  const verifyTemplateSections = [
    {
      templateFile: 'docs/engineering/repo-contract.md',
      heading: 'Verify 정의',
    },
  ]

  for (const template of verifyTemplateSections) {
    const templateSource = await readFile(
      fileURLToPath(
        new URL(`../../../scaffold-templates/base/${template.templateFile}`, import.meta.url),
      ),
      'utf8',
    )

    assert.equal(
      getMarkdownSectionBody(templateSource, template.heading),
      '{{rootVerifyStepsMarkdown}}',
    )
  }
})

test('root package template keeps packageManager field tokenized', async () => {
  const templateSource = await readFile(
    fileURLToPath(new URL('../../../scaffold-templates/root/package.json', import.meta.url)),
    'utf8',
  )

  assert.match(templateSource, /"packageManager": "\{\{packageManagerField\}\}"/)
  assert.doesNotMatch(templateSource, /pnpm@\d/)
})

test('package manager adapters do not expose the legacy rootVerifyScript helper', () => {
  for (const packageManager of PACKAGE_MANAGERS) {
    assert.equal('rootVerifyScript' in getPackageManagerAdapter(packageManager), false)
  }
})

test('README opens with user value and points readers to the next action', async () => {
  const readmeSource = await readFile(
    fileURLToPath(new URL('../../../../README.md', import.meta.url)),
    'utf8',
  )

  assert.match(readmeSource, /## 이런 경우에 잘 맞아요/)
  assert.match(readmeSource, /## 빠른 시작/)
  assert.match(readmeSource, /## 생성한 다음엔 이렇게 보면 돼요/)
  assert.match(readmeSource, /## CLI 옵션은 `--help`로 확인해요/)
  assert.match(readmeSource, /생성한 뒤에는 루트 `AGENTS\.md`의 `Start Here`부터 보면 돼요\./)
  assert.ok(
    readmeSource.indexOf('## 빠른 시작') <
      readmeSource.indexOf('## CLI 옵션은 `--help`로 확인해요'),
  )
  assert.ok(
    readmeSource.indexOf('## 생성한 다음엔 이렇게 보면 돼요') <
      readmeSource.indexOf('## CLI 옵션은 `--help`로 확인해요'),
  )
})

test('README frames skill value as miniapp-ready setup before agent collaboration wording', async () => {
  const readmeSource = await readFile(
    fileURLToPath(new URL('../../../../README.md', import.meta.url)),
    'utf8',
  )

  assert.match(
    readmeSource,
    /MiniApp에서 자주 쓰는 agent skill을 나중에 표준 CLI로 붙일 수 있으면 좋을 때/,
  )
  assert.match(readmeSource, /## skills 전략/)
  assert.doesNotMatch(
    readmeSource,
    /사람과 에이전트가 같은 문서와 Skill을 보면서 바로 작업하고 싶을 때/,
  )
})

test('README defers generated repo onboarding order to AGENTS Start Here', async () => {
  const readmeSource = await readFile(
    fileURLToPath(new URL('../../../../README.md', import.meta.url)),
    'utf8',
  )

  assert.match(readmeSource, /생성한 뒤에는 루트 `AGENTS\.md`의 `Start Here`부터 보면 돼요\./)
  assert.doesNotMatch(
    readmeSource,
    /docs\/product\/기능명세서\.md.*docs\/ai\/Plan\.md.*docs\/index\.md/s,
  )
})

test('README does not hand-maintain generated root tree, helper scripts, or provider file details', async () => {
  const readmeSource = await readFile(
    fileURLToPath(new URL('../../../../README.md', import.meta.url)),
    'utf8',
  )

  assert.doesNotMatch(readmeSource, /<appName>\/[\s\S]*scripts\//)
  assert.doesNotMatch(
    readmeSource,
    /verify-frontend-routes\.mjs|sync-skills\.mjs|check-skills\.mjs/,
  )
  assert.doesNotMatch(
    readmeSource,
    /SUPABASE_PROJECT_REF|CLOUDFLARE_ACCOUNT_ID|FIREBASE_PROJECT_ID|workers\.dev|supabase\/functions\/api\/index\.ts/,
  )
  assert.match(readmeSource, /자세한 생성 구조와 운영 방식은 생성된 repo 문서를 보면 돼요\./)
})

test('README treats generated skills as a first-class scaffold output and avoids opaque English jargon', async () => {
  const readmeSource = await readFile(
    fileURLToPath(new URL('../../../../README.md', import.meta.url)),
    'utf8',
  )
  const expectedCoreInstallCommand = renderSkillsInstallExample(
    CORE_SKILL_DEFINITIONS.map((skill) => skill.id),
  )
  const expectedCommandSummary = renderSkillsStandardCommandSummary()

  assert.match(
    readmeSource,
    /공식 scaffold 위에 필요한 운영 문서와 optional agent skill onboarding을 함께 준비해줘요\./,
  )
  assert.match(readmeSource, /optional agent skill 가이드까지 함께 준비해주는 CLI/)
  assert.match(readmeSource, /## skills 전략/)
  assert.match(
    readmeSource,
    /`create-rn-miniapp`는 skill을 직접 관리하지 않고, 추천 skill과 설치 방법만 알려줘요\./,
  )
  assert.match(
    readmeSource,
    /실제 설치, 확인, 업데이트는 \[`@vercel-labs\/skills`\]\(https:\/\/github\.com\/vercel-labs\/skills\) 표준 CLI로 바로 하면 돼요\./,
  )
  assert.match(
    readmeSource,
    /이 저장소의 `skills\/`에는 MiniApp 작업에 맞춘 skill source가 들어 있고, 생성된 repo `README\.md`가 추천 목록을 자동으로 보여줘요\./,
  )
  assert.match(readmeSource, new RegExp(escapeRegExp(expectedCoreInstallCommand)))
  assert.match(readmeSource, new RegExp(escapeRegExp(expectedCommandSummary)))
  assert.doesNotMatch(readmeSource, /지금 설치할 수 있는 skill id는 이거예요\./)
  assert.doesNotMatch(readmeSource, /canonical/i)
  assert.doesNotMatch(readmeSource, /source of truth/i)
  assert.doesNotMatch(readmeSource, /생성물 계약/)
  assert.doesNotMatch(readmeSource, /Provider IaC/)
})

test('root README managed sections stay synced with shared renderers', async () => {
  const readmeSource = await readFile(
    fileURLToPath(new URL('../../../../README.md', import.meta.url)),
    'utf8',
  )

  assert.equal(
    getManagedBlock(
      readmeSource,
      ROOT_README_SKILLS_SECTION_START_MARKER,
      ROOT_README_SKILLS_SECTION_END_MARKER,
    ),
    renderRootReadmeSkillsSection().trim(),
  )
  assert.equal(
    getManagedBlock(
      readmeSource,
      ROOT_README_PROVIDER_SECTION_START_MARKER,
      ROOT_README_PROVIDER_SECTION_END_MARKER,
    ),
    renderRootReadmeProviderSection().trim(),
  )
})

test('skill references do not hardcode the project-local skills root when sibling paths are enough', async () => {
  const featureMapSource = await readFile(
    fileURLToPath(
      new URL('../../../../skills/miniapp-capabilities/references/feature-map.md', import.meta.url),
    ),
    'utf8',
  )
  const routingPatternsSource = await readFile(
    fileURLToPath(
      new URL('../../../../skills/granite-routing/references/patterns.md', import.meta.url),
    ),
    'utf8',
  )

  assert.doesNotMatch(featureMapSource, /\.agents\/skills\//)
  assert.doesNotMatch(routingPatternsSource, /\.agents\/skills\//)
  assert.doesNotMatch(featureMapSource, /\.\.\/tds-ui\//)
  assert.doesNotMatch(routingPatternsSource, /\.\.\/miniapp-capabilities\//)
  assert.match(featureMapSource, /`tds-ui` skill의 generated catalog/)
  assert.match(routingPatternsSource, /`miniapp-capabilities` skill의 feature map/)
  assert.match(routingPatternsSource, /`miniapp-capabilities` skill의 full index/)
})

test('shared frontend policy reference stays synced with the frontend policy renderer', async () => {
  const sharedReferenceSource = await readFile(
    fileURLToPath(
      new URL('../../../../skills/shared/references/frontend-policy.md', import.meta.url),
    ),
    'utf8',
  )

  assert.equal(sharedReferenceSource, renderSharedFrontendPolicyReferenceMarkdown())
})

test('root AGENTS follows the code-owned generated AGENTS contract', async () => {
  const agentsSource = await readFile(
    fileURLToPath(new URL('../../../../AGENTS.md', import.meta.url)),
    'utf8',
  )

  assert.doesNotMatch(agentsSource, /packages\/scaffold-templates\/base\/AGENTS\.md/)
  assert.match(agentsSource, /packages\/create-rn-miniapp\/src\/templates\/docs\.ts/)
})

test('README lists scaffolded skills in user-facing groups without leaking maintainer labels', async () => {
  const agentsSource = await readFile(
    fileURLToPath(new URL('../../../../AGENTS.md', import.meta.url)),
    'utf8',
  )
  const readmeSource = await readFile(
    fileURLToPath(new URL('../../../../README.md', import.meta.url)),
    'utf8',
  )
  const expectedCoreInstallCommand = renderSkillsInstallExample(
    CORE_SKILL_DEFINITIONS.map((skill) => skill.id),
  )

  assert.doesNotMatch(agentsSource, /^- core:/m)
  assert.doesNotMatch(agentsSource, /^- optional:/m)
  assert.match(agentsSource, /skill-catalog\.ts/)
  assert.match(agentsSource, /Skill source: `skills`/)
  assert.match(readmeSource, /생성된 repo `README\.md`가 추천 목록을 자동으로 보여줘요\./)
  assert.match(readmeSource, new RegExp(escapeRegExp(expectedCoreInstallCommand)))
  assert.doesNotMatch(readmeSource, /backoffice-react/)
  assert.doesNotMatch(readmeSource, /cloudflare-worker/)
  assert.doesNotMatch(readmeSource, /trpc-boundary/)
  assert.doesNotMatch(readmeSource, /^- core:/m)
  assert.doesNotMatch(readmeSource, /^- optional:/m)
  assert.doesNotMatch(readmeSource, /skill-catalog\.ts/)
})

test('README keeps maintainer-only implementation language out of the user guide', async () => {
  const readmeSource = await readFile(
    fileURLToPath(new URL('../../../../README.md', import.meta.url)),
    'utf8',
  )

  assert.doesNotMatch(readmeSource, /## 생성물 계약/)
  assert.doesNotMatch(readmeSource, /## Provider IaC/)
  assert.doesNotMatch(readmeSource, /렌더/)
  assert.doesNotMatch(readmeSource, /catalog가 소유해요/)
  assert.doesNotMatch(readmeSource, /skill-catalog\.ts/)
  assert.match(readmeSource, /자세한 생성 구조와 운영 방식은 생성된 repo 문서를 보면 돼요\./)
})

test('README explains option discovery through --help instead of a long flag list', async () => {
  const readmeSource = await readFile(
    fileURLToPath(new URL('../../../../README.md', import.meta.url)),
    'utf8',
  )

  assert.match(readmeSource, /## CLI 옵션은 `--help`로 확인해요/)
  assert.match(
    readmeSource,
    /어떤 실행 방식이든 마지막에 `--help`를 붙이면 전체 옵션을 볼 수 있어요\./,
  )
  assert.match(
    readmeSource,
    /처음엔 `package manager`, `server provider`, `backoffice`, `--add` 정도만 보면 충분해요\./,
  )
  assert.match(readmeSource, /## server provider 고르기/)
  assert.match(readmeSource, /## 기존 워크스페이스에 나중에 붙이기/)
  assert.doesNotMatch(readmeSource, /## 자주 쓰는 옵션/)
  assert.doesNotMatch(readmeSource, /## 필요할 때만 보는 옵션/)
  assert.ok(
    readmeSource.indexOf('## CLI 옵션은 `--help`로 확인해요') <
      readmeSource.indexOf('## server provider 고르기'),
  )
  assert.ok(
    readmeSource.indexOf('## server provider 고르기') < readmeSource.indexOf('## 생성 기준'),
  )
})

test('README explains how nx and biome keep the generated root workflow aligned', async () => {
  const readmeSource = await readFile(
    fileURLToPath(new URL('../../../../README.md', import.meta.url)),
    'utf8',
  )

  assert.match(
    readmeSource,
    /루트 `verify`는 `nx`로 워크스페이스 작업 순서를 맞추고, `biome`으로 포맷과 lint 기준을 한 군데에서 관리해요\./,
  )
  assert.match(readmeSource, /그래서 생성 직후에도 루트에서 한 번에 검사 흐름을 맞출 수 있어요\./)
})

test('server remote ops are derived from shared script metadata instead of hardcoded provider tables', async () => {
  const serverPatchingSource = await readFile(
    fileURLToPath(new URL('../patching/server.ts', import.meta.url)),
    'utf8',
  )

  assert.doesNotMatch(serverPatchingSource, /const nextCommandsByProvider =/)
  assert.doesNotMatch(serverPatchingSource, /renderServerRemoteOpsSection\(\[/)
  assert.match(serverPatchingSource, /renderServerRemoteOpsSection\(.*render.*RemoteOps.*\)/s)
})

test('root helper script names come from shared metadata instead of scattered literals', async () => {
  const frontendPolicySource = await readFile(
    fileURLToPath(new URL('./frontend-policy.ts', import.meta.url)),
    'utf8',
  )
  const claudeSource = await readFile(
    fileURLToPath(new URL('../../../scaffold-templates/base/CLAUDE.md', import.meta.url)),
    'utf8',
  )

  assert.doesNotMatch(frontendPolicySource, /frontend:policy:check/)
  assert.doesNotMatch(claudeSource, /skills:check/)
  assert.doesNotMatch(claudeSource, /skills:sync/)
  assert.doesNotMatch(claudeSource, /docs\/skills\.md/)
})

test('root package template keeps generated scripts out of template source', async () => {
  const templateSource = await readFile(
    fileURLToPath(new URL('../../../scaffold-templates/root/package.json', import.meta.url)),
    'utf8',
  )
  const templatePackageJson = JSON.parse(templateSource) as {
    scripts?: Record<string, string>
  }

  assert.equal(templatePackageJson.scripts, undefined)
})

test('applyRootTemplates does not emit legacy skills lifecycle scripts', async (t) => {
  const targetRoot = await createTempTargetRoot(t)

  await applyRootTemplates(targetRoot, createTokens('pnpm'), ['frontend'])

  const packageJson = JSON.parse(await readFile(path.join(targetRoot, 'package.json'), 'utf8')) as {
    scripts?: Record<string, string>
  }

  assert.equal(await pathExists(path.join(targetRoot, 'scripts', 'mirror-skills.mjs')), false)
  assert.equal(await pathExists(path.join(targetRoot, 'scripts', 'sync-skills.mjs')), false)
  assert.equal(await pathExists(path.join(targetRoot, 'scripts', 'check-skills.mjs')), false)
  assert.equal(await pathExists(path.join(targetRoot, 'scripts', 'diff-skills.mjs')), false)
  assert.equal(await pathExists(path.join(targetRoot, 'scripts', 'upgrade-skills.mjs')), false)
  assert.equal(packageJson.scripts?.['skills:mirror'], undefined)
  assert.equal(packageJson.scripts?.['skills:sync'], undefined)
  assert.equal(packageJson.scripts?.['skills:check'], undefined)
  assert.equal(packageJson.scripts?.['skills:diff'], undefined)
  assert.equal(packageJson.scripts?.['skills:upgrade'], undefined)
})

test('AGENTS markdown delegates detailed repository contract rules to repo-contract doc', async (t) => {
  const targetRoot = await createTempTargetRoot(t)
  const tokens = createTokens('pnpm')

  await applyDocsTemplates(targetRoot, tokens, createDocsHints())

  const agents = await readFile(path.join(targetRoot, 'AGENTS.md'), 'utf8')

  assert.match(agents, /docs\/engineering\/repo-contract\.md/)
  assert.doesNotMatch(agents, /Plan first:/)
  assert.doesNotMatch(agents, /TDD first:/)
  assert.doesNotMatch(agents, /Self-verify first:/)
  assert.doesNotMatch(agents, /No secrets:/)
  assert.doesNotMatch(agents, /Official scaffold first:/)
})

test('applyDocsTemplates keeps AGENTS skill-free and renders README onboarding when no local skills are installed', async (t) => {
  const targetRoot = await createTempTargetRoot(t)
  const tokens = createTokens('pnpm')

  await applyDocsTemplates(targetRoot, tokens, createDocsHints())

  const agents = await readFile(path.join(targetRoot, 'AGENTS.md'), 'utf8')
  const claude = await readFile(path.join(targetRoot, 'CLAUDE.md'), 'utf8')
  const readme = await readFile(path.join(targetRoot, 'README.md'), 'utf8')
  const frontendPolicy = await readFile(
    path.join(targetRoot, 'docs', 'engineering', 'frontend-policy.md'),
    'utf8',
  )
  const repoContract = await readFile(
    path.join(targetRoot, 'docs', 'engineering', 'repo-contract.md'),
    'utf8',
  )

  assert.doesNotMatch(agents, /\.agents\/skills/)
  assert.doesNotMatch(agents, /\.claude\/skills/)
  assert.doesNotMatch(agents, /skills add/)
  assert.doesNotMatch(claude, /\.agents\/skills/)
  assert.doesNotMatch(claude, /\.claude\/skills/)
  assert.match(
    repoContract,
    /optional agent skill은 project-local로 설치되어 있을 때만 supplemental playbook으로 사용한다\./,
  )
  assert.match(repoContract, /README\.md/)
  assert.doesNotMatch(repoContract, /\.agents\/skills/)
  assert.doesNotMatch(repoContract, /\.claude\/skills/)
  assert.match(readme, /## skills 전략/)
  assert.match(readme, /npx skills add/)
  for (const command of [SKILLS_LIST_COMMAND, SKILLS_CHECK_COMMAND, SKILLS_UPDATE_COMMAND]) {
    assert.match(readme, new RegExp(escapeRegExp(command)))
  }
  assert.doesNotMatch(frontendPolicy, /\.agents\/skills\//)
  assert.match(frontendPolicy, /UI는 TDS를 사용한다\./)
  assert.match(
    frontendPolicy,
    /Granite router의 `:param` path params와 `validateParams`는 허용한다\./,
  )
})

test('secondary agent docs defer onboarding rules to AGENTS instead of restating them', async () => {
  const claudeSource = await readFile(
    fileURLToPath(new URL('../../../scaffold-templates/base/CLAUDE.md', import.meta.url)),
    'utf8',
  )
  const copilotSource = await readFile(
    fileURLToPath(
      new URL('../../../scaffold-templates/base/.github/copilot-instructions.md', import.meta.url),
    ),
    'utf8',
  )

  assert.match(claudeSource, /AGENTS\.md/)
  assert.match(copilotSource, /AGENTS\.md/)
  assert.doesNotMatch(claudeSource, /hard rules와 done 기준/)
  assert.doesNotMatch(copilotSource, /강제 규칙:/)
  assert.doesNotMatch(copilotSource, /작업 전 `docs\/ai\/Plan\.md`를 갱신한다\./)
})

test('starter pages defer onboarding order to AGENTS instead of restating a sequence', async () => {
  const frontendPatchingSource = await readFile(
    fileURLToPath(new URL('../patching/frontend.ts', import.meta.url)),
    'utf8',
  )

  assert.doesNotMatch(frontendPatchingSource, /1\. `docs\/product`에 기능 명세를 적어요\./)
  assert.doesNotMatch(
    frontendPatchingSource,
    /2\. `AGENTS\.md`의 `Start Here` 순서를 먼저 따라가요\./,
  )
  assert.doesNotMatch(
    frontendPatchingSource,
    /3\. 필요한 화면부터 `frontend\/src\/pages`에서 만들어요\./,
  )
  assert.doesNotMatch(frontendPatchingSource, /`AGENTS\.md`의 `Start Here`와 `docs\/index\.md`/)
})

test('frontend policy derives restriction prose and enforcement from a shared manifest', async () => {
  const frontendPolicySource = await readFile(
    fileURLToPath(new URL('./frontend-policy.ts', import.meta.url)),
    'utf8',
  )

  assert.match(frontendPolicySource, /const FRONTEND_POLICY_RESTRICTION_DEFINITIONS/)
  assert.doesNotMatch(
    frontendPolicySource,
    /export const FRONTEND_POLICY_REACT_NATIVE_IMPORT_NAMES = \[/,
  )
  assert.doesNotMatch(
    frontendPolicySource,
    /export const FRONTEND_POLICY_NATIVE_IMPORT_PATTERNS: .* = \[/,
  )
  assert.equal(
    (frontendPolicySource.match(/docs\/engineering\/frontend-policy\.md/g) ?? []).length,
    1,
  )
})

test('resolveGeneratedWorkspaceOptions derives optional docs state from the actual workspace tree', async (t) => {
  const targetRoot = await createTempTargetRoot(t)

  let options = await resolveGeneratedWorkspaceOptions(targetRoot, {
    serverProvider: 'cloudflare',
  })
  assert.deepEqual(options, {
    hasBackoffice: false,
    serverProvider: null,
    hasTrpc: false,
  })

  await mkdir(path.join(targetRoot, 'server'), { recursive: true })
  await mkdir(path.join(targetRoot, 'backoffice'), { recursive: true })
  await mkdir(path.join(targetRoot, 'packages', 'contracts'), { recursive: true })

  options = await resolveGeneratedWorkspaceOptions(targetRoot, {
    serverProvider: 'cloudflare',
  })
  assert.deepEqual(options, {
    hasBackoffice: true,
    serverProvider: 'cloudflare',
    hasTrpc: false,
  })

  await mkdir(path.join(targetRoot, 'packages', 'app-router'), { recursive: true })

  options = await resolveGeneratedWorkspaceOptions(targetRoot, {
    serverProvider: 'cloudflare',
  })
  assert.deepEqual(options, {
    hasBackoffice: true,
    serverProvider: 'cloudflare',
    hasTrpc: true,
  })
})

test('applyRootTemplates keeps pnpm workspace manifest for pnpm', async (t) => {
  const targetRoot = await createTempTargetRoot(t)

  await applyRootTemplates(targetRoot, createTokens('pnpm'), ['frontend'])

  const packageJson = JSON.parse(await readFile(path.join(targetRoot, 'package.json'), 'utf8')) as {
    packageManager?: string
    workspaces?: string[]
    scripts?: Record<string, string>
    devDependencies?: Record<string, string>
  }
  const nxJson = JSON.parse(await readFile(path.join(targetRoot, 'nx.json'), 'utf8')) as {
    $schema?: string
    namedInputs?: {
      sharedGlobals?: string[]
    }
    targetDefaults?: Record<string, { inputs?: string[]; dependsOn?: string[] }>
  }
  const gitignore = await readFile(path.join(targetRoot, '.gitignore'), 'utf8')
  const biomeJson = await readFile(path.join(targetRoot, 'biome.json'), 'utf8')

  assert.equal(packageJson.packageManager, getTestPackageManagerField('pnpm'))
  assert.equal(packageJson.workspaces, undefined)
  assert.equal(await pathExists(path.join(targetRoot, 'pnpm-workspace.yaml')), true)
  assert.equal(await pathExists(path.join(targetRoot, '.yarnrc.yml')), false)
  assert.equal(await pathExists(path.join(targetRoot, 'tsconfig.base.json')), false)
  assert.equal(
    await pathExists(path.join(targetRoot, 'scripts', 'verify-frontend-routes.mjs')),
    true,
  )
  assert.equal(await pathExists(path.join(targetRoot, 'scripts', 'mirror-skills.mjs')), false)
  assert.equal(await pathExists(path.join(targetRoot, 'scripts', 'sync-skills.mjs')), false)
  assert.equal(await pathExists(path.join(targetRoot, 'scripts', 'check-skills.mjs')), false)
  assert.equal(await pathExists(path.join(targetRoot, 'scripts', 'diff-skills.mjs')), false)
  assert.equal(await pathExists(path.join(targetRoot, 'scripts', 'upgrade-skills.mjs')), false)
  assert.equal(packageJson.scripts?.verify, renderRootVerifyScript('pnpm'))
  assert.equal(
    packageJson.scripts?.['frontend:policy:check'],
    'node ./scripts/verify-frontend-routes.mjs',
  )
  assert.equal(packageJson.scripts?.['skills:mirror'], undefined)
  assert.equal(packageJson.scripts?.['skills:sync'], undefined)
  assert.equal(packageJson.scripts?.['skills:check'], undefined)
  assert.equal(packageJson.scripts?.['skills:diff'], undefined)
  assert.equal(packageJson.scripts?.['skills:upgrade'], undefined)
  assert.equal(packageJson.devDependencies?.nx, '^22.5.4')
  assert.equal(packageJson.devDependencies?.typescript, '^5.9.3')
  assert.equal(packageJson.devDependencies?.['@biomejs/biome'], '^2.4.8')
  assert.equal(nxJson.$schema, NX_ROOT_SCHEMA_URL)
  assert.deepEqual(nxJson.namedInputs?.sharedGlobals, ['{workspaceRoot}/biome.json'])
  assert.deepEqual(nxJson.targetDefaults?.build?.dependsOn, ['^build'])
  assert.deepEqual(nxJson.targetDefaults?.typecheck?.dependsOn, ['^build'])
  assert.deepEqual(nxJson.targetDefaults?.test?.dependsOn, ['^build'])
  assert.doesNotMatch(gitignore, /^\.yarn\/?$/m)
  assert.doesNotMatch(gitignore, /^\.pnp\.\*$/m)
  assert.doesNotMatch(gitignore, /^server\/worker-configuration\.d\.ts$/m)
  assert.doesNotMatch(biomeJson, /\*\*\/\.yarn\/\*\*/)
  assert.doesNotMatch(biomeJson, /\*\*\/\.pnp\.\*/)
  assert.doesNotMatch(biomeJson, /\*\*\/server\/worker-configuration\.d\.ts/)
  assert.equal(
    await readFile(path.join(targetRoot, 'pnpm-workspace.yaml'), 'utf8'),
    'packages:\n  - frontend\n',
  )
  assert.match(biomeJson, /schemas\/2\.4\.8\/schema\.json/)
  assert.match(biomeJson, /noRestrictedImports/)
  assert.match(biomeJson, /@react-native-async-storage\/async-storage/)
  assert.match(biomeJson, /@react-navigation\/\*/)
  assert.match(biomeJson, /@react-native-community\/\*/)
  assert.match(biomeJson, /react-native-\*/)
  assert.match(biomeJson, /!!frontend\/\.granite/)
  assert.match(biomeJson, /ActivityIndicator/)
  assert.match(biomeJson, /Alert/)
  assert.match(biomeJson, /Text/)
  assert.match(biomeJson, /TDS를 써 주세요/)
  assert.match(biomeJson, /정말 이 컴포넌트를 써야 하면 `biome-ignore`에 이유를 같이 남겨 주세요/)
  assert.match(biomeJson, /docs\/engineering\/frontend-policy\.md/)
  assert.doesNotMatch(biomeJson, /\.agents\/skills\/tds-ui\/generated\/catalog\.json/)
})

test('applyRootTemplates emits shared react-native guidance across package managers', async (t) => {
  const reactNativeMessages: Array<[PackageManager, string]> = []

  for (const packageManager of PACKAGE_MANAGERS) {
    const targetRoot = await createTempTargetRoot(t)
    await applyRootTemplates(targetRoot, createTokens(packageManager), ['frontend'])

    const biomeJson = JSON.parse(await readFile(path.join(targetRoot, 'biome.json'), 'utf8')) as {
      linter?: {
        rules?: {
          style?: {
            noRestrictedImports?: {
              options?: {
                paths?: Record<string, string | { message?: string }>
              }
            }
          }
        }
      }
    }
    const reactNativePath =
      biomeJson.linter?.rules?.style?.noRestrictedImports?.options?.paths?.['react-native']

    assert.ok(reactNativePath && typeof reactNativePath === 'object')
    assert.equal(typeof reactNativePath.message, 'string')
    reactNativeMessages.push([packageManager, reactNativePath.message ?? ''])
  }

  assert.equal(new Set(reactNativeMessages.map(([, message]) => message)).size, 1)
  assert.match(reactNativeMessages[0]?.[1] ?? '', /TDS를 써 주세요/)
  assert.match(
    reactNativeMessages[0]?.[1] ?? '',
    /정말 이 컴포넌트를 써야 하면 `biome-ignore`에 이유를 같이 남겨 주세요/,
  )
  assert.doesNotMatch(reactNativeMessages[0]?.[1] ?? '', /Granite UI로 보완/)
  assert.doesNotMatch(reactNativeMessages[0]?.[1] ?? '', /\.agents\/skills\/tds-ui/)
})

test('applyRootTemplates keeps biome guidance stable even when local core skills are installed', async (t) => {
  const targetRoot = await createTempTargetRoot(t)
  const tokens = createTokens('pnpm')

  for (const skillId of ['miniapp-capabilities', 'granite-routing', 'tds-ui']) {
    await mkdir(path.join(targetRoot, 'skills', skillId), { recursive: true })
    await writeFile(path.join(targetRoot, 'skills', skillId, 'SKILL.md'), `# ${skillId}\n`, 'utf8')
  }

  await applyRootTemplates(targetRoot, tokens, ['frontend'])

  const biomeJson = await readFile(path.join(targetRoot, 'biome.json'), 'utf8')

  assert.doesNotMatch(biomeJson, /skills\/tds-ui\/generated\/catalog\.json/)
  assert.match(biomeJson, /TDS를 써 주세요/)
  assert.doesNotMatch(biomeJson, /Granite UI로 보완/)
})

test('syncRootWorkspaceManifest preserves root workspace order and normalizes package workspaces to packages/*', async (t) => {
  const targetRoot = await createTempTargetRoot(t)
  const tokens = createTokens('pnpm')

  await applyRootTemplates(targetRoot, tokens, ['frontend'])
  await syncRootWorkspaceManifest(targetRoot, 'pnpm', [
    'frontend',
    'marketing',
    'packages/contracts',
  ])

  assert.equal(
    await readFile(path.join(targetRoot, 'pnpm-workspace.yaml'), 'utf8'),
    ['packages:', '  - frontend', '  - marketing', '  - packages/*', ''].join('\n'),
  )
})

test('applyTrpcWorkspaceTemplate creates shared contracts and app-router workspaces for cloudflare', async (t) => {
  const targetRoot = await createTempTargetRoot(t)
  const tokens = createTokens('pnpm')

  await applyRootTemplates(targetRoot, tokens, [
    'frontend',
    'server',
    'packages/contracts',
    'packages/app-router',
  ])
  await applyTrpcWorkspaceTemplate(targetRoot, tokens, { serverProvider: 'cloudflare' })

  const contractsPackageJson = JSON.parse(
    await readFile(path.join(targetRoot, 'packages', 'contracts', 'package.json'), 'utf8'),
  ) as {
    name?: string
    files?: string[]
    exports?: Record<
      string,
      { types?: string; import?: string; require?: string; default?: string }
    >
    types?: string
    main?: string
    dependencies?: Record<string, string>
    devDependencies?: Record<string, string>
    scripts?: Record<string, string>
  }
  const appRouterPackageJson = JSON.parse(
    await readFile(path.join(targetRoot, 'packages', 'app-router', 'package.json'), 'utf8'),
  ) as {
    name?: string
    files?: string[]
    exports?: Record<
      string,
      { types?: string; import?: string; require?: string; default?: string }
    >
    types?: string
    main?: string
    dependencies?: Record<string, string>
    devDependencies?: Record<string, string>
    scripts?: Record<string, string>
  }
  const appRouterTsconfig = JSON.parse(
    await readFile(path.join(targetRoot, 'packages', 'app-router', 'tsconfig.json'), 'utf8'),
  ) as {
    compilerOptions?: {
      allowImportingTsExtensions?: boolean
      composite?: boolean
      declaration?: boolean
      outDir?: string
      rewriteRelativeImportExtensions?: boolean
    }
  }
  const appRouterProjectJson = JSON.parse(
    await readFile(path.join(targetRoot, 'packages', 'app-router', 'project.json'), 'utf8'),
  ) as {
    targets?: Record<string, { command?: string }>
  }
  const contractsReadme = await readFile(
    path.join(targetRoot, 'packages', 'contracts', 'README.md'),
    'utf8',
  )
  const appRouterReadme = await readFile(
    path.join(targetRoot, 'packages', 'app-router', 'README.md'),
    'utf8',
  )
  const contractsIndexSource = await readFile(
    path.join(targetRoot, 'packages', 'contracts', 'src', 'index.ts'),
    'utf8',
  )
  const appRouterIndexSource = await readFile(
    path.join(targetRoot, 'packages', 'app-router', 'src', 'index.ts'),
    'utf8',
  )
  const appRouterExampleRouterSource = await readFile(
    path.join(targetRoot, 'packages', 'app-router', 'src', 'routers', 'example.ts'),
    'utf8',
  )
  const appRouterRootSource = await readFile(
    path.join(targetRoot, 'packages', 'app-router', 'src', 'root.ts'),
    'utf8',
  )
  assert.equal(contractsPackageJson.name, '@workspace/contracts')
  assert.deepEqual(contractsPackageJson.files, ['dist'])
  assert.equal(contractsPackageJson.exports?.['.']?.types, './dist/index.d.mts')
  assert.equal(contractsPackageJson.exports?.['.']?.import, './dist/index.mjs')
  assert.equal(contractsPackageJson.exports?.['.']?.require, './dist/index.cjs')
  assert.equal(contractsPackageJson.exports?.['.']?.default, './dist/index.mjs')
  assert.equal(contractsPackageJson.types, './dist/index.d.mts')
  assert.equal(contractsPackageJson.main, './dist/index.cjs')
  assert.equal(contractsPackageJson.dependencies?.zod, '^4.3.6')
  assert.equal(contractsPackageJson.devDependencies?.tsdown, '^0.21.4')
  assert.equal(appRouterPackageJson.name, '@workspace/app-router')
  assert.deepEqual(appRouterPackageJson.files, ['dist'])
  assert.equal(appRouterPackageJson.exports?.['.']?.types, './dist/index.d.mts')
  assert.equal(appRouterPackageJson.exports?.['.']?.import, './dist/index.mjs')
  assert.equal(appRouterPackageJson.exports?.['.']?.require, './dist/index.cjs')
  assert.equal(appRouterPackageJson.exports?.['.']?.default, './dist/index.mjs')
  assert.equal(appRouterPackageJson.types, './dist/index.d.mts')
  assert.equal(appRouterPackageJson.main, './dist/index.cjs')
  assert.equal(appRouterPackageJson.dependencies?.['@trpc/server'], '^11.13.4')
  assert.equal(appRouterPackageJson.dependencies?.['@workspace/contracts'], 'workspace:*')
  assert.equal(appRouterPackageJson.devDependencies?.tsdown, '^0.21.4')
  assert.equal(
    contractsPackageJson.scripts?.build,
    'tsdown src/index.ts --format esm,cjs --dts --clean --out-dir dist',
  )
  assert.equal(
    appRouterPackageJson.scripts?.build,
    'pnpm --dir ../contracts build && tsdown src/index.ts --format esm,cjs --dts --clean --out-dir dist',
  )
  assert.equal(appRouterTsconfig.compilerOptions?.composite, true)
  assert.equal(appRouterTsconfig.compilerOptions?.declaration, true)
  assert.equal(appRouterTsconfig.compilerOptions?.outDir, 'dist')
  assert.equal(appRouterTsconfig.compilerOptions?.allowImportingTsExtensions, true)
  assert.equal(appRouterTsconfig.compilerOptions?.rewriteRelativeImportExtensions, true)
  assert.equal(appRouterProjectJson.targets?.build?.command, 'pnpm --dir packages/app-router build')
  assert.equal(
    appRouterProjectJson.targets?.typecheck?.command,
    'pnpm --dir packages/app-router typecheck',
  )
  assert.match(contractsReadme, /packages\/contracts/)
  assert.match(appRouterReadme, /packages\/app-router/)
  assert.match(appRouterReadme, /packages\/contracts/)
  assert.match(contractsIndexSource, /ExampleEchoInputSchema/)
  assert.match(appRouterExampleRouterSource, /from '\.\.\/\.\.\/\.\.\/contracts\/src\/index\.ts'/)
  assert.match(appRouterIndexSource, /export type \{ AppRouter \} from '\.\/root\.ts'/)
  assert.match(appRouterRootSource, /from '\.\/routers\/example\.ts'/)
})

test('applyRootTemplates wires frontend route checker into root verify', async (t) => {
  const targetRoot = await createTempTargetRoot(t)
  const tokens = createTokens('pnpm')

  await applyRootTemplates(targetRoot, tokens, ['frontend'])

  const rootPackageJson = JSON.parse(
    await readFile(path.join(targetRoot, 'package.json'), 'utf8'),
  ) as {
    scripts?: Record<string, string>
  }
  const scriptSource = await readFile(
    path.join(targetRoot, 'scripts', 'verify-frontend-routes.mjs'),
    'utf8',
  )

  assert.equal(
    rootPackageJson.scripts?.['frontend:policy:check'],
    'node ./scripts/verify-frontend-routes.mjs',
  )
  assert.equal(rootPackageJson.scripts?.['skills:mirror'], undefined)
  assert.equal(rootPackageJson.scripts?.['skills:sync'], undefined)
  assert.equal(rootPackageJson.scripts?.['skills:check'], undefined)
  assert.equal(rootPackageJson.scripts?.['skills:diff'], undefined)
  assert.equal(rootPackageJson.scripts?.['skills:upgrade'], undefined)
  assert.equal(rootPackageJson.scripts?.verify, renderRootVerifyScript('pnpm'))
  assert.equal(await pathExists(path.join(targetRoot, 'scripts', 'mirror-skills.mjs')), false)
  assert.equal(await pathExists(path.join(targetRoot, 'scripts', 'sync-skills.mjs')), false)
  assert.equal(await pathExists(path.join(targetRoot, 'scripts', 'check-skills.mjs')), false)
  assert.equal(await pathExists(path.join(targetRoot, 'scripts', 'diff-skills.mjs')), false)
  assert.equal(await pathExists(path.join(targetRoot, 'scripts', 'upgrade-skills.mjs')), false)
  assert.match(scriptSource, /route-dynamic-segment-dollar/)
  assert.match(scriptSource, /FRONTEND_ENTRY_ROOT/)
  assert.match(scriptSource, /FRONTEND_SOURCE_PAGES_ROOT/)
})

test('applyDocsTemplates renders verify sections from the shared root verify metadata', async (t) => {
  const targetRoot = await createTempTargetRoot(t)
  const tokens = createTokens('pnpm')

  await applyRootTemplates(targetRoot, tokens, ['frontend'])
  await applyDocsTemplates(targetRoot, tokens, createDocsHints())

  const rootPackageJson = JSON.parse(
    await readFile(path.join(targetRoot, 'package.json'), 'utf8'),
  ) as {
    scripts?: Record<string, string>
  }
  const docsIndexSource = await readFile(path.join(targetRoot, 'docs', 'index.md'), 'utf8')
  const repoContractSource = await readFile(
    path.join(targetRoot, 'docs', 'engineering', 'repo-contract.md'),
    'utf8',
  )
  const expectedVerifySection = renderRootVerifyScript('pnpm')
    .split(' && ')
    .map((command) => `- \`${command}\``)
    .join('\n')

  assert.equal(rootPackageJson.scripts?.verify, renderRootVerifyScript('pnpm'))
  assert.equal(getMarkdownSectionBody(docsIndexSource, 'verify'), expectedVerifySection)
  assert.equal(getMarkdownSectionBody(repoContractSource, 'Verify 정의'), expectedVerifySection)
})

test('generated frontend route checker allows fixed path routes', async (t) => {
  const targetRoot = await createTempTargetRoot(t)
  const tokens = createTokens('pnpm')

  await applyRootTemplates(targetRoot, tokens, ['frontend'])
  await mkdir(path.join(targetRoot, 'frontend', 'pages'), { recursive: true })
  await mkdir(path.join(targetRoot, 'frontend', 'src', 'pages'), { recursive: true })
  await writeFile(
    path.join(targetRoot, 'frontend', 'pages', 'book-detail.tsx'),
    ["export { BookDetailPage } from '../src/pages/book-detail'", ''].join('\n'),
    'utf8',
  )
  await writeFile(
    path.join(targetRoot, 'frontend', 'src', 'pages', 'book-detail.tsx'),
    [
      "export const BOOK_DETAIL_ROUTE = '/book-detail'",
      '',
      'export const BookDetailPage = () => null',
      '',
    ].join('\n'),
    'utf8',
  )

  const result = spawnSync(process.execPath, ['./scripts/verify-frontend-routes.mjs'], {
    cwd: targetRoot,
    encoding: 'utf8',
  })

  assert.equal(result.status, 0, result.stderr)
})

test('generated frontend route checker rejects dollar route filenames', async (t) => {
  const targetRoot = await createTempTargetRoot(t)
  const tokens = createTokens('pnpm')

  await applyRootTemplates(targetRoot, tokens, ['frontend'])
  await mkdir(path.join(targetRoot, 'frontend', 'pages', 'book'), { recursive: true })
  await writeFile(
    path.join(targetRoot, 'frontend', 'pages', 'book', '$bookId.tsx'),
    ["export { BookPage } from '../../src/pages/book/$bookId'", ''].join('\n'),
    'utf8',
  )

  const result = spawnSync(process.execPath, ['./scripts/verify-frontend-routes.mjs'], {
    cwd: targetRoot,
    encoding: 'utf8',
  })

  assert.equal(result.status, 1)
  assert.match(result.stderr, /frontend\/pages\/book\/\$bookId\.tsx/)
  assert.match(result.stderr, /\$param/)
  assert.match(result.stderr, /docs\/engineering\/frontend-policy\.md/)
})

test('generated frontend route checker rejects dollar route strings', async (t) => {
  const targetRoot = await createTempTargetRoot(t)
  const tokens = createTokens('pnpm')

  await applyRootTemplates(targetRoot, tokens, ['frontend'])
  await mkdir(path.join(targetRoot, 'frontend', 'src'), { recursive: true })
  await writeFile(
    path.join(targetRoot, 'frontend', 'src', 'navigation-bad.ts'),
    ["export const navigationBad = () => '/book/$bookId'", ''].join('\n'),
    'utf8',
  )

  const result = spawnSync(process.execPath, ['./scripts/verify-frontend-routes.mjs'], {
    cwd: targetRoot,
    encoding: 'utf8',
  })

  assert.equal(result.status, 1)
  assert.match(result.stderr, /frontend\/src\/navigation-bad\.ts/)
  assert.match(result.stderr, /\/\$bookId/)
  assert.match(result.stderr, /docs\/engineering\/frontend-policy\.md/)
})

test('generated frontend route checker reports every violation in one run', async (t) => {
  const targetRoot = await createTempTargetRoot(t)
  const tokens = createTokens('pnpm')

  await applyRootTemplates(targetRoot, tokens, ['frontend'])
  await mkdir(path.join(targetRoot, 'frontend', 'pages', 'book'), { recursive: true })
  await mkdir(path.join(targetRoot, 'frontend', 'src'), { recursive: true })
  await writeFile(
    path.join(targetRoot, 'frontend', 'pages', 'book', '$bookId.tsx'),
    ["export { BookPage } from '../../src/pages/book/$bookId'", ''].join('\n'),
    'utf8',
  )
  await writeFile(
    path.join(targetRoot, 'frontend', 'src', 'navigation-bad.ts'),
    ["export const navigationBad = () => '/book/$bookId'", ''].join('\n'),
    'utf8',
  )

  const result = spawnSync(process.execPath, ['./scripts/verify-frontend-routes.mjs'], {
    cwd: targetRoot,
    encoding: 'utf8',
  })

  assert.equal(result.status, 1)
  assert.match(result.stderr, /frontend\/pages\/book\/\$bookId\.tsx/)
  assert.match(result.stderr, /frontend\/src\/navigation-bad\.ts/)
  assert.match(result.stderr, /\/book\/\$bookId/)
  assert.match(result.stderr, /docs\/engineering\/frontend-policy\.md/)
})

test('generated frontend route checker survives root biome unsafe fixes', async (t) => {
  const targetRoot = await createTempTargetRoot(t)
  const tokens = createTokens('yarn')

  await applyRootTemplates(targetRoot, tokens, ['frontend'])

  const biomeResult = spawnSync(ROOT_BIOME_BIN, ['check', '.', '--write', '--unsafe'], {
    cwd: targetRoot,
    encoding: 'utf8',
  })

  assert.equal(biomeResult.status, 0, biomeResult.stderr)

  const scriptSource = await readFile(
    path.join(targetRoot, 'scripts', 'verify-frontend-routes.mjs'),
    'utf8',
  )
  assert.match(
    scriptSource,
    /new RegExp\(\s*ROUTE_DYNAMIC_SEGMENT_DOLLAR_REGEX_SOURCE,\s*'g',?\s*\)/,
  )
  assert.match(scriptSource, /new RegExp\(FILENAME_DOLLAR_PATTERN_REGEX_SOURCE\)/)

  const verifyResult = spawnSync(process.execPath, ['./scripts/verify-frontend-routes.mjs'], {
    cwd: targetRoot,
    encoding: 'utf8',
  })

  assert.equal(verifyResult.status, 0, verifyResult.stderr)
})

test('applyDocsTemplates omits local skill routing and docs/skills for base-only workspaces', async (t) => {
  const targetRoot = await createTempTargetRoot(t)
  const tokens = createTokens('pnpm')

  await applyDocsTemplates(targetRoot, tokens, createDocsHints())

  const agents = await readFile(path.join(targetRoot, 'AGENTS.md'), 'utf8')
  const claude = await readFile(path.join(targetRoot, 'CLAUDE.md'), 'utf8')
  const copilot = await readFile(
    path.join(targetRoot, '.github', 'copilot-instructions.md'),
    'utf8',
  )
  const readme = await readFile(path.join(targetRoot, 'README.md'), 'utf8')
  const docsIndex = await readFile(path.join(targetRoot, 'docs', 'index.md'), 'utf8')
  const workspaceTopology = await readFile(
    path.join(targetRoot, 'docs', 'engineering', 'workspace-topology.md'),
    'utf8',
  )

  assert.match(agents, /Repository Contract/)
  assert.doesNotMatch(agents, /\.agents\/skills/)
  assert.doesNotMatch(agents, /\.claude\/skills/)
  assert.match(claude, /README\.md/)
  assert.doesNotMatch(claude, /\.agents\/skills/)
  assert.doesNotMatch(claude, /\.claude\/skills/)
  assert.match(copilot, /AGENTS\.md/)
  assert.match(readme, /## skills 전략/)
  assert.match(readme, /npx skills add/)
  assert.match(readme, /추천 skill:/)
  assert.match(readme, /miniapp-capabilities/)
  assert.match(docsIndex, /repo-contract\.md/)
  assert.match(docsIndex, /frontend-policy\.md/)
  assert.match(docsIndex, /workspace-topology\.md/)
  assert.doesNotMatch(docsIndex, /skills\.md/)
  assert.equal(await pathExists(path.join(targetRoot, 'docs', 'skills.md')), false)
  assert.doesNotMatch(workspaceTopology, /Backoffice React workflow/)
  assert.doesNotMatch(workspaceTopology, /Cloudflare Worker 운영 가이드/)
})

test('applyDocsTemplates keeps backoffice-only workspaces free of server-only topology text', async (t) => {
  const targetRoot = await createTempTargetRoot(t)
  const tokens = createTokens('pnpm')
  await materializeDocsWorkspaceState(targetRoot, {
    hasBackoffice: true,
  })

  await applyDocsTemplates(targetRoot, tokens, createDocsHints())

  const workspaceTopology = await readFile(
    path.join(targetRoot, 'docs', 'engineering', 'workspace-topology.md'),
    'utf8',
  )
  const readme = await readFile(path.join(targetRoot, 'README.md'), 'utf8')

  assert.match(workspaceTopology, /### backoffice/)
  assert.doesNotMatch(workspaceTopology, /### server/)
  assert.doesNotMatch(workspaceTopology, /backoffice ↔ server 직접 import 금지/)
  assert.match(readme, /추천 skill:/)
  assert.match(readme, /backoffice-react/)
  assert.doesNotMatch(readme, /cloudflare-worker/)
})

test('applyDocsTemplates keeps AGENTS free of local skill routing even when project-local skills are installed', async (t) => {
  const targetRoot = await createTempTargetRoot(t)
  const tokens = createTokens('pnpm')

  await mkdir(path.join(targetRoot, '.agents', 'skills', 'tds-ui'), { recursive: true })
  await mkdir(path.join(targetRoot, '.claude', 'skills', 'tds-ui'), { recursive: true })
  await writeFile(
    path.join(targetRoot, '.agents', 'skills', 'tds-ui', 'SKILL.md'),
    '# TDS\n',
    'utf8',
  )
  await writeFile(
    path.join(targetRoot, '.claude', 'skills', 'tds-ui', 'SKILL.md'),
    '# TDS\n',
    'utf8',
  )

  await applyDocsTemplates(targetRoot, tokens, createDocsHints())

  const agents = await readFile(path.join(targetRoot, 'AGENTS.md'), 'utf8')

  assert.doesNotMatch(agents, /Installed Local Skills/)
  assert.doesNotMatch(agents, /\.agents\/skills\/\*/)
  assert.doesNotMatch(agents, /\.claude\/skills\/\*/)
})

test('applyDocsTemplates replaces install CTA with installed skill summary when project-local skills already exist', async (t) => {
  const targetRoot = await createTempTargetRoot(t)
  const tokens = createTokens('pnpm')

  await mkdir(path.join(targetRoot, '.agents', 'skills', 'tds-ui'), { recursive: true })
  await mkdir(path.join(targetRoot, '.agents', 'skills', 'miniapp-capabilities'), {
    recursive: true,
  })
  await writeFile(
    path.join(targetRoot, '.agents', 'skills', 'tds-ui', 'SKILL.md'),
    '# TDS\n',
    'utf8',
  )
  await writeFile(
    path.join(targetRoot, '.agents', 'skills', 'miniapp-capabilities', 'SKILL.md'),
    '# MiniApp\n',
    'utf8',
  )

  await applyDocsTemplates(targetRoot, tokens, createDocsHints())

  const readme = await readFile(path.join(targetRoot, 'README.md'), 'utf8')

  assert.match(readme, /## skills 전략/)
  assert.match(readme, /현재 project-local skills가 설치되어 있어요\./)
  assert.match(readme, /### Installed/)
  assert.match(readme, /miniapp-capabilities/)
  assert.match(readme, /tds-ui/)
  assert.doesNotMatch(readme, /추천 skill:/)
  assert.doesNotMatch(readme, /설치 예시:/)
  assert.doesNotMatch(readme, /npx skills add/)
})

test('applyDocsTemplates keeps frontend policy generic even when project-local core skills are installed', async (t) => {
  const targetRoot = await createTempTargetRoot(t)
  const tokens = createTokens('pnpm')

  for (const skillId of ['miniapp-capabilities', 'granite-routing', 'tds-ui']) {
    await mkdir(path.join(targetRoot, 'skills', skillId), { recursive: true })
    await writeFile(path.join(targetRoot, 'skills', skillId, 'SKILL.md'), `# ${skillId}\n`, 'utf8')
  }

  await applyDocsTemplates(targetRoot, tokens, createDocsHints())

  const frontendPolicy = await readFile(
    path.join(targetRoot, 'docs', 'engineering', 'frontend-policy.md'),
    'utf8',
  )

  assert.doesNotMatch(frontendPolicy, /skills\/miniapp-capabilities\/SKILL\.md/)
  assert.doesNotMatch(frontendPolicy, /skills\/granite-routing\/SKILL\.md/)
  assert.doesNotMatch(frontendPolicy, /skills\/tds-ui\/SKILL\.md/)
  assert.match(frontendPolicy, /TDS를 기준으로 구현한다/)
  assert.match(frontendPolicy, /Granite router 규칙/)
  assert.match(frontendPolicy, /UI는 TDS를 사용한다\./)
  assert.doesNotMatch(frontendPolicy, /Granite UI를 보완적으로 사용한다/)
})

test('applyDocsTemplates rerenders README recommendations when optional workspaces are added later', async (t) => {
  const targetRoot = await createTempTargetRoot(t)
  const tokens = createTokens('pnpm')

  await applyDocsTemplates(targetRoot, tokens, createDocsHints())
  let readme = await readFile(path.join(targetRoot, 'README.md'), 'utf8')
  assert.doesNotMatch(readme, /cloudflare-worker/)
  assert.doesNotMatch(readme, /backoffice-react/)

  await materializeDocsWorkspaceState(targetRoot, {
    hasBackoffice: true,
    hasServer: true,
    hasTrpc: true,
  })
  await applyDocsTemplates(targetRoot, tokens, createDocsHints({ serverProvider: 'cloudflare' }))

  readme = await readFile(path.join(targetRoot, 'README.md'), 'utf8')

  assert.match(readme, /cloudflare-worker/)
  assert.match(readme, /backoffice-react/)
  assert.match(readme, /trpc-boundary/)
})

test('applyRootTemplates and workspace templates emit yarn-specific files and commands', async (t) => {
  const targetRoot = await createTempTargetRoot(t)
  const tokens = createTokens('yarn')

  await applyRootTemplates(targetRoot, tokens, ['frontend', 'server'])
  await applyWorkspaceProjectTemplate(targetRoot, 'frontend', tokens)
  await applyServerPackageTemplate(targetRoot, tokens)

  const packageJsonSource = await readFile(path.join(targetRoot, 'package.json'), 'utf8')
  const packageJson = JSON.parse(packageJsonSource) as {
    packageManager?: string
    workspaces?: string[]
    scripts?: Record<string, string>
    devDependencies?: Record<string, string>
  }
  const gitignore = await readFile(path.join(targetRoot, '.gitignore'), 'utf8')
  const yarnrc = await readFile(path.join(targetRoot, '.yarnrc.yml'), 'utf8')
  const biomeJson = await readFile(path.join(targetRoot, 'biome.json'), 'utf8')
  const frontendProject = JSON.parse(
    await readFile(path.join(targetRoot, 'frontend', 'project.json'), 'utf8'),
  ) as {
    $schema?: string
    targets?: Record<string, { command?: string }>
  }
  const serverPackageJson = JSON.parse(
    await readFile(path.join(targetRoot, 'server', 'package.json'), 'utf8'),
  ) as {
    scripts?: Record<string, string>
    dependencies?: Record<string, string>
  }
  const serverDbApplyScript = await readFile(
    path.join(targetRoot, 'server', 'scripts', 'supabase-db-apply.mjs'),
    'utf8',
  )
  const serverTypecheckScript = await readFile(
    path.join(targetRoot, 'server', 'scripts', 'supabase-functions-typecheck.mjs'),
    'utf8',
  )
  const serverInstallDenoScript = await readFile(
    path.join(targetRoot, 'server', 'scripts', 'supabase-install-deno.mjs'),
    'utf8',
  )
  const serverFunctionsDeployScript = await readFile(
    path.join(targetRoot, 'server', 'scripts', 'supabase-functions-deploy.mjs'),
    'utf8',
  )

  assert.equal(packageJson.packageManager, getTestPackageManagerField('yarn'))
  assert.deepEqual(packageJson.workspaces, ['frontend', 'server'])
  assert.equal(await pathExists(path.join(targetRoot, 'pnpm-workspace.yaml')), false)
  assert.equal(packageJson.scripts?.verify, renderRootVerifyScript('yarn'))
  assert.ok(
    packageJsonSource.indexOf('"packageManager"') < packageJsonSource.indexOf('"workspaces"'),
  )
  assert.equal(packageJson.devDependencies?.nx, '^22.5.4')
  assert.equal(packageJson.devDependencies?.typescript, '^5.9.3')
  assert.equal(packageJson.devDependencies?.['@biomejs/biome'], '^2.4.8')
  assert.equal(frontendProject.$schema, NX_PROJECT_SCHEMA_URL)
  assert.match(gitignore, /^\.yarn\/?$/m)
  assert.match(gitignore, /^\.pnp\.\*$/m)
  assert.match(yarnrc, /nodeLinker: pnp/)
  assert.match(yarnrc, /packageExtensions:/)
  assert.match(yarnrc, /"@react-native-community\/cli-debugger-ui@\*":/)
  assert.match(yarnrc, /"@babel\/runtime": "\^7\.0\.0"/)
  assert.doesNotMatch(yarnrc, /"@apphosting\/build@\*":/)
  assert.doesNotMatch(yarnrc, /yaml: "\^2\.4\.1"/)
  assert.match(biomeJson, /!!\*\*\/\.yarn/)
  assert.match(biomeJson, /!!\*\*\/\.pnp\.\*/)
  assert.doesNotMatch(gitignore, /^server\/worker-configuration\.d\.ts$/m)
  assert.doesNotMatch(biomeJson, /\*\*\/server\/worker-configuration\.d\.ts/)
  assert.doesNotMatch(gitignore, /^server\/functions\/lib\/$/m)
  assert.doesNotMatch(biomeJson, /\*\*\/server\/functions\/lib\/\*\*/)
  assert.equal(frontendProject.targets?.build.command, 'yarn workspace frontend build')
  assert.equal(frontendProject.targets?.typecheck.command, 'yarn workspace frontend typecheck')
  assert.equal(serverPackageJson.scripts?.dev, 'yarn dlx supabase@2.83.0 start --workdir .')
  assert.equal(serverPackageJson.scripts?.build, 'yarn typecheck')
  assert.equal(
    serverPackageJson.scripts?.typecheck,
    'node ./scripts/supabase-functions-typecheck.mjs',
  )
  assert.equal(
    serverPackageJson.scripts?.['deno:install'],
    'node ./scripts/supabase-install-deno.mjs',
  )
  assert.equal(serverPackageJson.scripts?.['db:apply'], 'node ./scripts/supabase-db-apply.mjs')
  assert.equal(
    serverPackageJson.scripts?.['functions:serve'],
    'yarn dlx supabase@2.83.0 functions serve --env-file ./.env.local --workdir .',
  )
  assert.equal(
    serverPackageJson.scripts?.['functions:deploy'],
    'node ./scripts/supabase-functions-deploy.mjs',
  )
  assert.equal(
    serverPackageJson.scripts?.['db:apply:local'],
    'yarn dlx supabase@2.83.0 db push --local --workdir .',
  )
  assert.equal(
    serverPackageJson.scripts?.['db:reset'],
    'yarn dlx supabase@2.83.0 db reset --local --workdir .',
  )
  assert.match(serverDbApplyScript, /SUPABASE_DB_PASSWORD/)
  assert.match(serverDbApplyScript, /baseArgs = \["dlx","supabase@2\.83\.0","db","push"/)
  assert.match(serverDbApplyScript, /yarn/)
  assert.doesNotMatch(serverDbApplyScript, /value: string/)
  assert.match(serverTypecheckScript, /os\.homedir\(\)/)
  assert.match(serverTypecheckScript, /\.deno/)
  assert.match(serverTypecheckScript, /resolveDenoCommand/)
  assert.match(serverTypecheckScript, /const denoCommand =/)
  assert.match(serverTypecheckScript, /\['check'/)
  assert.match(serverTypecheckScript, /path\.join\(serverRoot, 'supabase', 'functions'\)/)
  assert.match(serverInstallDenoScript, /install\.sh/)
  assert.match(serverInstallDenoScript, /install\.ps1/)
  assert.match(serverInstallDenoScript, /\['upgrade', 'stable'\]/)
  assert.doesNotMatch(serverInstallDenoScript, /최신 버전/)
  assert.doesNotMatch(serverInstallDenoScript, /\\`/)
  const denoInstallerCheckPath = path.join(
    targetRoot,
    'server',
    'scripts',
    'supabase-install-deno.mjs',
  )
  const denoInstallerSyntaxCheck = spawnSync(
    process.execPath,
    ['--check', denoInstallerCheckPath],
    {
      cwd: targetRoot,
      encoding: 'utf8',
    },
  )
  assert.equal(
    denoInstallerSyntaxCheck.status,
    0,
    denoInstallerSyntaxCheck.stderr || denoInstallerSyntaxCheck.stdout,
  )
  assert.match(serverFunctionsDeployScript, /SUPABASE_PROJECT_REF/)
  assert.match(
    serverFunctionsDeployScript,
    /baseArgs = \["dlx","supabase@2\.83\.0","functions","deploy"/,
  )
  assert.match(serverFunctionsDeployScript, /--project-ref/)
  assert.match(serverFunctionsDeployScript, /yarn/)
  assert.doesNotMatch(serverFunctionsDeployScript, /value: string/)
})

test('applyRootTemplates emits npm-specific workspace manifest and scripts', async (t) => {
  const targetRoot = await createTempTargetRoot(t)
  const tokens = createTokens('npm')

  await applyRootTemplates(targetRoot, tokens, ['frontend', 'server'])
  await applyWorkspaceProjectTemplate(targetRoot, 'frontend', tokens)
  await applyServerPackageTemplate(targetRoot, tokens)

  const packageJson = JSON.parse(await readFile(path.join(targetRoot, 'package.json'), 'utf8')) as {
    packageManager?: string
    workspaces?: string[]
    scripts?: Record<string, string>
  }
  const npmrc = await readFile(path.join(targetRoot, '.npmrc'), 'utf8')
  const frontendProject = JSON.parse(
    await readFile(path.join(targetRoot, 'frontend', 'project.json'), 'utf8'),
  ) as {
    targets?: Record<string, { command?: string }>
  }
  const serverPackageJson = JSON.parse(
    await readFile(path.join(targetRoot, 'server', 'package.json'), 'utf8'),
  ) as {
    scripts?: Record<string, string>
    dependencies?: Record<string, string>
  }
  const serverDbApplyScript = await readFile(
    path.join(targetRoot, 'server', 'scripts', 'supabase-db-apply.mjs'),
    'utf8',
  )
  const serverTypecheckScript = await readFile(
    path.join(targetRoot, 'server', 'scripts', 'supabase-functions-typecheck.mjs'),
    'utf8',
  )

  assert.equal(packageJson.packageManager, getTestPackageManagerField('npm'))
  assert.deepEqual(packageJson.workspaces, ['frontend', 'server'])
  assert.equal(await pathExists(path.join(targetRoot, 'pnpm-workspace.yaml')), false)
  assert.equal(npmrc, 'legacy-peer-deps=true\n')
  assert.equal(frontendProject.targets?.build.command, 'npm --workspace frontend run build')
  assert.equal(serverPackageJson.scripts?.dev, 'npx supabase@2.83.0 start --workdir .')
  assert.equal(
    serverPackageJson.scripts?.['functions:serve'],
    'npx supabase@2.83.0 functions serve --env-file ./.env.local --workdir .',
  )
  assert.equal(
    serverPackageJson.scripts?.['db:apply:local'],
    'npx supabase@2.83.0 db push --local --workdir .',
  )
  assert.equal(serverPackageJson.scripts?.build, 'npm run typecheck')
  assert.equal(
    serverPackageJson.scripts?.typecheck,
    'node ./scripts/supabase-functions-typecheck.mjs',
  )
  assert.equal(
    serverPackageJson.scripts?.['deno:install'],
    'node ./scripts/supabase-install-deno.mjs',
  )
  assert.equal(packageJson.scripts?.verify, renderRootVerifyScript('npm'))
  assert.equal(
    await readFile(path.join(targetRoot, 'server', '.npmrc'), 'utf8'),
    'legacy-peer-deps=true\n',
  )
  assert.match(serverDbApplyScript, /npx/)
  assert.match(serverTypecheckScript, /const denoCommand =/)
  assert.match(serverTypecheckScript, /\['check'/)
  assert.match(serverTypecheckScript, /path\.join\(serverRoot, 'supabase', 'functions'\)/)
})

test('applyRootTemplates emits bun-specific workspace manifest and scripts', async (t) => {
  const targetRoot = await createTempTargetRoot(t)
  const tokens = createTokens('bun')

  await applyRootTemplates(targetRoot, tokens, ['frontend', 'server'])
  await applyWorkspaceProjectTemplate(targetRoot, 'frontend', tokens)
  await applyServerPackageTemplate(targetRoot, tokens)

  const packageJson = JSON.parse(await readFile(path.join(targetRoot, 'package.json'), 'utf8')) as {
    packageManager?: string
    workspaces?: string[]
    scripts?: Record<string, string>
  }
  const frontendProject = JSON.parse(
    await readFile(path.join(targetRoot, 'frontend', 'project.json'), 'utf8'),
  ) as {
    targets?: Record<string, { command?: string }>
  }
  const serverPackageJson = JSON.parse(
    await readFile(path.join(targetRoot, 'server', 'package.json'), 'utf8'),
  ) as {
    scripts?: Record<string, string>
    dependencies?: Record<string, string>
  }
  const serverDbApplyScript = await readFile(
    path.join(targetRoot, 'server', 'scripts', 'supabase-db-apply.mjs'),
    'utf8',
  )
  const serverTypecheckScript = await readFile(
    path.join(targetRoot, 'server', 'scripts', 'supabase-functions-typecheck.mjs'),
    'utf8',
  )

  assert.equal(packageJson.packageManager, getTestPackageManagerField('bun'))
  assert.deepEqual(packageJson.workspaces, ['frontend', 'server'])
  assert.equal(frontendProject.targets?.build.command, 'bun run --cwd frontend build')
  assert.equal(serverPackageJson.scripts?.dev, 'bunx supabase@2.83.0 start --workdir .')
  assert.equal(
    serverPackageJson.scripts?.['functions:serve'],
    'bunx supabase@2.83.0 functions serve --env-file ./.env.local --workdir .',
  )
  assert.equal(
    serverPackageJson.scripts?.['db:apply:local'],
    'bunx supabase@2.83.0 db push --local --workdir .',
  )
  assert.equal(serverPackageJson.scripts?.build, 'bun run typecheck')
  assert.equal(
    serverPackageJson.scripts?.typecheck,
    'node ./scripts/supabase-functions-typecheck.mjs',
  )
  assert.equal(
    serverPackageJson.scripts?.['deno:install'],
    'node ./scripts/supabase-install-deno.mjs',
  )
  assert.equal(packageJson.scripts?.verify, renderRootVerifyScript('bun'))
  assert.match(serverDbApplyScript, /bunx/)
  assert.match(serverTypecheckScript, /const denoCommand =/)
  assert.match(serverTypecheckScript, /\['check'/)
  assert.match(serverTypecheckScript, /path\.join\(serverRoot, 'supabase', 'functions'\)/)
})

test('applyFirebaseServerWorkspaceTemplate creates firebase server skeleton with package-manager aware scripts', async (t) => {
  const targetRoot = await createTempTargetRoot(t)
  const tokens = createTokens('pnpm')

  await applyFirebaseServerWorkspaceTemplate(targetRoot, tokens, {
    projectId: 'ebook-firebase',
    functionRegion: 'us-central1',
  })

  const serverPackageJson = JSON.parse(
    await readFile(path.join(targetRoot, 'server', 'package.json'), 'utf8'),
  ) as {
    scripts?: Record<string, string>
    dependencies?: Record<string, string>
  }
  const firebaserc = JSON.parse(
    await readFile(path.join(targetRoot, 'server', '.firebaserc'), 'utf8'),
  ) as {
    projects?: {
      default?: string
    }
  }
  const firebaseJson = JSON.parse(
    await readFile(path.join(targetRoot, 'server', 'firebase.json'), 'utf8'),
  ) as {
    functions?: Array<{
      predeploy?: string[]
    }>
    firestore?: {
      rules?: string
      indexes?: string
    }
  }
  const functionsTsconfig = JSON.parse(
    await readFile(path.join(targetRoot, 'server', 'functions', 'tsconfig.json'), 'utf8'),
  ) as {
    compilerOptions?: {
      skipLibCheck?: boolean
    }
  }
  const functionsPackageJson = JSON.parse(
    await readFile(path.join(targetRoot, 'server', 'functions', 'package.json'), 'utf8'),
  ) as {
    scripts?: Record<string, string>
    engines?: {
      node?: string
    }
    dependencies?: Record<string, string>
    devDependencies?: Record<string, string>
  }
  const serverFirestoreRules = await readFile(
    path.join(targetRoot, 'server', 'firestore.rules'),
    'utf8',
  )
  const serverFirestoreIndexes = JSON.parse(
    await readFile(path.join(targetRoot, 'server', 'firestore.indexes.json'), 'utf8'),
  ) as {
    indexes?: unknown[]
    fieldOverrides?: unknown[]
  }
  const ensureFirestoreScript = await readFile(
    path.join(targetRoot, 'server', 'scripts', 'firebase-ensure-firestore.mjs'),
    'utf8',
  )
  const functionEntry = await readFile(
    path.join(targetRoot, 'server', 'functions', 'src', 'index.ts'),
    'utf8',
  )
  const publicStatusSource = await readFile(
    path.join(targetRoot, 'server', 'functions', 'src', 'public-status.ts'),
    'utf8',
  )
  const seedPublicStatusSource = await readFile(
    path.join(targetRoot, 'server', 'functions', 'src', 'seed-public-status.ts'),
    'utf8',
  )
  const deployScript = await readFile(
    path.join(targetRoot, 'server', 'scripts', 'firebase-functions-deploy.mjs'),
    'utf8',
  )
  const functionsGitignore = await readFile(
    path.join(targetRoot, 'server', 'functions', '.gitignore'),
    'utf8',
  )

  assert.equal(firebaserc.projects?.default, 'ebook-firebase')
  assert.equal(serverPackageJson.dependencies?.['google-auth-library'], '^10.6.1')
  assert.equal(
    serverPackageJson.scripts?.build,
    'pnpm --dir ./functions install --ignore-workspace && pnpm --dir ./functions build',
  )
  assert.equal(
    serverPackageJson.scripts?.typecheck,
    'pnpm --dir ./functions install --ignore-workspace && pnpm --dir ./functions typecheck',
  )
  assert.equal(
    serverPackageJson.scripts?.deploy,
    'pnpm --dir ./functions install --ignore-workspace && node ./scripts/firebase-functions-deploy.mjs',
  )
  assert.equal(
    serverPackageJson.scripts?.['firestore:ensure'],
    'node ./scripts/firebase-ensure-firestore.mjs',
  )
  assert.equal(
    serverPackageJson.scripts?.['deploy:firestore'],
    'node ./scripts/firebase-functions-deploy.mjs --only firestore:rules,firestore:indexes',
  )
  assert.equal(
    serverPackageJson.scripts?.['seed:public-status'],
    'pnpm --dir ./functions install --ignore-workspace && pnpm --dir ./functions seed:public-status',
  )
  assert.equal(
    serverPackageJson.scripts?.['setup:public-status'],
    'pnpm firestore:ensure && pnpm deploy:firestore && pnpm seed:public-status',
  )
  assert.equal(
    firebaseJson.functions?.[0]?.predeploy?.[0],
    'pnpm --dir "$RESOURCE_DIR" install --ignore-workspace && pnpm --dir "$RESOURCE_DIR" build',
  )
  assert.equal(firebaseJson.firestore?.rules, 'firestore.rules')
  assert.equal(firebaseJson.firestore?.indexes, 'firestore.indexes.json')
  assert.equal(functionsTsconfig.compilerOptions?.skipLibCheck, true)
  assert.equal(functionsPackageJson.dependencies?.['firebase-admin'], '^13.6.0')
  assert.equal(functionsPackageJson.dependencies?.['firebase-functions'], '^7.0.0')
  assert.equal(functionsPackageJson.dependencies?.['@google-cloud/functions-framework'], '^3.4.5')
  assert.equal(functionsPackageJson.engines?.node, '22')
  assert.equal(functionsPackageJson.scripts?.test, 'tsx --test src/**/*.test.ts')
  assert.equal(
    functionsPackageJson.scripts?.['seed:public-status'],
    'tsx src/seed-public-status.ts',
  )
  assert.equal(functionsPackageJson.devDependencies?.tsx, '^4.20.5')
  assert.equal(functionsPackageJson.devDependencies?.typescript, '^5.7.3')
  assert.equal(functionsGitignore, 'lib/\nnode_modules/\n')
  assert.match(serverFirestoreRules, /rules_version = '2'/)
  assert.deepEqual(serverFirestoreIndexes.indexes, [])
  assert.deepEqual(serverFirestoreIndexes.fieldOverrides, [])
  assert.match(functionEntry, /region: 'us-central1'/)
  assert.match(functionEntry, /export const getPublicStatus = onCall/)
  assert.match(functionEntry, /normalizedPath === '\/public-status'/)
  assert.match(publicStatusSource, /buildPublicAppStatusDocument/)
  assert.match(seedPublicStatusSource, /import \{ parseEnv \} from 'node:util'/)
  assert.doesNotMatch(seedPublicStatusSource, /function stripWrappingQuotes\(value: string\)/)
  assert.match(
    seedPublicStatusSource,
    /function loadLocalEnv\(filePath: string\): Record<string, string> \{/,
  )
  assert.match(seedPublicStatusSource, /return parseEnv\(readFileSync\(filePath, 'utf8'\)\)/)
  assert.match(seedPublicStatusSource, /FIREBASE_PROJECT_ID is required/)
  assert.doesNotMatch(functionEntry, new RegExp(FIREBASE_DEFAULT_FUNCTION_REGION))
  assert.match(deployScript, /FIREBASE_PROJECT_ID/)
  assert.match(deployScript, /functions,firestore:rules,firestore:indexes/)
  assert.match(deployScript, /--only/)
  assert.match(deployScript, /FIREBASE_TOKEN/)
  assert.match(deployScript, /GOOGLE_APPLICATION_CREDENTIALS/)
  assert.match(deployScript, /firebase-tools@15\.11\.0/)
  assert.match(ensureFirestoreScript, /google-auth-library/)
  assert.match(ensureFirestoreScript, /firestore\.googleapis\.com:enable/)
})

test('applyFirebaseServerWorkspaceTemplate emits bun-compatible predeploy commands', async (t) => {
  const targetRoot = await createTempTargetRoot(t)
  const tokens = createTokens('bun')

  await applyFirebaseServerWorkspaceTemplate(targetRoot, tokens, {
    projectId: 'ebook-firebase',
    functionRegion: 'us-central1',
  })

  const serverPackageJson = JSON.parse(
    await readFile(path.join(targetRoot, 'server', 'package.json'), 'utf8'),
  ) as {
    scripts?: Record<string, string>
  }
  const firebaseJson = JSON.parse(
    await readFile(path.join(targetRoot, 'server', 'firebase.json'), 'utf8'),
  ) as {
    functions?: Array<{
      predeploy?: string[]
    }>
  }

  assert.equal(
    serverPackageJson.scripts?.build,
    'bun install --cwd ./functions && bun run --cwd ./functions build',
  )
  assert.equal(
    firebaseJson.functions?.[0]?.predeploy?.[0],
    'bun install --cwd "$RESOURCE_DIR" && bun run --cwd "$RESOURCE_DIR" build',
  )
})

test('applyFirebaseServerWorkspaceTemplate emits plain npm predeploy commands and writes npmrc files', async (t) => {
  const targetRoot = await createTempTargetRoot(t)
  const tokens = createTokens('npm')

  await applyFirebaseServerWorkspaceTemplate(targetRoot, tokens, {
    projectId: 'ebook-firebase',
    functionRegion: 'us-central1',
  })

  const serverPackageJson = JSON.parse(
    await readFile(path.join(targetRoot, 'server', 'package.json'), 'utf8'),
  ) as {
    scripts?: Record<string, string>
  }
  const firebaseJson = JSON.parse(
    await readFile(path.join(targetRoot, 'server', 'firebase.json'), 'utf8'),
  ) as {
    functions?: Array<{
      predeploy?: string[]
    }>
  }
  const serverNpmrc = await readFile(path.join(targetRoot, 'server', '.npmrc'), 'utf8')
  const functionsNpmrc = await readFile(
    path.join(targetRoot, 'server', 'functions', '.npmrc'),
    'utf8',
  )

  assert.equal(
    serverPackageJson.scripts?.build,
    'npm --prefix ./functions install && npm --prefix ./functions run build',
  )
  assert.equal(
    firebaseJson.functions?.[0]?.predeploy?.[0],
    'npm --prefix "$RESOURCE_DIR" install && npm --prefix "$RESOURCE_DIR" run build',
  )
  assert.equal(serverNpmrc, 'legacy-peer-deps=true\n')
  assert.equal(functionsNpmrc, 'legacy-peer-deps=true\n')
})

test('applyFirebaseServerWorkspaceTemplate creates yarn-isolated functions project assets for yarn', async (t) => {
  const targetRoot = await createTempTargetRoot(t)
  const tokens = createTokens('yarn')

  await applyFirebaseServerWorkspaceTemplate(targetRoot, tokens, {
    projectId: 'ebook-firebase',
  })

  const functionsGitignore = await readFile(
    path.join(targetRoot, 'server', 'functions', '.gitignore'),
    'utf8',
  )
  const functionsYarnrc = await readFile(
    path.join(targetRoot, 'server', 'functions', '.yarnrc.yml'),
    'utf8',
  )
  const functionsYarnLock = await readFile(
    path.join(targetRoot, 'server', 'functions', 'yarn.lock'),
    'utf8',
  )
  const firebaseJson = JSON.parse(
    await readFile(path.join(targetRoot, 'server', 'firebase.json'), 'utf8'),
  ) as {
    functions?: Array<{
      predeploy?: string[]
    }>
  }
  const serverPackageJson = JSON.parse(
    await readFile(path.join(targetRoot, 'server', 'package.json'), 'utf8'),
  ) as {
    scripts?: Record<string, string>
  }

  assert.equal(functionsYarnLock, '')
  assert.match(functionsYarnrc, /nodeLinker: node-modules/)
  assert.match(functionsGitignore, /^\.yarn\/?$/m)
  assert.match(functionsGitignore, /^\.pnp\.\*$/m)
  assert.equal(
    serverPackageJson.scripts?.build,
    'yarn --cwd ./functions install && yarn --cwd ./functions build',
  )
  assert.equal(
    firebaseJson.functions?.[0]?.predeploy?.[0],
    'yarn --cwd "$RESOURCE_DIR" install && yarn --cwd "$RESOURCE_DIR" build',
  )
})

test('syncRootWorkspaceManifest adds newly added workspaces to existing root manifests', async (t) => {
  const pnpmRoot = await createTempTargetRoot(t)
  const yarnRoot = await createTempTargetRoot(t)
  const npmRoot = await createTempTargetRoot(t)
  const bunRoot = await createTempTargetRoot(t)

  await applyRootTemplates(pnpmRoot, createTokens('pnpm'), ['frontend', 'marketing'])
  await applyRootTemplates(yarnRoot, createTokens('yarn'), ['frontend', 'marketing'])
  await applyRootTemplates(npmRoot, createTokens('npm'), ['frontend', 'marketing'])
  await applyRootTemplates(bunRoot, createTokens('bun'), ['frontend', 'marketing'])

  await syncRootWorkspaceManifest(pnpmRoot, 'pnpm', [
    'frontend',
    'marketing',
    'server',
    'packages/contracts',
    'packages/app-router',
  ])
  await syncRootWorkspaceManifest(yarnRoot, 'yarn', [
    'frontend',
    'marketing',
    'backoffice',
    'packages/contracts',
    'packages/app-router',
  ])
  await syncRootWorkspaceManifest(npmRoot, 'npm', [
    'frontend',
    'marketing',
    'server',
    'packages/contracts',
    'packages/app-router',
  ])
  await syncRootWorkspaceManifest(bunRoot, 'bun', [
    'frontend',
    'marketing',
    'backoffice',
    'packages/contracts',
    'packages/app-router',
  ])

  const pnpmWorkspaceManifest = await readFile(path.join(pnpmRoot, 'pnpm-workspace.yaml'), 'utf8')
  const yarnPackageJson = JSON.parse(
    await readFile(path.join(yarnRoot, 'package.json'), 'utf8'),
  ) as {
    workspaces?: string[]
  }
  const npmPackageJson = JSON.parse(await readFile(path.join(npmRoot, 'package.json'), 'utf8')) as {
    workspaces?: string[]
  }
  const bunPackageJson = JSON.parse(await readFile(path.join(bunRoot, 'package.json'), 'utf8')) as {
    workspaces?: string[]
  }

  assert.equal(
    pnpmWorkspaceManifest,
    'packages:\n  - frontend\n  - marketing\n  - server\n  - packages/*\n',
  )
  assert.deepEqual(yarnPackageJson.workspaces, [
    'frontend',
    'marketing',
    'backoffice',
    'packages/*',
  ])
  assert.deepEqual(npmPackageJson.workspaces, ['frontend', 'marketing', 'server', 'packages/*'])
  assert.deepEqual(bunPackageJson.workspaces, ['frontend', 'marketing', 'backoffice', 'packages/*'])
})
