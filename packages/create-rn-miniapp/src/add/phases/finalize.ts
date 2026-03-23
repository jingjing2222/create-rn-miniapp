import { log } from '@clack/prompts'
import { writeServerScaffoldState } from '../../patching/server.js'
import { runCommand } from '../../runtime/commands.js'
import { buildRootFinalizePlan } from '../../scaffold/orders.js'
import {
  maybeFinalizeCloudflareProvisioning,
  maybeFinalizeFirebaseProvisioning,
  maybeFinalizeSupabaseProvisioning,
} from '../../scaffold/provisioning.js'
import { resolveFinalServerScaffoldState } from '../../server/project.js'
import type { AddContext } from '../context.js'

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
  const finalServerState = resolveFinalServerScaffoldState({
    serverProvider: finalServerProvider,
    initialServerState: ctx.initialServerState,
    fallbackServerProjectMode:
      ctx.initialServerState?.serverProjectMode ?? ctx.options.serverProjectMode,
    fallbackTrpc: ctx.trpcEnabled,
    fallbackBackoffice: ctx.options.withBackoffice,
    provisionedSupabaseProject: ctx.provisionedSupabaseProject,
    provisionedCloudflareWorker: ctx.provisionedCloudflareWorker,
    provisionedFirebaseProject: ctx.provisionedFirebaseProject,
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
      log.step(command.label)
      await runCommand(command)
    }
  }

  return ctx
}
