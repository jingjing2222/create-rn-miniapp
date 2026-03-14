import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const repoRoot = path.resolve(import.meta.dirname, '../../..')

test('version-packages formats workspace after changeset bump', () => {
  const packageJsonPath = path.join(repoRoot, 'package.json')
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) as {
    scripts?: Record<string, string>
  }

  assert.equal(packageJson.scripts?.['version-packages'], 'changeset version && pnpm format')
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

test('scaffold templates tarball keeps the root gitignore template', () => {
  const packJson = execFileSync('npm', ['pack', '--dry-run', '--json'], {
    cwd: path.join(repoRoot, 'packages/scaffold-templates'),
    encoding: 'utf8',
  })
  const [packResult] = JSON.parse(packJson) as Array<{
    files: Array<{ path: string }>
  }>

  assert.ok(packResult)
  assert.equal(
    packResult.files.some((file) => file.path === 'root/gitignore'),
    true,
  )
})
