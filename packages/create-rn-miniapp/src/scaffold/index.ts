import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { log } from '@clack/prompts'
import { buildAddCommandPhases, buildCreateCommandPhases, runCommand } from '../commands.js'
import { getPackageManagerAdapter } from '../package-manager.js'
import { patchBackofficeWorkspace, patchFrontendWorkspace } from '../patching/index.js'
import { serverProviderSupportsTrpc } from '../providers/index.js'
import {
  applyDocsTemplates,
  applyRootTemplates,
  ensureEmptyDirectory,
  pathExists,
  syncOptionalDocsTemplates,
  syncRootWorkspaceManifest,
} from '../templates/index.js'
import type { ProvisioningNote } from '../server-project.js'
import { buildRootFinalizePlan, buildRootGitSetupPlan } from './orders.js'
import {
  maybeFinalizeCloudflareProvisioning,
  maybeFinalizeFirebaseProvisioning,
  maybeFinalizeSupabaseProvisioning,
  maybeProvisionCloudflareWorker,
  maybeProvisionFirebaseProject,
  maybeProvisionSupabaseProject,
} from './provisioning.js'
import {
  createTemplateTokens,
  maybePrepareTrpcWorkspace,
  maybeWriteNpmWorkspaceConfig,
  maybePatchServerWorkspace,
  maybePrepareServerWorkspace,
  resolveRootWorkspaces,
} from './helpers.js'
import type { AddWorkspaceOptions, ScaffoldOptions } from './types.js'

export type { AddWorkspaceOptions, ScaffoldOptions } from './types.js'
export {
  buildRootFinalizePlan,
  buildRootGitSetupPlan,
} from './orders.js'
export { buildCreateExecutionOrder, buildCreateLifecycleOrder } from './orders.js'

