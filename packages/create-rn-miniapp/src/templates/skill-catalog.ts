import type { GeneratedWorkspaceOptions } from './types.js'

export type CoreSkillId = 'miniapp-capabilities' | 'granite-routing' | 'tds-ui'

export type OptionalSkillId =
  | 'backoffice-react'
  | 'cloudflare-worker'
  | 'supabase-project'
  | 'firebase-functions'
  | 'trpc-boundary'

export type SkillId = CoreSkillId | OptionalSkillId

export type SkillReferenceDefinition = {
  id: SkillId
  templateDir: string
  docsPath: string
  agentsLabel: string
  topologyLabel: string
}

export type CoreSkillDefinition = SkillReferenceDefinition & {
  id: CoreSkillId
  kind: 'core'
  frontendPolicyReferenceLabel: string
  frontendPolicyReferencePath: string
  referenceCatalogPath?: string
}

export type OptionalSkillDefinition = SkillReferenceDefinition & {
  id: OptionalSkillId
  kind: 'optional'
  enabled: (options: GeneratedWorkspaceOptions) => boolean
}

export type SkillDefinition = CoreSkillDefinition | OptionalSkillDefinition

export const SKILL_CATALOG: SkillDefinition[] = [
  {
    id: 'miniapp-capabilities',
    kind: 'core',
    templateDir: 'miniapp-capabilities',
    docsPath: '.agents/skills/miniapp-capabilities/SKILL.md',
    agentsLabel: 'MiniApp capability / 공식 API 탐색',
    topologyLabel: 'MiniApp capability',
    frontendPolicyReferenceLabel: '기능 축과 공식 문서 진입',
    frontendPolicyReferencePath: '.agents/skills/miniapp-capabilities/SKILL.md',
  },
  {
    id: 'granite-routing',
    kind: 'core',
    templateDir: 'granite-routing',
    docsPath: '.agents/skills/granite-routing/SKILL.md',
    agentsLabel: 'route / page / navigation 패턴',
    topologyLabel: 'Granite page/route patterns',
    frontendPolicyReferenceLabel: 'route / navigation 패턴',
    frontendPolicyReferencePath: '.agents/skills/granite-routing/SKILL.md',
  },
  {
    id: 'tds-ui',
    kind: 'core',
    templateDir: 'tds-ui',
    docsPath: '.agents/skills/tds-ui/SKILL.md',
    agentsLabel: 'TDS UI 선택과 form 패턴',
    topologyLabel: 'TDS UI selection',
    frontendPolicyReferenceLabel: 'TDS component 선택',
    frontendPolicyReferencePath: '.agents/skills/tds-ui/SKILL.md',
    referenceCatalogPath: '.agents/skills/tds-ui/references/catalog.md',
  },
  {
    id: 'backoffice-react',
    kind: 'optional',
    templateDir: 'backoffice-react',
    docsPath: '.agents/skills/backoffice-react/SKILL.md',
    agentsLabel: 'backoffice React 작업',
    topologyLabel: 'Backoffice React workflow',
    enabled: (options) => options.hasBackoffice,
  },
  {
    id: 'cloudflare-worker',
    kind: 'optional',
    templateDir: 'cloudflare-worker',
    docsPath: '.agents/skills/cloudflare-worker/SKILL.md',
    agentsLabel: 'Cloudflare Worker 작업',
    topologyLabel: 'Cloudflare Worker 운영 가이드',
    enabled: (options) => options.serverProvider === 'cloudflare',
  },
  {
    id: 'supabase-project',
    kind: 'optional',
    templateDir: 'supabase-project',
    docsPath: '.agents/skills/supabase-project/SKILL.md',
    agentsLabel: 'Supabase project 작업',
    topologyLabel: 'Supabase 프로젝트 운영 가이드',
    enabled: (options) => options.serverProvider === 'supabase',
  },
  {
    id: 'firebase-functions',
    kind: 'optional',
    templateDir: 'firebase-functions',
    docsPath: '.agents/skills/firebase-functions/SKILL.md',
    agentsLabel: 'Firebase Functions 작업',
    topologyLabel: 'Firebase Functions 운영 가이드',
    enabled: (options) => options.serverProvider === 'firebase',
  },
  {
    id: 'trpc-boundary',
    kind: 'optional',
    templateDir: 'trpc-boundary',
    docsPath: '.agents/skills/trpc-boundary/SKILL.md',
    agentsLabel: 'tRPC boundary 변경',
    topologyLabel: 'tRPC boundary change flow',
    enabled: (options) => options.hasTrpc,
  },
]

export const CORE_SKILL_DEFINITIONS = SKILL_CATALOG.filter(
  (skill): skill is CoreSkillDefinition => skill.kind === 'core',
)

export const OPTIONAL_SKILL_DEFINITIONS = SKILL_CATALOG.filter(
  (skill): skill is OptionalSkillDefinition => skill.kind === 'optional',
)

export function getSkillDefinition(id: SkillId) {
  const definition = SKILL_CATALOG.find((skill) => skill.id === id)

  if (!definition) {
    throw new Error(`알 수 없는 skill id입니다: ${id}`)
  }

  return definition
}

export function getCoreSkillDefinition(id: CoreSkillId) {
  const definition = getSkillDefinition(id)

  if (definition.kind !== 'core') {
    throw new Error(`core skill이 아닌 id입니다: ${id}`)
  }

  return definition
}

export function resolveOptionalSkillDefinition(id: OptionalSkillId) {
  const definition = getSkillDefinition(id)

  if (definition.kind !== 'optional') {
    throw new Error(`optional skill이 아닌 id입니다: ${id}`)
  }

  return definition
}

export function resolveSelectedOptionalSkillDefinitions(options: GeneratedWorkspaceOptions) {
  return OPTIONAL_SKILL_DEFINITIONS.filter((skill) => skill.enabled(options))
}

export function resolveSelectedSkillDefinitions(options: GeneratedWorkspaceOptions) {
  return [...CORE_SKILL_DEFINITIONS, ...resolveSelectedOptionalSkillDefinitions(options)]
}
