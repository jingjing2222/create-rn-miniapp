export const PACKAGE_MANAGERS = ['pnpm', 'yarn', 'npm', 'bun'] as const

export type PackageManager = (typeof PACKAGE_MANAGERS)[number]

export type PackageManagerCommand = {
  command: string
  args: string[]
}

export type PackageManagerAdapter = {
  id: PackageManager
  label: string
  packageManagerField: string
  runCommandPrefix: string
  execCommandPrefix: string
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
  createCloudflareApp(targetDirectory: string): PackageManagerCommand
  installInDirectoryCommand(directory: string): string
  runScriptInDirectoryCommand(directory: string, script: string): string
  dlxCommand(packageName: string, args: string[]): string
  workspaceRunCommand(
    workspace: 'frontend' | 'backoffice' | 'server' | 'packages/trpc',
    script: string,
  ): string
  runScript(script: string): string
  rootFormatScript(): string
  rootFormatCheckScript(): string
  rootLintScript(): string
  rootVerifyScript(): string
  verifyCommand(): string
}

const PNPM_VERSION = '10.32.1'
const YARN_VERSION = '4.13.0'
const NPM_VERSION = '11.11.1'
const BUN_VERSION = '1.3.4'

function withArgs(command: string, args: string[]): PackageManagerCommand {
  return { command, args }
}

