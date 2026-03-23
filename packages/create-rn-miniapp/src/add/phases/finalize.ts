import { writeServerScaffoldState } from '../../patching/server.js'
import { runCommand } from '../../runtime/commands.js'
import { buildRootFinalizePlan } from '../../scaffold/orders.js'
import {
  maybeFinalizeCloudflareProvisioning,
  maybeFinalizeFirebaseProvisioning,
  maybeFinalizeSupabaseProvisioning,
} from '../../scaffold/provisioning.js'
import { buildServerScaffoldState } from '../../server/project.js'
import type { AddContext } from '../context.js'

function resolveAddRemoteInitialization(ctx: AddContext) {
  const finalServerProvider = ctx.serverFlowState?.finalServerProvider ?? null

  if (finalServerProvider === 'supabase') {
    return ctx.provisionedSupabaseProject
      ? ctx.provisionedSupabaseProject.didApplyRemoteDb ||
        ctx.provisionedSupabaseProject.didDeployEdgeFunctions
        ? 'applied'
        : 'skipped'
      : (ctx.initialServerState?.remoteInitialization ?? 'not-run')
  }

  if (finalServerProvider === 'cloudflare') {
    return ctx.provisionedCloudflareWorker
      ? ctx.provisionedCloudflareWorker.didInitializeRemoteContent
        ? 'applied'
        : 'skipped'
      : (ctx.initialServerState?.remoteInitialization ?? 'not-run')
  }

  if (finalServerProvider === 'firebase') {
    return ctx.provisionedFirebaseProject
      ? ctx.provisionedFirebaseProject.didInitializeRemoteContent
        ? 'applied'
        : 'skipped'
      : (ctx.initialServerState?.remoteInitialization ?? 'not-run')
  }

  return 'not-run'
}

export async function finalizeAddWorkspace(ctx: AddContext) {
  if (ctx.options.withServer) {
    ctx.notes.push(
      ...(await maybeFinalizeSupabaseProvisioning({
        targetRoot: ctx.targetRoot,
        provisionedProject: ctx.provisionedSupabaseProject,
        serverProvider: ctx.options.serverProvider,
      })),
    )
    ctx.notes.push(
      ...(await maybeFinalizeCloudflareProvisioning({
        targetRoot: ctx.targetRoot,
        provisionedWorker: ctx.provisionedCloudflareWorker,
        serverProvider: ctx.options.serverProvider,
      })),
    )
    ctx.notes.push(
      ...(await maybeFinalizeFirebaseProvisioning({
        targetRoot: ctx.targetRoot,
        packageManager: ctx.options.packageManager,
        provisionedProject: ctx.provisionedFirebaseProject,
        serverProvider: ctx.options.serverProvider,
      })),
    )
  }

  const finalServerProvider = ctx.serverFlowState?.finalServerProvider ?? null
  const finalServerState = buildServerScaffoldState({
    serverProvider: finalServerProvider,
    serverProjectMode:
      ctx.provisionedSupabaseProject?.mode ??
      ctx.provisionedCloudflareWorker?.mode ??
      ctx.provisionedFirebaseProject?.mode ??
      ctx.initialServerState?.serverProjectMode ??
      ctx.options.serverProjectMode,
    remoteInitialization: resolveAddRemoteInitialization(ctx),
    trpc: ctx.initialServerState?.trpc ?? ctx.trpcEnabled,
    backoffice: ctx.initialServerState?.backoffice ?? ctx.options.withBackoffice,
  })

  if (finalServerState) {
    await writeServerScaffoldState(ctx.targetRoot, finalServerState)
  }

  if (!ctx.options.skipInstall) {
    for (const command of buildRootFinalizePlan({
      targetRoot: ctx.targetRoot,
      packageManager: ctx.options.packageManager,
      serverProvider: finalServerProvider,
    })) {
      await runCommand(command)
    }
  }

  return ctx
}
