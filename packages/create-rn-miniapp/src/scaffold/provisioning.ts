import path from 'node:path'
import type { CliPrompter } from '../cli.js'
import type { PackageManager } from '../package-manager.js'
import {
  finalizeCloudflareProvisioning,
  type ProvisionedCloudflareWorker,
  provisionCloudflareWorker,
} from '../providers/cloudflare/provision.js'
import {
  finalizeFirebaseProvisioning,
  type ProvisionedFirebaseProject,
  provisionFirebaseProject,
} from '../providers/firebase/provision.js'
import type { ServerProvider } from '../providers/index.js'
import {
  finalizeSupabaseProvisioning,
  type ProvisionedSupabaseProject,
  provisionSupabaseProject,
} from '../providers/supabase/provision.js'
import type { ProvisioningNote, ServerProjectMode } from '../server-project.js'
import { pathExists } from '../templates/index.js'

export async function maybeProvisionSupabaseProject(options: {
  targetRoot: string
  packageManager: PackageManager
  prompt: CliPrompter
  serverProvider: ServerProvider | null
  serverProjectMode: ServerProjectMode | null
  skipServerProvisioning: boolean
}) {
  if (
    options.skipServerProvisioning ||
    options.serverProvider !== 'supabase' ||
    !(await pathExists(path.join(options.targetRoot, 'server')))
  ) {
    return null
  }

  return await provisionSupabaseProject({
    targetRoot: options.targetRoot,
    packageManager: options.packageManager,
    prompt: options.prompt,
    projectMode: options.serverProjectMode,
  })
}

export async function maybeFinalizeSupabaseProvisioning(options: {
  targetRoot: string
  provisionedProject: ProvisionedSupabaseProject | null
  serverProvider: ServerProvider | null
}) {
  if (options.serverProvider !== 'supabase') {
    return [] satisfies ProvisioningNote[]
  }

  return await finalizeSupabaseProvisioning({
    targetRoot: options.targetRoot,
    provisionedProject: options.provisionedProject,
  })
}

export async function maybeProvisionCloudflareWorker(options: {
  targetRoot: string
  packageManager: PackageManager
  prompt: CliPrompter
  serverProvider: ServerProvider | null
  serverProjectMode: ServerProjectMode | null
  appName: string
  skipServerProvisioning: boolean
}) {
  if (
    options.skipServerProvisioning ||
    options.serverProvider !== 'cloudflare' ||
    !(await pathExists(path.join(options.targetRoot, 'server')))
  ) {
    return null
  }

  return await provisionCloudflareWorker({
    targetRoot: options.targetRoot,
    packageManager: options.packageManager,
    prompt: options.prompt,
    projectMode: options.serverProjectMode,
    appName: options.appName,
  })
}

export async function maybeFinalizeCloudflareProvisioning(options: {
  targetRoot: string
  provisionedWorker: ProvisionedCloudflareWorker | null
  serverProvider: ServerProvider | null
}) {
  if (options.serverProvider !== 'cloudflare') {
    return [] satisfies ProvisioningNote[]
  }

  return await finalizeCloudflareProvisioning({
    targetRoot: options.targetRoot,
    provisionedWorker: options.provisionedWorker,
  })
}

export async function maybeProvisionFirebaseProject(options: {
  targetRoot: string
  packageManager: PackageManager
  prompt: CliPrompter
  serverProvider: ServerProvider | null
  serverProjectMode: ServerProjectMode | null
  appName: string
  displayName: string
  skipServerProvisioning: boolean
}) {
  if (
    options.skipServerProvisioning ||
    options.serverProvider !== 'firebase' ||
    !(await pathExists(path.join(options.targetRoot, 'server')))
  ) {
    return null
  }

  return await provisionFirebaseProject({
    targetRoot: options.targetRoot,
    packageManager: options.packageManager,
    prompt: options.prompt,
    projectMode: options.serverProjectMode,
    appName: options.appName,
    displayName: options.displayName,
  })
}

export async function maybeFinalizeFirebaseProvisioning(options: {
  targetRoot: string
  packageManager: PackageManager
  provisionedProject: ProvisionedFirebaseProject | null
  serverProvider: ServerProvider | null
}) {
  if (options.serverProvider !== 'firebase') {
    return [] satisfies ProvisioningNote[]
  }

  return await finalizeFirebaseProvisioning({
    targetRoot: options.targetRoot,
    packageManager: options.packageManager,
    provisionedProject: options.provisionedProject,
  })
}
