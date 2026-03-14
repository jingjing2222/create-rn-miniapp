import { spawn } from 'node:child_process'

export type CommandSpec = {
  cwd: string
  command: string
  args: string[]
  label: string
}

export function buildCommandPlan(options: {
  appName: string
  targetRoot: string
  withServer: boolean
  withBackoffice: boolean
}) {
  const frontendRoot = `${options.targetRoot}/frontend`
  const serverRoot = `${options.targetRoot}/server`

  const plan: CommandSpec[] = [
    {
      cwd: options.targetRoot,
      command: 'pnpm',
      args: ['create', 'granite-app', 'frontend', '--tools', 'biome'],
      label: 'frontend Granite 생성',
    },
    {
      cwd: frontendRoot,
      command: 'pnpm',
      args: ['install'],
      label: 'frontend 의존성 설치',
    },
    {
      cwd: frontendRoot,
      command: 'pnpm',
      args: ['add', '@apps-in-toss/framework'],
      label: 'frontend AppInToss Framework 설치',
    },
    {
      cwd: frontendRoot,
      command: 'pnpm',
      args: [
        'exec',
        'ait',
        'init',
        '--template',
        'react-native',
        '--app-name',
        options.appName,
        '--skip-input',
      ],
      label: 'frontend ait 초기화',
    },
    {
      cwd: frontendRoot,
      command: 'pnpm',
      args: ['add', '@toss/tds-react-native@2.0.2'],
      label: 'frontend TDS 설치',
    },
  ]

  if (options.withServer) {
    plan.push({
      cwd: serverRoot,
      command: 'pnpm',
      args: ['dlx', 'supabase', 'init'],
      label: 'server Supabase 초기화',
    })
  }

  if (options.withBackoffice) {
    plan.push({
      cwd: options.targetRoot,
      command: 'pnpm',
      args: ['dlx', 'create-vite', 'backoffice', '--template', 'react-ts', '--no-interactive'],
      label: 'backoffice Vite 생성',
    })
  }

  return plan
}

export async function runCommand(spec: CommandSpec) {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(spec.command, spec.args, {
      cwd: spec.cwd,
      stdio: 'inherit',
      shell: false,
    })

    child.on('error', reject)
    child.on('exit', (code) => {
      if (code === 0) {
        resolve()
        return
      }

      reject(
        new Error(`${spec.label} 단계가 실패했습니다. (${spec.command} ${spec.args.join(' ')})`),
      )
    })
  })
}
