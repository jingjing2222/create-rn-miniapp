import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import { getPackageManagerAdapter } from '../package-manager.js'
import type { TemplateTokens } from './types.js'

const NPMRC_SOURCE = 'legacy-peer-deps=true\n'
const BINARY_TEMPLATE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif'])
const require = createRequire(import.meta.url)

export type TemplateReplacementTokens = Record<string, string>

export type CopyDirectoryWithTokensOptions = {
  relativeDir?: string
  skipRelativePaths?: Set<string>
  extraTokens?: TemplateReplacementTokens
}

export function resolveTemplatesPackageRoot() {
  const packageJsonPath = require.resolve('@create-rn-miniapp/scaffold-templates/package.json')
  return path.dirname(packageJsonPath)
}

export function resolveSkillsPackageRoot() {
  const packageJsonPath = require.resolve('@create-rn-miniapp/scaffold-skills/package.json')
  return path.dirname(packageJsonPath)
}

export function replaceTemplateTokens(
  source: string,
  tokens: TemplateTokens,
  extraTokens: TemplateReplacementTokens = {},
) {
  const packageManagerField =
    tokens.packageManagerField ??
    getPackageManagerAdapter(tokens.packageManager).packageManagerField

  let rendered = source
    .replaceAll('{{appName}}', tokens.appName)
    .replaceAll('{{displayName}}', tokens.displayName)
    .replaceAll('{{packageManager}}', tokens.packageManager)
    .replaceAll('{{packageManagerField}}', packageManagerField)
    .replaceAll('{{packageManagerCommand}}', tokens.packageManagerCommand)
    .replaceAll('{{packageManagerRunCommand}}', tokens.packageManagerRunCommand)
    .replaceAll('{{packageManagerExecCommand}}', tokens.packageManagerExecCommand)
    .replaceAll('{{verifyCommand}}', tokens.verifyCommand)

  for (const [key, value] of Object.entries(extraTokens)) {
    rendered = rendered.replaceAll(key, value)
  }

  return rendered
}

export async function copyFileWithTokens(
  sourcePath: string,
  targetPath: string,
  tokens: TemplateTokens,
  extraTokens: TemplateReplacementTokens = {},
) {
  if (BINARY_TEMPLATE_EXTENSIONS.has(path.extname(sourcePath).toLowerCase())) {
    await mkdir(path.dirname(targetPath), { recursive: true })
    await cp(sourcePath, targetPath)
    return
  }

  const contents = await readFile(sourcePath, 'utf8')
  await mkdir(path.dirname(targetPath), { recursive: true })
  await writeFile(targetPath, replaceTemplateTokens(contents, tokens, extraTokens), 'utf8')
}

export async function copyDirectoryWithTokens(
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

    await copyFileWithTokens(sourcePath, targetPath, tokens, options?.extraTokens)
  }
}

export async function readJsonTemplate<T>(
  sourcePath: string,
  tokens: TemplateTokens,
  extraTokens: TemplateReplacementTokens = {},
) {
  const contents = replaceTemplateTokens(await readFile(sourcePath, 'utf8'), tokens, extraTokens)
  return JSON.parse(contents) as T
}

export async function writeJsonFile(targetPath: string, value: unknown) {
  await mkdir(path.dirname(targetPath), { recursive: true })
  await writeFile(targetPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

export async function writeWorkspaceNpmrc(targetRoot: string) {
  await mkdir(targetRoot, { recursive: true })
  await writeFile(path.join(targetRoot, '.npmrc'), NPMRC_SOURCE, 'utf8')
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
