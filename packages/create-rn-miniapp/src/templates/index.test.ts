import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import {
  getPackageManagerAdapter,
  PACKAGE_MANAGERS,
  type PackageManager,
} from '../package-manager.js'
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
  syncGeneratedSkills,
  syncRootWorkspaceManifest,
  type TemplateTokens,
} from './index.js'

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

async function writeJsonFile(targetPath: string, value: unknown) {
  await writeFile(targetPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

async function spawnNodeProcess(
  command: string,
  args: string[],
  options: {
    cwd: string
    env?: NodeJS.ProcessEnv
    timeoutMs?: number
  },
) {
  return await new Promise<{
    status: number | null
    signal: NodeJS.Signals | null
    stdout: string
    stderr: string
  }>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    const stdoutChunks: string[] = []
    const stderrChunks: string[] = []
    const timeout = setTimeout(() => {
      child.kill('SIGTERM')
      reject(new Error(`command timed out after ${options.timeoutMs ?? 15_000}ms`))
    }, options.timeoutMs ?? 15_000)

    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', (chunk) => stdoutChunks.push(chunk))
    child.stderr.on('data', (chunk) => stderrChunks.push(chunk))
    child.on('error', (error) => {
      clearTimeout(timeout)
      reject(error)
    })
    child.on('close', (status, signal) => {
      clearTimeout(timeout)
      resolve({
        status,
        signal,
        stdout: stdoutChunks.join(''),
        stderr: stderrChunks.join(''),
      })
    })
  })
}

async function createRegistryFixtureServer(
  t: test.TestContext,
  registryMetadata: Record<string, unknown>,
) {
  const server = createServer((request, response) => {
    const requestUrl = new URL(request.url ?? '/', 'http://127.0.0.1')

    if (requestUrl.pathname === '/registry.json') {
      response.setHeader('content-type', 'application/json')
      response.end(JSON.stringify(registryMetadata))
      return
    }

    response.statusCode = 404
    response.end('not found')
  })

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve())
  })

  t.after(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error)
          return
        }

        resolve()
      })
    })
  })

  const address = server.address()
  assert.ok(address && typeof address === 'object' && 'port' in address)

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
  }
}

function renderTdsUiDocsPage(options: { hrefs: string[]; propNames?: string[] }) {
  const tsDoc =
    options.propNames && options.propNames.length > 0
      ? [
          {
            title: 'ComponentProps',
            description: '',
            items: options.propNames.map((name) => ({
              name,
              type: ['unknown'],
              defaultValue: '-',
              link: '-',
              description: '',
              required: false,
            })),
          },
        ]
      : []

  return [
    '<!DOCTYPE html>',
    '<html lang="ko">',
    '<body>',
    ...options.hrefs.map((href) => `<a href="${href}">${href}</a>`),
    `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
      props: {
        pageProps: {
          ssg: {
            tsDoc,
          },
        },
      },
    })}</script>`,
    '</body>',
    '</html>',
  ].join('')
}

async function createTdsUiRefreshFixtureServer(
  t: test.TestContext,
  options?: {
    radioWithoutDefaultValue?: boolean
  },
) {
  const preferredVersion = '2.0.2'
  const baselineCatalogPath = fileURLToPath(
    new URL('../../../scaffold-skills/tds-ui/generated/catalog.json', import.meta.url),
  )
  const baselineCatalog = JSON.parse(await readFile(baselineCatalogPath, 'utf8')) as Array<{
    name: string
    rootExported: boolean
    componentDirExists: boolean
    docsStatus: string
    docsSlug: string | null
    docUrl: string | null
    stateModel: {
      controlled: string[]
      uncontrolled: string[]
    }
  }>
  const docsLinks = baselineCatalog
    .filter((entry) => entry.docsStatus === 'public-docs' && entry.docUrl)
    .map((entry) => new URL(entry.docUrl as string).pathname)
  const docsPages = new Map<string, string>(
    baselineCatalog
      .filter((entry) => entry.docsStatus === 'public-docs' && entry.docUrl)
      .map((entry) => {
        const propNames = [...entry.stateModel.controlled, ...entry.stateModel.uncontrolled]
          .filter((value, index, values) => values.indexOf(value) === index)
          .filter(
            (value) =>
              !(
                options?.radioWithoutDefaultValue &&
                entry.name === 'radio' &&
                value === 'defaultValue'
              ),
          )
        return [
          new URL(entry.docUrl as string).pathname,
          renderTdsUiDocsPage({
            hrefs: docsLinks,
            propNames,
          }),
        ]
      }),
  )
  const componentMeta = {
    package: '@toss/tds-react-native',
    version: preferredVersion,
    prefix: '/dist/cjs/components/',
    files: baselineCatalog
      .filter((entry) => entry.componentDirExists)
      .map((entry) => `/dist/cjs/components/${entry.name}/index.js`)
      .map((filePath) => ({
        path: filePath,
        size: 1,
        type: 'text/javascript',
        integrity: 'sha256-test',
      })),
  }
  const rootIndexSource = baselineCatalog
    .filter((entry) => entry.rootExported)
    .map((entry) => `__exportStar(require("./components/${entry.name}"), exports);`)
    .concat(['__exportStar(require("./extensions/page-navbar"), exports);'])
    .join('\n')

  const server = createServer((request, response) => {
    const requestUrl = new URL(request.url ?? '/', 'http://127.0.0.1')

    if (requestUrl.pathname === '/registry.json') {
      response.setHeader('content-type', 'application/json')
      response.end(
        JSON.stringify({
          'dist-tags': {
            latest: '1.3.8',
            next: preferredVersion,
          },
          versions: {
            '1.3.8': {
              dist: {
                tarball: 'http://127.0.0.1/dummy-legacy.tgz',
              },
            },
            [preferredVersion]: {
              dist: {
                tarball: 'http://127.0.0.1/dummy.tgz',
              },
            },
          },
        }),
      )
      return
    }

    if (
      requestUrl.pathname === `/@toss/tds-react-native@${preferredVersion}/dist/cjs/components/` &&
      requestUrl.search === '?meta'
    ) {
      response.setHeader('content-type', 'application/json')
      response.end(JSON.stringify(componentMeta))
      return
    }

    if (requestUrl.pathname === `/@toss/tds-react-native@${preferredVersion}/dist/cjs/index.js`) {
      response.setHeader('content-type', 'text/javascript')
      response.end(rootIndexSource)
      return
    }

    const docsPage = docsPages.get(requestUrl.pathname)
    if (docsPage) {
      response.setHeader('content-type', 'text/html; charset=utf-8')
      response.end(docsPage)
      return
    }

    response.statusCode = 404
    response.end('not found')
  })

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve())
  })

  t.after(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error)
          return
        }

        resolve()
      })
    })
  })

  const address = server.address()
  assert.ok(address && typeof address === 'object' && 'port' in address)

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
  }
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

