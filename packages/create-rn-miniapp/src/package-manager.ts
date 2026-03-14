export const PACKAGE_MANAGERS = ['pnpm', 'yarn'] as const

export type PackageManager = (typeof PACKAGE_MANAGERS)[number]

export type PackageManagerCommand = {
  command: string
  args: string[]
}

export type PackageManagerAdapter = {
  id: PackageManager
  label: string
  packageManagerField: string
  rootTemplateFiles: Array<{
    sourceName: string
    targetName: string
  }>
  workspaceManifestFile: string | null
  extraRootFiles: Array<{
    sourceName: string
    targetName: string
  }>
  toolingFiles: string[]
  workspaceArtifacts: string[]
  install(): PackageManagerCommand
  add(packages: string[], options?: { dev?: boolean }): PackageManagerCommand
  exec(binary: string, args: string[]): PackageManagerCommand
  dlx(packageName: string, args: string[]): PackageManagerCommand
  createGraniteApp(targetDirectory: string): PackageManagerCommand
  createViteApp(targetDirectory: string): PackageManagerCommand
  workspaceRunCommand(workspace: 'frontend' | 'backoffice' | 'server', script: string): string
  runScript(script: string): string
  rootFormatScript(): string
  rootFormatCheckScript(): string
  rootLintScript(): string
  rootVerifyScript(): string
  verifyCommand(): string
}

const PNPM_VERSION = '10.32.1'
const YARN_VERSION = '4.13.0'

function withArgs(command: string, args: string[]): PackageManagerCommand {
  return { command, args }
}

const pnpmAdapter: PackageManagerAdapter = {
  id: 'pnpm',
  label: 'pnpm',
  packageManagerField: `pnpm@${PNPM_VERSION}`,
  rootTemplateFiles: [
    {
      sourceName: 'pnpm.gitignore',
      targetName: '.gitignore',
    },
    {
      sourceName: 'pnpm.biome.json',
      targetName: 'biome.json',
    },
  ],
  workspaceManifestFile: 'pnpm-workspace.yaml',
  extraRootFiles: [],
  toolingFiles: ['pnpm-lock.yaml'],
  workspaceArtifacts: ['node_modules'],
  install() {
    return withArgs('pnpm', ['install'])
  },
  add(packages, options) {
    return withArgs('pnpm', ['add', ...(options?.dev ? ['-D'] : []), ...packages])
  },
  exec(binary, args) {
    return withArgs('pnpm', ['exec', binary, ...args])
  },
  dlx(packageName, args) {
    return withArgs('pnpm', ['dlx', packageName, ...args])
  },
  createGraniteApp(targetDirectory) {
    return withArgs('pnpm', ['create', 'granite-app', targetDirectory, '--tools', 'biome'])
  },
  createViteApp(targetDirectory) {
    return withArgs('pnpm', [
      'dlx',
      'create-vite',
      targetDirectory,
      '--template',
      'react-ts',
      '--no-interactive',
    ])
  },
  workspaceRunCommand(workspace, script) {
    return `pnpm --dir ${workspace} ${script}`
  },
  runScript(script) {
    return `pnpm ${script}`
  },
  rootFormatScript() {
    return 'pnpm exec biome format . --write'
  },
  rootFormatCheckScript() {
    return 'pnpm exec biome format .'
  },
  rootLintScript() {
    return 'pnpm exec biome lint .'
  },
  rootVerifyScript() {
    return 'pnpm format:check && pnpm lint && pnpm typecheck && pnpm test'
  },
  verifyCommand() {
    return 'pnpm verify'
  },
}

const yarnAdapter: PackageManagerAdapter = {
  id: 'yarn',
  label: 'yarn',
  packageManagerField: `yarn@${YARN_VERSION}`,
  rootTemplateFiles: [
    {
      sourceName: 'yarn.gitignore',
      targetName: '.gitignore',
    },
    {
      sourceName: 'yarn.biome.json',
      targetName: 'biome.json',
    },
  ],
  workspaceManifestFile: null,
  extraRootFiles: [
    {
      sourceName: 'yarnrc.yml',
      targetName: '.yarnrc.yml',
    },
  ],
  toolingFiles: ['yarn.lock', '.pnp.cjs', '.pnp.loader.mjs'],
  workspaceArtifacts: ['node_modules', '.yarn'],
  install() {
    return withArgs('yarn', ['install'])
  },
  add(packages, options) {
    return withArgs('yarn', ['add', ...(options?.dev ? ['-D'] : []), ...packages])
  },
  exec(binary, args) {
    return withArgs('yarn', ['exec', binary, ...args])
  },
  dlx(packageName, args) {
    return withArgs('yarn', ['dlx', packageName, ...args])
  },
  createGraniteApp(targetDirectory) {
    return withArgs('yarn', ['dlx', 'create-granite-app', targetDirectory, '--tools', 'biome'])
  },
  createViteApp(targetDirectory) {
    return withArgs('yarn', [
      'dlx',
      'create-vite',
      targetDirectory,
      '--template',
      'react-ts',
      '--no-interactive',
    ])
  },
  workspaceRunCommand(workspace, script) {
    return `yarn workspace ${workspace} ${script}`
  },
  runScript(script) {
    return `yarn ${script}`
  },
  rootFormatScript() {
    return 'yarn exec biome format . --write'
  },
  rootFormatCheckScript() {
    return 'yarn exec biome format .'
  },
  rootLintScript() {
    return 'yarn exec biome lint .'
  },
  rootVerifyScript() {
    return 'yarn format:check && yarn lint && yarn typecheck && yarn test'
  },
  verifyCommand() {
    return 'yarn verify'
  },
}

const packageManagers = {
  pnpm: pnpmAdapter,
  yarn: yarnAdapter,
} satisfies Record<PackageManager, PackageManagerAdapter>

export function getPackageManagerAdapter(packageManager: PackageManager) {
  return packageManagers[packageManager]
}
