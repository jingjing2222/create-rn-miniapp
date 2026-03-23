import { getPackageManagerAdapter, type PackageManager } from '../runtime/package-manager.js'

export function getTestPackageManagerField(packageManager: PackageManager) {
  return getPackageManagerAdapter(packageManager).packageManagerField
}

function getTestPackageManagerVersion(packageManager: PackageManager) {
  return getTestPackageManagerField(packageManager).split('@')[1] ?? ''
}

export function buildInvocationUserAgent(
  packageManager: PackageManager,
  options?: {
    nodeVersion?: string
    platform?: string
  },
) {
  const version = getTestPackageManagerVersion(packageManager)
  const nodeVersion = options?.nodeVersion ?? '25.6.1'
  const platform = options?.platform ?? 'darwin arm64'

  switch (packageManager) {
    case 'pnpm':
      return `pnpm/${version} npm/? node/v${nodeVersion} ${platform}`
    case 'yarn':
      return `yarn/${version} npm/? node/v${nodeVersion} ${platform}`
    case 'npm':
      return `npm/${version} node/v${nodeVersion} ${platform} workspaces/false`
    case 'bun':
      return `bun/${version} bunfig/false node/v${nodeVersion} ${platform}`
  }
}