export async function scaffoldWorkspace(options: ScaffoldOptions) {
  const targetRoot = path.resolve(options.outputDir, options.appName)
  const notes: ProvisioningNote[] = []
  const tokens = createTemplateTokens({
    appName: options.appName,
    displayName: options.displayName,
    packageManager: options.packageManager,
  })

  await ensureEmptyDirectory(targetRoot)

  if (options.serverProvider) {
    await mkdir(path.join(targetRoot, 'server'), { recursive: true })
  }

  const phases = buildCreateCommandPhases({
    appName: options.appName,
    targetRoot,
    packageManager: options.packageManager,
    serverProvider: options.serverProvider,
    withBackoffice: options.withBackoffice,
  })

  const [frontendCreateCommand, ...frontendSetupCommands] = phases.frontend

  if (frontendCreateCommand) {
    log.step(frontendCreateCommand.label)
    await runCommand(frontendCreateCommand)
    await maybeWriteNpmWorkspaceConfig(path.join(targetRoot, 'frontend'), options.packageManager)
  }

  for (const command of frontendSetupCommands) {
    log.step(command.label)
    await runCommand(command)
  }

  for (const command of phases.server) {
    log.step(command.label)
    await runCommand(command)
  }

  await maybePrepareServerWorkspace({
    targetRoot,
    tokens,
    packageManager: options.packageManager,
    serverProvider: options.serverProvider,
  })

  await applyRootTemplates(targetRoot, tokens, await resolveRootWorkspaces(targetRoot))
  await maybePrepareTrpcWorkspace({
    targetRoot,
    tokens,
    withTrpc: options.withTrpc,
    serverProvider: serverProviderSupportsTrpc(options.serverProvider)
      ? options.serverProvider
      : null,
  })
  await maybePatchServerWorkspace({
    targetRoot,
    tokens,
    packageManager: options.packageManager,
    serverProvider: options.serverProvider,
    trpc: options.withTrpc,
  })

  if (options.withTrpc) {
    await syncRootWorkspaceManifest(
      targetRoot,
      options.packageManager,
      await resolveRootWorkspaces(targetRoot),
    )
  }

  if (options.serverProvider === 'cloudflare' && options.withTrpc) {
    const packageManager = getPackageManagerAdapter(options.packageManager)
    log.step('루트 tRPC workspace 의존성을 먼저 설치할게요')
    await runCommand({
      cwd: targetRoot,
      ...packageManager.install(),
      label: '루트 tRPC workspace 의존성을 먼저 설치할게요',
    })
  }

  const provisionedSupabaseProject = await maybeProvisionSupabaseProject({
    targetRoot,
    packageManager: options.packageManager,
    prompt: options.prompt,
    serverProvider: options.serverProvider,
    serverProjectMode: options.serverProjectMode,
    skipServerProvisioning: options.skipServerProvisioning,
  })
  const provisionedCloudflareWorker = await maybeProvisionCloudflareWorker({
    targetRoot,
    packageManager: options.packageManager,
    prompt: options.prompt,
    serverProvider: options.serverProvider,
    serverProjectMode: options.serverProjectMode,
    appName: options.appName,
    skipServerProvisioning: options.skipServerProvisioning,
  })
  const provisionedFirebaseProject = await maybeProvisionFirebaseProject({
    targetRoot,
    packageManager: options.packageManager,
    prompt: options.prompt,
    serverProvider: options.serverProvider,
    serverProjectMode: options.serverProjectMode,
    appName: options.appName,
    displayName: options.displayName,
    skipServerProvisioning: options.skipServerProvisioning,
  })

  for (const command of phases.backoffice) {
    log.step(command.label)
    await runCommand(command)
  }

  if (options.withBackoffice && (await pathExists(path.join(targetRoot, 'backoffice')))) {
    await maybeWriteNpmWorkspaceConfig(path.join(targetRoot, 'backoffice'), options.packageManager)
  }

  if (options.withBackoffice || options.withTrpc) {
    await syncRootWorkspaceManifest(
      targetRoot,
      options.packageManager,
      await resolveRootWorkspaces(targetRoot),
    )
  }
  await applyDocsTemplates(targetRoot, tokens)
  await syncOptionalDocsTemplates(targetRoot, tokens, {
    hasBackoffice:
      options.withBackoffice && (await pathExists(path.join(targetRoot, 'backoffice'))),
    serverProvider: options.serverProvider,
    hasTrpc: options.withTrpc,
  })
  await patchFrontendWorkspace(targetRoot, tokens, {
    packageManager: options.packageManager,
    serverProvider: options.serverProvider,
    trpc: options.withTrpc,
    removeCloudflareApiClientHelpers: options.serverProvider === 'cloudflare' && options.withTrpc,
  })

  if (options.withBackoffice && (await pathExists(path.join(targetRoot, 'backoffice')))) {
    await patchBackofficeWorkspace(targetRoot, tokens, {
      packageManager: options.packageManager,
      serverProvider: options.serverProvider,
      trpc: options.withTrpc,
      removeCloudflareApiClientHelpers: options.serverProvider === 'cloudflare' && options.withTrpc,
    })
  }

  notes.push(
    ...(await maybeFinalizeSupabaseProvisioning({
      targetRoot,
      provisionedProject: provisionedSupabaseProject,
      serverProvider: options.serverProvider,
    })),
  )
  notes.push(
    ...(await maybeFinalizeCloudflareProvisioning({
      targetRoot,
      provisionedWorker: provisionedCloudflareWorker,
      serverProvider: options.serverProvider,
    })),
  )
  notes.push(
    ...(await maybeFinalizeFirebaseProvisioning({
      targetRoot,
      provisionedProject: provisionedFirebaseProject,
      serverProvider: options.serverProvider,
    })),
  )

  if (!options.noGit) {
    for (const command of buildRootGitSetupPlan({ targetRoot })) {
      log.step(command.label)
      await runCommand(command)
    }
  }

  if (!options.skipInstall) {
    for (const command of buildRootFinalizePlan({
      targetRoot,
      packageManager: options.packageManager,
    })) {
      log.step(command.label)
      await runCommand(command)
    }
  }

  return { targetRoot, notes }
}

