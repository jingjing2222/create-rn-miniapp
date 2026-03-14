import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import { patchRootPackageJsonSource } from './ast.js'
import { getPackageManagerAdapter, type PackageManager } from './package-manager.js'

export type TemplateTokens = {
  appName: string
  displayName: string
  packageManager: PackageManager
  packageManagerCommand: string
  packageManagerExecCommand: string
  verifyCommand: string
}

type WorkspaceProjectJson = {
  targets?: Record<string, { command?: string }>
}

type ServerPackageJson = {
  scripts?: Record<string, string>
}

const require = createRequire(import.meta.url)

function resolveTemplatesPackageRoot() {
  const packageJsonPath = require.resolve('@create-rn-miniapp/scaffold-templates/package.json')
  return path.dirname(packageJsonPath)
}

function replaceTemplateTokens(source: string, tokens: TemplateTokens) {
  return source
    .replaceAll('{{appName}}', tokens.appName)
    .replaceAll('{{displayName}}', tokens.displayName)
    .replaceAll('{{packageManager}}', tokens.packageManager)
    .replaceAll('{{packageManagerCommand}}', tokens.packageManagerCommand)
    .replaceAll('{{packageManagerExecCommand}}', tokens.packageManagerExecCommand)
    .replaceAll('{{verifyCommand}}', tokens.verifyCommand)
}

async function copyFileWithTokens(sourcePath: string, targetPath: string, tokens: TemplateTokens) {
  const contents = await readFile(sourcePath, 'utf8')
  await mkdir(path.dirname(targetPath), { recursive: true })
  await writeFile(targetPath, replaceTemplateTokens(contents, tokens), 'utf8')
}

async function copyDirectoryWithTokens(
  sourceDir: string,
  targetDir: string,
  tokens: TemplateTokens,
) {
  const entries = await readdir(sourceDir, { withFileTypes: true })

  await mkdir(targetDir, { recursive: true })

  for (const entry of entries) {
    const sourcePath = path.join(sourceDir, entry.name)
    const targetPath = path.join(targetDir, entry.name)

    if (entry.isDirectory()) {
      await copyDirectoryWithTokens(sourcePath, targetPath, tokens)
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

export async function applyRootTemplates(targetRoot: string, tokens: TemplateTokens) {
  const templatesRoot = resolveTemplatesPackageRoot()
  const rootTemplateDir = path.join(templatesRoot, 'root')
  const packageManager = getPackageManagerAdapter(tokens.packageManager)

  const fileMappings = [
    ['nx.json', 'nx.json'],
    ['tsconfig.base.json', 'tsconfig.base.json'],
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

  const rootPackageJsonSource = replaceTemplateTokens(
    await readFile(path.join(rootTemplateDir, 'package.json'), 'utf8'),
    tokens,
  )
  const nextRootPackageJsonSource = patchRootPackageJsonSource(rootPackageJsonSource, {
    packageManagerField: packageManager.packageManagerField,
    scripts: {
      build: 'nx run-many -t build --all',
      typecheck: 'nx run-many -t typecheck --all',
      test: 'nx run-many -t test --all',
      format: packageManager.rootFormatScript(),
      'format:check': packageManager.rootFormatCheckScript(),
      lint: packageManager.rootLintScript(),
      verify: packageManager.rootVerifyScript(),
    },
    workspaces:
      packageManager.workspaceManifestFile === null ? ['frontend', 'server', 'backoffice'] : null,
  })

  await mkdir(targetRoot, { recursive: true })
  await writeFile(path.join(targetRoot, 'package.json'), nextRootPackageJsonSource, 'utf8')

  if (packageManager.workspaceManifestFile) {
    await copyOptionalTemplateFile(
      path.join(rootTemplateDir, packageManager.workspaceManifestFile),
      path.join(targetRoot, packageManager.workspaceManifestFile),
      tokens,
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

export async function applyDocsTemplates(targetRoot: string, tokens: TemplateTokens) {
  const templatesRoot = resolveTemplatesPackageRoot()
  const baseTemplateDir = path.join(templatesRoot, 'base')

  await copyFileWithTokens(
    path.join(baseTemplateDir, 'AGENTS.md'),
    path.join(targetRoot, 'AGENTS.md'),
    tokens,
  )
  await copyDirectoryWithTokens(
    path.join(baseTemplateDir, 'docs'),
    path.join(targetRoot, 'docs'),
    tokens,
  )
}

export async function applyWorkspaceProjectTemplate(
  targetRoot: string,
  workspace: 'frontend' | 'backoffice' | 'server',
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
  const packageManager = getPackageManagerAdapter(tokens.packageManager)
  const packageJson = await readJsonTemplate<ServerPackageJson>(
    path.join(templatesRoot, 'root', 'server.package.json'),
    tokens,
  )

  packageJson.scripts ??= {}
  packageJson.scripts.dev = `${packageManager.runScript('dlx')} supabase start --workdir .`
  packageJson.scripts.build = packageManager.runScript('typecheck')
  packageJson.scripts['db:reset'] =
    `${packageManager.runScript('dlx')} supabase db reset --local --workdir .`
  packageJson.scripts['db:apply'] =
    `${packageManager.runScript('dlx')} supabase db push --local --workdir .`

  await writeJsonFile(path.join(targetRoot, 'server', 'package.json'), packageJson)
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
