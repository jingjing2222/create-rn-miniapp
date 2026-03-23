import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { log } from '@clack/prompts'
import type { CommandSpec } from '../../runtime/command-spec.js'
import { runCommand } from '../../runtime/commands.js'
import { getPackageManagerAdapter } from '../../runtime/package-manager.js'
import {
  maybePatchServerWorkspace,
  maybePrepareServerWorkspace,
  maybePrepareTrpcWorkspace,
  resolveRootWorkspaces,
} from '../../scaffold/helpers.js'
import { CLOUDFLARE_PREINSTALL_LABEL } from '../../scaffold/lifecycle-labels.js'
import { syncRootWorkspaceManifest } from '../../templates/root.js'
import type { AddContext } from '../context.js'

async function runCommands(commands: readonly CommandSpec[]) {
  for (const command of commands) {
    log.step(command.label)
    await runCommand(command)
  }
}

async function scaffoldAddServer(ctx: AddContext) {
  if (ctx.options.withServer) {
    await mkdir(path.join(ctx.targetRoot, 'server'), { recursive: true })
  }

  await runCommands(ctx.commandPhases?.server ?? [])
  return ctx
}

async function prepareAddServerWorkspace(ctx: AddContext) {
  await maybePrepareServerWorkspace({
    targetRoot: ctx.targetRoot,
    tokens: ctx.tokens,
    packageManager: ctx.options.packageManager,
    serverProvider: ctx.options.serverProvider,
  })

  return ctx
}

async function prepareAddTrpcWorkspace(ctx: AddContext) {
  await maybePrepareTrpcWorkspace({
    targetRoot: ctx.targetRoot,
    tokens: ctx.tokens,
    withTrpc: ctx.trpcEnabled,
    serverProvider: ctx.trpcEnabled ? 'cloudflare' : null,
  })

  return ctx
}

async function patchAddServerWorkspace(ctx: AddContext) {
  await maybePatchServerWorkspace({
    targetRoot: ctx.targetRoot,
    tokens: ctx.tokens,
    packageManager: ctx.options.packageManager,
    serverProvider: ctx.serverFlowState?.patchServerProvider ?? null,
    state: ctx.initialServerState,
    trpc: ctx.trpcEnabled,
  })

  return ctx
}

async function syncAddManifestBeforeProvisioning(ctx: AddContext) {
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

async function primeAddCloudflareProvisioning(ctx: AddContext) {
  if (!ctx.options.withServer || ctx.options.serverProvider !== 'cloudflare') {
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

export async function scaffoldAddWorkspace(ctx: AddContext) {
  ctx = await scaffoldAddServer(ctx)
  ctx = await prepareAddServerWorkspace(ctx)
  ctx = await prepareAddTrpcWorkspace(ctx)
  ctx = await patchAddServerWorkspace(ctx)
  ctx = await syncAddManifestBeforeProvisioning(ctx)
  ctx = await primeAddCloudflareProvisioning(ctx)

  return ctx
}
