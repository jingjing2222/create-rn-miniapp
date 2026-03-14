import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import {
  applyRootTemplates,
  applyServerPackageTemplate,
  applyWorkspaceProjectTemplate,
  pathExists,
  syncRootWorkspaceManifest,
  type TemplateTokens,
} from './templates.js'

function createTokens(packageManager: 'pnpm' | 'yarn'): TemplateTokens {
  return {
    appName: 'ebook-miniapp',
    displayName: '전자책 미니앱',
    packageManager,
    packageManagerCommand: packageManager,
    packageManagerExecCommand: `${packageManager} exec`,
    verifyCommand: `${packageManager} verify`,
  }
}

async function createTempTargetRoot(t: test.TestContext) {
  const targetRoot = await mkdtemp(path.join(os.tmpdir(), 'create-rn-miniapp-templates-'))
  t.after(async () => {
    await rm(targetRoot, { recursive: true, force: true })
  })
  return targetRoot
}

const NX_ROOT_SCHEMA_URL =
  'https://raw.githubusercontent.com/nrwl/nx/master/packages/nx/schemas/nx-schema.json'
const NX_PROJECT_SCHEMA_URL =
  'https://raw.githubusercontent.com/nrwl/nx/master/packages/nx/schemas/project-schema.json'

test('applyRootTemplates keeps pnpm workspace manifest for pnpm', async (t) => {
  const targetRoot = await createTempTargetRoot(t)

  await applyRootTemplates(targetRoot, createTokens('pnpm'), ['frontend'])

  const packageJson = JSON.parse(await readFile(path.join(targetRoot, 'package.json'), 'utf8')) as {
    packageManager?: string
    workspaces?: string[]
    scripts?: Record<string, string>
    devDependencies?: Record<string, string>
  }
  const nxJson = JSON.parse(await readFile(path.join(targetRoot, 'nx.json'), 'utf8')) as {
    $schema?: string
  }
  const gitignore = await readFile(path.join(targetRoot, '.gitignore'), 'utf8')
  const biomeJson = await readFile(path.join(targetRoot, 'biome.json'), 'utf8')

  assert.equal(packageJson.packageManager, 'pnpm@10.32.1')
  assert.equal(packageJson.workspaces, undefined)
  assert.equal(await pathExists(path.join(targetRoot, 'pnpm-workspace.yaml')), true)
  assert.equal(await pathExists(path.join(targetRoot, '.yarnrc.yml')), false)
  assert.equal(
    packageJson.scripts?.verify,
    'pnpm format:check && pnpm lint && pnpm typecheck && pnpm test',
  )
  assert.equal(packageJson.devDependencies?.nx, '^22.5.4')
  assert.equal(packageJson.devDependencies?.typescript, '^5.9.3')
  assert.equal(packageJson.devDependencies?.['@biomejs/biome'], '^1.9.4')
  assert.equal(nxJson.$schema, NX_ROOT_SCHEMA_URL)
  assert.doesNotMatch(gitignore, /^\.yarn\/?$/m)
  assert.doesNotMatch(gitignore, /^\.pnp\.\*$/m)
  assert.doesNotMatch(gitignore, /^server\/worker-configuration\.d\.ts$/m)
  assert.doesNotMatch(biomeJson, /\*\*\/\.yarn\/\*\*/)
  assert.doesNotMatch(biomeJson, /\*\*\/\.pnp\.\*/)
  assert.doesNotMatch(biomeJson, /\*\*\/server\/worker-configuration\.d\.ts/)
  assert.equal(
    await readFile(path.join(targetRoot, 'pnpm-workspace.yaml'), 'utf8'),
    'packages:\n  - frontend\n',
  )
})

