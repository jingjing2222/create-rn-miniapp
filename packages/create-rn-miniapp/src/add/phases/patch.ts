import path from 'node:path'
import { log } from '@clack/prompts'
import { patchBackofficeWorkspace } from '../../patching/backoffice.js'
import { patchFrontendWorkspace } from '../../patching/frontend.js'
import { runCommand } from '../../runtime/commands.js'
import { maybeWriteNpmWorkspaceConfig, resolveRootWorkspaces } from '../../scaffold/helpers.js'
import { pathExists } from '../../templates/filesystem.js'
import { applyDocsTemplates } from '../../templates/docs.js'
import { syncRootWorkspaceManifest } from '../../templates/root.js'
import type { AddContext } from '../context.js'

async function scaffoldAddBackoffice(ctx: AddContext) {
  for (const command of ctx.commandPhases?.backoffice ?? []) {
    log.step(command.label)
    await runCommand(command)
  }

  if (ctx.options.withBackoffice && (await pathExists(path.join(ctx.targetRoot, 'backoffice')))) {
    await maybeWriteNpmWorkspaceConfig(
      path.join(ctx.targetRoot, 'backoffice'),
      ctx.options.packageManager,
    )
  }

  return ctx
}

async function syncAddManifestAfterOptionalWorkspaces(ctx: AddContext) {
  await syncRootWorkspaceManifest(
    ctx.targetRoot,
    ctx.options.packageManager,
    await resolveRootWorkspaces(ctx.targetRoot),
  )

  return ctx
}

async function applyAddDocs(ctx: AddContext) {
  await applyDocsTemplates(ctx.targetRoot, ctx.tokens)

  return ctx
}

async function patchAddFrontend(ctx: AddContext) {
  if (
    !(ctx.options.withServer || ctx.trpcEnabled) ||
    !(await pathExists(path.join(ctx.targetRoot, 'frontend')))
  ) {
    return ctx
  }

  await patchFrontendWorkspace(ctx.targetRoot, ctx.tokens, {
    packageManager: ctx.options.packageManager,
    serverProvider: ctx.serverFlowState?.finalServerProvider ?? null,
    trpc: ctx.trpcEnabled,
    removeCloudflareApiClientHelpers:
      ctx.trpcEnabled && ctx.options.removeCloudflareApiClientHelpers,
  })

  return ctx
}

async function patchAddBackoffice(ctx: AddContext) {
  if (
    !(ctx.options.withBackoffice || ctx.options.withServer || ctx.trpcEnabled) ||
    !(await pathExists(path.join(ctx.targetRoot, 'backoffice')))
  ) {
    return ctx
  }

  await patchBackofficeWorkspace(ctx.targetRoot, ctx.tokens, {
    packageManager: ctx.options.packageManager,
    serverProvider: ctx.serverFlowState?.finalServerProvider ?? null,
    trpc: ctx.trpcEnabled,
    removeCloudflareApiClientHelpers:
      ctx.trpcEnabled && ctx.options.removeCloudflareApiClientHelpers,
  })

  return ctx
}

export async function patchAddWorkspace(ctx: AddContext) {
  ctx = await scaffoldAddBackoffice(ctx)
  ctx = await syncAddManifestAfterOptionalWorkspaces(ctx)
  ctx = await applyAddDocs(ctx)
  ctx = await patchAddFrontend(ctx)
  ctx = await patchAddBackoffice(ctx)

  return ctx
}
