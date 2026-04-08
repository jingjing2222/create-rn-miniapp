import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { CommandSpec } from '../runtime/command-spec.js'
import { SKILLS_CLI } from '../runtime/external-tooling.js'
import {
  getInstallableSkillDefinition,
  INSTALLABLE_SKILL_CATALOG,
  resolveAlwaysRecommendedSkillDefinitions,
  type InstallableSkillId,
} from '../installable-skill-catalog.js'
import { getPackageManagerAdapter, type PackageManager } from '../runtime/package-manager.js'
import type { ServerProvider } from '../providers/index.js'
import {
  createProjectSkillDirectoryPath,
  createSkillsAddArgs,
  PROJECT_SKILLS_DIR_CANDIDATES,
  SKILLS_LIST_COMMAND,
  SKILLS_SOURCE_REPO,
} from './contract.js'
import {
  groupSkillIdsBySource,
  renderSkillsAddCommand as renderSkillsAddCommandImpl,
} from './add-command.js'
import { resolveRecommendedSkillDefinitions } from '../templates/feature-catalog.js'
import dedent from '../runtime/dedent.js'

type SkillRecommendationContext = {
  serverProvider: ServerProvider | null
  hasBackoffice: boolean
  hasTrpc: boolean
}

export type InstalledProjectSkill = {
  id: string
  skillsRoot: (typeof PROJECT_SKILLS_DIR_CANDIDATES)[number]
}

type SkillMirrorMetadata = {
  upstreamSources: string[]
  installMirrors: Record<string, string>
}

type SyncInstalledSkillArtifactsOptions = {
  fetchImpl?: typeof fetch
  allowDownloadFailureSkillIds?: readonly string[]
}

type ResolvedSkillsSource = {
  source: string
  usesLocalCheckout: boolean
}

class SkillMirrorDownloadError extends Error {
  constructor(sourceUrl: string, statusOrReason: number | string) {
    super(`tds-ui llms mirror를 다운로드하지 못했어요: ${sourceUrl} (${statusOrReason})`)
    this.name = 'SkillMirrorDownloadError'
  }
}

async function pathExists(targetPath: string) {
  try {
    await stat(targetPath)
    return true
  } catch {
    return false
  }
}

async function enumerateInstalledProjectSkills(targetRoot: string) {
  const installed: InstalledProjectSkill[] = []

  for (const skillsRoot of PROJECT_SKILLS_DIR_CANDIDATES) {
    const skillDirectory = path.join(targetRoot, skillsRoot)

    if (!(await pathExists(skillDirectory))) {
      continue
    }

    const entries = (await readdir(skillDirectory, { withFileTypes: true })).sort((left, right) =>
      left.name.localeCompare(right.name),
    )

    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue
      }

      if (await pathExists(path.join(skillDirectory, entry.name, 'SKILL.md'))) {
        installed.push({
          id: entry.name,
          skillsRoot,
        })
      }
    }
  }

  return installed.sort(
    (left, right) =>
      left.id.localeCompare(right.id) || left.skillsRoot.localeCompare(right.skillsRoot),
  )
}

async function resolveInstalledProjectSkills(targetRoot: string) {
  const installed = new Map<string, InstalledProjectSkill>()

  for (const skill of await enumerateInstalledProjectSkills(targetRoot)) {
    if (!installed.has(skill.id)) {
      installed.set(skill.id, skill)
    }
  }

  return [...installed.values()]
}

function readMetadataStringArray(
  metadata: Record<string, unknown>,
  fieldName: string,
  skillId: string,
) {
  const value = metadata[fieldName]

  if (
    !Array.isArray(value) ||
    value.some((entry) => typeof entry !== 'string' || entry.length === 0)
  ) {
    throw new Error(`${skillId} metadata.${fieldName} 형식이 잘못됐어요.`)
  }

  return value as string[]
}