test('applyRootTemplates and workspace templates emit yarn-specific files and commands', async (t) => {
  const targetRoot = await createTempTargetRoot(t)
  const tokens = createTokens('yarn')

  await applyRootTemplates(targetRoot, tokens, ['frontend', 'server'])
  await applyWorkspaceProjectTemplate(targetRoot, 'frontend', tokens)
  await applyServerPackageTemplate(targetRoot, tokens)

  const packageJsonSource = await readFile(path.join(targetRoot, 'package.json'), 'utf8')
  const packageJson = JSON.parse(packageJsonSource) as {
    packageManager?: string
    workspaces?: string[]
    scripts?: Record<string, string>
    devDependencies?: Record<string, string>
  }
  const gitignore = await readFile(path.join(targetRoot, '.gitignore'), 'utf8')
  const yarnrc = await readFile(path.join(targetRoot, '.yarnrc.yml'), 'utf8')
  const biomeJson = await readFile(path.join(targetRoot, 'biome.json'), 'utf8')
  const frontendProject = JSON.parse(
    await readFile(path.join(targetRoot, 'frontend', 'project.json'), 'utf8'),
  ) as {
    $schema?: string
    targets?: Record<string, { command?: string }>
  }
  const serverPackageJson = JSON.parse(
    await readFile(path.join(targetRoot, 'server', 'package.json'), 'utf8'),
  ) as {
    scripts?: Record<string, string>
  }
  const serverDbApplyScript = await readFile(
    path.join(targetRoot, 'server', 'scripts', 'supabase-db-apply.mjs'),
    'utf8',
  )

  assert.equal(packageJson.packageManager, 'yarn@4.13.0')
  assert.deepEqual(packageJson.workspaces, ['frontend', 'server'])
  assert.equal(await pathExists(path.join(targetRoot, 'pnpm-workspace.yaml')), false)
  assert.ok(
    packageJsonSource.indexOf('"packageManager"') < packageJsonSource.indexOf('"workspaces"'),
  )
  assert.equal(packageJson.devDependencies?.nx, '^22.5.4')
  assert.equal(packageJson.devDependencies?.typescript, '^5.9.3')
  assert.equal(packageJson.devDependencies?.['@biomejs/biome'], '^1.9.4')
  assert.equal(frontendProject.$schema, NX_PROJECT_SCHEMA_URL)
  assert.match(gitignore, /^\.yarn\/?$/m)
  assert.match(gitignore, /^\.pnp\.\*$/m)
  assert.match(yarnrc, /nodeLinker: pnp/)
  assert.match(yarnrc, /packageExtensions:/)
  assert.match(yarnrc, /"@react-native-community\/cli-debugger-ui@\*":/)
  assert.match(yarnrc, /"@babel\/runtime": "\^7\.0\.0"/)
  assert.match(biomeJson, /\*\*\/\.yarn\/\*\*/)
  assert.match(biomeJson, /\*\*\/\.pnp\.\*/)
  assert.doesNotMatch(gitignore, /^server\/worker-configuration\.d\.ts$/m)
  assert.doesNotMatch(biomeJson, /\*\*\/server\/worker-configuration\.d\.ts/)
  assert.equal(frontendProject.targets?.build.command, 'yarn workspace frontend build')
  assert.equal(frontendProject.targets?.typecheck.command, 'yarn workspace frontend typecheck')
  assert.equal(serverPackageJson.scripts?.dev, 'yarn dlx supabase start --workdir .')
  assert.equal(serverPackageJson.scripts?.build, 'yarn typecheck')
  assert.equal(serverPackageJson.scripts?.['db:apply'], 'node ./scripts/supabase-db-apply.mjs')
  assert.equal(
    serverPackageJson.scripts?.['db:apply:local'],
    'yarn dlx supabase db push --local --workdir .',
  )
  assert.equal(
    serverPackageJson.scripts?.['db:reset'],
    'yarn dlx supabase db reset --local --workdir .',
  )
  assert.match(serverDbApplyScript, /SUPABASE_DB_PASSWORD/)
  assert.match(serverDbApplyScript, /supabase', 'db', 'push'/)
  assert.match(serverDbApplyScript, /yarn/)
})

test('syncRootWorkspaceManifest adds newly added workspaces to existing root manifests', async (t) => {
  const pnpmRoot = await createTempTargetRoot(t)
  const yarnRoot = await createTempTargetRoot(t)

  await applyRootTemplates(pnpmRoot, createTokens('pnpm'), ['frontend'])
  await applyRootTemplates(yarnRoot, createTokens('yarn'), ['frontend'])

  await syncRootWorkspaceManifest(pnpmRoot, 'pnpm', ['frontend', 'server'])
  await syncRootWorkspaceManifest(yarnRoot, 'yarn', ['frontend', 'backoffice'])

  const pnpmWorkspaceManifest = await readFile(path.join(pnpmRoot, 'pnpm-workspace.yaml'), 'utf8')
  const yarnPackageJson = JSON.parse(
    await readFile(path.join(yarnRoot, 'package.json'), 'utf8'),
  ) as {
    workspaces?: string[]
  }

  assert.equal(pnpmWorkspaceManifest, 'packages:\n  - frontend\n  - server\n')
  assert.deepEqual(yarnPackageJson.workspaces, ['frontend', 'backoffice'])
})