const pnpmAdapter: PackageManagerAdapter = {
  id: 'pnpm',
  label: 'pnpm',
  packageManagerField: `pnpm@${PNPM_VERSION}`,
  runCommandPrefix: 'pnpm',
  execCommandPrefix: 'pnpm exec',
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
  createCloudflareApp(targetDirectory) {
    return withArgs('pnpm', [
      'create',
      'cloudflare@latest',
      targetDirectory,
      '--type',
      'hello-world',
      '--lang',
      'ts',
      '--no-deploy',
      '--no-git',
      '--accept-defaults',
    ])
  },
  installInDirectoryCommand(directory) {
    return `pnpm --dir ${directory} install`
  },
  runScriptInDirectoryCommand(directory, script) {
    return `pnpm --dir ${directory} ${script}`
  },
  dlxCommand(packageName, args) {
    return ['pnpm', 'dlx', packageName, ...args].join(' ')
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
  runCommandPrefix: 'yarn',
  execCommandPrefix: 'yarn exec',
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
  createCloudflareApp(targetDirectory) {
    return withArgs('yarn', [
      'create',
      'cloudflare@latest',
      targetDirectory,
      '--type',
      'hello-world',
      '--lang',
      'ts',
      '--no-deploy',
      '--no-git',
      '--accept-defaults',
    ])
  },
  installInDirectoryCommand(directory) {
    return `yarn --cwd ${directory} install`
  },
  runScriptInDirectoryCommand(directory, script) {
    return `yarn --cwd ${directory} ${script}`
  },
  dlxCommand(packageName, args) {
    return ['yarn', 'dlx', packageName, ...args].join(' ')
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

const npmAdapter: PackageManagerAdapter = {
  id: 'npm',
  label: 'npm',
  packageManagerField: `npm@${NPM_VERSION}`,
  runCommandPrefix: 'npm run',
  execCommandPrefix: 'npm exec --',
  rootTemplateFiles: [
    {
      sourceName: 'npm.gitignore',
      targetName: '.gitignore',
    },
    {
      sourceName: 'npm.biome.json',
      targetName: 'biome.json',
    },
    {
      sourceName: 'npm.npmrc',
      targetName: '.npmrc',
    },
  ],
  workspaceManifestFile: null,
  extraRootFiles: [],
  toolingFiles: ['package-lock.json'],
  workspaceArtifacts: ['node_modules'],
  install() {
    return withArgs('npm', ['install'])
  },
  add(packages, options) {
    return withArgs('npm', ['install', ...(options?.dev ? ['--save-dev'] : []), ...packages])
  },
  exec(binary, args) {
    return withArgs('npm', ['exec', '--', binary, ...args])
  },
  dlx(packageName, args) {
    return withArgs('npx', [packageName, ...args])
  },
  createGraniteApp(targetDirectory) {
    return withArgs('npx', ['create-granite-app', targetDirectory, '--tools', 'biome'])
  },
  createViteApp(targetDirectory) {
    return withArgs('npx', [
      'create-vite',
      targetDirectory,
      '--template',
      'react-ts',
      '--no-interactive',
    ])
  },
  createCloudflareApp(targetDirectory) {
    return withArgs('npx', [
      'create-cloudflare@latest',
      targetDirectory,
      '--type',
      'hello-world',
      '--lang',
      'ts',
      '--no-deploy',
      '--no-git',
      '--accept-defaults',
    ])
  },
  installInDirectoryCommand(directory) {
    return `npm --prefix ${directory} install`
  },
  runScriptInDirectoryCommand(directory, script) {
    return `npm --prefix ${directory} run ${script}`
  },
  dlxCommand(packageName, args) {
    return ['npx', packageName, ...args].join(' ')
  },
  workspaceRunCommand(workspace, script) {
    return `npm --workspace ${workspace} run ${script}`
  },
  runScript(script) {
    return `npm run ${script}`
  },
  rootFormatScript() {
    return 'npm exec -- biome format . --write'
  },
  rootFormatCheckScript() {
    return 'npm exec -- biome format .'
  },
  rootLintScript() {
    return 'npm exec -- biome lint .'
  },
  rootVerifyScript() {
    return 'npm run format:check && npm run lint && npm run typecheck && npm run test'
  },
  verifyCommand() {
    return 'npm run verify'
  },
}

const bunAdapter: PackageManagerAdapter = {
  id: 'bun',
  label: 'bun',
  packageManagerField: `bun@${BUN_VERSION}`,
  runCommandPrefix: 'bun run',
  execCommandPrefix: 'bunx',
  rootTemplateFiles: [
    {
      sourceName: 'bun.gitignore',
      targetName: '.gitignore',
    },
    {
      sourceName: 'bun.biome.json',
      targetName: 'biome.json',
    },
  ],
  workspaceManifestFile: null,
  extraRootFiles: [],
  toolingFiles: ['bun.lock', 'bun.lockb'],
  workspaceArtifacts: ['node_modules'],
  install() {
    return withArgs('bun', ['install'])
  },
  add(packages, options) {
    return withArgs('bun', ['add', ...(options?.dev ? ['-d'] : []), ...packages])
  },
  exec(binary, args) {
    return withArgs('bunx', [binary, ...args])
  },
  dlx(packageName, args) {
    return withArgs('bunx', [packageName, ...args])
  },
  createGraniteApp(targetDirectory) {
    return withArgs('bunx', ['create-granite-app', targetDirectory, '--tools', 'biome'])
  },
  createViteApp(targetDirectory) {
    return withArgs('bunx', [
      'create-vite',
      targetDirectory,
      '--template',
      'react-ts',
      '--no-interactive',
    ])
  },
  createCloudflareApp(targetDirectory) {
    return withArgs('bunx', [
      'create-cloudflare@latest',
      targetDirectory,
      '--type',
      'hello-world',
      '--lang',
      'ts',
      '--no-deploy',
      '--no-git',
      '--accept-defaults',
    ])
  },
  installInDirectoryCommand(directory) {
    return `bun install --cwd ${directory}`
  },
  runScriptInDirectoryCommand(directory, script) {
    return `bun run --cwd ${directory} ${script}`
  },
  dlxCommand(packageName, args) {
    return ['bunx', packageName, ...args].join(' ')
  },
  workspaceRunCommand(workspace, script) {
    return `bun run --cwd ${workspace} ${script}`
  },
  runScript(script) {
    return `bun run ${script}`
  },
  rootFormatScript() {
    return 'bunx biome format . --write'
  },
  rootFormatCheckScript() {
    return 'bunx biome format .'
  },
  rootLintScript() {
    return 'bunx biome lint .'
  },
  rootVerifyScript() {
    return 'bun run format:check && bun run lint && bun run typecheck && bun run test'
  },
  verifyCommand() {
    return 'bun run verify'
  },
}

const packageManagers = {
  pnpm: pnpmAdapter,
  yarn: yarnAdapter,
  npm: npmAdapter,
  bun: bunAdapter,
} satisfies Record<PackageManager, PackageManagerAdapter>

export function getPackageManagerAdapter(packageManager: PackageManager) {
  return packageManagers[packageManager]
}