function readMetadataStringRecord(
  metadata: Record<string, unknown>,
  fieldName: string,
  skillId: string,
) {
  const value = metadata[fieldName]

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${skillId} metadata.${fieldName} 형식이 잘못됐어요.`)
  }

  const entries = Object.entries(value)

  if (
    entries.some(
      ([key, entry]) => key.length === 0 || typeof entry !== 'string' || entry.length === 0,
    )
  ) {
    throw new Error(`${skillId} metadata.${fieldName} 형식이 잘못됐어요.`)
  }

  return Object.fromEntries(entries) as Record<string, string>
}

function resolveMirrorTargetPath(skillDirectory: string, relativePath: string) {
  const normalizedRelativePath = path.posix.normalize(relativePath.replaceAll('\\', '/'))

  if (
    normalizedRelativePath.length === 0 ||
    normalizedRelativePath === '.' ||
    path.posix.isAbsolute(normalizedRelativePath)
  ) {
    throw new Error(
      `tds-ui metadata.installMirrors 경로가 skill root 밖을 가리켜요: ${relativePath}`,
    )
  }

  const targetPath = path.resolve(skillDirectory, ...normalizedRelativePath.split('/'))
  const relativeToSkillRoot = path.relative(skillDirectory, targetPath)

  if (
    relativeToSkillRoot.length === 0 ||
    relativeToSkillRoot === '..' ||
    relativeToSkillRoot.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativeToSkillRoot)
  ) {
    throw new Error(
      `tds-ui metadata.installMirrors 경로가 skill root 밖을 가리켜요: ${relativePath}`,
    )
  }

  return targetPath
}

async function readSkillMirrorMetadata(
  skillDirectory: string,
  skillId: string,
): Promise<SkillMirrorMetadata> {
  const metadata = JSON.parse(
    await readFile(path.join(skillDirectory, 'metadata.json'), 'utf8'),
  ) as Record<string, unknown> | null

  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    throw new Error(`${skillId} metadata.json 형식이 잘못됐어요.`)
  }

  return {
    upstreamSources: readMetadataStringArray(metadata, 'upstreamSources', skillId),
    installMirrors: readMetadataStringRecord(metadata, 'installMirrors', skillId),
  }
}

async function syncTdsUiMirrorArtifacts(skillDirectory: string, fetchImpl: typeof fetch) {
  const metadata = await readSkillMirrorMetadata(skillDirectory, 'tds-ui')
  const downloads: Array<{ targetPath: string; contents: string }> = []

  for (const sourceUrl of metadata.upstreamSources) {
    const relativePath = metadata.installMirrors[sourceUrl]

    if (!relativePath) {
      throw new Error(`tds-ui metadata.installMirrors에 누락된 URL이 있어요: ${sourceUrl}`)
    }

    const targetPath = resolveMirrorTargetPath(skillDirectory, relativePath)

    let response: Awaited<ReturnType<typeof fetchImpl>>

    try {
      response = await fetchImpl(sourceUrl)
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error)
      throw new SkillMirrorDownloadError(sourceUrl, reason)
    }

    if (!response.ok) {
      throw new SkillMirrorDownloadError(sourceUrl, response.status)
    }

    downloads.push({
      targetPath,
      contents: await response.text(),
    })
  }

  for (const download of downloads) {
    await mkdir(path.dirname(download.targetPath), { recursive: true })
    await writeFile(download.targetPath, download.contents, 'utf8')
  }
}

export async function listInstalledProjectSkillEntries(targetRoot: string) {
  return await resolveInstalledProjectSkills(targetRoot)
}

export async function hasInstalledProjectSkills(targetRoot: string) {
  return (await resolveInstalledProjectSkills(targetRoot)).length > 0
}

export async function listInstalledProjectSkills(targetRoot: string) {
  return (await resolveInstalledProjectSkills(targetRoot)).map((skill) => skill.id)
}

export async function syncInstalledSkillArtifacts(
  targetRoot: string,
  options: SyncInstalledSkillArtifactsOptions = {},
) {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch
  const allowDownloadFailureSkillIds = new Set(options.allowDownloadFailureSkillIds ?? [])

  if (typeof fetchImpl !== 'function') {
    throw new Error('skill mirror를 다운로드할 fetch 구현을 찾지 못했어요.')
  }

  for (const skill of await enumerateInstalledProjectSkills(targetRoot)) {
    if (skill.id !== 'tds-ui') {
      continue
    }

    try {
      await syncTdsUiMirrorArtifacts(path.join(targetRoot, skill.skillsRoot, skill.id), fetchImpl)
    } catch (error) {
      if (error instanceof SkillMirrorDownloadError && allowDownloadFailureSkillIds.has(skill.id)) {
        continue
      }

      throw error
    }
  }
}

export function normalizeSelectedSkillIds(rawSkillIds: string[] | undefined) {
  const normalized: InstallableSkillId[] = []
  const seen = new Set<string>()

  for (const rawSkillId of rawSkillIds ?? []) {
    const definition = getInstallableSkillDefinition(rawSkillId)

    if (seen.has(definition.id)) {
      continue
    }

    normalized.push(definition.id)
    seen.add(definition.id)
  }

  return normalized
}

export function resolveRecommendedSkillIds(context: SkillRecommendationContext) {
  const recommendedSkillIds: InstallableSkillId[] = []
  const seen = new Set<string>()
  const localRecommendedSkillDefinitions = resolveRecommendedSkillDefinitions({
    hasBackoffice: context.hasBackoffice,
    serverProvider: context.serverProvider,
    hasTrpc: context.hasTrpc,
  })

  for (const definition of [
    ...resolveAlwaysRecommendedSkillDefinitions(),
    ...localRecommendedSkillDefinitions.map((skill) => getInstallableSkillDefinition(skill.id)),
  ]) {
    if (seen.has(definition.id)) {
      continue
    }

    recommendedSkillIds.push(definition.id)
    seen.add(definition.id)
  }

  return recommendedSkillIds
}

export function resolveSelectableSkills() {
  return INSTALLABLE_SKILL_CATALOG
}

export function renderSkillsAddCommand(skillIds: string[]) {
  return renderSkillsAddCommandImpl(skillIds)
}

export function renderInstalledSkillsSummary(
  installedSkills: readonly (string | InstalledProjectSkill)[],
) {
  const normalizedSkills = [...installedSkills].sort((left, right) => {
    const leftId = typeof left === 'string' ? left : left.id
    const rightId = typeof right === 'string' ? right : right.id

    return leftId.localeCompare(rightId)
  })

  return dedent`
    project-local skills를 설치했어요.
    ${(
      normalizedSkills.map((skill) =>
        typeof skill === 'string'
          ? `- ${skill}`
          : `- ${skill.id}: \`${createProjectSkillDirectoryPath(skill.id, skill.skillsRoot)}\``,
      )
    ).join('\n')}
    필요하면 \`${SKILLS_LIST_COMMAND}\`로 다시 확인해 주세요.
  `
}

