import type { CliPrompter } from '../cli.js'
import type { PackageManager } from '../package-manager.js'
import type { ServerProvider } from '../providers/index.js'
import type { ServerProjectMode } from '../server-project.js'

export type ScaffoldOptions = {
  prompt: CliPrompter
  packageManager: PackageManager
  appName: string
  displayName: string
  outputDir: string
  noGit: boolean
  yes: boolean
  worktree: boolean
  serverProvider: ServerProvider | null
  serverProjectMode: ServerProjectMode | null
  skipServerProvisioning: boolean
  withTrpc: boolean
  withBackoffice: boolean
  skipInstall: boolean
}

export type AddWorkspaceOptions = {
  prompt: CliPrompter
  rootDir: string
  packageManager: PackageManager
  appName: string
  displayName: string
  existingServerProvider: ServerProvider | null
  existingHasBackoffice: boolean
  existingHasTrpc: boolean
  existingHasWorktreePolicy: boolean
  serverProvider: ServerProvider | null
  serverProjectMode: ServerProjectMode | null
  skipServerProvisioning: boolean
  withServer: boolean
  withTrpc: boolean
  removeCloudflareApiClientHelpers: boolean
  withBackoffice: boolean
  skipInstall: boolean
}
