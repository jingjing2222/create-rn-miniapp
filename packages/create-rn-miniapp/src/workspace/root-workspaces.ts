import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { parse as parseJsonc } from 'jsonc-parser'
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml'
import { pathExists } from '../templates/filesystem.js'
import type { RootWorkspacePattern } from '../templates/types.js'

const NORMALIZED_PACKAGE_WORKSPACE = 'packages/*' as const

type RootPackageJson = {
  workspaces?: string[] | { packages?: string[] }
}

type PnpmWorkspaceManifest = {
  packages?: string[]
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function normalizeRootWorkspacePattern(workspace: RootWorkspacePattern) {
  const trimmedWorkspace = workspace.trim()

  if (
    trimmedWorkspace === NORMALIZED_PACKAGE_WORKSPACE ||
    trimmedWorkspace.startsWith('packages/')
  ) {
    return NORMALIZED_PACKAGE_WORKSPACE
  }

  return trimmedWorkspace
}

function readPackageJsonWorkspacePatterns(source: string): RootWorkspacePattern[] {
  const packageJson = parseJsonc(source) as RootPackageJson | undefined
  const workspaceValue = packageJson?.workspaces

  if (Array.isArray(workspaceValue)) {
    return workspaceValue.filter(isNonEmptyString)
  }

  if (Array.isArray(workspaceValue?.packages)) {
    return workspaceValue.packages.filter(isNonEmptyString)
  }

  return []
}

function readPnpmWorkspacePatterns(source: string): RootWorkspacePattern[] {
  const manifest = parseYaml(source) as PnpmWorkspaceManifest | null
  return Array.isArray(manifest?.packages) ? manifest.packages.filter(isNonEmptyString) : []
}

async function listWorkspaceDirectoryEntries(directory: string) {
  if (!(await pathExists(directory))) {
    return []
  }

  const entries = await readdir(directory, { withFileTypes: true })
  return [...entries]
    .filter((entry) => entry.isDirectory())
    .sort((left, right) => left.name.localeCompare(right.name))
}

async function discoverExistingRootWorkspacePatterns(
  targetRoot: string,
): Promise<RootWorkspacePattern[]> {
  const workspaces: RootWorkspacePattern[] = []

  for (const entry of await listWorkspaceDirectoryEntries(targetRoot)) {
    if (entry.name === 'packages' || entry.name.startsWith('.')) {
      continue
    }

    if (await pathExists(path.join(targetRoot, entry.name, 'package.json'))) {
      workspaces.push(entry.name)
    }
  }

  const packagesRoot = path.join(targetRoot, 'packages')

  for (const entry of await listWorkspaceDirectoryEntries(packagesRoot)) {
    if (entry.name.startsWith('.')) {
      continue
    }

    if (await pathExists(path.join(packagesRoot, entry.name, 'package.json'))) {
      workspaces.push(path.posix.join('packages', entry.name))
    }
  }

  return workspaces
}

export function normalizeRootWorkspacePatterns(
  workspaces: readonly RootWorkspacePattern[],
): RootWorkspacePattern[] {
  const normalizedWorkspaces: RootWorkspacePattern[] = []
  const included = new Set<RootWorkspacePattern>()

  for (const workspace of workspaces) {
    if (!isNonEmptyString(workspace)) {
      continue
    }

    const normalizedWorkspace = normalizeRootWorkspacePattern(workspace)

    if (included.has(normalizedWorkspace)) {
      continue
    }

    included.add(normalizedWorkspace)
    normalizedWorkspaces.push(normalizedWorkspace)
  }

  return normalizedWorkspaces
}

export async function readDeclaredRootWorkspacePatterns(
  targetRoot: string,
): Promise<RootWorkspacePattern[] | null> {
  const pnpmWorkspaceManifestPath = path.join(targetRoot, 'pnpm-workspace.yaml')

  if (await pathExists(pnpmWorkspaceManifestPath)) {
    return normalizeRootWorkspacePatterns(
      readPnpmWorkspacePatterns(await readFile(pnpmWorkspaceManifestPath, 'utf8')),
    )
  }

  const rootPackageJsonPath = path.join(targetRoot, 'package.json')

  if (!(await pathExists(rootPackageJsonPath))) {
    return null
  }

  const workspacePatterns = readPackageJsonWorkspacePatterns(
    await readFile(rootPackageJsonPath, 'utf8'),
  )
  return workspacePatterns.length > 0 ? normalizeRootWorkspacePatterns(workspacePatterns) : null
}

export async function resolveRootWorkspacePatterns(
  targetRoot: string,
): Promise<RootWorkspacePattern[]> {
  const declaredWorkspaces = (await readDeclaredRootWorkspacePatterns(targetRoot)) ?? []
  const discoveredWorkspaces = await discoverExistingRootWorkspacePatterns(targetRoot)

  return normalizeRootWorkspacePatterns([...declaredWorkspaces, ...discoveredWorkspaces])
}

export function renderPnpmWorkspaceManifest(workspaces: readonly RootWorkspacePattern[]) {
  return stringifyYaml({
    packages: [...normalizeRootWorkspacePatterns(workspaces)],
  })
}
