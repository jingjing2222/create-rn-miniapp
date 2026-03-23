import path from 'node:path'
import { log } from '@clack/prompts'
import { patchBackofficeWorkspace } from '../../patching/backoffice.js'
import { patchFrontendWorkspace } from '../../patching/frontend.js'
import { runCommand, runCommandWithOutput } from '../../runtime/commands.js'
import dedent from '../../runtime/dedent.js'
import {
  buildSkillsInstallCommand,
  listInstalledProjectSkillEntries,
  renderInstalledSkillsSummary,
  renderSkillsAddCommand,
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
  const installCommand = await buildSkillsInstallCommand({
    packageManager: ctx.options.packageManager,
    targetRoot: ctx.targetRoot,
    skillIds: ctx.options.selectedSkills,
  })

  if (!installCommand) {
    return {
      didInstall: false,
      notes: [] as ProvisioningNote[],
    }
  }

  try {
    log.step(installCommand.label)
    await runCommandWithOutput(installCommand)
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
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : '추천 agent skills 설치 중 알 수 없는 오류가 있었어요.'

    return {
      didInstall: false,
      notes: [
        {
          title: 'Agent skills',
          body: dedent`
            추천 agent skills 자동 설치는 건너뛰었어요.
            ${message}
            필요하면 나중에 직접 실행해 주세요: \`${renderSkillsAddCommand(ctx.options.selectedSkills)}\`
          `,
        },
      ] satisfies ProvisioningNote[],
    }
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
