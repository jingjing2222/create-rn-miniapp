import { readFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const manifestPath = path.join(workspaceRoot, '.create-rn-miniapp', 'skills.json')
const rootPackageJsonPath = path.join(workspaceRoot, 'package.json')

function resolvePackageManagerCommand(packageManager, packageSpec, args) {
  switch (packageManager) {
    case 'pnpm':
      return { command: 'pnpm', args: ['dlx', packageSpec, ...args] }
    case 'yarn':
      return { command: 'yarn', args: ['dlx', packageSpec, ...args] }
    case 'npm':
      return { command: 'npx', args: ['-y', packageSpec, ...args] }
    case 'bun':
      return { command: 'bunx', args: [packageSpec, ...args] }
    default:
      throw new Error(`지원하지 않는 package manager입니다: ${packageManager}`)
  }
}

async function main() {
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
  const rootPackageJson = JSON.parse(await readFile(rootPackageJsonPath, 'utf8'))
  const packageManager = String(rootPackageJson.packageManager ?? '').split('@')[0]
  const generatorPackage = manifest.generatorPackage ?? 'create-rn-miniapp'
  const targetVersion = process.argv[2] ?? 'latest'
  const invocation = resolvePackageManagerCommand(
    packageManager,
    `${generatorPackage}@${targetVersion}`,
    ['skills', 'upgrade', '--root-dir', '.', '--to', targetVersion],
  )

  await new Promise((resolve, reject) => {
    const child = spawn(invocation.command, invocation.args, {
      cwd: workspaceRoot,
      stdio: 'inherit',
    })

    child.on('exit', (code) => {
      if (code === 0) {
        resolve(undefined)
        return
      }

      reject(new Error(`skills upgrade가 실패했습니다. exit code: ${code ?? 'unknown'}`))
    })
    child.on('error', reject)
  })
}

await main()