const TDS_UI_REFRESH_SCRIPT_FILES = [
  'scripts/ensure-fresh.mjs',
  'scripts/lib/builders.mjs',
  'scripts/lib/external.mjs',
  'scripts/lib/io.mjs',
  'scripts/lib/render.mjs',
  'scripts/lib/validate.mjs',
  'scripts/refresh-catalog.mjs',
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
    '## Freshness Hook',
    '- 먼저 `node scripts/ensure-fresh.mjs`를 실행한다.',
    '- `metadata.json.lastVerifiedAt`이 7일을 넘기면 최신 `@toss/tds-react-native`와 Toss Mini Docs 기준으로 refresh를 시도한다.',
    '- refresh 산출물은 저장 전에 catalog/anomaly/metadata 계약 검증을 통과해야 한다.',
    '- refresh가 성공하면 canonical `.agents/skills/tds-ui` snapshot을 갱신하고 `.claude/skills` mirror를 다시 sync한다.',
    '- refresh가 실패하면 warning만 남기고 현재 snapshot으로 계속 진행한다.',
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

test('docs and skills modules do not keep separate optional feature manifests', async () => {
  const docsSource = await readFile(fileURLToPath(new URL('./docs.ts', import.meta.url)), 'utf8')
  const skillsSource = await readFile(
    fileURLToPath(new URL('./skills.ts', import.meta.url)),
    'utf8',
  )
  const sharedSkillCatalogSource = await readFile(
    fileURLToPath(new URL('./skill-catalog.ts', import.meta.url)),
    'utf8',
  )

  assert.doesNotMatch(docsSource, /WORKSPACE_FEATURE_DEFINITIONS/)
  assert.doesNotMatch(skillsSource, /OPTIONAL_SKILL_DEFINITIONS/)
  assert.match(sharedSkillCatalogSource, /templateDir: 'backoffice-react'/)
  assert.match(sharedSkillCatalogSource, /templateDir: 'cloudflare-worker'/)
  assert.match(sharedSkillCatalogSource, /templateDir: 'supabase-project'/)
  assert.match(sharedSkillCatalogSource, /templateDir: 'firebase-functions'/)
  assert.match(sharedSkillCatalogSource, /templateDir: 'trpc-boundary'/)
})

test('skill taxonomy metadata is centralized in a shared catalog', async () => {
  const catalogSource = await readFile(
    fileURLToPath(new URL('./skill-catalog.ts', import.meta.url)),
    'utf8',
  )
  const skillsSource = await readFile(
    fileURLToPath(new URL('./skills.ts', import.meta.url)),
    'utf8',
  )
  const sharedFeatureSource = await readFile(
    fileURLToPath(new URL('./feature-catalog.ts', import.meta.url)),
    'utf8',
  )

  assert.match(catalogSource, /export const SKILL_CATALOG/)
  assert.match(skillsSource, /from '\.\/skill-catalog\.js'/)
  assert.match(sharedFeatureSource, /from '\.\/skill-catalog\.js'/)
  assert.doesNotMatch(sharedFeatureSource, /templateDir: 'backoffice-react'/)
  assert.doesNotMatch(sharedFeatureSource, /templateDir: 'cloudflare-worker'/)
  assert.doesNotMatch(sharedFeatureSource, /templateDir: 'supabase-project'/)
  assert.doesNotMatch(sharedFeatureSource, /templateDir: 'firebase-functions'/)
  assert.doesNotMatch(sharedFeatureSource, /templateDir: 'trpc-boundary'/)
})

test('frontend policy derives core skill references from the core skill catalog', async () => {
  const frontendPolicySource = await readFile(
    fileURLToPath(new URL('./frontend-policy.ts', import.meta.url)),
    'utf8',
  )
  const skillCatalogSource = await readFile(
    fileURLToPath(new URL('./skill-catalog.ts', import.meta.url)),
    'utf8',
  )

  assert.doesNotMatch(frontendPolicySource, /\.agents\/skills\/miniapp\/SKILL\.md/)
  assert.doesNotMatch(frontendPolicySource, /\.agents\/skills\/granite\/SKILL\.md/)
  assert.doesNotMatch(frontendPolicySource, /\.agents\/skills\/tds\/SKILL\.md/)
  assert.doesNotMatch(frontendPolicySource, /\.agents\/skills\/tds\/references\/catalog\.md/)
  assert.doesNotMatch(frontendPolicySource, /\.agents\/skills\/tds-ui\/references\/catalog\.md/)
  assert.match(frontendPolicySource, /getCoreSkillDefinition\('miniapp-capabilities'/)
  assert.match(frontendPolicySource, /getCoreSkillDefinition\('granite-routing'/)
  assert.match(frontendPolicySource, /getCoreSkillDefinition\('tds-ui'/)
  assert.match(skillCatalogSource, /\.agents\/skills\/tds-ui\/generated\/catalog\.json/)
})

test('tds-ui canonical skill package is self-contained and decision-driven', async () => {
  const tdsUiRoot = fileURLToPath(new URL('../../../scaffold-skills/tds-ui', import.meta.url))
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
    ...TDS_UI_REFRESH_SCRIPT_FILES,
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
  assert.match(skillSource, /node scripts\/ensure-fresh\.mjs/)
  assert.match(skillSource, /7일|7 days/)
  assert.match(skillSource, /추천 컴포넌트/)
  assert.match(skillSource, /anomaly note/i)
  assert.match(skillSource, /incomplete answer/)
  assert.match(skillSource, /doc-backed fallback/)
  assert.equal(agentsSource, renderTdsUiAgentsMarkdown())

  const metadata = JSON.parse(await readFile(path.join(tdsUiRoot, 'metadata.json'), 'utf8')) as {
    package: { name: string; version: string }
    lastVerifiedAt: string
    refreshPolicy?: { maxAgeDays: number; strategy: string }
  }
  assert.equal(metadata.package.name, '@toss/tds-react-native')
  assert.equal(metadata.package.version, '2.0.2')
  assert.equal(metadata.lastVerifiedAt, '2026-03-21')
  assert.deepEqual(metadata.refreshPolicy, {
    maxAgeDays: 7,
    strategy: 'auto-refresh-latest',
  })

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

test('tds-ui refresh selector follows latest once latest reaches 2.x', async (t) => {
  const { baseUrl } = await createRegistryFixtureServer(t, {
    'dist-tags': {
      latest: '2.0.3',
      next: '2.0.2',
    },
    versions: {
      '2.0.2': {
        dist: {
          tarball: 'http://127.0.0.1/dummy-2.0.2.tgz',
        },
      },
      '2.0.3': {
        dist: {
          tarball: 'http://127.0.0.1/dummy-2.0.3.tgz',
        },
      },
    },
  })
  const externalModulePath = fileURLToPath(
    new URL('../../../scaffold-skills/tds-ui/scripts/lib/external.mjs', import.meta.url),
  )
  const { fetchLatestPackageVersion } = (await import(externalModulePath)) as {
    fetchLatestPackageVersion: (env?: NodeJS.ProcessEnv) => Promise<string>
  }

  const selectedVersion = await fetchLatestPackageVersion({
    ...process.env,
    TDS_UI_REFRESH_REGISTRY_URL: `${baseUrl}/registry.json`,
  })

  assert.equal(selectedVersion, '2.0.3')
})

test('tds-ui ensure-fresh refreshes stale canonical data and resyncs the claude mirror', async (t) => {
  const targetRoot = await createTempTargetRoot(t)
  const tokens = createTokens('pnpm')
  const { baseUrl } = await createTdsUiRefreshFixtureServer(t)

  await mkdir(path.join(targetRoot, 'frontend'), { recursive: true })
  await applyRootTemplates(targetRoot, tokens, ['frontend'])
  await syncGeneratedSkills(targetRoot, tokens, createDocsHints())

  const canonicalMetadataPath = path.join(
    targetRoot,
    '.agents',
    'skills',
    'tds-ui',
    'metadata.json',
  )
  const canonicalMetadata = JSON.parse(await readFile(canonicalMetadataPath, 'utf8')) as {
    name: string
    version: string
    package: { name: string; version: string }
    truthSources: string[]
    notes: string[]
  }

  await writeJsonFile(canonicalMetadataPath, {
    ...canonicalMetadata,
    lastVerifiedAt: '2026-03-01',
    refreshPolicy: {
      maxAgeDays: 7,
      strategy: 'auto-refresh-latest',
    },
  })

  const result = await spawnNodeProcess(
    process.execPath,
    [path.join('.claude', 'skills', 'tds-ui', 'scripts', 'ensure-fresh.mjs')],
    {
      cwd: targetRoot,
      env: {
        ...process.env,
        TDS_UI_REFRESH_DOCS_SEED_URL: `${baseUrl}/tds-react-native/components/text-field/`,
        TDS_UI_REFRESH_REGISTRY_URL: `${baseUrl}/registry.json`,
        TDS_UI_REFRESH_TODAY: '2026-03-21',
        TDS_UI_REFRESH_UNPKG_BASE_URL: baseUrl,
      },
      timeoutMs: 15_000,
    },
  )

  assert.equal(result.status, 0, result.stderr)

  const nextCanonicalMetadata = JSON.parse(await readFile(canonicalMetadataPath, 'utf8')) as {
    package: { version: string }
    lastVerifiedAt: string
    refreshPolicy?: { maxAgeDays: number; strategy: string }
  }
  const nextMirrorMetadata = JSON.parse(
    await readFile(path.join(targetRoot, '.claude', 'skills', 'tds-ui', 'metadata.json'), 'utf8'),
  ) as typeof nextCanonicalMetadata
  const nextCatalog = JSON.parse(
    await readFile(
      path.join(targetRoot, '.agents', 'skills', 'tds-ui', 'generated', 'catalog.json'),
      'utf8',
    ),
  ) as Array<{
    name: string
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
    packageVersion: string
    lastVerifiedAt: string
  }>
  const mirrorCatalogSource = await readFile(
    path.join(targetRoot, '.claude', 'skills', 'tds-ui', 'generated', 'catalog.json'),
    'utf8',
  )
  const canonicalCatalogSource = await readFile(
    path.join(targetRoot, '.agents', 'skills', 'tds-ui', 'generated', 'catalog.json'),
    'utf8',
  )
  const nextAnomalies = JSON.parse(
    await readFile(
      path.join(targetRoot, '.agents', 'skills', 'tds-ui', 'generated', 'anomalies.json'),
      'utf8',
    ),
  ) as Record<string, Array<{ name: string }>>

  assert.deepEqual(nextCanonicalMetadata, nextMirrorMetadata)
  assert.equal(nextCanonicalMetadata.package.version, '2.0.2')
  assert.equal(nextCanonicalMetadata.lastVerifiedAt, '2026-03-21')
  assert.deepEqual(nextCanonicalMetadata.refreshPolicy, {
    maxAgeDays: 7,
    strategy: 'auto-refresh-latest',
  })
  assert.equal(mirrorCatalogSource, canonicalCatalogSource)

  const textField = nextCatalog.find((entry) => entry.name === 'text-field')
  const navbar = nextCatalog.find((entry) => entry.name === 'navbar')
  const chart = nextCatalog.find((entry) => entry.name === 'chart')
  const stepperRow = nextCatalog.find((entry) => entry.name === 'stepper-row')
  const agreement = nextCatalog.find((entry) => entry.name === 'agreement')
  const paragraph = nextCatalog.find((entry) => entry.name === 'paragraph')

  assert.deepEqual(textField?.stateModel, {
    controlled: ['value', 'onChange'],
    uncontrolled: ['defaultValue'],
  })
  assert.equal(textField?.packageVersion, '2.0.2')
  assert.equal(textField?.lastVerifiedAt, '2026-03-21')
  assert.equal(navbar?.selectionStatus, 'export-gap')
  assert.equal(navbar?.rootExported, false)
  assert.equal(navbar?.componentDirExists, true)
  assert.equal(navbar?.rootImportPath, '@toss/tds-react-native/extensions/page-navbar')
  assert.equal(navbar?.docsStatus, 'public-docs')
  assert.equal(chart?.docsSlug, 'Chart/bar-chart')
  assert.equal(chart?.docUrl, `${baseUrl}/tds-react-native/components/Chart/bar-chart/`)
  assert.equal(stepperRow?.docsSlug, 'stepper')
  assert.equal(stepperRow?.docUrl, `${baseUrl}/tds-react-native/components/stepper/`)
  assert.equal(agreement?.selectionStatus, 'export-only')
  assert.equal(agreement?.docsStatus, 'no-public-docs')
  assert.equal(paragraph?.selectionStatus, 'blocked')
  assert.equal(paragraph?.componentDirExists, true)
  assert.equal(paragraph?.rootExported, false)

  assert.deepEqual(nextAnomalies['docs-slug-alias']?.map((entry) => entry.name).sort(), [
    'chart',
    'stepper-row',
  ])
  assert.deepEqual(
    nextAnomalies['root-export-gap']?.map((entry) => entry.name),
    ['navbar'],
  )
  assert.ok(
    nextAnomalies['root-export-no-public-docs']?.some((entry) => entry.name === 'agreement'),
  )
  assert.ok(nextAnomalies['dir-only-weak']?.some((entry) => entry.name === 'paragraph'))
})

test('tds-ui ensure-fresh swallows refresh failures and keeps the current snapshot', async (t) => {
  const targetRoot = await createTempTargetRoot(t)
  const tokens = createTokens('pnpm')

  await mkdir(path.join(targetRoot, 'frontend'), { recursive: true })
  await applyRootTemplates(targetRoot, tokens, ['frontend'])
  await syncGeneratedSkills(targetRoot, tokens, createDocsHints())

  const canonicalMetadataPath = path.join(
    targetRoot,
    '.agents',
    'skills',
    'tds-ui',
    'metadata.json',
  )
  const canonicalCatalogPath = path.join(
    targetRoot,
    '.agents',
    'skills',
    'tds-ui',
    'generated',
    'catalog.json',
  )
  const metadata = JSON.parse(await readFile(canonicalMetadataPath, 'utf8')) as {
    name: string
    version: string
    package: { name: string; version: string }
    truthSources: string[]
    notes: string[]
  }

  await writeJsonFile(canonicalMetadataPath, {
    ...metadata,
    lastVerifiedAt: '2026-03-01',
    refreshPolicy: {
      maxAgeDays: 7,
      strategy: 'auto-refresh-latest',
    },
  })

  const metadataBefore = await readFile(canonicalMetadataPath, 'utf8')
  const catalogBefore = await readFile(canonicalCatalogPath, 'utf8')
  const result = await spawnNodeProcess(
    process.execPath,
    [path.join('.agents', 'skills', 'tds-ui', 'scripts', 'ensure-fresh.mjs')],
    {
      cwd: targetRoot,
      env: {
        ...process.env,
        TDS_UI_REFRESH_DOCS_SEED_URL: 'http://127.0.0.1:1/tds-react-native/components/text-field/',
        TDS_UI_REFRESH_REGISTRY_URL: 'http://127.0.0.1:1/registry.json',
        TDS_UI_REFRESH_TODAY: '2026-03-21',
        TDS_UI_REFRESH_UNPKG_BASE_URL: 'http://127.0.0.1:1',
      },
      timeoutMs: 15_000,
    },
  )

  assert.equal(result.status, 0, result.stderr)
  assert.equal(await readFile(canonicalMetadataPath, 'utf8'), metadataBefore)
  assert.equal(await readFile(canonicalCatalogPath, 'utf8'), catalogBefore)
})

test('tds-ui ensure-fresh accepts live state-model drift and updates the snapshot', async (t) => {
  const targetRoot = await createTempTargetRoot(t)
  const tokens = createTokens('pnpm')
  const { baseUrl } = await createTdsUiRefreshFixtureServer(t, { radioWithoutDefaultValue: true })

  await mkdir(path.join(targetRoot, 'frontend'), { recursive: true })
  await applyRootTemplates(targetRoot, tokens, ['frontend'])
  await syncGeneratedSkills(targetRoot, tokens, createDocsHints())

  const canonicalMetadataPath = path.join(
    targetRoot,
    '.agents',
    'skills',
    'tds-ui',
    'metadata.json',
  )
  const canonicalCatalogPath = path.join(
    targetRoot,
    '.agents',
    'skills',
    'tds-ui',
    'generated',
    'catalog.json',
  )
  const metadata = JSON.parse(await readFile(canonicalMetadataPath, 'utf8')) as {
    name: string
    version: string
    package: { name: string; version: string }
    truthSources: string[]
    notes: string[]
  }

  await writeJsonFile(canonicalMetadataPath, {
    ...metadata,
    lastVerifiedAt: '2026-03-01',
    refreshPolicy: {
      maxAgeDays: 7,
      strategy: 'auto-refresh-latest',
    },
  })

  const result = await spawnNodeProcess(
    process.execPath,
    [path.join('.agents', 'skills', 'tds-ui', 'scripts', 'ensure-fresh.mjs')],
    {
      cwd: targetRoot,
      env: {
        ...process.env,
        TDS_UI_REFRESH_DOCS_SEED_URL: `${baseUrl}/tds-react-native/components/text-field/`,
        TDS_UI_REFRESH_REGISTRY_URL: `${baseUrl}/registry.json`,
        TDS_UI_REFRESH_TODAY: '2026-03-21',
        TDS_UI_REFRESH_UNPKG_BASE_URL: baseUrl,
      },
      timeoutMs: 15_000,
    },
  )

  assert.equal(result.status, 0, result.stderr)
  const nextMetadata = JSON.parse(await readFile(canonicalMetadataPath, 'utf8')) as {
    package: { version: string }
    lastVerifiedAt: string
  }
  const nextCatalog = JSON.parse(await readFile(canonicalCatalogPath, 'utf8')) as Array<{
    name: string
    stateModel: {
      controlled: string[]
      uncontrolled: string[]
    }
    packageVersion: string
    lastVerifiedAt: string
  }>
  const radio = nextCatalog.find((entry) => entry.name === 'radio')

  assert.equal(nextMetadata.package.version, '2.0.2')
  assert.equal(nextMetadata.lastVerifiedAt, '2026-03-21')
  assert.deepEqual(radio?.stateModel, {
    controlled: ['value', 'onChange'],
    uncontrolled: [],
  })
  assert.equal(radio?.packageVersion, '2.0.2')
  assert.equal(radio?.lastVerifiedAt, '2026-03-21')
})

test('tds-ui refresh-catalog swallows direct refresh failures and keeps the current snapshot', async (t) => {
  const targetRoot = await createTempTargetRoot(t)
  const tokens = createTokens('pnpm')

  await mkdir(path.join(targetRoot, 'frontend'), { recursive: true })
  await applyRootTemplates(targetRoot, tokens, ['frontend'])
  await syncGeneratedSkills(targetRoot, tokens, createDocsHints())

  const canonicalMetadataPath = path.join(
    targetRoot,
    '.agents',
    'skills',
    'tds-ui',
    'metadata.json',
  )
  const canonicalCatalogPath = path.join(
    targetRoot,
    '.agents',
    'skills',
    'tds-ui',
    'generated',
    'catalog.json',
  )
  const brokenMetadata = '{\n  "name": "tds-ui",\n'
  await writeFile(canonicalMetadataPath, brokenMetadata, 'utf8')
  const metadataBefore = await readFile(canonicalMetadataPath, 'utf8')
  const catalogBefore = await readFile(canonicalCatalogPath, 'utf8')
  const result = await spawnNodeProcess(
    process.execPath,
    [path.join('.agents', 'skills', 'tds-ui', 'scripts', 'refresh-catalog.mjs')],
    {
      cwd: targetRoot,
      timeoutMs: 15_000,
    },
  )

  assert.equal(result.status, 0, result.stderr)
  assert.equal(await readFile(canonicalMetadataPath, 'utf8'), metadataBefore)
  assert.equal(await readFile(canonicalCatalogPath, 'utf8'), catalogBefore)
})

test('tds-ui refresh validator rejects malformed output shape before save', async () => {
  const validatorModulePath = fileURLToPath(
    new URL('../../../scaffold-skills/tds-ui/scripts/lib/validate.mjs', import.meta.url),
  )
  const { validateRefreshArtifacts } = (await import(validatorModulePath)) as {
    validateRefreshArtifacts: (options: {
      baselineCatalog: unknown[]
      baselineAnomalies: Record<string, unknown>
      previousMetadata: Record<string, unknown>
      catalog: unknown[]
      anomalies: Record<string, unknown>
      metadata: Record<string, unknown>
    }) => void
  }
  const tdsUiRoot = fileURLToPath(new URL('../../../scaffold-skills/tds-ui', import.meta.url))
  const baselineCatalog = JSON.parse(
    await readFile(path.join(tdsUiRoot, 'generated', 'catalog.json'), 'utf8'),
  ) as Array<Record<string, unknown>>
  const baselineAnomalies = JSON.parse(
    await readFile(path.join(tdsUiRoot, 'generated', 'anomalies.json'), 'utf8'),
  ) as Record<string, unknown>
  const previousMetadata = JSON.parse(
    await readFile(path.join(tdsUiRoot, 'metadata.json'), 'utf8'),
  ) as Record<string, unknown>
  const malformedCatalog = structuredClone(baselineCatalog)
  malformedCatalog[0] = {
    ...malformedCatalog[0],
    unexpected: true,
  }

  assert.throws(() => {
    validateRefreshArtifacts({
      baselineCatalog,
      baselineAnomalies,
      previousMetadata,
      catalog: malformedCatalog,
      anomalies: structuredClone(baselineAnomalies),
      metadata: structuredClone(previousMetadata),
    })
  }, /keys changed|unexpected/)
})

test('tds-ui ensure-fresh swallows malformed metadata and keeps the current snapshot', async (t) => {
  const targetRoot = await createTempTargetRoot(t)
  const tokens = createTokens('pnpm')

  await mkdir(path.join(targetRoot, 'frontend'), { recursive: true })
  await applyRootTemplates(targetRoot, tokens, ['frontend'])
  await syncGeneratedSkills(targetRoot, tokens, createDocsHints())

  const canonicalMetadataPath = path.join(
    targetRoot,
    '.agents',
    'skills',
    'tds-ui',
    'metadata.json',
  )
  const brokenMetadata = '{\n  "name": "tds-ui",\n'
  await writeFile(canonicalMetadataPath, brokenMetadata, 'utf8')

  const result = await spawnNodeProcess(
    process.execPath,
    [path.join('.agents', 'skills', 'tds-ui', 'scripts', 'ensure-fresh.mjs')],
    {
      cwd: targetRoot,
      timeoutMs: 15_000,
    },
  )

  assert.equal(result.status, 0, result.stderr)
  assert.equal(await readFile(canonicalMetadataPath, 'utf8'), brokenMetadata)
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
  const patchingSharedSource = await readFile(
    fileURLToPath(new URL('../patching/shared.ts', import.meta.url)),
    'utf8',
  )

  assert.doesNotMatch(cliSource, /packages\/contracts/)
  assert.doesNotMatch(cliSource, /packages\/app-router/)
  assert.doesNotMatch(packageManagerSource, /packages\/contracts/)
  assert.doesNotMatch(packageManagerSource, /packages\/app-router/)
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

  assert.match(readmeSource, /MiniApp에서 자주 쓰는 Skill이 처음부터 준비돼 있으면 좋을 때/)
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

  assert.match(readmeSource, /공식 scaffold 위에 필요한 운영 문서와 Skill을 함께 준비해줘요\./)
  assert.match(readmeSource, /문서와 Skill까지 함께 준비해주는 CLI/)
  assert.match(readmeSource, /## Skill은 왜 같이 들어가나요/)
  assert.match(
    readmeSource,
    /Skill은 에이전트가 같은 기준으로 화면, 라우팅, 서버 작업을 이어가게 도와주는 작업 가이드예요\./,
  )
  assert.match(
    readmeSource,
    /생성된 repo에서는 `AGENTS\.md`가 지금 읽을 Skill로 이어주고, `.agents\/skills`, `.claude\/skills`에는 그 기준을 같이 넣어줘요\./,
  )
  assert.match(readmeSource, /기본으로는 아래 Skill이 같이 들어가요\./)
  assert.match(
    readmeSource,
    /- `miniapp-capabilities`: MiniApp capability와 공식 API를 찾을 때 봐요\./,
  )
  assert.match(readmeSource, /- `granite-routing`: route, page, navigation 패턴을 정할 때 봐요\./)
  assert.match(readmeSource, /- `tds-ui`: TDS UI와 form 패턴을 고를 때 봐요\./)
  assert.doesNotMatch(readmeSource, /canonical/i)
  assert.doesNotMatch(readmeSource, /source of truth/i)
  assert.doesNotMatch(readmeSource, /생성물 계약/)
  assert.doesNotMatch(readmeSource, /Provider IaC/)
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

  assert.doesNotMatch(agentsSource, /^- core:/m)
  assert.doesNotMatch(agentsSource, /^- optional:/m)
  assert.match(agentsSource, /skill-catalog\.ts/)
  assert.match(readmeSource, /선택한 구성에 따라 아래 Skill이 추가돼요\./)
  assert.match(readmeSource, /- `backoffice-react`: `backoffice`를 같이 만들었을 때 들어가요\./)
  assert.match(
    readmeSource,
    /- `cloudflare-worker`, `supabase-project`, `firebase-functions`: 고른 `server` provider에 맞춰 들어가요\./,
  )
  assert.match(
    readmeSource,
    /- `trpc-boundary`: `cloudflare` 위에 `tRPC`를 올렸을 때 같이 들어가요\./,
  )
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
  const checkSkillsSource = await readFile(
    fileURLToPath(new URL('../../../scaffold-templates/root/check-skills.mjs', import.meta.url)),
    'utf8',
  )

  assert.doesNotMatch(frontendPolicySource, /frontend:policy:check/)
  assert.doesNotMatch(claudeSource, /skills:check/)
  assert.doesNotMatch(claudeSource, /skills:sync/)
  assert.doesNotMatch(checkSkillsSource, /skills:sync/)
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
  assert.equal(await pathExists(path.join(targetRoot, 'scripts', 'sync-skills.mjs')), true)
  assert.equal(await pathExists(path.join(targetRoot, 'scripts', 'check-skills.mjs')), true)
  assert.equal(packageJson.scripts?.verify, renderRootVerifyScript('pnpm'))
  assert.equal(
    packageJson.scripts?.['frontend:policy:check'],
    'node ./scripts/verify-frontend-routes.mjs',
  )
  assert.equal(packageJson.scripts?.['skills:sync'], 'node ./scripts/sync-skills.mjs')
  assert.equal(packageJson.scripts?.['skills:check'], 'node ./scripts/check-skills.mjs')
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
  assert.match(biomeJson, /TDS `Txt`/)
  assert.match(biomeJson, /docs\/engineering\/frontend-policy\.md/)
  assert.match(biomeJson, /\.agents\/skills\/tds-ui\/generated\/catalog\.json/)
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
  assert.match(reactNativeMessages[0]?.[1] ?? '', /TDS `Txt`/)
})

test('syncRootWorkspaceManifest normalizes package workspaces to packages/* in pnpm manifest', async (t) => {
  const targetRoot = await createTempTargetRoot(t)
  const tokens = createTokens('pnpm')

  await applyRootTemplates(targetRoot, tokens, ['frontend'])
  await syncRootWorkspaceManifest(targetRoot, 'pnpm', ['frontend', 'packages/contracts'])

  assert.equal(
    await readFile(path.join(targetRoot, 'pnpm-workspace.yaml'), 'utf8'),
    ['packages:', '  - frontend', '  - packages/*', ''].join('\n'),
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
  assert.equal(rootPackageJson.scripts?.['skills:sync'], 'node ./scripts/sync-skills.mjs')
  assert.equal(rootPackageJson.scripts?.['skills:check'], 'node ./scripts/check-skills.mjs')
  assert.equal(rootPackageJson.scripts?.verify, renderRootVerifyScript('pnpm'))
  assert.equal(await pathExists(path.join(targetRoot, 'scripts', 'sync-skills.mjs')), true)
  assert.equal(await pathExists(path.join(targetRoot, 'scripts', 'check-skills.mjs')), true)
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

test('applyDocsTemplates omits optional workspace and skill references for base-only workspaces', async (t) => {
  const targetRoot = await createTempTargetRoot(t)
  const tokens = createTokens('pnpm')

  await applyDocsTemplates(targetRoot, tokens, createDocsHints())

  const agents = await readFile(path.join(targetRoot, 'AGENTS.md'), 'utf8')
  const claude = await readFile(path.join(targetRoot, 'CLAUDE.md'), 'utf8')
  const copilot = await readFile(
    path.join(targetRoot, '.github', 'copilot-instructions.md'),
    'utf8',
  )
  const docsIndex = await readFile(path.join(targetRoot, 'docs', 'index.md'), 'utf8')
  const workspaceTopology = await readFile(
    path.join(targetRoot, 'docs', 'engineering', 'workspace-topology.md'),
    'utf8',
  )

  assert.match(agents, /Repository Contract/)
  assert.match(agents, /\.agents\/skills\/miniapp-capabilities\/SKILL\.md/)
  assert.match(agents, /\.agents\/skills\/granite-routing\/SKILL\.md/)
  assert.match(agents, /\.agents\/skills\/tds-ui\/SKILL\.md/)
  assert.doesNotMatch(agents, /\.agents\/skills\/miniapp\/SKILL\.md/)
  assert.doesNotMatch(agents, /\.agents\/skills\/granite\/SKILL\.md/)
  assert.doesNotMatch(agents, /\.agents\/skills\/tds\/SKILL\.md/)
  assert.doesNotMatch(agents, /optional provider workspace/)
  assert.doesNotMatch(agents, /backoffice React 작업/)
  assert.doesNotMatch(agents, /provider 운영 가이드/)
  assert.doesNotMatch(agents, /trRPC|tRPC boundary 변경/)
  assert.match(claude, /\.claude\/skills/)
  assert.match(copilot, /AGENTS\.md/)
  assert.match(docsIndex, /repo-contract\.md/)
  assert.match(docsIndex, /frontend-policy\.md/)
  assert.match(docsIndex, /workspace-topology\.md/)
  assert.doesNotMatch(docsIndex, /optional skills:/)
  assert.doesNotMatch(docsIndex, /cloudflare-worker/)
  assert.doesNotMatch(docsIndex, /backoffice-react/)
  assert.doesNotMatch(docsIndex, /trpc-boundary/)
  assert.doesNotMatch(docsIndex, /server-cloudflare|server-supabase|server-firebase/)
  assert.doesNotMatch(workspaceTopology, /optional provider workspace/)
  assert.doesNotMatch(workspaceTopology, /backoffice/)
  assert.doesNotMatch(workspaceTopology, /packages\/contracts/)
  assert.doesNotMatch(workspaceTopology, /import boundary:/)
  assert.doesNotMatch(workspaceTopology, /provider 운영 가이드/)
  assert.equal(
    await pathExists(path.join(targetRoot, 'docs', 'engineering', 'repo-contract.md')),
    true,
  )
  assert.equal(
    await pathExists(path.join(targetRoot, 'docs', 'engineering', 'frontend-policy.md')),
    true,
  )
  assert.equal(
    await pathExists(path.join(targetRoot, 'docs', 'engineering', 'workspace-topology.md')),
    true,
  )
  assert.equal(
    await pathExists(
      path.join(targetRoot, 'docs', 'engineering', 'appsintoss-granite-api-index.md'),
    ),
    false,
  )
  assert.equal(
    await pathExists(path.join(targetRoot, 'docs', 'engineering', 'granite-ssot.md')),
    false,
  )
})

test('applyDocsTemplates includes only the selected optional workspace and skill references', async (t) => {
  const targetRoot = await createTempTargetRoot(t)
  const tokens = createTokens('pnpm')
  await materializeDocsWorkspaceState(targetRoot, {
    hasBackoffice: true,
    hasServer: true,
    hasTrpc: true,
  })

  await applyDocsTemplates(targetRoot, tokens, createDocsHints({ serverProvider: 'cloudflare' }))

  const agents = await readFile(path.join(targetRoot, 'AGENTS.md'), 'utf8')
  const docsIndex = await readFile(path.join(targetRoot, 'docs', 'index.md'), 'utf8')
  const workspaceTopology = await readFile(
    path.join(targetRoot, 'docs', 'engineering', 'workspace-topology.md'),
    'utf8',
  )

  assert.match(agents, /- `server`: optional provider workspace/)
  assert.match(agents, /- `backoffice`: optional Vite 기반 운영 도구/)
  assert.match(agents, /packages\/contracts/)
  assert.match(agents, /cloudflare-worker\/SKILL\.md/)
  assert.match(agents, /backoffice-react\/SKILL\.md/)
  assert.match(agents, /trpc-boundary\/SKILL\.md/)
  assert.doesNotMatch(agents, /server-cloudflare\/SKILL\.md/)
  assert.doesNotMatch(agents, /server-supabase\/SKILL\.md/)
  assert.doesNotMatch(agents, /server-firebase\/SKILL\.md/)
  assert.doesNotMatch(agents, /supabase-project\/SKILL\.md/)
  assert.doesNotMatch(agents, /firebase-functions\/SKILL\.md/)
  assert.match(docsIndex, /optional skills:/)
  assert.match(docsIndex, /cloudflare-worker/)
  assert.match(docsIndex, /backoffice-react/)
  assert.match(docsIndex, /trpc-boundary/)
  assert.doesNotMatch(docsIndex, /server-cloudflare|server-supabase|server-firebase/)
  assert.doesNotMatch(docsIndex, /supabase-project/)
  assert.doesNotMatch(docsIndex, /firebase-functions/)
  assert.match(workspaceTopology, /- `server`: optional provider workspace/)
  assert.match(workspaceTopology, /- `backoffice`: optional Vite \+ React 운영 도구/)
  assert.match(
    workspaceTopology,
    /- `packages\/contracts`: optional tRPC boundary schema \/ type source/,
  )
  assert.match(
    workspaceTopology,
    /- `packages\/app-router`: optional tRPC router \/ `AppRouter` source/,
  )
  assert.match(workspaceTopology, /Cloudflare Worker 운영 가이드/)
  assert.doesNotMatch(workspaceTopology, /Cloudflare provider 운영 가이드/)
  assert.doesNotMatch(workspaceTopology, /Supabase 프로젝트 운영 가이드/)
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

  assert.match(workspaceTopology, /### backoffice/)
  assert.match(workspaceTopology, /Backoffice React workflow/)
  assert.doesNotMatch(workspaceTopology, /### server/)
  assert.doesNotMatch(workspaceTopology, /server runtime 구현을 직접 import하지 않는다/)
  assert.doesNotMatch(workspaceTopology, /backoffice ↔ server 직접 import 금지/)
  assert.doesNotMatch(workspaceTopology, /provider workspace가 값을 정의/)
})

test('applyDocsTemplates can rerender docs after optional workspaces are added later', async (t) => {
  const targetRoot = await createTempTargetRoot(t)
  const tokens = createTokens('pnpm')

  await applyDocsTemplates(targetRoot, tokens, createDocsHints())
  let agents = await readFile(path.join(targetRoot, 'AGENTS.md'), 'utf8')
  assert.doesNotMatch(agents, /cloudflare-worker\/SKILL\.md/)
  assert.doesNotMatch(agents, /backoffice React 작업/)

  await materializeDocsWorkspaceState(targetRoot, {
    hasBackoffice: true,
    hasServer: true,
  })
  await applyDocsTemplates(targetRoot, tokens, createDocsHints({ serverProvider: 'cloudflare' }))

  agents = await readFile(path.join(targetRoot, 'AGENTS.md'), 'utf8')
  const docsIndex = await readFile(path.join(targetRoot, 'docs', 'index.md'), 'utf8')

  assert.match(agents, /cloudflare-worker\/SKILL\.md/)
  assert.match(agents, /backoffice-react\/SKILL\.md/)
  assert.doesNotMatch(agents, /trpc-boundary\/SKILL\.md/)
  assert.match(docsIndex, /cloudflare-worker/)
  assert.match(docsIndex, /backoffice-react/)
  assert.doesNotMatch(docsIndex, /trpc-boundary/)
})

test('syncGeneratedSkills copies core skills, selected optional skills, and the claude mirror', async (t) => {
  const targetRoot = await createTempTargetRoot(t)
  const tokens = createTokens('yarn')

  await applyRootTemplates(targetRoot, tokens, ['frontend', 'backoffice', 'server'])
  await materializeDocsWorkspaceState(targetRoot, {
    hasBackoffice: true,
    hasServer: true,
  })
  await syncGeneratedSkills(targetRoot, tokens, createDocsHints({ serverProvider: 'firebase' }))

  const checkResult = spawnSync(process.execPath, ['./scripts/check-skills.mjs'], {
    cwd: targetRoot,
    encoding: 'utf8',
  })

  assert.equal(checkResult.status, 0, checkResult.stderr)
  assert.equal(
    await pathExists(
      path.join(targetRoot, '.agents', 'skills', 'miniapp-capabilities', 'SKILL.md'),
    ),
    true,
  )
  assert.equal(
    await pathExists(path.join(targetRoot, '.agents', 'skills', 'backoffice-react', 'SKILL.md')),
    true,
  )
  assert.equal(
    await pathExists(path.join(targetRoot, '.agents', 'skills', 'firebase-functions', 'SKILL.md')),
    true,
  )
  assert.equal(
    await pathExists(path.join(targetRoot, '.agents', 'skills', 'supabase-project', 'SKILL.md')),
    false,
  )
  assert.equal(
    await pathExists(path.join(targetRoot, '.claude', 'skills', 'firebase-functions', 'SKILL.md')),
    true,
  )
  assert.equal(
    await readFile(
      path.join(
        targetRoot,
        '.agents',
        'skills',
        'miniapp-capabilities',
        'references',
        'feature-map.md',
      ),
      'utf8',
    ),
    await readFile(
      path.join(
        targetRoot,
        '.claude',
        'skills',
        'miniapp-capabilities',
        'references',
        'feature-map.md',
      ),
      'utf8',
    ),
  )
  assert.equal(
    await pathExists(path.join(targetRoot, '.agents', 'skills', 'tds-ui', 'AGENTS.md')),
    true,
  )
  assert.equal(
    await pathExists(
      path.join(targetRoot, '.agents', 'skills', 'tds-ui', 'generated', 'catalog.json'),
    ),
    true,
  )
  assert.equal(
    await pathExists(
      path.join(targetRoot, '.agents', 'skills', 'tds-ui', 'generated', 'anomalies.json'),
    ),
    true,
  )
  assert.equal(
    await pathExists(
      path.join(targetRoot, '.agents', 'skills', 'tds-ui', 'references', 'decision-matrix.md'),
    ),
    true,
  )
  assert.equal(
    await pathExists(
      path.join(targetRoot, '.agents', 'skills', 'tds-ui', 'rules', 'export-only-gated.md'),
    ),
    true,
  )
  assert.equal(
    await pathExists(
      path.join(targetRoot, '.agents', 'skills', 'tds-ui', 'scripts', 'ensure-fresh.mjs'),
    ),
    true,
  )
  assert.equal(
    await pathExists(
      path.join(targetRoot, '.claude', 'skills', 'tds-ui', 'scripts', 'refresh-catalog.mjs'),
    ),
    true,
  )

  const syncedTdsSkill = await readFile(
    path.join(targetRoot, '.agents', 'skills', 'tds-ui', 'SKILL.md'),
    'utf8',
  )
  const syncedCatalog = JSON.parse(
    await readFile(
      path.join(targetRoot, '.agents', 'skills', 'tds-ui', 'generated', 'catalog.json'),
      'utf8',
    ),
  ) as Array<{ name: string; cluster: string }>

  assert.match(syncedTdsSkill, /generated\/catalog\.json/)
  assert.match(syncedTdsSkill, /generated\/anomalies\.json/)
  assert.match(syncedTdsSkill, /node scripts\/ensure-fresh\.mjs/)
  assert.ok(
    syncedCatalog.some(
      (entry) => entry.name === 'search-field' && entry.cluster === 'input-choice',
    ),
  )
  assert.ok(
    syncedCatalog.some(
      (entry) => entry.name === 'agreement' && entry.cluster === 'guarded-export-only',
    ),
  )
})

test('syncGeneratedSkills selects the provider and trpc skills without leaving stale entries', async (t) => {
  const targetRoot = await createTempTargetRoot(t)
  const tokens = createTokens('pnpm')
  await materializeDocsWorkspaceState(targetRoot, {
    hasServer: true,
    hasTrpc: true,
  })

  await syncGeneratedSkills(targetRoot, tokens, createDocsHints({ serverProvider: 'cloudflare' }))

  assert.equal(
    await pathExists(path.join(targetRoot, '.agents', 'skills', 'cloudflare-worker', 'SKILL.md')),
    true,
  )
  assert.equal(
    await pathExists(path.join(targetRoot, '.agents', 'skills', 'trpc-boundary', 'SKILL.md')),
    true,
  )
  assert.equal(
    await pathExists(path.join(targetRoot, '.agents', 'skills', 'supabase-project', 'SKILL.md')),
    false,
  )
  assert.equal(
    await pathExists(path.join(targetRoot, '.claude', 'skills', 'trpc-boundary', 'SKILL.md')),
    true,
  )

  const cloudflareSkill = await readFile(
    path.join(targetRoot, '.agents', 'skills', 'cloudflare-worker', 'SKILL.md'),
    'utf8',
  )

  assert.match(cloudflareSkill, /Use when/i)
  assert.match(cloudflareSkill, /Do not use for/i)
  assert.match(cloudflareSkill, /state\.json/)
  assert.equal(
    await pathExists(
      path.join(targetRoot, '.agents', 'skills', 'cloudflare-worker', 'references', 'overview.md'),
    ),
    true,
  )
  assert.equal(
    await pathExists(
      path.join(targetRoot, '.agents', 'skills', 'cloudflare-worker', 'references', 'local-dev.md'),
    ),
    true,
  )
  assert.equal(
    await pathExists(
      path.join(
        targetRoot,
        '.agents',
        'skills',
        'cloudflare-worker',
        'references',
        'client-connection.md',
      ),
    ),
    true,
  )
  assert.equal(
    await pathExists(
      path.join(
        targetRoot,
        '.agents',
        'skills',
        'cloudflare-worker',
        'references',
        'troubleshooting.md',
      ),
    ),
    true,
  )
  assert.equal(
    await pathExists(
      path.join(
        targetRoot,
        '.agents',
        'skills',
        'cloudflare-worker',
        'references',
        'provider-guide.md',
      ),
    ),
    false,
  )
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
  assert.equal(serverPackageJson.scripts?.dev, 'yarn dlx supabase start --workdir .')
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
    'yarn dlx supabase functions serve --env-file ./.env.local --workdir .',
  )
  assert.equal(
    serverPackageJson.scripts?.['functions:deploy'],
    'node ./scripts/supabase-functions-deploy.mjs',
  )
  assert.equal(
    serverPackageJson.scripts?.['db:apply:local'],
    'yarn dlx supabase db push --local --workdir .',
  )
  assert.equal(
    serverPackageJson.scripts?.['db:reset'],
    'yarn dlx supabase db reset --local --workdir .',
  )
  assert.match(serverDbApplyScript, /SUPABASE_DB_PASSWORD/)
  assert.match(serverDbApplyScript, /baseArgs = \["dlx","supabase","db","push"/)
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
  assert.match(serverFunctionsDeployScript, /baseArgs = \["dlx","supabase","functions","deploy"/)
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
  assert.equal(serverPackageJson.scripts?.dev, 'npx supabase start --workdir .')
  assert.equal(
    serverPackageJson.scripts?.['functions:serve'],
    'npx supabase functions serve --env-file ./.env.local --workdir .',
  )
  assert.equal(
    serverPackageJson.scripts?.['db:apply:local'],
    'npx supabase db push --local --workdir .',
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
  assert.equal(serverPackageJson.scripts?.dev, 'bunx supabase start --workdir .')
  assert.equal(
    serverPackageJson.scripts?.['functions:serve'],
    'bunx supabase functions serve --env-file ./.env.local --workdir .',
  )
  assert.equal(
    serverPackageJson.scripts?.['db:apply:local'],
    'bunx supabase db push --local --workdir .',
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
  assert.match(serverFirestoreRules, /rules_version = '2'/)
  assert.deepEqual(serverFirestoreIndexes.indexes, [])
  assert.deepEqual(serverFirestoreIndexes.fieldOverrides, [])
  assert.match(functionEntry, /region: 'us-central1'/)
  assert.match(functionEntry, /export const getPublicStatus = onCall/)
  assert.match(functionEntry, /normalizedPath === '\/public-status'/)
  assert.match(publicStatusSource, /buildPublicAppStatusDocument/)
  assert.match(seedPublicStatusSource, /function stripWrappingQuotes\(value: string\)/)
  assert.match(seedPublicStatusSource, /function loadLocalEnv\(filePath: string\)/)
  assert.match(seedPublicStatusSource, /const result: Record<string, string> = \{\}/)
  assert.match(seedPublicStatusSource, /FIREBASE_PROJECT_ID is required/)
  assert.doesNotMatch(functionEntry, new RegExp(FIREBASE_DEFAULT_FUNCTION_REGION))
  assert.match(deployScript, /FIREBASE_PROJECT_ID/)
  assert.match(deployScript, /functions,firestore:rules,firestore:indexes/)
  assert.match(deployScript, /--only/)
  assert.match(deployScript, /FIREBASE_TOKEN/)
  assert.match(deployScript, /GOOGLE_APPLICATION_CREDENTIALS/)
  assert.match(deployScript, /firebase-tools/)
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

  await applyRootTemplates(pnpmRoot, createTokens('pnpm'), ['frontend'])
  await applyRootTemplates(yarnRoot, createTokens('yarn'), ['frontend'])
  await applyRootTemplates(npmRoot, createTokens('npm'), ['frontend'])
  await applyRootTemplates(bunRoot, createTokens('bun'), ['frontend'])

  await syncRootWorkspaceManifest(pnpmRoot, 'pnpm', [
    'frontend',
    'server',
    'packages/contracts',
    'packages/app-router',
  ])
  await syncRootWorkspaceManifest(yarnRoot, 'yarn', [
    'frontend',
    'backoffice',
    'packages/contracts',
    'packages/app-router',
  ])
  await syncRootWorkspaceManifest(npmRoot, 'npm', [
    'frontend',
    'server',
    'packages/contracts',
    'packages/app-router',
  ])
  await syncRootWorkspaceManifest(bunRoot, 'bun', [
    'frontend',
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

  assert.equal(pnpmWorkspaceManifest, 'packages:\n  - frontend\n  - server\n  - packages/*\n')
  assert.deepEqual(yarnPackageJson.workspaces, ['frontend', 'packages/*', 'backoffice'])
  assert.deepEqual(npmPackageJson.workspaces, ['frontend', 'server', 'packages/*'])
  assert.deepEqual(bunPackageJson.workspaces, ['frontend', 'packages/*', 'backoffice'])
})
