import { buildCreateCommandPhases, type CommandSpec } from '../commands.js'
import { getPackageManagerAdapter, type PackageManager } from '../package-manager.js'
import type { ServerProvider } from '../providers/index.js'

export function buildRootFinalizePlan(options: {
  targetRoot: string
  packageManager: PackageManager
}) {
  const packageManager = getPackageManagerAdapter(options.packageManager)
  const plan: CommandSpec[] = [
    {
      cwd: options.targetRoot,
      ...packageManager.install(),
      label: `루트 ${options.packageManager} install`,
    },
  ]

  if (options.packageManager === 'yarn') {
    plan.push({
      cwd: options.targetRoot,
      ...packageManager.dlx('@yarnpkg/sdks', ['base']),
      label: '루트 yarn sdks 생성',
    })
  }

  plan.push({
    cwd: options.targetRoot,
    ...packageManager.exec('biome', ['check', '.', '--write', '--unsafe']),
    label: '루트 biome check --write --unsafe',
  })

  return plan
}

type CreateOrderOptions = {
  appName: string
  targetRoot: string
  packageManager: PackageManager
  noGit?: boolean
  serverProvider: ServerProvider | null
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
    labels.push('server 워크스페이스 준비')
  }

  labels.push('루트 템플릿 적용')

  if (options.serverProvider) {
    labels.push('server 워크스페이스 patch', 'server provisioning')
  }

  labels.push(...phases.backoffice.map((command) => command.label))

  if (options.withBackoffice) {
    labels.push('루트 workspace manifest 동기화')
  }

  if (!options.noGit) {
    labels.push('루트 git init')
  }

  return labels
}