async function resolveSkillsSource(sourceRepo: string): Promise<ResolvedSkillsSource> {
  if (sourceRepo !== SKILLS_SOURCE_REPO) {
    return {
      source: sourceRepo,
      usesLocalCheckout: false,
    }
  }

  const localRepoRoot = path.resolve(import.meta.dirname, '../../../..')

  if (await pathExists(path.join(localRepoRoot, 'skills'))) {
    return {
      source: localRepoRoot,
      usesLocalCheckout: true,
    }
  }

  return {
    source: sourceRepo,
    usesLocalCheckout: false,
  }
}

export async function resolveLocalSourceSkillIds(skillIds: InstallableSkillId[]) {
  const localSourceSkillIds: InstallableSkillId[] = []

  for (const group of groupSkillIdsBySource(skillIds)) {
    const source = await resolveSkillsSource(group.sourceRepo)

    if (source.usesLocalCheckout) {
      localSourceSkillIds.push(...group.skillIds)
    }
  }

  return localSourceSkillIds
}

export async function buildSkillsInstallCommands(options: {
  packageManager: PackageManager
  targetRoot: string
  skillIds: InstallableSkillId[]
}): Promise<CommandSpec[]> {
  if (options.skillIds.length === 0) {
    return []
  }

  const adapter = getPackageManagerAdapter(options.packageManager)
  const commands: CommandSpec[] = []

  for (const group of groupSkillIdsBySource(options.skillIds)) {
    const source = await resolveSkillsSource(group.sourceRepo)

    commands.push({
      cwd: options.targetRoot,
      ...adapter.dlx(
        SKILLS_CLI,
        createSkillsAddArgs({
          source: source.source,
          skillIds: group.skillIds,
          yes: true,
        }),
      ),
      label: '추천 agent skills 설치하기',
    })
  }

  return commands
}
