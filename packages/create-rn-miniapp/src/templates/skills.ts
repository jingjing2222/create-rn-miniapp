import path from 'node:path'
import { mkdir, rm } from 'node:fs/promises'
import { copyDirectory, copyDirectoryWithTokens, resolveSkillsPackageRoot } from './filesystem.js'
import { resolveGeneratedWorkspaceOptions } from './generated-workspace.js'
import type { GeneratedWorkspaceOptions, GeneratedWorkspaceHints, TemplateTokens } from './types.js'

export type SkillReferenceDefinition = {
  templateDir: string
  docsPath: string
  agentsLabel: string
  topologyLabel: string
  enabled?: (options: GeneratedWorkspaceOptions) => boolean
}

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

export const OPTIONAL_SKILL_DEFINITIONS: SkillReferenceDefinition[] = [
  {
    templateDir: 'optional/backoffice-react',
    docsPath: '.agents/skills/optional/backoffice-react/SKILL.md',
    agentsLabel: 'backoffice React 작업',
    topologyLabel: 'Backoffice React workflow',
    enabled: (options) => options.hasBackoffice,
  },
  {
    templateDir: 'optional/server-cloudflare',
    docsPath: '.agents/skills/optional/server-cloudflare/SKILL.md',
    agentsLabel: 'Cloudflare provider 작업',
    topologyLabel: 'Cloudflare provider 운영 가이드',
    enabled: (options) => options.serverProvider === 'cloudflare',
  },
  {
    templateDir: 'optional/server-supabase',
    docsPath: '.agents/skills/optional/server-supabase/SKILL.md',
    agentsLabel: 'Supabase provider 작업',
    topologyLabel: 'Supabase provider 운영 가이드',
    enabled: (options) => options.serverProvider === 'supabase',
  },
  {
    templateDir: 'optional/server-firebase',
    docsPath: '.agents/skills/optional/server-firebase/SKILL.md',
    agentsLabel: 'Firebase provider 작업',
    topologyLabel: 'Firebase provider 운영 가이드',
    enabled: (options) => options.serverProvider === 'firebase',
  },
  {
    templateDir: 'optional/trpc-boundary',
    docsPath: '.agents/skills/optional/trpc-boundary/SKILL.md',
    agentsLabel: 'tRPC boundary 변경',
    topologyLabel: 'tRPC boundary change flow',
    enabled: (options) => options.hasTrpc,
  },
]

export function resolveSelectedOptionalSkillDefinitions(options: GeneratedWorkspaceOptions) {
  return OPTIONAL_SKILL_DEFINITIONS.filter((skill) => skill.enabled?.(options) ?? true)
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
