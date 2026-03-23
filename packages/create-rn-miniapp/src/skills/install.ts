import { readdir, stat } from 'node:fs/promises'
import path from 'node:path'
import type { CommandSpec } from '../runtime/command-spec.js'
import { SKILLS_CLI } from '../runtime/external-tooling.js'
import { getPackageManagerAdapter, type PackageManager } from '../runtime/package-manager.js'
import type { ServerProvider } from '../providers/index.js'
import {
  createProjectSkillDirectoryPath,
  createSkillsAddArgs,
  PROJECT_SKILLS_DIR_CANDIDATES,
  SKILLS_LIST_COMMAND,
  SKILLS_SOURCE_REPO,
} from './contract.js'
import { resolveRecommendedSkillDefinitions } from '../templates/feature-catalog.js'
import { SKILL_CATALOG, getSkillDefinition, type SkillId } from '../templates/skill-catalog.js'
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

async function pathExists(targetPath: string) {
  try {
    await stat(targetPath)
    return true
  } catch {
    return false
  }
}

async function resolveInstalledProjectSkills(targetRoot: string) {
  const installed = new Map<string, InstalledProjectSkill>()

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
        if (!installed.has(entry.name)) {
          installed.set(entry.name, {
            id: entry.name,
            skillsRoot,
          })
        }
      }
    }
  }

  return [...installed.values()].sort((left, right) => left.id.localeCompare(right.id))
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

export function normalizeSelectedSkillIds(rawSkillIds: string[] | undefined) {
  const normalized: SkillId[] = []
  const seen = new Set<string>()

  for (const rawSkillId of rawSkillIds ?? []) {
    const definition = getSkillDefinition(rawSkillId as SkillId)

    if (seen.has(definition.id)) {
      continue
    }

    normalized.push(definition.id)
    seen.add(definition.id)
  }

  return normalized
}

export function resolveRecommendedSkillIds(context: SkillRecommendationContext) {
  return resolveRecommendedSkillDefinitions({
    hasBackoffice: context.hasBackoffice,
    serverProvider: context.serverProvider,
    hasTrpc: context.hasTrpc,
  }).map((skill) => skill.id)
}

export function resolveSelectableSkills() {
  return SKILL_CATALOG
}

export function renderSkillsAddCommand(skillIds: string[]) {
  const baseArgs = [
    'npx',
    'skills',
    ...createSkillsAddArgs({
      source: SKILLS_SOURCE_REPO,
      skillIds,
    }),
  ]

  return baseArgs.join(' ')
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

async function resolveSkillsSource() {
  const localRepoRoot = path.resolve(import.meta.dirname, '../../../..')

  if (await pathExists(path.join(localRepoRoot, 'skills'))) {
    return localRepoRoot
  }

  return SKILLS_SOURCE_REPO
}

export async function buildSkillsInstallCommand(options: {
  packageManager: PackageManager
  targetRoot: string
  skillIds: SkillId[]
}): Promise<CommandSpec | null> {
  if (options.skillIds.length === 0) {
    return null
  }

  const adapter = getPackageManagerAdapter(options.packageManager)
  const source = await resolveSkillsSource()

  return {
    cwd: options.targetRoot,
    ...adapter.dlx(
      SKILLS_CLI,
      createSkillsAddArgs({
        source,
        skillIds: options.skillIds,
        yes: true,
      }),
    ),
    label: '추천 agent skills 설치하기',
  }
}
