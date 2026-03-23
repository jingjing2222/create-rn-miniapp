export const CONTRACTS_WORKSPACE_PATH = 'packages/contracts' as const
export const APP_ROUTER_WORKSPACE_PATH = 'packages/app-router' as const
export const LEGACY_TRPC_WORKSPACE_PATH = 'packages/trpc' as const
export const LEGACY_TRPC_WORKSPACE_PACKAGE_PATH =
  `${LEGACY_TRPC_WORKSPACE_PATH}/package.json` as const

export const TRPC_WORKSPACE_PATHS = [CONTRACTS_WORKSPACE_PATH, APP_ROUTER_WORKSPACE_PATH] as const

export type TrpcWorkspacePath = (typeof TRPC_WORKSPACE_PATHS)[number]

export function resolveWorkspaceRelativeTrpcPath(workspacePath: TrpcWorkspacePath) {
  return `../${workspacePath}`
}
