import path from 'node:path'
import { log } from '@clack/prompts'
import { patchBackofficeWorkspace } from '../../patching/backoffice.js'
import { patchFrontendWorkspace } from '../../patching/frontend.js'
import { runCommand, runCommandWithOutput } from '../../runtime/commands.js'
import {
  buildSkillsInstallCommands,
  listInstalledProjectSkillEntries,
  resolveLocalSourceSkillIds,
  renderInstalledSkillsSummary,
  syncInstalledSkillArtifacts,
} from '../../skills/install.js'
import { maybeWriteNpmWorkspaceConfig, resolveRootWorkspaces } from '../../scaffold/helpers.js'
import { pathExists } from '../../templates/filesystem.js'
import { applyDocsTemplates } from '../../templates/docs.js'
import { syncRootFrontendPolicyFiles, syncRootWorkspaceManifest } from '../../templates/root.js'
import type { ProvisioningNote } from '../../server/project.js'
import type { CreateContext } from '../context.js'

async function scaffoldCreateBackoffice(ctx: CreateContext) {
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

async function syncCreateManifestAfterOptionalWorkspaces(ctx: CreateContext) {
  if (!ctx.options.withBackoffice && !ctx.trpcEnabled) {
    return ctx
  }

  await syncRootWorkspaceManifest(
    ctx.targetRoot,
    ctx.options.packageManager,
    await resolveRootWorkspaces(ctx.targetRoot),
  )

  return ctx
}

async function maybeInstallSelectedSkills(ctx: CreateContext) {
  const localSourceSkillIds = await resolveLocalSourceSkillIds(ctx.options.selectedSkills)
  const installCommands = await buildSkillsInstallCommands({
    packageManager: ctx.options.packageManager,
    targetRoot: ctx.targetRoot,
    skillIds: ctx.options.selectedSkills,
  })

  if (installCommands.length === 0) {
    return {
      didInstall: false,
      notes: [] as ProvisioningNote[],
    }
  }

  for (const installCommand of installCommands) {
    log.step(installCommand.label)
    await runCommandWithOutput(installCommand)
  }

  await syncInstalledSkillArtifacts(ctx.targetRoot, {
    allowDownloadFailureSkillIds: localSourceSkillIds,
  })
  const installedSkills = await listInstalledProjectSkillEntries(ctx.targetRoot)

  return {
    didInstall: true,
    notes: [
      {
        title: 'Agent skills',
        body: renderInstalledSkillsSummary(
          installedSkills.length > 0 ? installedSkills : ctx.options.selectedSkills,
        ),
      },
    ] satisfies ProvisioningNote[],
  }
}

async function applyCreateDocs(ctx: CreateContext) {
  await applyDocsTemplates(ctx.targetRoot, ctx.tokens)

  return ctx
}

async function patchCreateFrontend(ctx: CreateContext) {
  await patchFrontendWorkspace(ctx.targetRoot, ctx.tokens, {
    packageManager: ctx.options.packageManager,
    serverProvider: ctx.options.serverProvider,
    trpc: ctx.trpcEnabled,
    removeCloudflareApiClientHelpers: ctx.trpcEnabled,
  })

  return ctx
}

async function patchCreateBackoffice(ctx: CreateContext) {
  if (!ctx.options.withBackoffice || !(await pathExists(path.join(ctx.targetRoot, 'backoffice')))) {
    return ctx
  }

  await patchBackofficeWorkspace(ctx.targetRoot, ctx.tokens, {
    packageManager: ctx.options.packageManager,
    serverProvider: ctx.options.serverProvider,
    trpc: ctx.trpcEnabled,
    removeCloudflareApiClientHelpers: ctx.trpcEnabled,
  })

  return ctx
}

export async function patchCreateWorkspace(ctx: CreateContext) {
  ctx = await scaffoldCreateBackoffice(ctx)
  ctx = await syncCreateManifestAfterOptionalWorkspaces(ctx)

  const installedSkills = await maybeInstallSelectedSkills(ctx)

  if (installedSkills.didInstall) {
    await syncRootFrontendPolicyFiles(ctx.targetRoot, ctx.options.packageManager)
  }

  ctx = {
    ...ctx,
    installedSkillNotes: installedSkills.notes,
  }
  ctx = await applyCreateDocs(ctx)
  ctx = await patchCreateFrontend(ctx)
  ctx = await patchCreateBackoffice(ctx)

  return ctx
}
