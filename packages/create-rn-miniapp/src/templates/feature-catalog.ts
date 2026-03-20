import type { GeneratedWorkspaceOptions } from './types.js'

export type SkillReferenceDefinition = {
  templateDir: string
  docsPath: string
  agentsLabel: string
  topologyLabel: string
}

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
  optionalSkill?: SkillReferenceDefinition
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
    optionalSkill: {
      templateDir: 'optional/backoffice-react',
      docsPath: '.agents/skills/optional/backoffice-react/SKILL.md',
      agentsLabel: 'backoffice React 작업',
      topologyLabel: 'Backoffice React workflow',
    },
  },
  {
    enabled: (options) => options.serverProvider === 'cloudflare',
    optionalSkill: {
      templateDir: 'optional/server-cloudflare',
      docsPath: '.agents/skills/optional/server-cloudflare/SKILL.md',
      agentsLabel: 'Cloudflare provider 작업',
      topologyLabel: 'Cloudflare provider 운영 가이드',
    },
  },
  {
    enabled: (options) => options.serverProvider === 'supabase',
    optionalSkill: {
      templateDir: 'optional/server-supabase',
      docsPath: '.agents/skills/optional/server-supabase/SKILL.md',
      agentsLabel: 'Supabase provider 작업',
      topologyLabel: 'Supabase provider 운영 가이드',
    },
  },
  {
    enabled: (options) => options.serverProvider === 'firebase',
    optionalSkill: {
      templateDir: 'optional/server-firebase',
      docsPath: '.agents/skills/optional/server-firebase/SKILL.md',
      agentsLabel: 'Firebase provider 작업',
      topologyLabel: 'Firebase provider 운영 가이드',
    },
  },
  {
    enabled: (options) => options.hasTrpc,
    agentsLines: [
      '`packages/contracts`, `packages/app-router`: optional shared tRPC boundary packages',
    ],
    topologyRootLines: [
      '`packages/contracts`: optional tRPC boundary schema / type source',
      '`packages/app-router`: optional tRPC router / `AppRouter` source',
    ],
    roleSections: [
      {
        heading: 'packages/contracts',
        lines: () => [
          '- boundary input/output schema와 경계 타입의 source of truth다.',
          '- consumer는 root import만 사용하고 src 상대 경로를 내려가지 않는다.',
        ],
      },
      {
        heading: 'packages/app-router',
        lines: () => [
          '- route shape와 `AppRouter` 타입의 source of truth다.',
          '- Worker runtime과 client는 이 package를 기준으로 타입을 맞춘다.',
        ],
      },
    ],
    importBoundaryRules: () => [
      'shared contract가 필요하면 `packages/contracts`, `packages/app-router`로 올린다.',
    ],
    optionalSkill: {
      templateDir: 'optional/trpc-boundary',
      docsPath: '.agents/skills/optional/trpc-boundary/SKILL.md',
      agentsLabel: 'tRPC boundary 변경',
      topologyLabel: 'tRPC boundary change flow',
    },
  },
]

export function resolveEnabledWorkspaceFeatures(options: GeneratedWorkspaceOptions) {
  return WORKSPACE_FEATURE_CATALOG.filter((feature) => feature.enabled(options))
}

export function resolveSelectedOptionalSkillDefinitions(options: GeneratedWorkspaceOptions) {
  return resolveEnabledWorkspaceFeatures(options).flatMap((feature) =>
    feature.optionalSkill ? [feature.optionalSkill] : [],
  )
}
