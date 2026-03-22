import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { log } from '@clack/prompts'
import {
  buildAddCommandPhases,
  buildCreateCommandPhases,
  runCommand,
  runCommandWithOutput,
} from '../commands.js'
import { getPackageManagerAdapter } from '../package-manager.js'
import { patchBackofficeWorkspace } from '../patching/backoffice.js'
import { patchFrontendWorkspace } from '../patching/frontend.js'
import { writeServerScaffoldState } from '../patching/server.js'
import { ensureEmptyDirectory, pathExists } from '../templates/filesystem.js'
import {
  applyRootTemplates,
  syncRootFrontendPolicyFiles,
  syncRootWorkspaceManifest,
} from '../templates/root.js'
import { applyDocsTemplates } from '../templates/docs.js'
import {
  buildSkillsInstallCommand,
  listInstalledProjectSkillEntries,
  renderInstalledSkillsSummary,
  renderSkillsAddCommand,
} from '../skills-install.js'
import type {
  ProvisioningNote,
  ServerProjectMode,
  ServerRemoteInitializationState,
  ServerScaffoldState,
} from '../server-project.js'
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
import dedent from '../dedent.js'

export type { AddWorkspaceOptions, ScaffoldOptions } from './types.js'
export {
  buildRootFinalizePlan,
  buildRootGitSetupPlan,
} from './orders.js'
export { buildCreateExecutionOrder, buildCreateLifecycleOrder } from './orders.js'

function resolveRequestedRemoteInitializationState(options: {
  serverProjectMode: ServerProjectMode | null
  skipServerProvisioning: boolean
}): ServerRemoteInitializationState {
  if (options.skipServerProvisioning || options.serverProjectMode === null) {
    return 'not-run'
  }

  return options.serverProjectMode === 'create' ? 'applied' : 'skipped'
}

