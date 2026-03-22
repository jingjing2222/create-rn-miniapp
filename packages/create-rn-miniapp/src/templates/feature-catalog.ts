import { getServerProviderAdapter } from '../providers/index.js'
import type { GeneratedWorkspaceOptions } from './types.js'
import {
  CORE_SKILL_DEFINITIONS,
  OPTIONAL_SKILL_IDS,
  resolveOptionalSkillDefinition,
  type OptionalSkillId,
  type SkillDefinition,
} from './skill-catalog.js'
import {
  TRPC_APP_ROUTER_WORKSPACE_ROLE_SECTION,
  TRPC_CONTRACTS_WORKSPACE_ROLE_SECTION,
  TRPC_WORKSPACE_AGENTS_LINE,
  TRPC_WORKSPACE_IMPORT_BOUNDARY_RULES,
  TRPC_WORKSPACE_TOPOLOGY_ROOT_LINES,
} from './trpc.js'

export type WorkspaceRoleSectionDefinition = {
  heading: string
  lines: (options: GeneratedWorkspaceOptions) => string[]
}

export type WorkspaceFeatureDefinition = {
  enabled: (options: GeneratedWorkspaceOptions) => boolean
  agentsLines?: string[]
  topologyRootLines?: string[]
  roleSections?: WorkspaceRoleSectionDefinition[]
  ownershipLines?: (options: GeneratedWorkspaceOptions) => string[]
  importBoundaryRules?: (options: GeneratedWorkspaceOptions) => string[]
  optionalSkillId?: OptionalSkillId
}

export const WORKSPACE_FEATURE_CATALOG: WorkspaceFeatureDefinition[] = [
  {
    enabled: () => true,
    agentsLines: ['`frontend`: AppInToss + Granite 기반 MiniApp'],
    topologyRootLines: ['`frontend`: AppInToss + Granite 기반 MiniApp'],
    roleSections: [
      {
        heading: 'frontend',
        lines: (options) => [
          '- MiniApp UI, route, client integration을 담당한다.',
          ...(options.serverProvider !== null
            ? [
                '- provider 연결값은 각 workspace의 `.env.local`에서 읽는다.',
                '- server runtime 구현을 직접 import하지 않는다.',
              ]
            : []),
        ],
      },
    ],
    importBoundaryRules: (options) =>
      options.serverProvider !== null ? ['`frontend` ↔ `server` 직접 import 금지'] : [],
  },
  {
    enabled: (options) => options.serverProvider !== null,
    agentsLines: ['`server`: optional provider workspace'],
    topologyRootLines: ['`server`: optional provider workspace'],
    roleSections: [
      {
        heading: 'server',
        lines: (options) => [
          '- provider별 원격 리소스 운영과 server-side runtime을 담당한다.',
          '- deploy, db/functions, rules/indexes 같은 운영 스크립트의 source다.',
          '- frontend가 기대하는 env와 연결값을 제공한다.',
          ...(options.hasBackoffice ? ['- backoffice가 기대하는 env와 연결값을 제공한다.'] : []),
        ],
      },
    ],
    ownershipLines: () => [
      '- API / base URL ownership: provider workspace가 값을 정의하고 consumer workspace가 읽는다.',
    ],
  },
  {
    enabled: (options) => options.hasBackoffice,
    agentsLines: ['`backoffice`: optional Vite 기반 운영 도구'],
    topologyRootLines: ['`backoffice`: optional Vite + React 운영 도구'],
    roleSections: [
      {
        heading: 'backoffice',
        lines: (options) => [
          '- 브라우저 기반 운영 화면을 담당한다.',
          '- MiniApp 전용 runtime 대신 browser/client 패턴을 따른다.',
          ...(options.serverProvider !== null
            ? ['- server runtime 구현을 직접 import하지 않는다.']
            : []),
        ],
      },
    ],
    importBoundaryRules: (options) =>
      options.serverProvider !== null ? ['`backoffice` ↔ `server` 직접 import 금지'] : [],
    optionalSkillId: 'backoffice-react',
  },
  {
    enabled: (options) => options.hasTrpc,
    agentsLines: [TRPC_WORKSPACE_AGENTS_LINE],
    topologyRootLines: TRPC_WORKSPACE_TOPOLOGY_ROOT_LINES,
    roleSections: [
      {
        heading: TRPC_CONTRACTS_WORKSPACE_ROLE_SECTION.heading,
        lines: () => TRPC_CONTRACTS_WORKSPACE_ROLE_SECTION.lines,
      },
      {
        heading: TRPC_APP_ROUTER_WORKSPACE_ROLE_SECTION.heading,
        lines: () => TRPC_APP_ROUTER_WORKSPACE_ROLE_SECTION.lines,
      },
    ],
    importBoundaryRules: () => TRPC_WORKSPACE_IMPORT_BOUNDARY_RULES,
    optionalSkillId: 'trpc-boundary',
  },
]

export function resolveEnabledWorkspaceFeatures(options: GeneratedWorkspaceOptions) {
  return WORKSPACE_FEATURE_CATALOG.filter((feature) => feature.enabled(options))
}

export function resolveSelectedOptionalSkillDefinitions(options: GeneratedWorkspaceOptions) {
  const selectedSkillIds = new Set<OptionalSkillId>()

  for (const feature of resolveEnabledWorkspaceFeatures(options)) {
    if (feature.optionalSkillId) {
      selectedSkillIds.add(feature.optionalSkillId)
    }
  }

  if (options.serverProvider !== null) {
    const providerSkillId = getServerProviderAdapter(options.serverProvider).optionalSkillId

    if (providerSkillId) {
      selectedSkillIds.add(providerSkillId)
    }
  }

  return OPTIONAL_SKILL_IDS.filter((skillId) => selectedSkillIds.has(skillId)).map((skillId) =>
    resolveOptionalSkillDefinition(skillId),
  )
}

export function resolveRecommendedSkillDefinitions(
  options: GeneratedWorkspaceOptions,
): SkillDefinition[] {
  return [...CORE_SKILL_DEFINITIONS, ...resolveSelectedOptionalSkillDefinitions(options)]
}
