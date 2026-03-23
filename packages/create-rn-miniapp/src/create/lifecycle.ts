import type { CreateCommandPhases } from './context.js'
import type { ServerProvider } from '../providers/index.js'
import {
  CLOUDFLARE_PREINSTALL_LABEL,
  ROOT_GIT_SETUP_LABELS,
  ROOT_TEMPLATE_APPLY_LABEL,
  ROOT_WORKSPACE_MANIFEST_BEFORE_PROVISIONING_LABEL,
  ROOT_WORKSPACE_MANIFEST_SYNC_LABEL,
  SERVER_PROVISIONING_LABEL,
  SERVER_WORKSPACE_PATCH_LABEL,
  SERVER_WORKSPACE_PREPARE_LABEL,
} from '../scaffold/lifecycle-labels.js'

type CreateLifecycleOptions = {
  commandPhases: CreateCommandPhases | null
  noGit?: boolean
  serverProvider: ServerProvider | null
  trpcEnabled: boolean
  withBackoffice: boolean
}

export function listCreateScaffoldLifecycleLabels(options: CreateLifecycleOptions) {
  const labels = [
    ...(options.commandPhases?.frontend ?? []).map((command) => command.label),
    ...(options.commandPhases?.server ?? []).map((command) => command.label),
  ]

  if (options.serverProvider) {
    labels.push(SERVER_WORKSPACE_PREPARE_LABEL)
  }

  labels.push(ROOT_TEMPLATE_APPLY_LABEL)

  if (options.serverProvider) {
    labels.push(SERVER_WORKSPACE_PATCH_LABEL)
  }

  if (options.trpcEnabled) {
    labels.push(ROOT_WORKSPACE_MANIFEST_BEFORE_PROVISIONING_LABEL)
  }

  if (options.serverProvider === 'cloudflare') {
    labels.push(CLOUDFLARE_PREINSTALL_LABEL)
  }

  return labels
}

export function listCreateProvisionLifecycleLabels(options: CreateLifecycleOptions) {
  return options.serverProvider ? [SERVER_PROVISIONING_LABEL] : []
}

export function listCreatePatchLifecycleLabels(options: CreateLifecycleOptions) {
  const labels = [...(options.commandPhases?.backoffice ?? []).map((command) => command.label)]

  if (options.withBackoffice || options.trpcEnabled) {
    labels.push(ROOT_WORKSPACE_MANIFEST_SYNC_LABEL)
  }

  return labels
}

export function listCreateFinalizeLifecycleLabels(options: CreateLifecycleOptions) {
  return options.noGit ? [] : [...ROOT_GIT_SETUP_LABELS]
}
