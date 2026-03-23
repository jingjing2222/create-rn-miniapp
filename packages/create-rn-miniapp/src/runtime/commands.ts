import { execa, ExecaError } from 'execa'
import type { CommandSpec } from './command-spec.js'
import { getPackageManagerAdapter, type PackageManager } from './package-manager.js'
import { getServerProviderAdapter, type ServerProvider } from '../providers/index.js'

export type CommandOutput = {
  stdout: string
  stderr: string
}

type CommandExecutionErrorOptions = {
  label: string
  command: string
  args: string[]
  stdout: string
  stderr: string
  exitCode: number
}

export class CommandExecutionError extends Error {
  readonly label: string
  readonly command: string
  readonly args: string[]
  readonly stdout: string
  readonly stderr: string
  readonly exitCode: number

  constructor(options: CommandExecutionErrorOptions) {
    const combinedOutput = [options.stdout.trim(), options.stderr.trim()].filter(Boolean).join('\n')
    super(
      `${options.label} 중에 실패했어요. (${options.command} ${options.args.join(' ')})${combinedOutput ? `\n${combinedOutput}` : ''}`,
    )

    this.name = 'CommandExecutionError'
    this.label = options.label
    this.command = options.command
    this.args = [...options.args]
    this.stdout = options.stdout
    this.stderr = options.stderr
    this.exitCode = options.exitCode
  }
}

type CreatePlanOptions = {
  appName: string
  targetRoot: string
  packageManager: PackageManager
  serverProvider: ServerProvider | null
  withBackoffice: boolean
}

type AddPlanOptions = {
  targetRoot: string
  packageManager: PackageManager
  serverProvider: ServerProvider | null
  withBackoffice: boolean
}

function buildServerCommands(options: {
  targetRoot: string
  packageManager: PackageManager
  serverProvider: ServerProvider | null
}) {
  return options.serverProvider
    ? getServerProviderAdapter(options.serverProvider).buildPlan(options)
    : []
}

function buildBackofficeCommands(options: {
  targetRoot: string
  packageManager: PackageManager
  withBackoffice: boolean
}) {
  if (!options.withBackoffice) {
    return []
  }

  const packageManager = getPackageManagerAdapter(options.packageManager)

  return [
    {
      cwd: options.targetRoot,
      ...packageManager.createViteApp('backoffice'),
      label: 'backoffice Vite 만들기',
    },
  ] satisfies CommandSpec[]
}

export function buildCreateCommandPhases(options: CreatePlanOptions) {
  const packageManager = getPackageManagerAdapter(options.packageManager)
  const frontendRoot = `${options.targetRoot}/frontend`

  const frontend: CommandSpec[] = [
    {
      cwd: options.targetRoot,
      ...packageManager.createGraniteApp('frontend'),
      label: 'frontend Granite 만들기',
    },
    {
      cwd: frontendRoot,
      ...packageManager.install(),
      label: 'frontend 의존성 설치하기',
    },
    {
      cwd: frontendRoot,
      ...packageManager.add(['@apps-in-toss/framework']),
      label: 'frontend AppInToss Framework 설치하기',
    },
    {
      cwd: frontendRoot,
      ...packageManager.exec('ait', [
        'init',
        '--template',
        'react-native',
        '--app-name',
        options.appName,
        '--skip-input',
      ]),
      label: 'frontend ait 초기화하기',
    },
    {
      cwd: frontendRoot,
      ...packageManager.add(['@toss/tds-react-native@2.0.2']),
      label: 'frontend TDS 설치하기',
    },
  ]

  const server = buildServerCommands(options)
  const backoffice = buildBackofficeCommands(options)

  return {
    frontend,
    server,
    backoffice,
  }
}

export function buildCommandPlan(options: CreatePlanOptions) {
  const phases = buildCreateCommandPhases(options)

  return [...phases.frontend, ...phases.server, ...phases.backoffice]
}

export function buildAddCommandPhases(options: AddPlanOptions) {
  const server = buildServerCommands(options)
  const backoffice = buildBackofficeCommands(options)

  return {
    server,
    backoffice,
  }
}

export function buildAddCommandPlan(options: AddPlanOptions) {
  const phases = buildAddCommandPhases(options)

  return [...phases.server, ...phases.backoffice]
}

async function executeCommand(spec: CommandSpec, captureOutput: boolean) {
  try {
    const result = await execa(spec.command, spec.args, {
      cwd: spec.cwd,
      stdin: 'ignore',
      stdout: captureOutput ? 'pipe' : 'inherit',
      stderr: captureOutput ? 'pipe' : 'inherit',
      reject: false,
    })

    const stdout = result.stdout ?? ''
    const stderr = result.stderr ?? ''

    if (result.exitCode === 0) {
      return { stdout, stderr }
    }

    throw new CommandExecutionError({
      label: spec.label,
      command: spec.command,
      args: spec.args,
      stdout: captureOutput ? stdout : '',
      stderr: captureOutput ? stderr : '',
      exitCode: result.exitCode ?? 1,
    })
  } catch (error) {
    if (error instanceof CommandExecutionError) {
      throw error
    }

    if (error instanceof ExecaError) {
      throw new CommandExecutionError({
        label: spec.label,
        command: spec.command,
        args: spec.args,
        stdout: typeof error.stdout === 'string' ? error.stdout : '',
        stderr:
          [error.stderr, error.shortMessage]
            .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
            .map((part) => part.trim())
            .join('\n') ?? '',
        exitCode: error.exitCode ?? 1,
      })
    }

    const message = error instanceof Error ? error.message : String(error)
    throw new Error(
      `${spec.label} 중에 실패했어요. (${spec.command} ${spec.args.join(' ')})\n${message}`,
    )
  }
}

export async function runCommand(spec: CommandSpec) {
  await executeCommand(spec, false)
}

export async function runCommandWithOutput(spec: CommandSpec) {
  return await executeCommand(spec, true)
}
