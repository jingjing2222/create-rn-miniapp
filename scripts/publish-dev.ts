import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

type PackageJson = {
  name: string
  version: string
  dependencies?: Record<string, string>
}

type PrepareDevPublishPackageJsonsInput = {
  version: string
  cliPackageJson: PackageJson
  templatesPackageJson: PackageJson
}

type PrepareDevPublishPackageJsonsResult = {
  cliPackageJson: PackageJson
  templatesPackageJson: PackageJson
}

const repoRoot = path.resolve(__dirname, '..')
const cliPackageName = 'create-rn-miniapp'
const templatesPackageName = '@create-rn-miniapp/scaffold-templates'

export function formatDevPublishVersion(date: Date): string {
  const year = String(date.getUTCFullYear())
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  const hour = String(date.getUTCHours()).padStart(2, '0')
  const minute = String(date.getUTCMinutes()).padStart(2, '0')
  const second = String(date.getUTCSeconds()).padStart(2, '0')

  return `0.0.0-dev.${year}${month}${day}${hour}${minute}${second}`
}

export function prepareDevPublishPackageJsons(
  input: PrepareDevPublishPackageJsonsInput,
): PrepareDevPublishPackageJsonsResult {
  return {
    templatesPackageJson: {
      ...input.templatesPackageJson,
      version: input.version,
    },
    cliPackageJson: {
      ...input.cliPackageJson,
      version: input.version,
      dependencies: {
        ...input.cliPackageJson.dependencies,
        [templatesPackageName]: input.version,
      },
    },
  }
}

function readJsonFile<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T
}

function writeJsonFile(filePath: string, value: unknown): void {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`)
}

function ensureNpmToken(env: NodeJS.ProcessEnv): string {
  const token = env.NPM_TOKEN?.trim()

  if (!token) {
    throw new Error('`publish:dev`를 실행하려면 `NPM_TOKEN` 환경 변수가 필요합니다.')
  }

  return token
}

function buildWorkspace(): void {
  execFileSync('pnpm', ['build'], {
    cwd: repoRoot,
    stdio: 'inherit',
  })
}

function stagePackageDirectory(sourceDir: string, targetDir: string): void {
  fs.cpSync(sourceDir, targetDir, {
    recursive: true,
  })
}

function createNpmUserConfig(tempRoot: string, token: string): string {
  const npmrcPath = path.join(tempRoot, '.npmrc')
  fs.writeFileSync(npmrcPath, `//registry.npmjs.org/:_authToken=${token}\nalways-auth=true\n`)

  return npmrcPath
}

function publishPackage(cwd: string, npmrcPath: string): void {
  execFileSync(
    'npm',
    [
      'publish',
      '--tag',
      'dev',
      '--access',
      'public',
      '--ignore-scripts',
      '--userconfig',
      npmrcPath,
    ],
    {
      cwd,
      stdio: 'inherit',
    },
  )
}

function main(): void {
  const npmToken = ensureNpmToken(process.env)
  const version = formatDevPublishVersion(new Date())
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'create-rn-miniapp-dev-publish-'))
  const npmrcPath = createNpmUserConfig(tempRoot, npmToken)
  const cliSourceDir = path.join(repoRoot, 'packages/create-rn-miniapp')
  const templatesSourceDir = path.join(repoRoot, 'packages/scaffold-templates')
  const cliStageDir = path.join(tempRoot, 'create-rn-miniapp')
  const templatesStageDir = path.join(tempRoot, 'scaffold-templates')

  try {
    buildWorkspace()

    stagePackageDirectory(templatesSourceDir, templatesStageDir)
    stagePackageDirectory(cliSourceDir, cliStageDir)

    const prepared = prepareDevPublishPackageJsons({
      version,
      cliPackageJson: readJsonFile<PackageJson>(path.join(cliStageDir, 'package.json')),
      templatesPackageJson: readJsonFile<PackageJson>(path.join(templatesStageDir, 'package.json')),
    })

    writeJsonFile(path.join(templatesStageDir, 'package.json'), prepared.templatesPackageJson)
    writeJsonFile(path.join(cliStageDir, 'package.json'), prepared.cliPackageJson)

    console.log(`Publishing ${templatesPackageName}@${version}`)
    publishPackage(templatesStageDir, npmrcPath)

    console.log(`Publishing ${cliPackageName}@${version}`)
    publishPackage(cliStageDir, npmrcPath)
  } finally {
    fs.rmSync(tempRoot, {
      force: true,
      recursive: true,
    })
  }
}

if (require.main === module) {
  main()
}