function buildServerScaffoldState(options: {
  serverProvider: 'supabase' | 'cloudflare' | 'firebase' | null
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

function buildAddInitialServerState(options: {
  existingState: ServerScaffoldState | null
  existingServerProvider: 'supabase' | 'cloudflare' | 'firebase' | null
  serverProvider: 'supabase' | 'cloudflare' | 'firebase' | null
  serverProjectMode: ServerProjectMode | null
  skipServerProvisioning: boolean
  withServer: boolean
  withTrpc: boolean
  existingHasTrpc: boolean
  withBackoffice: boolean
  existingHasBackoffice: boolean
}) {
  const serverProvider = options.withServer
    ? options.serverProvider
    : (options.serverProvider ?? options.existingServerProvider)

  if (!serverProvider) {
    return null
  }

  if (options.withServer) {
    return buildServerScaffoldState({
      serverProvider,
      serverProjectMode: options.serverProjectMode,
      remoteInitialization: resolveRequestedRemoteInitializationState({
        serverProjectMode: options.serverProjectMode,
        skipServerProvisioning: options.skipServerProvisioning,
      }),
      trpc: options.withTrpc,
      backoffice: options.withBackoffice || options.existingHasBackoffice,
    })
  }

  return {
    serverProvider,
    serverProjectMode: options.existingState?.serverProjectMode ?? null,
    remoteInitialization: options.existingState?.remoteInitialization ?? 'not-run',
    trpc: options.withTrpc || options.existingState?.trpc === true || options.existingHasTrpc,
    backoffice:
      options.withBackoffice ||
      options.existingState?.backoffice === true ||
      options.existingHasBackoffice,
  } satisfies ServerScaffoldState
}

async function maybeInstallSelectedSkills(options: {
  targetRoot: string
  packageManager: AddWorkspaceOptions['packageManager'] | ScaffoldOptions['packageManager']
  selectedSkills: ScaffoldOptions['selectedSkills']
}) {
  const installCommand = await buildSkillsInstallCommand({
    packageManager: options.packageManager,
    targetRoot: options.targetRoot,
    skillIds: options.selectedSkills,
  })

  if (!installCommand) {
    return {
      didInstall: false,
      notes: [] as ProvisioningNote[],
    }
  }

  try {
    log.step(installCommand.label)
    await runCommandWithOutput(installCommand)
    const installedSkills = await listInstalledProjectSkillEntries(options.targetRoot)

    return {
      didInstall: true,
      notes: [
        {
          title: 'Agent skills',
          body: renderInstalledSkillsSummary(
            installedSkills.length > 0 ? installedSkills : options.selectedSkills,
          ),
        },
      ] satisfies ProvisioningNote[],
    }
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : '추천 agent skills 설치 중 알 수 없는 오류가 있었어요.'

    return {
      didInstall: false,
      notes: [
        {
          title: 'Agent skills',
          body: dedent`
            추천 agent skills 자동 설치는 건너뛰었어요.
            ${message}
            필요하면 나중에 직접 실행해 주세요: \`${renderSkillsAddCommand(options.selectedSkills)}\`
          `,
        },
      ] satisfies ProvisioningNote[],
    }
  }
}

export async function scaffoldWorkspace(options: ScaffoldOptions) {
  const targetRoot = path.resolve(options.outputDir, options.appName)
  const notes: ProvisioningNote[] = []
  const trpcEnabled = options.withTrpc && options.serverProvider === 'cloudflare'
  const initialServerState = buildServerScaffoldState({
    serverProvider: options.serverProvider,
    serverProjectMode: options.serverProjectMode,
    remoteInitialization: resolveRequestedRemoteInitializationState({
      serverProjectMode: options.serverProjectMode,
      skipServerProvisioning: options.skipServerProvisioning,
    }),
    trpc: trpcEnabled,
    backoffice: options.withBackoffice,
  })
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
    withTrpc: trpcEnabled,
    serverProvider: trpcEnabled ? 'cloudflare' : null,
  })
  await maybePatchServerWorkspace({
    targetRoot,
    tokens,
    packageManager: options.packageManager,
    serverProvider: options.serverProvider,
    state: initialServerState,
    trpc: trpcEnabled,
  })

  if (trpcEnabled) {
    await syncRootWorkspaceManifest(
      targetRoot,
      options.packageManager,
      await resolveRootWorkspaces(targetRoot),
    )
  }

  if (trpcEnabled) {
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

  if (options.withBackoffice || trpcEnabled) {
    await syncRootWorkspaceManifest(
      targetRoot,
      options.packageManager,
      await resolveRootWorkspaces(targetRoot),
    )
  }

  const installedSkills = await maybeInstallSelectedSkills({
    targetRoot,
    packageManager: options.packageManager,
    selectedSkills: options.selectedSkills,
  })

  if (installedSkills.didInstall) {
    await syncRootFrontendPolicyFiles(targetRoot, options.packageManager)
  }

  await applyDocsTemplates(targetRoot, tokens, {
    serverProvider: options.serverProvider,
  })
  await patchFrontendWorkspace(targetRoot, tokens, {
    packageManager: options.packageManager,
    serverProvider: options.serverProvider,
    trpc: trpcEnabled,
    removeCloudflareApiClientHelpers: trpcEnabled,
  })

  if (options.withBackoffice && (await pathExists(path.join(targetRoot, 'backoffice')))) {
    await patchBackofficeWorkspace(targetRoot, tokens, {
      packageManager: options.packageManager,
      serverProvider: options.serverProvider,
      trpc: trpcEnabled,
      removeCloudflareApiClientHelpers: trpcEnabled,
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
      packageManager: options.packageManager,
      provisionedProject: provisionedFirebaseProject,
      serverProvider: options.serverProvider,
    })),
  )
  notes.push(...installedSkills.notes)

  const finalServerState = buildServerScaffoldState({
    serverProvider: options.serverProvider,
    serverProjectMode:
      provisionedSupabaseProject?.mode ??
      provisionedCloudflareWorker?.mode ??
      provisionedFirebaseProject?.mode ??
      options.serverProjectMode,
    remoteInitialization:
      options.serverProvider === 'supabase'
        ? provisionedSupabaseProject
          ? provisionedSupabaseProject.didApplyRemoteDb ||
            provisionedSupabaseProject.didDeployEdgeFunctions
            ? 'applied'
            : 'skipped'
          : (initialServerState?.remoteInitialization ?? 'not-run')
        : options.serverProvider === 'cloudflare'
          ? provisionedCloudflareWorker
            ? provisionedCloudflareWorker.didInitializeRemoteContent
              ? 'applied'
              : 'skipped'
            : (initialServerState?.remoteInitialization ?? 'not-run')
          : options.serverProvider === 'firebase'
            ? provisionedFirebaseProject
              ? provisionedFirebaseProject.didInitializeRemoteContent
                ? 'applied'
                : 'skipped'
              : (initialServerState?.remoteInitialization ?? 'not-run')
            : 'not-run',
    trpc: initialServerState?.trpc ?? trpcEnabled,
    backoffice: initialServerState?.backoffice ?? options.withBackoffice,
  })

  if (finalServerState) {
    await writeServerScaffoldState(targetRoot, finalServerState)
  }

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
      serverProvider: options.serverProvider,
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
  const trpcEnabled = options.withTrpc && trpcServerProvider === 'cloudflare'
  const initialServerState = buildAddInitialServerState({
    existingState: options.existingServerScaffoldState,
    existingServerProvider: options.existingServerProvider,
    serverProvider: options.serverProvider,
    serverProjectMode: options.serverProjectMode,
    skipServerProvisioning: options.skipServerProvisioning,
    withServer: options.withServer,
    withTrpc: trpcEnabled,
    existingHasTrpc: options.existingHasTrpc,
    withBackoffice: options.withBackoffice,
    existingHasBackoffice: options.existingHasBackoffice,
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
  await maybePrepareTrpcWorkspace({
    targetRoot,
    tokens,
    withTrpc: trpcEnabled,
    serverProvider: trpcEnabled ? 'cloudflare' : null,
  })

  await maybePatchServerWorkspace({
    targetRoot,
    tokens,
    packageManager: options.packageManager,
    serverProvider: options.withServer
      ? options.serverProvider
      : trpcEnabled
        ? options.existingServerProvider
        : null,
    state: initialServerState,
    trpc: trpcEnabled,
  })

  if (trpcEnabled) {
    await syncRootWorkspaceManifest(
      targetRoot,
      options.packageManager,
      await resolveRootWorkspaces(targetRoot),
    )
  }

  if (options.withServer && options.serverProvider === 'cloudflare' && trpcEnabled) {
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
  await applyDocsTemplates(targetRoot, tokens, { serverProvider: finalServerProvider })

  if (
    (options.withServer || trpcEnabled) &&
    (await pathExists(path.join(targetRoot, 'frontend')))
  ) {
    await patchFrontendWorkspace(targetRoot, tokens, {
      packageManager: options.packageManager,
      serverProvider: finalServerProvider,
      trpc: trpcEnabled,
      removeCloudflareApiClientHelpers: trpcEnabled && options.removeCloudflareApiClientHelpers,
    })
  }

  if (
    (options.withBackoffice || options.withServer || trpcEnabled) &&
    (await pathExists(path.join(targetRoot, 'backoffice')))
  ) {
    await patchBackofficeWorkspace(targetRoot, tokens, {
      packageManager: options.packageManager,
      serverProvider: finalServerProvider,
      trpc: trpcEnabled,
      removeCloudflareApiClientHelpers: trpcEnabled && options.removeCloudflareApiClientHelpers,
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
        packageManager: options.packageManager,
        provisionedProject: provisionedFirebaseProject,
        serverProvider: options.serverProvider,
      })),
    )
  }

  const finalServerState = buildServerScaffoldState({
    serverProvider: finalServerProvider,
    serverProjectMode:
      provisionedSupabaseProject?.mode ??
      provisionedCloudflareWorker?.mode ??
      provisionedFirebaseProject?.mode ??
      initialServerState?.serverProjectMode ??
      options.serverProjectMode,
    remoteInitialization:
      finalServerProvider === 'supabase'
        ? provisionedSupabaseProject
          ? provisionedSupabaseProject.didApplyRemoteDb ||
            provisionedSupabaseProject.didDeployEdgeFunctions
            ? 'applied'
            : 'skipped'
          : (initialServerState?.remoteInitialization ?? 'not-run')
        : finalServerProvider === 'cloudflare'
          ? provisionedCloudflareWorker
            ? provisionedCloudflareWorker.didInitializeRemoteContent
              ? 'applied'
              : 'skipped'
            : (initialServerState?.remoteInitialization ?? 'not-run')
          : finalServerProvider === 'firebase'
            ? provisionedFirebaseProject
              ? provisionedFirebaseProject.didInitializeRemoteContent
                ? 'applied'
                : 'skipped'
              : (initialServerState?.remoteInitialization ?? 'not-run')
            : 'not-run',
    trpc: initialServerState?.trpc ?? trpcEnabled,
    backoffice: initialServerState?.backoffice ?? options.withBackoffice,
  })

  if (finalServerState) {
    await writeServerScaffoldState(targetRoot, finalServerState)
  }

  if (!options.skipInstall) {
    for (const command of buildRootFinalizePlan({
      targetRoot,
      packageManager: options.packageManager,
      serverProvider: options.existingServerProvider ?? options.serverProvider,
    })) {
      log.step(command.label)
      await runCommand(command)
    }
  }

  return { targetRoot, notes }
}
