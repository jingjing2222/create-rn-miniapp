#!/usr/bin/env node

import path from 'node:path'
import { cancel, confirm, intro, isCancel, note, outro, text } from '@clack/prompts'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { assertValidAppName, generatedWorkspaceLayout, toDefaultDisplayName } from './layout.js'
import { scaffoldWorkspace } from './scaffold.js'

async function promptOrExit<T>(promise: Promise<T | symbol>) {
  const result = await promise

  if (isCancel(result)) {
    cancel('Scaffold cancelled.')
    process.exit(1)
  }

  return result as T
}

export async function main() {
  const argv = await yargs(hideBin(process.argv))
    .scriptName('create-miniapp')
    .option('name', {
      type: 'string',
      describe: 'Granite appName and target monorepo directory name',
    })
    .option('display-name', {
      type: 'string',
      describe: 'User-facing display name',
    })
    .option('with-server', {
      type: 'boolean',
      describe: 'Include Supabase server workspace',
    })
    .option('with-backoffice', {
      type: 'boolean',
      describe: 'Include Vite backoffice workspace',
    })
    .option('output-dir', {
      type: 'string',
      default: process.cwd(),
      describe: 'Parent directory where the monorepo will be created',
    })
    .option('skip-install', {
      type: 'boolean',
      default: false,
      describe: 'Skip final root pnpm install',
    })
    .option('yes', {
      type: 'boolean',
      default: false,
      describe: 'Use defaults for optional prompts',
    })
    .help()
    .parse()

  intro('create-miniapp')

  const rawName =
    argv.name ??
    (argv.yes
      ? undefined
      : await promptOrExit(
          text({
            message: 'appName을 입력하세요',
            placeholder: 'my-miniapp',
            validate(value) {
              const candidate = value?.trim() ?? ''

              return candidate.length === 0 || candidate.includes(' ')
                ? 'kebab-case appName이 필요합니다.'
                : undefined
            },
          }),
        ))

  if (!rawName) {
    throw new Error('appName is required. Pass --name or answer the prompt.')
  }

  const appName = assertValidAppName(rawName)
  const displayName =
    argv.displayName ??
    (argv.yes
      ? toDefaultDisplayName(appName)
      : await promptOrExit(
          text({
            message: 'displayName을 입력하세요',
            initialValue: toDefaultDisplayName(appName),
          }),
        ))

  const withServer =
    argv.withServer ??
    (argv.yes
      ? false
      : await promptOrExit(
          confirm({
            message: 'server workspace를 같이 만들까요?',
            initialValue: false,
          }),
        ))

  const withBackoffice =
    argv.withBackoffice ??
    (argv.yes
      ? false
      : await promptOrExit(
          confirm({
            message: 'backoffice workspace를 같이 만들까요?',
            initialValue: false,
          }),
        ))

  const outputDir = path.resolve(argv.outputDir)

  note(
    [
      `appName: ${appName}`,
      `displayName: ${displayName}`,
      `output: ${path.join(outputDir, appName)}`,
      `generated layout: ${generatedWorkspaceLayout.join(', ')}`,
      `withServer: ${String(withServer)}`,
      `withBackoffice: ${String(withBackoffice)}`,
    ].join('\n'),
    'Scaffold',
  )

  const result = await scaffoldWorkspace({
    appName,
    displayName,
    outputDir,
    withServer,
    withBackoffice,
    skipInstall: argv.skipInstall,
  })

  outro(`Scaffolded ${appName} at ${result.targetRoot}`)
}

void main()
