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
import { addWorkspaces, scaffoldWorkspace } from './scaffold/index.js'
import { TRPC_WORKSPACE_PATHS } from './trpc-workspace-metadata.js'
import { inspectWorkspace } from './workspace-inspector.js'

const require = createRequire(import.meta.url)
const packageJson = require('../package.json') as { version: string }

function describeWorkspaceLayout(options: {
  withServer: boolean
  withTrpc: boolean
  withBackoffice: boolean
}) {
  return [
    'frontend',
    ...(options.withServer ? ['server'] : []),
    ...(options.withTrpc ? TRPC_WORKSPACE_PATHS : []),
    ...(options.withBackoffice ? ['backoffice'] : []),
  ].join(', ')
}

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

    intro('create-miniapp으로 시작할게요')

    const prompt = createClackPrompter()

    if (argv.add) {
      const inspection = await inspectWorkspace(argv.rootDir)
      const resolved = await resolveAddCliOptions(argv, prompt, inspection)

      note(
        [
          `package manager: ${resolved.packageManager}`,
          `앱 이름(appName): ${resolved.appName}`,
          `표시 이름(displayName): ${resolved.displayName}`,
          `수정할 위치: ${resolved.rootDir}`,
          `server 추가: ${String(resolved.withServer)}`,
          `server 제공자: ${resolved.serverProvider ?? '이번엔 안 만들어요'}`,
          `server 프로젝트 연결: ${resolved.serverProvider ? (resolved.skipServerProvisioning ? '이번엔 건너뛸게요' : (resolved.serverProjectMode ?? '목록에서 고를게요')) : '해당 없어요'}`,
          `tRPC 추가: ${String(resolved.withTrpc)}`,
          ...(resolved.withTrpc && resolved.existingServerProvider === 'cloudflare'
            ? [
                `기존 Cloudflare API helper 정리: ${resolved.removeCloudflareApiClientHelpers ? '같이 지워둘게요' : '이번엔 남겨둘게요'}`,
              ]
            : []),
          `backoffice 추가: ${String(resolved.withBackoffice)}`,
        ].join('\n'),
        '이렇게 반영할게요',
      )

      const result = await addWorkspaces({
        ...resolved,
        prompt,
      })

      for (const item of result.notes) {
        note(item.body, item.title)
      }

      outro(`${result.targetRoot}까지 반영했어요`)
      return
    }

    const resolved = await resolveCliOptions(argv, prompt)

    note(
      [
        `package manager: ${resolved.packageManager}`,
        `앱 이름(appName): ${resolved.appName}`,
        `표시 이름(displayName): ${resolved.displayName}`,
        `만들 위치: ${resolved.outputDir}/${resolved.appName}`,
        `만들 구조: ${describeWorkspaceLayout(resolved)}`,
        `루트 git 초기화: ${String(!resolved.noGit)}`,
        `server 포함: ${String(resolved.withServer)}`,
        `server 제공자: ${resolved.serverProvider ?? '이번엔 안 만들어요'}`,
        `server 프로젝트 연결: ${resolved.serverProvider ? (resolved.skipServerProvisioning ? '이번엔 건너뛸게요' : (resolved.serverProjectMode ?? '목록에서 고를게요')) : '해당 없어요'}`,
        `tRPC 포함: ${String(resolved.withTrpc)}`,
        `backoffice 포함: ${String(resolved.withBackoffice)}`,
      ].join('\n'),
      '이렇게 만들게요',
    )

    const result = await scaffoldWorkspace({
      ...resolved,
      prompt,
    })

    for (const item of result.notes) {
      note(item.body, item.title)
    }

    outro(`${resolved.appName}을 만들었어요: ${result.targetRoot}`)
  } catch (error) {
    const message = error instanceof Error ? error.message : '알 수 없는 오류가 있었어요.'
    cancel(message)
    process.exit(1)
  }
}

void main()
