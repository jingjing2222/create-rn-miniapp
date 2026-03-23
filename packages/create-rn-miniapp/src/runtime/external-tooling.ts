export type ExternalCliToolId =
  | '@yarnpkg/sdks'
  | 'create-cloudflare'
  | 'create-granite-app'
  | 'create-vite'
  | 'firebase-tools'
  | 'skills'
  | 'supabase'
  | 'wrangler'

export type ExternalCliTool = {
  id: ExternalCliToolId
  packageName: string
  packageSpec: string
}

export const CREATE_CLOUDFLARE_CLI = {
  id: 'create-cloudflare',
  packageName: 'create-cloudflare',
  packageSpec: 'create-cloudflare@2.64.9',
} as const satisfies ExternalCliTool

export const YARN_SDKS_CLI = {
  id: '@yarnpkg/sdks',
  packageName: '@yarnpkg/sdks',
  packageSpec: '@yarnpkg/sdks@3.2.3',
} as const satisfies ExternalCliTool

export const CREATE_GRANITE_APP_CLI = {
  id: 'create-granite-app',
  packageName: 'create-granite-app',
  packageSpec: 'create-granite-app@1.0.7',
} as const satisfies ExternalCliTool

export const CREATE_VITE_CLI = {
  id: 'create-vite',
  packageName: 'create-vite',
  packageSpec: 'create-vite@9.0.3',
} as const satisfies ExternalCliTool

export const FIREBASE_TOOLS_CLI = {
  id: 'firebase-tools',
  packageName: 'firebase-tools',
  packageSpec: 'firebase-tools@15.11.0',
} as const satisfies ExternalCliTool

export const SKILLS_CLI = {
  id: 'skills',
  packageName: 'skills',
  packageSpec: 'skills@1.4.5',
} as const satisfies ExternalCliTool

export const SUPABASE_CLI = {
  id: 'supabase',
  packageName: 'supabase',
  packageSpec: 'supabase@2.83.0',
} as const satisfies ExternalCliTool

export const WRANGLER_CLI = {
  id: 'wrangler',
  packageName: 'wrangler',
  packageSpec: 'wrangler@4.76.0',
} as const satisfies ExternalCliTool

export const EXTERNAL_CLI_TOOLS = [
  YARN_SDKS_CLI,
  CREATE_CLOUDFLARE_CLI,
  CREATE_GRANITE_APP_CLI,
  CREATE_VITE_CLI,
  FIREBASE_TOOLS_CLI,
  SKILLS_CLI,
  SUPABASE_CLI,
  WRANGLER_CLI,
] as const satisfies readonly ExternalCliTool[]
