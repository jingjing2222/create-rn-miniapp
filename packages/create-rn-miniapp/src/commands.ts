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
      label: 'frontend granite scaffold',
    },
    {
      cwd: frontendRoot,
      command: 'pnpm',
      args: ['install'],
      label: 'frontend install',
    },
    {
      cwd: frontendRoot,
      command: 'pnpm',
      args: ['add', '@apps-in-toss/framework'],
      label: 'frontend install appintoss framework',
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
      label: 'frontend ait init',
    },
    {
      cwd: frontendRoot,
      command: 'pnpm',
      args: ['add', '@toss/tds-react-native@2.0.2'],
      label: 'frontend install tds',
    },
  ]

  if (options.withServer) {
    plan.push({
      cwd: serverRoot,
      command: 'pnpm',
      args: ['dlx', 'supabase', 'init'],
      label: 'server supabase init',
    })
  }

  if (options.withBackoffice) {
    plan.push({
      cwd: options.targetRoot,
      command: 'pnpm',
      args: ['dlx', 'create-vite', 'backoffice', '--template', 'react-ts', '--no-interactive'],
      label: 'backoffice vite scaffold',
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

      reject(new Error(`Failed: ${spec.label} (${spec.command} ${spec.args.join(' ')})`))
    })
  })
}
