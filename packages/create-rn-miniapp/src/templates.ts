import { createRequire } from 'node:module'
import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'

export type TemplateTokens = {
  appName: string
  displayName: string
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

export async function applyRootTemplates(targetRoot: string, tokens: TemplateTokens) {
  const templatesRoot = resolveTemplatesPackageRoot()
  const rootTemplateDir = path.join(templatesRoot, 'root')

  const fileMappings = [
    ['gitignore', '.gitignore'],
    ['package.json', 'package.json'],
    ['pnpm-workspace.yaml', 'pnpm-workspace.yaml'],
    ['nx.json', 'nx.json'],
    ['biome.json', 'biome.json'],
    ['tsconfig.base.json', 'tsconfig.base.json'],
  ] as const

  for (const [sourceName, targetName] of fileMappings) {
    await copyFileWithTokens(
      path.join(rootTemplateDir, sourceName),
      path.join(targetRoot, targetName),
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
  await copyFileWithTokens(
    path.join(templatesRoot, 'root', templateName),
    path.join(targetRoot, workspace, 'project.json'),
    tokens,
  )
}

export async function applyServerPackageTemplate(targetRoot: string, tokens: TemplateTokens) {
  const templatesRoot = resolveTemplatesPackageRoot()
  await copyFileWithTokens(
    path.join(templatesRoot, 'root', 'server.package.json'),
    path.join(targetRoot, 'server', 'package.json'),
    tokens,
  )
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
