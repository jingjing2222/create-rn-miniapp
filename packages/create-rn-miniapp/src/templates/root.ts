import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { patchRootPackageJsonSource } from '../patching/package-json.js'
import { getPackageManagerAdapter, type PackageManager } from '../package-manager.js'
import {
  copyFileWithTokens,
  resolveTemplatesPackageRoot,
  replaceTemplateTokens,
} from './filesystem.js'
import type { TemplateTokens, WorkspaceName } from './types.js'

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
const ROOT_BIOME_REACT_NATIVE_MESSAGE =
  '`react-native` 기본 UI 컴포넌트는 바로 쓰지 말고 TDS나 Granite가 제공하는 컴포넌트를 먼저 써 주세요. 특히 `Text` 대신 TDS `Txt`를 써 주세요. `Pressable`이 정말 필요하면 `biome-ignore`에 이유를 같이 남겨 주세요. 먼저 `.agents/skills/core/tds/references/catalog.md`와 `docs/engineering/frontend-policy.md`를 확인해 주세요.'
const NORMALIZED_PACKAGE_WORKSPACE = 'packages/*' as const
const NORMALIZED_ROOT_WORKSPACE_ORDER = [
  'frontend',
  'server',
  NORMALIZED_PACKAGE_WORKSPACE,
  'backoffice',
] as const

type NormalizedRootWorkspaceName = (typeof NORMALIZED_ROOT_WORKSPACE_ORDER)[number]

export const ROOT_VERIFY_STEPS_TOKEN = '{{rootVerifyStepsMarkdown}}'

function resolveRootVerifyStepCommands(packageManager: PackageManager) {
  const adapter = getPackageManagerAdapter(packageManager)
  return ROOT_VERIFY_STEP_SCRIPT_NAMES.map((scriptName) => adapter.runScript(scriptName))
}

export function renderRootVerifyScript(packageManager: PackageManager) {
  return resolveRootVerifyStepCommands(packageManager).join(' && ')
}

export function renderRootVerifyStepsMarkdown(packageManager: PackageManager) {
  return resolveRootVerifyStepCommands(packageManager)
    .map((command) => `- \`${command}\``)
    .join('\n')
}

export function createRootTemplateExtraTokens(packageManager: PackageManager) {
  return {
    [ROOT_VERIFY_STEPS_TOKEN]: renderRootVerifyStepsMarkdown(packageManager),
  }
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
  const extraTokens = createRootTemplateExtraTokens(tokens.packageManager)

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
      extraTokens,
    )
  }

  for (const rootTemplateFile of packageManager.rootTemplateFiles) {
    await copyFileWithTokens(
      path.join(rootTemplateDir, rootTemplateFile.sourceName),
      path.join(targetRoot, rootTemplateFile.targetName),
      tokens,
      extraTokens,
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
    extraTokens,
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
    await copyFileWithTokens(
      path.join(rootTemplateDir, extraRootFile.sourceName),
      path.join(targetRoot, extraRootFile.targetName),
      tokens,
      extraTokens,
    )
  }
}
