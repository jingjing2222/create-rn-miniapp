import path from 'node:path'
import { mkdir, rm } from 'node:fs/promises'
import { copyDirectory, copyDirectoryWithTokens, resolveSkillsPackageRoot } from './filesystem.js'
import {
  resolveSelectedOptionalSkillDefinitions,
  type SkillReferenceDefinition,
} from './feature-catalog.js'
import { resolveGeneratedWorkspaceOptions } from './generated-workspace.js'
import type { GeneratedWorkspaceOptions, GeneratedWorkspaceHints, TemplateTokens } from './types.js'

export const CORE_SKILL_DEFINITIONS: SkillReferenceDefinition[] = [
  {
    templateDir: 'core/miniapp',
    docsPath: '.agents/skills/core/miniapp/SKILL.md',
    agentsLabel: 'MiniApp capability / 공식 API 탐색',
    topologyLabel: 'MiniApp capability',
  },
  {
    templateDir: 'core/granite',
    docsPath: '.agents/skills/core/granite/SKILL.md',
    agentsLabel: 'route / page / navigation 패턴',
    topologyLabel: 'Granite page/route patterns',
  },
  {
    templateDir: 'core/tds',
    docsPath: '.agents/skills/core/tds/SKILL.md',
    agentsLabel: 'TDS UI 선택과 form 패턴',
    topologyLabel: 'TDS UI selection',
  },
]

function resolveGeneratedSkillTemplates(options: GeneratedWorkspaceOptions) {
  return [
    ...CORE_SKILL_DEFINITIONS.map((skill) => skill.templateDir),
    ...resolveSelectedOptionalSkillDefinitions(options).map((skill) => skill.templateDir),
  ]
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
