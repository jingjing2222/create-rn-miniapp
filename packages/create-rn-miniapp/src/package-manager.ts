import {
  CREATE_CLOUDFLARE_CLI,
  CREATE_GRANITE_APP_CLI,
  CREATE_VITE_CLI,
  type ExternalCliTool,
} from './external-tooling.js'
import type { TrpcWorkspacePath } from './trpc-workspace-metadata.js'

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
  rootBiomeIncludes: string[]
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
  dlx(tool: ExternalCliTool, args: string[]): PackageManagerCommand
  createGraniteApp(targetDirectory: string): PackageManagerCommand
  createViteApp(targetDirectory: string): PackageManagerCommand
  createCloudflareApp(targetDirectory: string): PackageManagerCommand
  installInDirectory(directory: string): PackageManagerCommand
  runScriptInDirectory(directory: string, script: string): PackageManagerCommand
  installInDirectoryCommand(directory: string): string
  runScriptInDirectoryCommand(directory: string, script: string): string
  dlxCommand(tool: ExternalCliTool, args: string[]): string
  workspaceRunCommand(
    workspace: 'frontend' | 'backoffice' | 'server' | TrpcWorkspacePath,
    script: string,
  ): string
  runScript(script: string): string
  rootFormatScript(): string
  rootFormatCheckScript(): string
  rootLintScript(): string
  verifyCommand(): string
}

const PNPM_VERSION = '10.32.1'
const YARN_VERSION = '4.13.0'
const NPM_VERSION = '11.11.1'
const BUN_VERSION = '1.3.4'
const COMMON_ROOT_BIOME_INCLUDES = [
  '**',
  '!!**/.nx',
  '!!**/node_modules',
  '!!**/dist',
  '!!frontend/.granite',
]
const YARN_ROOT_BIOME_INCLUDES = [
  '**',
  '!!**/.nx',
  '!!**/.yarn',
  '!!**/node_modules',
  '!!**/dist',
  '!!**/.pnp.*',
  '!!frontend/.granite',
]

function withArgs(command: string, args: string[]): PackageManagerCommand {
  return { command, args }
}

function renderCommandString(command: PackageManagerCommand) {
  return [command.command, ...command.args].join(' ')
}

