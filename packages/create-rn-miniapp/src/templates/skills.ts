import path from 'node:path'
import { mkdir, rm } from 'node:fs/promises'
import { copyDirectory, copyDirectoryWithTokens, resolveSkillsPackageRoot } from './filesystem.js'
import { resolveGeneratedWorkspaceOptions } from './generated-workspace.js'
import {
  CORE_SKILL_DEFINITIONS as SHARED_CORE_SKILL_DEFINITIONS,
  getCoreSkillDefinition as getCoreSkillDefinitionFromCatalog,
  resolveSelectedSkillDefinitions,
  type CoreSkillDefinition as SharedCoreSkillDefinition,
  type CoreSkillId as SharedCoreSkillId,
} from './skill-catalog.js'
import type { GeneratedWorkspaceOptions, GeneratedWorkspaceHints, TemplateTokens } from './types.js'

export type CoreSkillDefinition = SharedCoreSkillDefinition
export type CoreSkillId = SharedCoreSkillId

export const CORE_SKILL_DEFINITIONS = SHARED_CORE_SKILL_DEFINITIONS
export const getCoreSkillDefinition = getCoreSkillDefinitionFromCatalog

function resolveGeneratedSkillTemplates(options: GeneratedWorkspaceOptions) {
  return resolveSelectedSkillDefinitions(options).map((skill) => skill.templateDir)
}

export async function syncGeneratedSkills(
  targetRoot: string,
  tokens: TemplateTokens,
  hints: GeneratedWorkspaceHints,
) {
  const options = await resolveGeneratedWorkspaceOptions(targetRoot, hints)
  const skillsRoot = resolveSkillsPackageRoot()
  const canonicalTargetRoot = path.join(targetRoot, '.agents', 'skills')
  const claudeMirrorRoot = path.join(targetRoot, '.claude', 'skills')

  await rm(canonicalTargetRoot, { recursive: true, force: true })
  await mkdir(canonicalTargetRoot, { recursive: true })

  for (const templateDir of resolveGeneratedSkillTemplates(options)) {
    await copyDirectoryWithTokens(
      path.join(skillsRoot, templateDir),
      path.join(canonicalTargetRoot, templateDir),
      tokens,
    )
  }

  await rm(claudeMirrorRoot, { recursive: true, force: true })
  await mkdir(path.dirname(claudeMirrorRoot), { recursive: true })
  await copyDirectory(canonicalTargetRoot, claudeMirrorRoot)
}
