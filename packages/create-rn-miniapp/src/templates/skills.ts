import { createHash } from 'node:crypto'
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  copyDirectory,
  copyDirectoryWithTokens,
  pathExists,
  resolveSkillsPackageRoot,
} from './filesystem.js'
import { resolveGeneratedWorkspaceOptions } from './generated-workspace.js'
import {
  CORE_SKILL_DEFINITIONS as SHARED_CORE_SKILL_DEFINITIONS,
  getCoreSkillDefinition as getCoreSkillDefinitionFromCatalog,
  getSkillDefinition,
  resolveSelectedSkillDefinitions,
  type CoreSkillDefinition as SharedCoreSkillDefinition,
  type CoreSkillId as SharedCoreSkillId,
  type SkillDefinition,
  type SkillId,
} from './skill-catalog.js'
import type { GeneratedWorkspaceOptions, GeneratedWorkspaceHints, TemplateTokens } from './types.js'

export type CoreSkillDefinition = SharedCoreSkillDefinition
export type CoreSkillId = SharedCoreSkillId

export const CORE_SKILL_DEFINITIONS = SHARED_CORE_SKILL_DEFINITIONS
export const getCoreSkillDefinition = getCoreSkillDefinitionFromCatalog

export type SkillSelectionMode = 'core' | 'derived' | 'manual'

export type ResolvedSkillManifestEntry = {
  id: SkillId
  mode: SkillSelectionMode
  renderedDigest: string
}

export type SkillsManifest = {
  schema: 1
  generatorPackage: string
  generatorVersion: string
  catalogPackage: string
  catalogVersion: string
  manualExtraSkills: string[]
  resolvedSkills: ResolvedSkillManifestEntry[]
  customSkillPolicy: 'preserve-unmanaged-siblings'
}

export const SKILLS_MANIFEST_RELATIVE_PATH = path.join('.create-rn-miniapp', 'skills.json')
const CUSTOM_SKILL_POLICY = 'preserve-unmanaged-siblings' as const

export function resolveManagedSkillSelections(
  options: GeneratedWorkspaceOptions,
  manualExtraSkills: string[],
) {
  const resolved: Array<{ definition: SkillDefinition; mode: SkillSelectionMode }> =
    resolveSelectedSkillDefinitions(options).map((definition) => ({
      definition,
      mode: definition.kind === 'core' ? ('core' as const) : ('derived' as const),
    }))
  const seen = new Set(resolved.map((entry) => entry.definition.id))

  for (const manualSkillId of manualExtraSkills) {
    const definition = getSkillDefinition(manualSkillId as SkillId)

    if (seen.has(definition.id)) {
      continue
    }

    resolved.push({
      definition,
      mode: 'manual',
    })
    seen.add(definition.id)
  }

  return resolved
}

async function listFilesRecursively(rootDir: string, currentDir = rootDir): Promise<string[]> {
  const entries = await readdir(currentDir, { withFileTypes: true })
  const files: string[] = []

  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const absolutePath = path.join(currentDir, entry.name)

    if (entry.isDirectory()) {
      files.push(...(await listFilesRecursively(rootDir, absolutePath)))
      continue
    }

    files.push(path.relative(rootDir, absolutePath))
  }

  return files
}

async function computeDirectoryDigest(rootDir: string) {
  const hash = createHash('sha256')
  const relativeFiles = await listFilesRecursively(rootDir)

  for (const relativeFile of relativeFiles) {
    hash.update(relativeFile)
    hash.update('\0')
    hash.update(await readFile(path.join(rootDir, relativeFile)))
    hash.update('\0')
  }

  return hash.digest('hex')
}

async function readPackageIdentity(packageJsonPath: string) {
  return JSON.parse(await readFile(packageJsonPath, 'utf8')) as {
    name: string
    version: string
  }
}

function getGeneratorPackageJsonPath() {
  return fileURLToPath(new URL('../../package.json', import.meta.url))
}

export function getSkillsManifestPath(targetRoot: string) {
  return path.join(targetRoot, SKILLS_MANIFEST_RELATIVE_PATH)
}

export async function readSkillsManifest(targetRoot: string): Promise<SkillsManifest | null> {
  const manifestPath = getSkillsManifestPath(targetRoot)

  if (!(await pathExists(manifestPath))) {
    return null
  }

  return JSON.parse(await readFile(manifestPath, 'utf8')) as SkillsManifest
}

async function resolveBootstrapManualExtraSkills(
  targetRoot: string,
  options: GeneratedWorkspaceOptions,
) {
  const canonicalTargetRoot = path.join(targetRoot, '.agents', 'skills')

  if (!(await pathExists(canonicalTargetRoot))) {
    return []
  }

  const derivedSkillIds = new Set(resolveSelectedSkillDefinitions(options).map((skill) => skill.id))
  const entries = await readdir(canonicalTargetRoot, { withFileTypes: true })
  const manualSkillIds: SkillId[] = []

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue
    }

    const skillId = entry.name as SkillId

    try {
      const definition = getSkillDefinition(skillId)

      if (derivedSkillIds.has(definition.id)) {
        continue
      }

      manualSkillIds.push(definition.id)
    } catch {
      // unmanaged custom sibling
    }
  }

  return manualSkillIds
}

