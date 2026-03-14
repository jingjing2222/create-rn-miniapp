import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import {
  applyServerPackageTemplate,
  applyWorkspaceProjectTemplate,
  pathExists,
  removePathIfExists,
  type TemplateTokens,
} from './templates.js'

const TOOLING_FILES = [
  'biome.json',
  '.biome.json',
  'eslint.config.js',
  '.eslintrc',
  '.eslintrc.js',
  '.eslintrc.cjs',
  '.eslintrc.json',
  '.prettierrc',
  '.prettierrc.js',
  '.prettierrc.cjs',
  '.prettierrc.json',
  'prettier.config.js',
  'prettier.config.cjs',
  'prettier.config.mjs',
  'pnpm-lock.yaml',
] as const

const TOOLING_DEPENDENCIES = [
  '@biomejs/biome',
  '@eslint/js',
  'eslint',
  'eslint-config-prettier',
  'eslint-plugin-react',
  'eslint-plugin-react-hooks',
  'eslint-plugin-react-refresh',
  'typescript-eslint',
  'prettier',
] as const

const WORKSPACE_ARTIFACTS = ['node_modules'] as const

type PackageJson = {
  name?: string
  scripts?: Record<string, string>
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
}

async function readPackageJson(packageJsonPath: string) {
  return JSON.parse(await readFile(packageJsonPath, 'utf8')) as PackageJson
}

async function writePackageJson(packageJsonPath: string, packageJson: PackageJson) {
  await writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`, 'utf8')
}

function stripJsonComments(source: string) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '')
}

async function normalizeJsonFile(filePath: string) {
  if (!(await pathExists(filePath))) {
    return
  }

  const source = await readFile(filePath, 'utf8')
  const parsed = JSON.parse(stripJsonComments(source)) as unknown
  await writeFile(filePath, `${JSON.stringify(parsed, null, 2)}\n`, 'utf8')
}

function stripToolingFromPackageJson(packageJson: PackageJson) {
  for (const scriptName of ['lint', 'lint:fix', 'format', 'format:check']) {
    delete packageJson.scripts?.[scriptName]
  }

  for (const dependencyName of TOOLING_DEPENDENCIES) {
    delete packageJson.dependencies?.[dependencyName]
    delete packageJson.devDependencies?.[dependencyName]
  }

  return packageJson
}

async function removeToolingFiles(workspaceRoot: string) {
  await Promise.all(
    TOOLING_FILES.map((fileName) => removePathIfExists(path.join(workspaceRoot, fileName))),
  )
}

async function removeWorkspaceArtifacts(workspaceRoot: string) {
  await Promise.all(
    WORKSPACE_ARTIFACTS.map((fileName) => removePathIfExists(path.join(workspaceRoot, fileName))),
  )
}

async function patchGraniteConfig(frontendRoot: string, tokens: TemplateTokens) {
  const graniteConfigPath = path.join(frontendRoot, 'granite.config.ts')

  if (!(await pathExists(graniteConfigPath))) {
    return
  }

  const source = await readFile(graniteConfigPath, 'utf8')
  const next = source
    .replace(/appName:\s*['"`][^'"`]+['"`]/, `appName: '${tokens.appName}'`)
    .replace(/displayName:\s*['"`][^'"`]+['"`]/, `displayName: '${tokens.displayName}'`)
    .replace(
      /displayName:\s*['"`][^'"`]+['"`],\s*\/\/ 화면에 노출될 앱의 한글 이름으로 바꿔주세요\./,
      `displayName: '${tokens.displayName}',`,
    )
    .replace(
      /icon:\s*null,?\s*\/\/ 화면에 노출될 앱의 아이콘 이미지 주소로 바꿔주세요\./,
      `icon: '',`,
    )
    .replace(/icon:\s*null/, `icon: ''`)

  await writeFile(graniteConfigPath, next, 'utf8')
}

async function patchBackofficeEntryFiles(backofficeRoot: string) {
  const mainPath = path.join(backofficeRoot, 'src', 'main.tsx')
  const appPath = path.join(backofficeRoot, 'src', 'App.tsx')

  if (await pathExists(mainPath)) {
    const source = await readFile(mainPath, 'utf8')
    const next = source.replace(
      /createRoot\(document\.getElementById\('root'\)!\)\.render\(/,
      [
        "const rootElement = document.getElementById('root')",
        '',
        'if (!rootElement) {',
        "  throw new Error('Root element not found')",
        '}',
        '',
        'createRoot(rootElement).render(',
      ].join('\n'),
    )

    await writeFile(mainPath, next, 'utf8')
  }

  if (await pathExists(appPath)) {
    const source = await readFile(appPath, 'utf8')
    const next = source.replace(
      /<button\s+className="counter"/,
      '<button type="button" className="counter"',
    )
    await writeFile(appPath, next, 'utf8')
  }
}

export async function patchFrontendWorkspace(targetRoot: string, tokens: TemplateTokens) {
  const frontendRoot = path.join(targetRoot, 'frontend')
  const packageJsonPath = path.join(frontendRoot, 'package.json')
  const packageJson = stripToolingFromPackageJson(await readPackageJson(packageJsonPath))

  packageJson.name = 'frontend'
  packageJson.scripts ??= {}
  packageJson.scripts.typecheck ??= 'tsc --noEmit'
  packageJson.scripts.test ??= `node -e "console.log('frontend test placeholder')"`

  await writePackageJson(packageJsonPath, packageJson)
  await removeToolingFiles(frontendRoot)
  await removeWorkspaceArtifacts(frontendRoot)
  await patchGraniteConfig(frontendRoot, tokens)
  await applyWorkspaceProjectTemplate(targetRoot, 'frontend', tokens)
}

export async function patchBackofficeWorkspace(targetRoot: string, tokens: TemplateTokens) {
  const backofficeRoot = path.join(targetRoot, 'backoffice')
  const packageJsonPath = path.join(backofficeRoot, 'package.json')
  const packageJson = stripToolingFromPackageJson(await readPackageJson(packageJsonPath))

  packageJson.name = 'backoffice'
  packageJson.scripts ??= {}
  packageJson.scripts.typecheck = 'tsc -b --pretty false'
  packageJson.scripts.test ??= `node -e "console.log('backoffice test placeholder')"`

  await writePackageJson(packageJsonPath, packageJson)
  await normalizeJsonFile(path.join(backofficeRoot, 'tsconfig.json'))
  await normalizeJsonFile(path.join(backofficeRoot, 'tsconfig.app.json'))
  await normalizeJsonFile(path.join(backofficeRoot, 'tsconfig.node.json'))
  await patchBackofficeEntryFiles(backofficeRoot)
  await removeToolingFiles(backofficeRoot)
  await removeWorkspaceArtifacts(backofficeRoot)
  await applyWorkspaceProjectTemplate(targetRoot, 'backoffice', tokens)
}

export async function patchServerWorkspace(targetRoot: string, tokens: TemplateTokens) {
  await applyServerPackageTemplate(targetRoot, tokens)
  await removeWorkspaceArtifacts(path.join(targetRoot, 'server'))
  await applyWorkspaceProjectTemplate(targetRoot, 'server', tokens)
}

export function createRootPackageName(appName: string) {
  return `${appName}-workspace`
}
