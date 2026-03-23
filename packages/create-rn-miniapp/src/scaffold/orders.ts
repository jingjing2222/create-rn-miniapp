import type { CommandSpec } from '../runtime/command-spec.js'
import {
  listCreateFinalizeLifecycleLabels,
  listCreatePatchLifecycleLabels,
  listCreateProvisionLifecycleLabels,
  listCreateScaffoldLifecycleLabels,
} from '../create/lifecycle.js'
import { buildCreateCommandPhases } from '../runtime/commands.js'
import { YARN_SDKS_CLI } from '../runtime/external-tooling.js'
import { getPackageManagerAdapter, type PackageManager } from '../runtime/package-manager.js'
import type { ServerProvider } from '../providers/index.js'
import { ROOT_GIT_INIT_LABEL, ROOT_GIT_MAIN_BRANCH_LABEL } from './lifecycle-labels.js'
import { resolveCreateTrpcEnabled } from './flow-state.js'

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
      ...packageManager.dlx(YARN_SDKS_CLI, ['base']),
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
      label: ROOT_GIT_INIT_LABEL,
    },
    {
      cwd: options.targetRoot,
      command: 'git',
      args: ['symbolic-ref', 'HEAD', 'refs/heads/main'],
      label: ROOT_GIT_MAIN_BRANCH_LABEL,
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
  const trpcEnabled = resolveCreateTrpcEnabled({
    serverProvider: options.serverProvider,
    withTrpc: options.withTrpc ?? false,
  })

  return [
    ...listCreateScaffoldLifecycleLabels({
      commandPhases: phases,
      noGit: options.noGit,
      serverProvider: options.serverProvider,
      trpcEnabled,
      withBackoffice: options.withBackoffice,
    }),
    ...listCreateProvisionLifecycleLabels({
      commandPhases: phases,
      noGit: options.noGit,
      serverProvider: options.serverProvider,
      trpcEnabled,
      withBackoffice: options.withBackoffice,
    }),
    ...listCreatePatchLifecycleLabels({
      commandPhases: phases,
      noGit: options.noGit,
      serverProvider: options.serverProvider,
      trpcEnabled,
      withBackoffice: options.withBackoffice,
    }),
    ...listCreateFinalizeLifecycleLabels({
      commandPhases: phases,
      noGit: options.noGit,
      serverProvider: options.serverProvider,
      trpcEnabled,
      withBackoffice: options.withBackoffice,
    }),
  ]
}
