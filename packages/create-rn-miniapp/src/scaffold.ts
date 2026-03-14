import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { log } from '@clack/prompts'
import {
  finalizeCloudflareProvisioning,
  provisionCloudflareWorker,
  type ProvisionedCloudflareWorker,
} from './cloudflare-provision.js'
import {
  buildAddCommandPhases,
  buildCreateCommandPhases,
  runCommand,
  type CommandSpec,
} from './commands.js'
import type { CliPrompter } from './cli.js'
import { getPackageManagerAdapter, type PackageManager } from './package-manager.js'
import { patchBackofficeWorkspace, patchFrontendWorkspace } from './patch.js'
import type { ProvisioningNote, ServerProjectMode } from './server-project.js'
import { getServerProviderAdapter, type ServerProvider } from './server-provider.js'
import {
  finalizeSupabaseProvisioning,
  provisionSupabaseProject,
  type ProvisionedSupabaseProject,
} from './supabase-provision.js'
import {
  type TemplateTokens,
  type WorkspaceName,
  applyDocsTemplates,
  applyRootTemplates,
  ensureEmptyDirectory,
  pathExists,
  syncRootWorkspaceManifest,
} from './templates.js'

export type ScaffoldOptions = {
  prompt: CliPrompter
  packageManager: PackageManager
  appName: string
  displayName: string
  outputDir: string
  serverProvider: ServerProvider | null
  serverProjectMode: ServerProjectMode | null
  skipServerProvisioning: boolean
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
  serverProvider: ServerProvider | null
  serverProjectMode: ServerProjectMode | null
  skipServerProvisioning: boolean
  withServer: boolean
  withBackoffice: boolean
  skipInstall: boolean
}

export function buildRootFinalizePlan(options: {
  targetRoot: string
  packageManager: PackageManager
}) {
  const packageManager = getPackageManagerAdapter(options.packageManager)
  const plan: CommandSpec[] = [
    {
      cwd: options.targetRoot,
      ...packageManager.install(),
      label: `루트 ${options.packageManager} install`,
    },
  ]

  if (options.packageManager === 'yarn') {
    plan.push({
      cwd: options.targetRoot,
      ...packageManager.dlx('@yarnpkg/sdks', ['base']),
      label: '루트 yarn sdks 생성',
    })
  }

  plan.push({
    cwd: options.targetRoot,
    ...packageManager.exec('biome', ['check', '.', '--write', '--unsafe']),
    label: '루트 biome check --write --unsafe',
  })

  return plan
}

export function buildCreateExecutionOrder(options: {
  appName: string
  targetRoot: string
  packageManager: PackageManager
  serverProvider: ServerProvider | null
  withBackoffice: boolean
}) {
  const phases = buildCreateCommandPhases(options)

  return [
    ...phases.frontend.map((command) => command.label),
    ...phases.server.map((command) => command.label),
    ...phases.backoffice.map((command) => command.label),
  ]
}

async function resolveRootWorkspaces(targetRoot: string) {
  const workspaces: WorkspaceName[] = []

  for (const workspace of ['frontend', 'server', 'backoffice'] as const) {
    if (await pathExists(path.join(targetRoot, workspace))) {
      workspaces.push(workspace)
    }
  }

  return workspaces
}

async function maybeProvisionSupabaseProject(options: {
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

async function maybeFinalizeSupabaseProvisioning(options: {
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

async function maybeProvisionCloudflareWorker(options: {
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

async function maybeFinalizeCloudflareProvisioning(options: {
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

export async function scaffoldWorkspace(options: ScaffoldOptions) {
  const targetRoot = path.resolve(options.outputDir, options.appName)
  const packageManager = getPackageManagerAdapter(options.packageManager)
  const notes: ProvisioningNote[] = []
  const tokens: TemplateTokens = {
    appName: options.appName,
    displayName: options.displayName,
    packageManager: options.packageManager,
    packageManagerCommand: options.packageManager,
    packageManagerExecCommand: `${options.packageManager} exec`,
    verifyCommand: packageManager.verifyCommand(),
  }

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

  for (const command of phases.backoffice) {
    log.step(command.label)
    await runCommand(command)
  }

  await applyRootTemplates(targetRoot, tokens, await resolveRootWorkspaces(targetRoot))
  await applyDocsTemplates(targetRoot, tokens)
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

  if (options.serverProvider && (await pathExists(path.join(targetRoot, 'server')))) {
    const serverProvider = getServerProviderAdapter(options.serverProvider)

    await serverProvider.patchServerWorkspace({
      targetRoot,
      tokens,
      packageManager: options.packageManager,
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
  const packageManager = getPackageManagerAdapter(options.packageManager)
  const notes: ProvisioningNote[] = []
  const tokens: TemplateTokens = {
    appName: options.appName,
    displayName: options.displayName,
    packageManager: options.packageManager,
    packageManagerCommand: options.packageManager,
    packageManagerExecCommand: `${options.packageManager} exec`,
    verifyCommand: packageManager.verifyCommand(),
  }

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

  if (options.withServer && (await pathExists(path.join(targetRoot, 'server')))) {
    if (!options.serverProvider) {
      throw new Error('추가할 server 제공자를 결정하지 못했습니다.')
    }

    const serverProvider = getServerProviderAdapter(options.serverProvider)

    await serverProvider.patchServerWorkspace({
      targetRoot,
      tokens,
      packageManager: options.packageManager,
    })
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
