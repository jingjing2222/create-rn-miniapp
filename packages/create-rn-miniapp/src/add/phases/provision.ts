import {
  maybeProvisionCloudflareWorker,
  maybeProvisionFirebaseProject,
  maybeProvisionSupabaseProject,
} from '../../scaffold/provisioning.js'
import type { AddContext } from '../context.js'

export async function provisionAddWorkspace(ctx: AddContext) {
  if (!ctx.options.withServer) {
    return ctx
  }

  const provisionedSupabaseProject = await maybeProvisionSupabaseProject({
    targetRoot: ctx.targetRoot,
    packageManager: ctx.options.packageManager,
    prompt: ctx.options.prompt,
    serverProvider: ctx.options.serverProvider,
    serverProjectMode: ctx.options.serverProjectMode,
    skipServerProvisioning: ctx.options.skipServerProvisioning,
  })
  const provisionedCloudflareWorker = await maybeProvisionCloudflareWorker({
    targetRoot: ctx.targetRoot,
    packageManager: ctx.options.packageManager,
    prompt: ctx.options.prompt,
    serverProvider: ctx.options.serverProvider,
    serverProjectMode: ctx.options.serverProjectMode,
    appName: ctx.options.appName,
    skipServerProvisioning: ctx.options.skipServerProvisioning,
  })
  const provisionedFirebaseProject = await maybeProvisionFirebaseProject({
    targetRoot: ctx.targetRoot,
    packageManager: ctx.options.packageManager,
    prompt: ctx.options.prompt,
    serverProvider: ctx.options.serverProvider,
    serverProjectMode: ctx.options.serverProjectMode,
    appName: ctx.options.appName,
    displayName: ctx.options.displayName,
    skipServerProvisioning: ctx.options.skipServerProvisioning,
  })

  return {
    ...ctx,
    provisionedSupabaseProject,
    provisionedCloudflareWorker,
    provisionedFirebaseProject,
  }
}
