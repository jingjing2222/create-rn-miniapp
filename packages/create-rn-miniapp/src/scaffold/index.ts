import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { log } from '@clack/prompts'
import { buildAddCommandPhases, buildCreateCommandPhases, runCommand } from '../commands.js'
import { patchBackofficeWorkspace, patchFrontendWorkspace } from '../patching/index.js'
import { getServerProviderAdapter } from '../providers/index.js'
import {
  applyDocsTemplates,
  applyRootTemplates,
  ensureEmptyDirectory,
  pathExists,
  syncOptionalDocsTemplates,
  syncRootWorkspaceManifest,
} from '../templates/index.js'
import type { ProvisioningNote } from '../server-project.js'
import {
  buildRootFinalizePlan,
  buildCreateExecutionOrder,
  buildCreateLifecycleOrder,
} from './orders.js'
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
  maybePatchServerWorkspace,
  maybePrepareServerWorkspace,
  resolveRootWorkspaces,
} from './helpers.js'
import type { AddWorkspaceOptions, ScaffoldOptions } from './types.js'

export type { AddWorkspaceOptions, ScaffoldOptions } from './types.js'
export {
  buildRootFinalizePlan,
  buildCreateExecutionOrder,
  buildCreateLifecycleOrder,
} from './orders.js'

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

  for (const command of phases.frontend) {
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
  await maybePatchServerWorkspace({
    targetRoot,
    tokens,
    packageManager: options.packageManager,
    serverProvider: options.serverProvider,
  })

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

  if (options.withBackoffice) {
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
  })
  await patchFrontendWorkspace(targetRoot, tokens, {
    packageManager: options.packageManager,
    serverProvider: options.serverProvider,
  })

  if (options.withBackoffice && (await pathExists(path.join(targetRoot, 'backoffice')))) {
    await patchBackofficeWorkspace(targetRoot, tokens, {
      packageManager: options.packageManager,
      serverProvider: options.serverProvider,
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
    log.step('루트 git init')
    await runCommand({
      cwd: targetRoot,
      command: 'git',
      args: ['init'],
      label: '루트 git init',
    })
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

  await maybePatchServerWorkspace({
    targetRoot,
    tokens,
    packageManager: options.packageManager,
    serverProvider: options.withServer ? options.serverProvider : null,
  })

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

  await syncRootWorkspaceManifest(
    targetRoot,
    options.packageManager,
    await resolveRootWorkspaces(targetRoot),
  )

  const finalServerProvider = options.existingServerProvider ?? options.serverProvider
  await syncOptionalDocsTemplates(targetRoot, tokens, {
    hasBackoffice: await pathExists(path.join(targetRoot, 'backoffice')),
    serverProvider: finalServerProvider,
  })

  if (options.withServer && (await pathExists(path.join(targetRoot, 'server')))) {
    if (!options.serverProvider) {
      throw new Error('추가할 server 제공자를 결정하지 못했습니다.')
    }

    const serverProvider = getServerProviderAdapter(options.serverProvider)

    await serverProvider.bootstrapFrontend?.({
      targetRoot,
      tokens,
    })
  }

  if (options.withBackoffice && (await pathExists(path.join(targetRoot, 'backoffice')))) {
    await patchBackofficeWorkspace(targetRoot, tokens, {
      packageManager: options.packageManager,
      serverProvider: finalServerProvider,
    })
  } else if (
    options.withServer &&
    options.existingHasBackoffice &&
    (await pathExists(path.join(targetRoot, 'backoffice')))
  ) {
    if (!finalServerProvider) {
      throw new Error('기존 server 제공자를 결정하지 못했습니다.')
    }

    const serverProvider = getServerProviderAdapter(finalServerProvider)

    await serverProvider.bootstrapBackoffice?.({
      targetRoot,
      tokens,
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
