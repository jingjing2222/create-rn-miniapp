import { writeServerScaffoldState } from '../../patching/server.js'
import { runCommand } from '../../runtime/commands.js'
import { buildRootFinalizePlan, buildRootGitSetupPlan } from '../../scaffold/orders.js'
import {
  maybeFinalizeCloudflareProvisioning,
  maybeFinalizeFirebaseProvisioning,
  maybeFinalizeSupabaseProvisioning,
} from '../../scaffold/provisioning.js'
import { buildServerScaffoldState } from '../../server/project.js'
import type { CreateContext } from '../context.js'

function resolveCreateRemoteInitialization(ctx: CreateContext) {
  if (ctx.options.serverProvider === 'supabase') {
    return ctx.provisionedSupabaseProject
      ? ctx.provisionedSupabaseProject.didApplyRemoteDb ||
        ctx.provisionedSupabaseProject.didDeployEdgeFunctions
        ? 'applied'
        : 'skipped'
      : (ctx.initialServerState?.remoteInitialization ?? 'not-run')
  }

  if (ctx.options.serverProvider === 'cloudflare') {
    return ctx.provisionedCloudflareWorker
      ? ctx.provisionedCloudflareWorker.didInitializeRemoteContent
        ? 'applied'
        : 'skipped'
      : (ctx.initialServerState?.remoteInitialization ?? 'not-run')
  }

  if (ctx.options.serverProvider === 'firebase') {
    return ctx.provisionedFirebaseProject
      ? ctx.provisionedFirebaseProject.didInitializeRemoteContent
        ? 'applied'
        : 'skipped'
      : (ctx.initialServerState?.remoteInitialization ?? 'not-run')
  }

  return 'not-run'
}

export async function finalizeCreateWorkspace(ctx: CreateContext) {
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

  const finalServerState = buildServerScaffoldState({
    serverProvider: ctx.options.serverProvider,
    serverProjectMode:
      ctx.provisionedSupabaseProject?.mode ??
      ctx.provisionedCloudflareWorker?.mode ??
      ctx.provisionedFirebaseProject?.mode ??
      ctx.options.serverProjectMode,
    remoteInitialization: resolveCreateRemoteInitialization(ctx),
    trpc: ctx.initialServerState?.trpc ?? ctx.trpcEnabled,
    backoffice: ctx.initialServerState?.backoffice ?? ctx.options.withBackoffice,
  })

  if (finalServerState) {
    await writeServerScaffoldState(ctx.targetRoot, finalServerState)
  }

  if (!ctx.options.noGit) {
    for (const command of buildRootGitSetupPlan({ targetRoot: ctx.targetRoot })) {
      await runCommand(command)
    }
  }

  if (!ctx.options.skipInstall) {
    for (const command of buildRootFinalizePlan({
      targetRoot: ctx.targetRoot,
      packageManager: ctx.options.packageManager,
      serverProvider: ctx.options.serverProvider,
    })) {
      await runCommand(command)
    }
  }

  return ctx
}
