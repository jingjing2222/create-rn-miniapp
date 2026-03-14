import path from 'node:path'
import { mkdir } from 'node:fs/promises'
import { log } from '@clack/prompts'
import { buildCommandPlan, runCommand } from './commands.js'
import { patchBackofficeWorkspace, patchFrontendWorkspace, patchServerWorkspace } from './patch.js'
import {
  applyDocsTemplates,
  applyRootTemplates,
  ensureEmptyDirectory,
  pathExists,
  type TemplateTokens,
} from './templates.js'

export type ScaffoldOptions = {
  appName: string
  displayName: string
  outputDir: string
  withServer: boolean
  withBackoffice: boolean
  skipInstall: boolean
}

export async function scaffoldWorkspace(options: ScaffoldOptions) {
  const targetRoot = path.resolve(options.outputDir, options.appName)
  const tokens: TemplateTokens = {
    appName: options.appName,
    displayName: options.displayName,
  }

  await ensureEmptyDirectory(targetRoot)

  if (options.withServer) {
    await mkdir(path.join(targetRoot, 'server'), { recursive: true })
  }

  const plan = buildCommandPlan({
    appName: options.appName,
    targetRoot,
    withServer: options.withServer,
    withBackoffice: options.withBackoffice,
  })

  for (const command of plan) {
    log.step(command.label)
    await runCommand(command)
  }

  await applyRootTemplates(targetRoot, tokens)
  await applyDocsTemplates(targetRoot, tokens)
  await patchFrontendWorkspace(targetRoot, tokens)

  if (options.withBackoffice && (await pathExists(path.join(targetRoot, 'backoffice')))) {
    await patchBackofficeWorkspace(targetRoot, tokens)
  }

  if (options.withServer && (await pathExists(path.join(targetRoot, 'server')))) {
    await patchServerWorkspace(targetRoot, tokens)
  }

  if (!options.skipInstall) {
    log.step('루트 pnpm install')
    await runCommand({
      cwd: targetRoot,
      command: 'pnpm',
      args: ['install'],
      label: '루트 pnpm install',
    })

    log.step('루트 biome check --write --unsafe')
    await runCommand({
      cwd: targetRoot,
      command: 'pnpm',
      args: ['exec', 'biome', 'check', '.', '--write', '--unsafe'],
      label: '루트 biome check --write --unsafe',
    })
  }

  return { targetRoot }
}
