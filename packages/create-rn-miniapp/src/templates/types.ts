import type { PackageManager } from '../package-manager.js'
import type { ServerProvider } from '../providers/index.js'
import { APP_ROUTER_WORKSPACE_PATH, CONTRACTS_WORKSPACE_PATH } from '../trpc-workspace-metadata.js'

export const ROOT_WORKSPACE_ORDER = [
  'frontend',
  'server',
  CONTRACTS_WORKSPACE_PATH,
  APP_ROUTER_WORKSPACE_PATH,
  'backoffice',
] as const

export type WorkspaceName = (typeof ROOT_WORKSPACE_ORDER)[number]
export type RootWorkspacePattern = string

export type TemplateTokens = {
  appName: string
  displayName: string
  packageManager: PackageManager
  packageManagerField?: string
  packageManagerCommand: string
  packageManagerRunCommand?: string
  packageManagerExecCommand?: string
  verifyCommand: string
}

export type GeneratedWorkspaceHints = {
  serverProvider: ServerProvider | null
}

export type GeneratedWorkspaceOptions = {
  hasBackoffice: boolean
  serverProvider: ServerProvider | null
  hasTrpc: boolean
}

export type ServerPackageJson = {
  scripts?: Record<string, string>
}

export type FirebaseFunctionsPackageJson = {
  name: string
  private: boolean
  main: string
  packageManager?: string
  engines: {
    node: string
  }
  scripts: Record<string, string>
  dependencies: Record<string, string>
  devDependencies: Record<string, string>
}
