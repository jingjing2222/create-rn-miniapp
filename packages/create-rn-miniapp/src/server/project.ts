import { readFile } from 'node:fs/promises'
import path from 'node:path'
import type { ServerProvider } from '../providers/index.js'
import { pathExists } from '../templates/filesystem.js'

export const SERVER_PROJECT_MODES = ['create', 'existing'] as const

export type ServerProjectMode = (typeof SERVER_PROJECT_MODES)[number]

export const SERVER_REMOTE_INITIALIZATION_STATES = ['applied', 'skipped', 'not-run'] as const

export type ServerRemoteInitializationState = (typeof SERVER_REMOTE_INITIALIZATION_STATES)[number]

export type ServerScaffoldState = {
  serverProvider: 'supabase' | 'cloudflare' | 'firebase'
  serverProjectMode: ServerProjectMode | null
  remoteInitialization: ServerRemoteInitializationState
  trpc: boolean
  backoffice: boolean
}

export const SERVER_SCAFFOLD_STATE_DIR = '.create-rn-miniapp'
export const SERVER_SCAFFOLD_STATE_RELATIVE_PATH = `${SERVER_SCAFFOLD_STATE_DIR}/state.json`

export async function readServerScaffoldState(
  targetRoot: string,
): Promise<ServerScaffoldState | null> {
  const statePath = path.join(targetRoot, 'server', SERVER_SCAFFOLD_STATE_RELATIVE_PATH)

  if (!(await pathExists(statePath))) {
    return null
  }

  return JSON.parse(await readFile(statePath, 'utf8')) as ServerScaffoldState
}

export type ProvisioningNote = {
  title: string
  body: string
}

type SupabaseProvisioningSummary = {
  didApplyRemoteDb: boolean
  didDeployEdgeFunctions: boolean
} | null

type RemoteContentProvisioningSummary = {
  mode?: ServerProjectMode
  didInitializeRemoteContent: boolean
} | null

type FinalServerProvisioningSummary = {
  mode?: ServerProjectMode
  didApplyRemoteDb: boolean
  didDeployEdgeFunctions: boolean
} | null

export function resolveRequestedRemoteInitializationState(options: {
  serverProjectMode: ServerProjectMode | null
  skipServerProvisioning: boolean
}): ServerRemoteInitializationState {
  if (options.skipServerProvisioning || options.serverProjectMode === null) {
    return 'not-run'
  }

  return options.serverProjectMode === 'create' ? 'applied' : 'skipped'
}

export function buildServerScaffoldState(options: {
  serverProvider: ServerProvider | null
  serverProjectMode: ServerProjectMode | null
  remoteInitialization: ServerRemoteInitializationState
  trpc: boolean
  backoffice: boolean
}): ServerScaffoldState | null {
  if (!options.serverProvider) {
    return null
  }

  return {
    serverProvider: options.serverProvider,
    serverProjectMode: options.serverProjectMode,
    remoteInitialization: options.remoteInitialization,
    trpc: options.trpc,
    backoffice: options.backoffice,
  }
}

export function resolveFinalRemoteInitializationState(options: {
  serverProvider: ServerProvider | null
  initialServerState: ServerScaffoldState | null
  provisionedSupabaseProject: SupabaseProvisioningSummary | FinalServerProvisioningSummary
  provisionedCloudflareWorker: RemoteContentProvisioningSummary
  provisionedFirebaseProject: RemoteContentProvisioningSummary
}): ServerRemoteInitializationState {
  const fallback = options.initialServerState?.remoteInitialization ?? 'not-run'

  if (options.serverProvider === 'supabase') {
    return options.provisionedSupabaseProject
      ? options.provisionedSupabaseProject.didApplyRemoteDb ||
        options.provisionedSupabaseProject.didDeployEdgeFunctions
        ? 'applied'
        : 'skipped'
      : fallback
  }

  if (options.serverProvider === 'cloudflare') {
    return options.provisionedCloudflareWorker
      ? options.provisionedCloudflareWorker.didInitializeRemoteContent
        ? 'applied'
        : 'skipped'
      : fallback
  }

  if (options.serverProvider === 'firebase') {
    return options.provisionedFirebaseProject
      ? options.provisionedFirebaseProject.didInitializeRemoteContent
        ? 'applied'
        : 'skipped'
      : fallback
  }

  return 'not-run'
}

export function resolveFinalServerScaffoldState(options: {
  serverProvider: ServerProvider | null
  initialServerState: ServerScaffoldState | null
  fallbackServerProjectMode: ServerProjectMode | null
  fallbackTrpc: boolean
  fallbackBackoffice: boolean
  provisionedSupabaseProject: FinalServerProvisioningSummary
  provisionedCloudflareWorker: RemoteContentProvisioningSummary
  provisionedFirebaseProject: RemoteContentProvisioningSummary
}) {
  return buildServerScaffoldState({
    serverProvider: options.serverProvider,
    serverProjectMode:
      options.provisionedSupabaseProject?.mode ??
      options.provisionedCloudflareWorker?.mode ??
      options.provisionedFirebaseProject?.mode ??
      options.fallbackServerProjectMode,
    remoteInitialization: resolveFinalRemoteInitializationState({
      serverProvider: options.serverProvider,
      initialServerState: options.initialServerState,
      provisionedSupabaseProject: options.provisionedSupabaseProject,
      provisionedCloudflareWorker: options.provisionedCloudflareWorker,
      provisionedFirebaseProject: options.provisionedFirebaseProject,
    }),
    trpc: options.initialServerState?.trpc ?? options.fallbackTrpc,
    backoffice: options.initialServerState?.backoffice ?? options.fallbackBackoffice,
  })
}
