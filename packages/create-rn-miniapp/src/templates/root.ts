import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { patchRootPackageJsonSource } from '../patching/package-json.js'
import { getPackageManagerAdapter, type PackageManager } from '../runtime/package-manager.js'
import {
  normalizeRootWorkspacePatterns,
  renderPnpmWorkspaceManifest,
} from '../workspace/root-workspaces.js'
import {
  resolveFrontendPolicyRuleSet,
  renderFrontendPolicyVerifierSource,
} from './frontend-policy.js'
import {
  copyFileWithTokens,
  pathExists,
  resolveTemplatesPackageRoot,
  replaceTemplateTokens,
} from './filesystem.js'
import {
  createRootHelperScriptExtraTokens,
  FRONTEND_POLICY_CHECK_SCRIPT_COMMAND,
  FRONTEND_POLICY_CHECK_SCRIPT_NAME,
  ROOT_VERIFY_STEP_SCRIPT_NAMES,
} from './root-script-catalog.js'
import type { RootWorkspacePattern, TemplateTokens } from './types.js'

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
    ...createRootHelperScriptExtraTokens(packageManager),
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
    [FRONTEND_POLICY_CHECK_SCRIPT_NAME]: FRONTEND_POLICY_CHECK_SCRIPT_COMMAND,
    verify: renderRootVerifyScript(packageManager),
  }
}

function renderRootBiomeSource(adapter: ReturnType<typeof getPackageManagerAdapter>) {
  const policyRules = resolveFrontendPolicyRuleSet()

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
                  '@react-native-async-storage/async-storage': policyRules.asyncStorageMessage,
                  '@granite-js/native/@react-native-async-storage/async-storage':
                    policyRules.asyncStorageMessage,
                  'react-native': {
                    message: policyRules.reactNativeMessage,
                    importNames: policyRules.reactNativeImportNames,
                  },
                },
                patterns: policyRules.nativeImportPatterns,
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

async function resolvePreservedRootBiomeIncludes(
  targetRoot: string,
  packageManager: PackageManager,
) {
  const biomePath = path.join(targetRoot, 'biome.json')

  if (!(await pathExists(biomePath))) {
    return [] as string[]
  }

  const adapter = getPackageManagerAdapter(packageManager)
  const biomeJson = JSON.parse(await readFile(biomePath, 'utf8')) as {
    files?: {
      includes?: string[]
    }
  }
  const existingIncludes = biomeJson.files?.includes ?? []

  return existingIncludes.filter((entry) => !adapter.rootBiomeIncludes.includes(entry))
}

async function syncRootFrontendPolicyArtifacts(targetRoot: string, packageManager: PackageManager) {
  const packageManagerAdapter = getPackageManagerAdapter(packageManager)
  const preservedBiomeIncludes = await resolvePreservedRootBiomeIncludes(targetRoot, packageManager)

  await mkdir(path.join(targetRoot, 'scripts'), { recursive: true })
  await writeFile(
    path.join(targetRoot, 'scripts', 'verify-frontend-routes.mjs'),
    renderFrontendPolicyVerifierSource(),
    'utf8',
  )
  await writeFile(
    path.join(targetRoot, 'biome.json'),
    renderRootBiomeSource({
      ...packageManagerAdapter,
      rootBiomeIncludes: [...packageManagerAdapter.rootBiomeIncludes, ...preservedBiomeIncludes],
    }),
    'utf8',
  )
}

export async function syncRootWorkspaceManifest(
  targetRoot: string,
  packageManager: PackageManager,
  workspaces: RootWorkspacePattern[],
) {
  const adapter = getPackageManagerAdapter(packageManager)
  const normalizedWorkspaces = normalizeRootWorkspacePatterns(workspaces)

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
  workspaces: RootWorkspacePattern[],
) {
  const templatesRoot = resolveTemplatesPackageRoot()
  const rootTemplateDir = path.join(templatesRoot, 'root')
  const packageManager = getPackageManagerAdapter(tokens.packageManager)
  const normalizedWorkspaces = normalizeRootWorkspacePatterns(workspaces)
  const extraTokens = createRootTemplateExtraTokens(tokens.packageManager)

  const fileMappings = [['nx.json', 'nx.json']] as const

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
  await syncRootFrontendPolicyArtifacts(targetRoot, tokens.packageManager)

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

export async function syncRootFrontendPolicyFiles(
  targetRoot: string,
  packageManager: PackageManager,
) {
  await syncRootFrontendPolicyArtifacts(targetRoot, packageManager)
}