async function resolveManualExtraSkills(
  targetRoot: string,
  options: GeneratedWorkspaceOptions,
  hints: GeneratedWorkspaceHints,
  existingManifest: SkillsManifest | null,
) {
  const sourceManualSkills =
    hints.manualExtraSkills ??
    existingManifest?.manualExtraSkills ??
    (await resolveBootstrapManualExtraSkills(targetRoot, options))

  const dedupedManualSkills: SkillId[] = []
  const seen = new Set<string>()

  for (const skillId of sourceManualSkills) {
    const definition = getSkillDefinition(skillId as SkillId)

    if (seen.has(definition.id)) {
      continue
    }

    dedupedManualSkills.push(definition.id)
    seen.add(definition.id)
  }

  return dedupedManualSkills
}

function getSkillCopyOptions(definition: SkillDefinition) {
  if (definition.id !== 'tds-ui') {
    return undefined
  }

  return {
    skipRelativePaths: new Set(['scripts']),
  }
}

function stripSection(source: string, heading: string, nextHeading: string) {
  const pattern = new RegExp(`${heading}[\\s\\S]*?${nextHeading}`)
  return source.replace(pattern, nextHeading)
}

async function sanitizeGeneratedSkillSnapshot(targetRoot: string, definition: SkillDefinition) {
  if (definition.id !== 'tds-ui') {
    return
  }

  const skillRoot = path.join(targetRoot, definition.id)
  const skillPath = path.join(skillRoot, 'SKILL.md')
  const agentsPath = path.join(skillRoot, 'AGENTS.md')

  if (await pathExists(skillPath)) {
    const skillSource = await readFile(skillPath, 'utf8')
    await writeFile(
      skillPath,
      stripSection(skillSource, '## Freshness hook', '## Read in order'),
      'utf8',
    )
  }

  if (await pathExists(agentsPath)) {
    const agentsSource = await readFile(agentsPath, 'utf8')
    await writeFile(
      agentsPath,
      stripSection(agentsSource, '## Freshness Hook', '## Human References'),
      'utf8',
    )
  }
}

async function writeSkillsManifest(
  targetRoot: string,
  manifest: Omit<SkillsManifest, 'resolvedSkills'> & {
    resolvedSkills: ResolvedSkillManifestEntry[]
  },
) {
  await mkdir(path.dirname(getSkillsManifestPath(targetRoot)), { recursive: true })
  await writeFile(
    getSkillsManifestPath(targetRoot),
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8',
  )
}

export async function syncSkillsMirror(targetRoot: string) {
  const canonicalTargetRoot = path.join(targetRoot, '.agents', 'skills')
  const claudeMirrorRoot = path.join(targetRoot, '.claude', 'skills')

  await rm(claudeMirrorRoot, { recursive: true, force: true })
  await mkdir(path.dirname(claudeMirrorRoot), { recursive: true })
  await copyDirectory(canonicalTargetRoot, claudeMirrorRoot)
}

export async function syncGeneratedSkills(
  targetRoot: string,
  tokens: TemplateTokens,
  hints: GeneratedWorkspaceHints,
) {
  const options = await resolveGeneratedWorkspaceOptions(targetRoot, hints)
  const existingManifest = await readSkillsManifest(targetRoot)
  const skillsRoot = resolveSkillsPackageRoot()
  const generatorPackage = await readPackageIdentity(getGeneratorPackageJsonPath())
  const catalogPackage = await readPackageIdentity(path.join(skillsRoot, 'package.json'))
  const canonicalTargetRoot = path.join(targetRoot, '.agents', 'skills')
  const manualExtraSkills = await resolveManualExtraSkills(
    targetRoot,
    options,
    hints,
    existingManifest,
  )
  const resolvedSkills = resolveManagedSkillSelections(options, manualExtraSkills)
  const nextManagedSkillIds = new Set(resolvedSkills.map((entry) => entry.definition.id))
  const previousManagedSkillIds = new Set(
    existingManifest?.resolvedSkills.map((entry) => entry.id) ?? [],
  )

  await mkdir(canonicalTargetRoot, { recursive: true })

  for (const staleSkillId of previousManagedSkillIds) {
    if (nextManagedSkillIds.has(staleSkillId)) {
      continue
    }

    await rm(path.join(canonicalTargetRoot, staleSkillId), { recursive: true, force: true })
  }

  const manifestEntries: ResolvedSkillManifestEntry[] = []

  for (const { definition, mode } of resolvedSkills) {
    const targetSkillRoot = path.join(canonicalTargetRoot, definition.templateDir)

    await rm(targetSkillRoot, { recursive: true, force: true })
    await copyDirectoryWithTokens(
      path.join(skillsRoot, definition.templateDir),
      targetSkillRoot,
      tokens,
      getSkillCopyOptions(definition),
    )
    await sanitizeGeneratedSkillSnapshot(canonicalTargetRoot, definition)

    manifestEntries.push({
      id: definition.id,
      mode,
      renderedDigest: await computeDirectoryDigest(targetSkillRoot),
    })
  }

  await writeSkillsManifest(targetRoot, {
    schema: 1,
    generatorPackage: generatorPackage.name,
    generatorVersion: generatorPackage.version,
    catalogPackage: catalogPackage.name,
    catalogVersion: catalogPackage.version,
    manualExtraSkills,
    resolvedSkills: manifestEntries,
    customSkillPolicy: CUSTOM_SKILL_POLICY,
  })

  await syncSkillsMirror(targetRoot)
}
