import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const repoRoot = path.resolve(import.meta.dirname, '../../..')
const require = createRequire(import.meta.url)
const {
  formatDevPublishVersion,
  prepareDevPublishPackageJsons,
} = require('../../../scripts/publish-dev.ts')

test('version-packages formats workspace after changeset bump', () => {
  const packageJsonPath = path.join(repoRoot, 'package.json')
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) as {
    scripts?: Record<string, string>
  }

  assert.equal(packageJson.scripts?.['version-packages'], 'changeset version && pnpm format')
  assert.equal(packageJson.scripts?.['publish:dev'], 'pnpm exec tsx scripts/publish-dev.ts')
  assert.equal(fs.existsSync(path.join(repoRoot, 'scripts/publish-dev.ts')), true)
  assert.equal(
    fs.existsSync(path.join(repoRoot, 'packages/create-rn-miniapp/src/release/dev-publish.ts')),
    false,
  )
})

test('formatDevPublishVersion renders a timestamped prerelease version', () => {
  assert.equal(
    formatDevPublishVersion(new Date('2026-03-15T09:08:07.000Z')),
    '0.0.0-dev.20260315090807',
  )
})

test('prepareDevPublishPackageJsons rewrites all publish manifests to the same dev version', () => {
  const prepared = prepareDevPublishPackageJsons({
    version: '0.0.0-dev.20260315090807',
    cliPackageJson: {
      name: 'create-rn-miniapp',
      version: '0.0.9',
      dependencies: {
        '@create-rn-miniapp/scaffold-templates': 'workspace:*',
        yargs: '^18.0.0',
      },
    },
    templatesPackageJson: {
      name: '@create-rn-miniapp/scaffold-templates',
      version: '0.0.9',
    },
  })

  assert.equal(prepared.cliPackageJson.version, '0.0.0-dev.20260315090807')
  assert.equal(prepared.templatesPackageJson.version, '0.0.0-dev.20260315090807')
  assert.equal(
    prepared.cliPackageJson.dependencies?.['@create-rn-miniapp/scaffold-templates'],
    '0.0.0-dev.20260315090807',
  )
  assert.equal(prepared.cliPackageJson.dependencies?.yargs, '^18.0.0')
})

test('published package names match the released npm packages', () => {
  const cliPackageJson = JSON.parse(
    fs.readFileSync(path.join(repoRoot, 'packages/create-rn-miniapp/package.json'), 'utf8'),
  ) as {
    name: string
    dependencies?: Record<string, string>
  }
  const templatesPackageJson = JSON.parse(
    fs.readFileSync(path.join(repoRoot, 'packages/scaffold-templates/package.json'), 'utf8'),
  ) as {
    name: string
  }

  assert.equal(cliPackageJson.name, 'create-rn-miniapp')
  assert.equal(
    cliPackageJson.dependencies?.['@create-rn-miniapp/scaffold-templates'],
    'workspace:*',
  )
  assert.equal(templatesPackageJson.name, '@create-rn-miniapp/scaffold-templates')
})

test('create-rn-miniapp package does not keep a local skills subcommand implementation', () => {
  assert.equal(
    fs.existsSync(path.join(repoRoot, 'packages/create-rn-miniapp/src/skills-command.ts')),
    false,
  )
})

test('skills live in the repository root instead of a published workspace package', () => {
  assert.equal(fs.existsSync(path.join(repoRoot, 'skills')), true)
  assert.equal(fs.existsSync(path.join(repoRoot, 'packages/agent-skills/package.json')), false)
  assert.equal(fs.existsSync(path.join(repoRoot, 'packages/skills-manager/package.json')), false)
})

test('workspace project schema does not depend on local node_modules paths', () => {
  const projectJson = JSON.parse(
    fs.readFileSync(path.join(repoRoot, 'packages/create-rn-miniapp/project.json'), 'utf8'),
  ) as {
    $schema?: string
  }

  assert.equal(
    projectJson.$schema,
    'https://raw.githubusercontent.com/nrwl/nx/master/packages/nx/schemas/project-schema.json',
  )
})

test('changeset files keep valid frontmatter delimiters', () => {
  const changesetRoot = path.join(repoRoot, '.changeset')
  const changesetFiles = fs
    .readdirSync(changesetRoot)
    .filter((fileName) => fileName.endsWith('.md') && fileName !== 'README.md')
    .sort()

  for (const fileName of changesetFiles) {
    const source = fs.readFileSync(path.join(changesetRoot, fileName), 'utf8')
    assert.equal(
      source.startsWith('---\n') || source.startsWith('---\r\n'),
      true,
      `${fileName} must start with a YAML frontmatter delimiter`,
    )
  }
})

test('scaffold templates tarball keeps the root assets and new contract docs', () => {
  const packJson = execFileSync('npm', ['pack', '--dry-run', '--json'], {
    cwd: path.join(repoRoot, 'packages/scaffold-templates'),
    encoding: 'utf8',
  })
  const [packResult] = JSON.parse(packJson) as Array<{
    files: Array<{ path: string }>
  }>

  assert.ok(packResult)
  assert.equal(
    packResult.files.some((file) => file.path === 'root/pnpm.gitignore'),
    true,
  )
  assert.equal(
    packResult.files.some((file) => file.path === 'root/yarn.gitignore'),
    true,
  )
  assert.equal(
    packResult.files.some((file) => file.path === 'root/npm.gitignore'),
    true,
  )
  assert.equal(
    packResult.files.some((file) => file.path === 'root/bun.gitignore'),
    true,
  )
  assert.equal(
    packResult.files.some((file) => file.path === 'root/yarnrc.yml'),
    true,
  )
  assert.equal(
    packResult.files.some((file) => file.path === 'root/verify-frontend-routes.mjs'),
    false,
  )
  assert.equal(
    packResult.files.some((file) => file.path === 'root/tsconfig.base.json'),
    false,
  )
  assert.equal(
    packResult.files.some((file) => file.path === 'base/.github/copilot-instructions.md'),
    true,
  )
  assert.equal(
    packResult.files.some((file) => file.path === 'base/CLAUDE.md'),
    true,
  )
  assert.equal(
    packResult.files.some((file) => file.path === 'base/AGENTS.md'),
    false,
  )
  assert.equal(
    packResult.files.some((file) => file.path === 'base/docs/index.md'),
    false,
  )
  assert.equal(
    packResult.files.some((file) => file.path === 'base/docs/engineering/frontend-policy.md'),
    false,
  )
  assert.equal(
    packResult.files.some((file) => file.path === 'base/docs/engineering/workspace-topology.md'),
    false,
  )
  assert.equal(
    packResult.files.some(
      (file) => file.path === 'base/docs/engineering/appsintoss-granite-api-index.md',
    ),
    false,
  )
})
