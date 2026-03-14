import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { log } from '@clack/prompts'
import { buildAddCommandPlan, buildCommandPlan, runCommand, type CommandSpec } from './commands.js'
import { getPackageManagerAdapter, type PackageManager } from './package-manager.js'
import { patchBackofficeWorkspace, patchFrontendWorkspace } from './patch.js'
import { getServerProviderAdapter, type ServerProvider } from './server-provider.js'
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
  packageManager: PackageManager
  appName: string
  displayName: string
  outputDir: string
  serverProvider: ServerProvider | null
  withBackoffice: boolean
  skipInstall: boolean
}

export type AddWorkspaceOptions = {
  rootDir: string
  packageManager: PackageManager
  appName: string
  displayName: string
  existingServerProvider: ServerProvider | null
  existingHasBackoffice: boolean
  serverProvider: ServerProvider | null
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

async function resolveRootWorkspaces(targetRoot: string) {
  const workspaces: WorkspaceName[] = []

  for (const workspace of ['frontend', 'server', 'backoffice'] as const) {
    if (await pathExists(path.join(targetRoot, workspace))) {
      workspaces.push(workspace)
    }
  }

  return workspaces
}

export async function scaffoldWorkspace(options: ScaffoldOptions) {
  const targetRoot = path.resolve(options.outputDir, options.appName)
  const packageManager = getPackageManagerAdapter(options.packageManager)
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

  const plan = buildCommandPlan({
    appName: options.appName,
    targetRoot,
    packageManager: options.packageManager,
    serverProvider: options.serverProvider,
    withBackoffice: options.withBackoffice,
  })

  for (const command of plan) {
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

  if (!options.skipInstall) {
    for (const command of buildRootFinalizePlan({
      targetRoot,
      packageManager: options.packageManager,
    })) {
      log.step(command.label)
      await runCommand(command)
    }
  }

  return { targetRoot }
}

export async function addWorkspaces(options: AddWorkspaceOptions) {
  const targetRoot = path.resolve(options.rootDir)
  const packageManager = getPackageManagerAdapter(options.packageManager)
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

  const plan = buildAddCommandPlan({
    targetRoot,
    packageManager: options.packageManager,
    serverProvider: options.serverProvider,
    withBackoffice: options.withBackoffice,
  })

  for (const command of plan) {
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

  if (!options.skipInstall) {
    for (const command of buildRootFinalizePlan({
      targetRoot,
      packageManager: options.packageManager,
    })) {
      log.step(command.label)
      await runCommand(command)
    }
  }

  return { targetRoot }
}
