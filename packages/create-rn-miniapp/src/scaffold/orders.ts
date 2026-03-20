import { buildCreateCommandPhases, type CommandSpec } from '../commands.js'
import { getPackageManagerAdapter, type PackageManager } from '../package-manager.js'
import type { ServerProvider } from '../providers/index.js'

export function buildRootFinalizePlan(options: {
  targetRoot: string
  packageManager: PackageManager
  serverProvider: ServerProvider | null
}) {
  const packageManager = getPackageManagerAdapter(options.packageManager)
  const plan: CommandSpec[] = [
    {
      cwd: options.targetRoot,
      ...packageManager.install(),
      label: `루트 ${options.packageManager} 설치하기`,
    },
  ]

  if (options.serverProvider === 'supabase') {
    plan.push({
      cwd: options.targetRoot,
      ...packageManager.runScriptInDirectory('server', 'deno:install'),
      label: 'server Deno stable 버전 맞추기',
    })
  }

  if (options.packageManager === 'yarn') {
    plan.push({
      cwd: options.targetRoot,
      ...packageManager.dlx('@yarnpkg/sdks', ['base']),
      label: '루트 yarn SDK 만들기',
    })
  }

  plan.push({
    cwd: options.targetRoot,
    ...packageManager.exec('biome', ['check', '.', '--write', '--unsafe']),
    label: '루트 biome로 코드 정리하기',
  })

  return plan
}

export function buildRootGitSetupPlan(options: { targetRoot: string }) {
  return [
    {
      cwd: options.targetRoot,
      command: 'git',
      args: ['init'],
      label: '루트 git 저장소 만들기',
    },
    {
      cwd: options.targetRoot,
      command: 'git',
      args: ['symbolic-ref', 'HEAD', 'refs/heads/main'],
      label: '루트 기본 브랜치를 main으로 맞추기',
    },
  ] satisfies CommandSpec[]
}

type CreateOrderOptions = {
  appName: string
  targetRoot: string
  packageManager: PackageManager
  noGit?: boolean
  serverProvider: ServerProvider | null
  withTrpc?: boolean
  withBackoffice: boolean
}

export function buildCreateExecutionOrder(options: CreateOrderOptions) {
  const phases = buildCreateCommandPhases(options)

  return [
    ...phases.frontend.map((command) => command.label),
    ...phases.server.map((command) => command.label),
    ...phases.backoffice.map((command) => command.label),
  ]
}

export function buildCreateLifecycleOrder(options: CreateOrderOptions) {
  const phases = buildCreateCommandPhases(options)
  const labels = [
    ...phases.frontend.map((command) => command.label),
    ...phases.server.map((command) => command.label),
  ]

  if (options.serverProvider) {
    labels.push('server 워크스페이스 준비하기')
  }

  labels.push('루트 템플릿 적용하기')

  if (options.serverProvider) {
    labels.push('server 워크스페이스 다듬기', 'server provisioning 하기')
  }

  if (options.withTrpc) {
    labels.splice(
      labels.indexOf('server provisioning 하기'),
      0,
      '루트 workspace manifest 먼저 맞추기',
    )
  }

  labels.push(...phases.backoffice.map((command) => command.label))

  if (options.withBackoffice || options.withTrpc) {
    labels.push('루트 workspace manifest 맞추기')
  }

  if (!options.noGit) {
    labels.push('루트 git 저장소 만들기', '루트 기본 브랜치를 main으로 맞추기')
  }

  return labels
}
