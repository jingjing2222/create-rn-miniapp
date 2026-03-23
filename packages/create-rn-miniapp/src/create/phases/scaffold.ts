import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { log } from '@clack/prompts'
import type { CommandSpec } from '../../runtime/command-spec.js'
import { buildCreateCommandPhases, runCommand } from '../../runtime/commands.js'
import { getPackageManagerAdapter } from '../../runtime/package-manager.js'
import {
  maybePatchServerWorkspace,
  maybePrepareServerWorkspace,
  maybePrepareTrpcWorkspace,
  resolveCreateRootWorkspaces,
  maybeWriteNpmWorkspaceConfig,
  resolveRootWorkspaces,
} from '../../scaffold/helpers.js'
import { CLOUDFLARE_PREINSTALL_LABEL } from '../../scaffold/lifecycle-labels.js'
import { ensureEmptyDirectory } from '../../templates/filesystem.js'
import { applyRootTemplates, syncRootWorkspaceManifest } from '../../templates/root.js'
import type { CreateContext } from '../context.js'

async function runCommands(commands: readonly CommandSpec[]) {
  for (const command of commands) {
    log.step(command.label)
    await runCommand(command)
  }
}

async function scaffoldCreateFrontend(ctx: CreateContext) {
  const [createFrontendCommand, ...setupFrontendCommands] = ctx.commandPhases?.frontend ?? []

  if (createFrontendCommand) {
    log.step(createFrontendCommand.label)
    await runCommand(createFrontendCommand)
    await maybeWriteNpmWorkspaceConfig(
      path.join(ctx.targetRoot, 'frontend'),
      ctx.options.packageManager,
    )
  }

  await runCommands(setupFrontendCommands)

  return ctx
}

async function scaffoldCreateServer(ctx: CreateContext) {
  await runCommands(ctx.commandPhases?.server ?? [])
  return ctx
}

async function prepareCreateServerWorkspace(ctx: CreateContext) {
  await maybePrepareServerWorkspace({
    targetRoot: ctx.targetRoot,
    tokens: ctx.tokens,
    packageManager: ctx.options.packageManager,
    serverProvider: ctx.options.serverProvider,
  })

  return ctx
}

async function applyCreateRootWorkspaceTemplates(ctx: CreateContext) {
  await applyRootTemplates(
    ctx.targetRoot,
    ctx.tokens,
    resolveCreateRootWorkspaces({
      serverProvider: ctx.options.serverProvider,
      withBackoffice: ctx.options.withBackoffice,
      withTrpc: ctx.options.withTrpc,
    }),
  )
  return ctx
}

async function prepareCreateTrpcWorkspace(ctx: CreateContext) {
  await maybePrepareTrpcWorkspace({
    targetRoot: ctx.targetRoot,
    tokens: ctx.tokens,
    withTrpc: ctx.trpcEnabled,
    serverProvider: ctx.trpcEnabled ? 'cloudflare' : null,
  })

  return ctx
}

async function patchCreateServerWorkspace(ctx: CreateContext) {
  await maybePatchServerWorkspace({
    targetRoot: ctx.targetRoot,
    tokens: ctx.tokens,
    packageManager: ctx.options.packageManager,
    serverProvider: ctx.options.serverProvider,
    state: ctx.initialServerState,
    trpc: ctx.trpcEnabled,
  })

  return ctx
}

async function syncCreateManifestBeforeProvisioning(ctx: CreateContext) {
  if (!ctx.trpcEnabled) {
    return ctx
  }

  await syncRootWorkspaceManifest(
    ctx.targetRoot,
    ctx.options.packageManager,
    await resolveRootWorkspaces(ctx.targetRoot),
  )

  return ctx
}

async function primeCreateCloudflareProvisioning(ctx: CreateContext) {
  if (ctx.options.serverProvider !== 'cloudflare') {
    return ctx
  }

  const packageManager = getPackageManagerAdapter(ctx.options.packageManager)

  log.step(CLOUDFLARE_PREINSTALL_LABEL)
  await runCommand({
    cwd: ctx.targetRoot,
    ...packageManager.install(),
    label: CLOUDFLARE_PREINSTALL_LABEL,
  })

  return ctx
}

export async function scaffoldCreateWorkspace(ctx: CreateContext) {
  const commandPhases = buildCreateCommandPhases({
    appName: ctx.options.appName,
    targetRoot: ctx.targetRoot,
    packageManager: ctx.options.packageManager,
    serverProvider: ctx.options.serverProvider,
    withBackoffice: ctx.options.withBackoffice,
  })

  await ensureEmptyDirectory(ctx.targetRoot)

  ctx = {
    ...ctx,
    commandPhases,
  }

  ctx = await applyCreateRootWorkspaceTemplates(ctx)

  if (ctx.options.serverProvider) {
    await mkdir(path.join(ctx.targetRoot, 'server'), { recursive: true })
  }

  ctx = await scaffoldCreateFrontend(ctx)
  ctx = await scaffoldCreateServer(ctx)
  ctx = await prepareCreateServerWorkspace(ctx)
  ctx = await prepareCreateTrpcWorkspace(ctx)
  ctx = await patchCreateServerWorkspace(ctx)
  ctx = await syncCreateManifestBeforeProvisioning(ctx)
  ctx = await primeCreateCloudflareProvisioning(ctx)

  return ctx
}
