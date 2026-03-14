#!/usr/bin/env node

import { createRequire } from 'node:module'
import { cancel, intro, note, outro } from '@clack/prompts'
import { hideBin } from 'yargs/helpers'
import {
  createClackPrompter,
  formatCliHelp,
  parseCliArgs,
  resolveAddCliOptions,
  resolveCliOptions,
} from './cli.js'
import { generatedWorkspaceLayout } from './layout.js'
import { addWorkspaces, scaffoldWorkspace } from './scaffold.js'
import { inspectWorkspace } from './workspace-inspector.js'

const require = createRequire(import.meta.url)
const packageJson = require('../package.json') as { version: string }

export async function main() {
  try {
    const argv = await parseCliArgs(hideBin(process.argv))

    if (argv.help) {
      console.log(formatCliHelp())
      return
    }

    if (argv.version) {
      console.log(packageJson.version)
      return
    }

    intro('create-miniapp 시작')

    const prompt = createClackPrompter()

    if (argv.add) {
      const inspection = await inspectWorkspace(argv.rootDir)
      const resolved = await resolveAddCliOptions(argv, prompt, inspection)

      note(
        [
          `package manager: ${resolved.packageManager}`,
          `앱 이름(appName): ${resolved.appName}`,
          `표시 이름(displayName): ${resolved.displayName}`,
          `수정 위치: ${resolved.rootDir}`,
          `server 추가: ${String(resolved.withServer)}`,
          `server 제공자: ${resolved.serverProvider ?? '없음'}`,
          `backoffice 추가: ${String(resolved.withBackoffice)}`,
        ].join('\n'),
        '수정 설정',
      )

      const result = await addWorkspaces(resolved)

      outro(`${result.targetRoot} 수정 완료`)
      return
    }

    const resolved = await resolveCliOptions(argv, prompt)

    note(
      [
        `package manager: ${resolved.packageManager}`,
        `앱 이름(appName): ${resolved.appName}`,
        `표시 이름(displayName): ${resolved.displayName}`,
        `생성 위치: ${resolved.outputDir}/${resolved.appName}`,
        `생성 구조: ${generatedWorkspaceLayout.join(', ')}`,
        `server 포함: ${String(resolved.withServer)}`,
        `server 제공자: ${resolved.serverProvider ?? '없음'}`,
        `backoffice 포함: ${String(resolved.withBackoffice)}`,
      ].join('\n'),
      '생성 설정',
    )

    const result = await scaffoldWorkspace(resolved)

    outro(`${resolved.appName} 생성 완료: ${result.targetRoot}`)
  } catch (error) {
    const message = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'
    cancel(message)
    process.exit(1)
  }
}

void main()
