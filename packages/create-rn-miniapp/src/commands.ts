import { spawn } from 'node:child_process'
import { getPackageManagerAdapter, type PackageManager } from './package-manager.js'
import {
  getServerProviderAdapter,
  type ServerProvider,
  type ServerProviderCommandSpec,
} from './providers/index.js'

export type CommandSpec = ServerProviderCommandSpec

export type CommandOutput = {
  stdout: string
  stderr: string
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

  const server = options.serverProvider
    ? getServerProviderAdapter(options.serverProvider).buildCreatePlan(options)
    : []

  const backoffice = options.withBackoffice
    ? [
        {
          cwd: options.targetRoot,
          ...packageManager.createViteApp('backoffice'),
          label: 'backoffice Vite 만들기',
        },
      ]
    : []

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
  const packageManager = getPackageManagerAdapter(options.packageManager)
  const server = options.serverProvider
    ? getServerProviderAdapter(options.serverProvider).buildAddPlan(options)
    : []

  const backoffice = options.withBackoffice
    ? [
        {
          cwd: options.targetRoot,
          ...packageManager.createViteApp('backoffice'),
          label: 'backoffice Vite 만들기',
        },
      ]
    : []

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
  return await new Promise<CommandOutput>((resolve, reject) => {
    let stdout = ''
    let stderr = ''
    const child = spawn(spec.command, spec.args, {
      cwd: spec.cwd,
      stdio: captureOutput ? ['ignore', 'pipe', 'pipe'] : 'inherit',
      shell: false,
    })

    if (captureOutput) {
      child.stdout?.on('data', (chunk) => {
        stdout += String(chunk)
      })
      child.stderr?.on('data', (chunk) => {
        stderr += String(chunk)
      })
    }

    child.on('error', reject)
    child.on('exit', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr })
        return
      }

      const combinedOutput = [stdout.trim(), stderr.trim()].filter(Boolean).join('\n')

      reject(
        new Error(
          `${spec.label} 중에 실패했어요. (${spec.command} ${spec.args.join(' ')})${captureOutput && combinedOutput ? `\n${combinedOutput}` : ''}`,
        ),
      )
    })
  })
}

export async function runCommand(spec: CommandSpec) {
  await executeCommand(spec, false)
}

export async function runCommandWithOutput(spec: CommandSpec) {
  return await executeCommand(spec, true)
}