const pnpmAdapter: PackageManagerAdapter = {
  id: 'pnpm',
  label: 'pnpm',
  packageManagerField: `pnpm@${PNPM_VERSION}`,
  rootBiomeIncludes: COMMON_ROOT_BIOME_INCLUDES,
  rootTemplateFiles: [
    {
      sourceName: 'pnpm.gitignore',
      targetName: '.gitignore',
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
  dlx(tool, args) {
    return withArgs('pnpm', ['dlx', tool.packageSpec, ...args])
  },
  createGraniteApp(targetDirectory) {
    return this.dlx(CREATE_GRANITE_APP_CLI, [targetDirectory, '--tools', 'biome'])
  },
  createViteApp(targetDirectory) {
    return this.dlx(CREATE_VITE_CLI, [
      targetDirectory,
      '--template',
      'react-ts',
      '--no-interactive',
    ])
  },
  createCloudflareApp(targetDirectory) {
    return this.dlx(CREATE_CLOUDFLARE_CLI, [
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
  installInDirectory(directory) {
    return withArgs('pnpm', ['--dir', directory, 'install'])
  },
  runScriptInDirectory(directory, script) {
    return withArgs('pnpm', ['--dir', directory, 'run', script])
  },
  installInDirectoryCommand(directory) {
    return renderCommandString(this.installInDirectory(directory))
  },
  runScriptInDirectoryCommand(directory, script) {
    return renderCommandString(this.runScriptInDirectory(directory, script))
  },
  dlxCommand(tool, args) {
    return renderCommandString(this.dlx(tool, args))
  },
  workspaceRunCommand(workspace, script) {
    return `pnpm --dir ${workspace} run ${script}`
  },
  runScript(script) {
    return `pnpm run ${script}`
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
  verifyCommand() {
    return 'pnpm verify'
  },
}

const yarnAdapter: PackageManagerAdapter = {
  id: 'yarn',
  label: 'yarn',
  packageManagerField: `yarn@${YARN_VERSION}`,
  rootBiomeIncludes: YARN_ROOT_BIOME_INCLUDES,
  rootTemplateFiles: [
    {
      sourceName: 'yarn.gitignore',
      targetName: '.gitignore',
    },
  ],
  workspaceManifestFile: null,
  extraRootFiles: [
    {
      sourceName: 'yarnrc.yml',
      targetName: '.yarnrc.yml',
    },
  ],
  toolingFiles: ['yarn.lock', '.pnp.cjs', '.pnp.loader.mjs', '.yarnrc.yml'],
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
  dlx(tool, args) {
    return withArgs('yarn', ['dlx', tool.packageSpec, ...args])
  },
  createGraniteApp(targetDirectory) {
    return this.dlx(CREATE_GRANITE_APP_CLI, [targetDirectory, '--tools', 'biome'])
  },
  createViteApp(targetDirectory) {
    return this.dlx(CREATE_VITE_CLI, [
      targetDirectory,
      '--template',
      'react-ts',
      '--no-interactive',
    ])
  },
  createCloudflareApp(targetDirectory) {
    return this.dlx(CREATE_CLOUDFLARE_CLI, [
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
  installInDirectory(directory) {
    return withArgs('yarn', ['--cwd', directory, 'install'])
  },
  runScriptInDirectory(directory, script) {
    return withArgs('yarn', ['--cwd', directory, script])
  },
  installInDirectoryCommand(directory) {
    return renderCommandString(this.installInDirectory(directory))
  },
  runScriptInDirectoryCommand(directory, script) {
    return renderCommandString(this.runScriptInDirectory(directory, script))
  },
  dlxCommand(tool, args) {
    return renderCommandString(this.dlx(tool, args))
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
  verifyCommand() {
    return 'yarn verify'
  },
}

const npmAdapter: PackageManagerAdapter = {
  id: 'npm',
  label: 'npm',
  packageManagerField: `npm@${NPM_VERSION}`,
  rootBiomeIncludes: COMMON_ROOT_BIOME_INCLUDES,
  rootTemplateFiles: [
    {
      sourceName: 'npm.gitignore',
      targetName: '.gitignore',
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
  dlx(tool, args) {
    return withArgs('npx', [tool.packageSpec, ...args])
  },
  createGraniteApp(targetDirectory) {
    return this.dlx(CREATE_GRANITE_APP_CLI, [targetDirectory, '--tools', 'biome'])
  },
  createViteApp(targetDirectory) {
    return this.dlx(CREATE_VITE_CLI, [
      targetDirectory,
      '--template',
      'react-ts',
      '--no-interactive',
    ])
  },
  createCloudflareApp(targetDirectory) {
    return this.dlx(CREATE_CLOUDFLARE_CLI, [
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
  installInDirectory(directory) {
    return withArgs('npm', ['--prefix', directory, 'install'])
  },
  runScriptInDirectory(directory, script) {
    return withArgs('npm', ['--prefix', directory, 'run', script])
  },
  installInDirectoryCommand(directory) {
    return renderCommandString(this.installInDirectory(directory))
  },
  runScriptInDirectoryCommand(directory, script) {
    return renderCommandString(this.runScriptInDirectory(directory, script))
  },
  dlxCommand(tool, args) {
    return renderCommandString(this.dlx(tool, args))
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
  verifyCommand() {
    return 'npm run verify'
  },
}

const bunAdapter: PackageManagerAdapter = {
  id: 'bun',
  label: 'bun',
  packageManagerField: `bun@${BUN_VERSION}`,
  rootBiomeIncludes: COMMON_ROOT_BIOME_INCLUDES,
  rootTemplateFiles: [
    {
      sourceName: 'bun.gitignore',
      targetName: '.gitignore',
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
  dlx(tool, args) {
    return withArgs('bunx', [tool.packageSpec, ...args])
  },
  createGraniteApp(targetDirectory) {
    return this.dlx(CREATE_GRANITE_APP_CLI, [targetDirectory, '--tools', 'biome'])
  },
  createViteApp(targetDirectory) {
    return this.dlx(CREATE_VITE_CLI, [
      targetDirectory,
      '--template',
      'react-ts',
      '--no-interactive',
    ])
  },
  createCloudflareApp(targetDirectory) {
    return this.dlx(CREATE_CLOUDFLARE_CLI, [
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
  installInDirectory(directory) {
    return withArgs('bun', ['install', '--cwd', directory])
  },
  runScriptInDirectory(directory, script) {
    return withArgs('bun', ['run', '--cwd', directory, script])
  },
  installInDirectoryCommand(directory) {
    return renderCommandString(this.installInDirectory(directory))
  },
  runScriptInDirectoryCommand(directory, script) {
    return renderCommandString(this.runScriptInDirectory(directory, script))
  },
  dlxCommand(tool, args) {
    return renderCommandString(this.dlx(tool, args))
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