export async function addWorkspaces(options: AddWorkspaceOptions) {
  const targetRoot = path.resolve(options.rootDir)
  const notes: ProvisioningNote[] = []
  const tokens = createTemplateTokens({
    appName: options.appName,
    displayName: options.displayName,
    packageManager: options.packageManager,
  })
  const trpcServerProvider = options.serverProvider ?? options.existingServerProvider

  if (options.withServer) {
    await mkdir(path.join(targetRoot, 'server'), { recursive: true })
  }

  const phases = buildAddCommandPhases({
    targetRoot,
    packageManager: options.packageManager,
    serverProvider: options.serverProvider,
    withBackoffice: options.withBackoffice,
  })

  for (const command of phases.server) {
    log.step(command.label)
    await runCommand(command)
  }

  await maybePrepareServerWorkspace({
    targetRoot,
    tokens,
    packageManager: options.packageManager,
    serverProvider: options.serverProvider,
  })
  await maybePrepareTrpcWorkspace({
    targetRoot,
    tokens,
    withTrpc: options.withTrpc,
    serverProvider:
      trpcServerProvider === 'supabase' || trpcServerProvider === 'cloudflare'
        ? trpcServerProvider
        : null,
  })

  await maybePatchServerWorkspace({
    targetRoot,
    tokens,
    packageManager: options.packageManager,
    serverProvider: options.withServer
      ? options.serverProvider
      : options.withTrpc
        ? options.existingServerProvider
        : null,
    trpc: options.withTrpc,
  })

  if (options.withTrpc) {
    await syncRootWorkspaceManifest(
      targetRoot,
      options.packageManager,
      await resolveRootWorkspaces(targetRoot),
    )
  }

  if (options.withServer && options.serverProvider === 'cloudflare' && options.withTrpc) {
    const packageManager = getPackageManagerAdapter(options.packageManager)
    log.step('루트 tRPC workspace 의존성을 먼저 설치할게요')
    await runCommand({
      cwd: targetRoot,
      ...packageManager.install(),
      label: '루트 tRPC workspace 의존성을 먼저 설치할게요',
    })
  }

  const provisionedSupabaseProject = options.withServer
    ? await maybeProvisionSupabaseProject({
        targetRoot,
        packageManager: options.packageManager,
        prompt: options.prompt,
        serverProvider: options.serverProvider,
        serverProjectMode: options.serverProjectMode,
        skipServerProvisioning: options.skipServerProvisioning,
      })
    : null
  const provisionedCloudflareWorker = options.withServer
    ? await maybeProvisionCloudflareWorker({
        targetRoot,
        packageManager: options.packageManager,
        prompt: options.prompt,
        serverProvider: options.serverProvider,
        serverProjectMode: options.serverProjectMode,
        appName: options.appName,
        skipServerProvisioning: options.skipServerProvisioning,
      })
    : null
  const provisionedFirebaseProject = options.withServer
    ? await maybeProvisionFirebaseProject({
        targetRoot,
        packageManager: options.packageManager,
        prompt: options.prompt,
        serverProvider: options.serverProvider,
        serverProjectMode: options.serverProjectMode,
        appName: options.appName,
        displayName: options.displayName,
        skipServerProvisioning: options.skipServerProvisioning,
      })
    : null

  for (const command of phases.backoffice) {
    log.step(command.label)
    await runCommand(command)
  }

  if (options.withBackoffice && (await pathExists(path.join(targetRoot, 'backoffice')))) {
    await maybeWriteNpmWorkspaceConfig(path.join(targetRoot, 'backoffice'), options.packageManager)
  }

  await syncRootWorkspaceManifest(
    targetRoot,
    options.packageManager,
    await resolveRootWorkspaces(targetRoot),
  )

  const finalServerProvider = options.existingServerProvider ?? options.serverProvider
  await syncOptionalDocsTemplates(targetRoot, tokens, {
    hasBackoffice: await pathExists(path.join(targetRoot, 'backoffice')),
    serverProvider: finalServerProvider,
    hasTrpc: options.withTrpc,
  })

  if (
    (options.withServer || options.withTrpc) &&
    (await pathExists(path.join(targetRoot, 'frontend')))
  ) {
    await patchFrontendWorkspace(targetRoot, tokens, {
      packageManager: options.packageManager,
      serverProvider: finalServerProvider,
      trpc: options.withTrpc,
      removeCloudflareApiClientHelpers: options.removeCloudflareApiClientHelpers,
    })
  }

  if (
    (options.withBackoffice || options.withServer || options.withTrpc) &&
    (await pathExists(path.join(targetRoot, 'backoffice')))
  ) {
    await patchBackofficeWorkspace(targetRoot, tokens, {
      packageManager: options.packageManager,
      serverProvider: finalServerProvider,
      trpc: options.withTrpc,
      removeCloudflareApiClientHelpers: options.removeCloudflareApiClientHelpers,
    })
  }

  if (options.withServer) {
    notes.push(
      ...(await maybeFinalizeSupabaseProvisioning({
        targetRoot,
        provisionedProject: provisionedSupabaseProject,
        serverProvider: options.serverProvider,
      })),
    )
    notes.push(
      ...(await maybeFinalizeCloudflareProvisioning({
        targetRoot,
        provisionedWorker: provisionedCloudflareWorker,
        serverProvider: options.serverProvider,
      })),
    )
    notes.push(
      ...(await maybeFinalizeFirebaseProvisioning({
        targetRoot,
        provisionedProject: provisionedFirebaseProject,
        serverProvider: options.serverProvider,
      })),
    )
  }

  if (!options.skipInstall) {
    for (const command of buildRootFinalizePlan({
      targetRoot,
      packageManager: options.packageManager,
    })) {
      log.step(command.label)
      await runCommand(command)
    }
  }

  return { targetRoot, notes }
}
