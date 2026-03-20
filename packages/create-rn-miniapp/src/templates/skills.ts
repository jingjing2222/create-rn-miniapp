import path from 'node:path'
import { mkdir, rm } from 'node:fs/promises'
import { copyDirectory, copyDirectoryWithTokens, resolveSkillsPackageRoot } from './filesystem.js'
import {
  resolveSelectedOptionalSkillDefinitions,
  type SkillReferenceDefinition,
} from './feature-catalog.js'
import { resolveGeneratedWorkspaceOptions } from './generated-workspace.js'
import type { GeneratedWorkspaceOptions, GeneratedWorkspaceHints, TemplateTokens } from './types.js'

export type CoreSkillId = 'miniapp' | 'granite' | 'tds'

export type CoreSkillDefinition = SkillReferenceDefinition & {
  id: CoreSkillId
  frontendPolicyReferenceLabel: string
  frontendPolicyReferencePath: string
  referenceCatalogPath?: string
}

export const CORE_SKILL_DEFINITIONS: CoreSkillDefinition[] = [
  {
    id: 'miniapp',
    templateDir: 'miniapp',
    docsPath: '.agents/skills/miniapp/SKILL.md',
    agentsLabel: 'MiniApp capability / 공식 API 탐색',
    topologyLabel: 'MiniApp capability',
    frontendPolicyReferenceLabel: '기능 축과 공식 문서 진입',
    frontendPolicyReferencePath: '.agents/skills/miniapp/SKILL.md',
  },
  {
    id: 'granite',
    templateDir: 'granite',
    docsPath: '.agents/skills/granite/SKILL.md',
    agentsLabel: 'route / page / navigation 패턴',
    topologyLabel: 'Granite page/route patterns',
    frontendPolicyReferenceLabel: 'route / navigation 패턴',
    frontendPolicyReferencePath: '.agents/skills/granite/SKILL.md',
  },
  {
    id: 'tds',
    templateDir: 'tds',
    docsPath: '.agents/skills/tds/SKILL.md',
    agentsLabel: 'TDS UI 선택과 form 패턴',
    topologyLabel: 'TDS UI selection',
    frontendPolicyReferenceLabel: 'TDS component 선택',
    frontendPolicyReferencePath: '.agents/skills/tds/SKILL.md',
    referenceCatalogPath: '.agents/skills/tds/references/catalog.md',
  },
]

export function getCoreSkillDefinition(id: CoreSkillId) {
  const definition = CORE_SKILL_DEFINITIONS.find((skill) => skill.id === id)

  if (!definition) {
    throw new Error(`알 수 없는 core skill id입니다: ${id}`)
  }

  return definition
}

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
