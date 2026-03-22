import assert from 'node:assert/strict'
import test from 'node:test'
import { parse } from 'jsonc-parser'
import { patchRootPackageJsonSource } from './package-json.js'
import { patchPackageJsonSource } from './package-json.js'

test('patchRootPackageJsonSource preserves comments and ordered top-level keys', () => {
  const source = [
    '{',
    '  // workspace root',
    '  "name": "demo",',
    '  "private": true,',
    '  "scripts": {',
    '    "build": "pnpm build"',
    '  }',
    '}',
    '',
  ].join('\n')

  const next = patchRootPackageJsonSource(source, {
    packageManagerField: 'pnpm@10.32.1',
    scripts: {
      build: 'pnpm build',
      verify: 'pnpm verify',
    },
    workspaces: ['packages/*'],
  })

  assert.match(next, /\/\/ workspace root/)
  assert.match(next, /"packageManager": "pnpm@10\.32\.1"/)
  assert.match(next, /"workspaces": \[/)
  assert.match(next, /"verify": "pnpm verify"/)

  const packageManagerIndex = next.indexOf('"packageManager"')
  const workspacesIndex = next.indexOf('"workspaces"')
  const scriptsIndex = next.indexOf('"scripts"')

  assert.notEqual(packageManagerIndex, -1)
  assert.notEqual(workspacesIndex, -1)
  assert.notEqual(scriptsIndex, -1)
  assert.equal(packageManagerIndex < workspacesIndex, true)
  assert.equal(workspacesIndex < scriptsIndex, true)
})

test('patchPackageJsonSource skips removals for sections that do not exist yet', () => {
  const source = ['{', '  "name": "server"', '}', ''].join('\n')

  const next = patchPackageJsonSource(source, {
    removeFromSections: {
      dependencies: ['eslint'],
      devDependencies: ['typescript'],
    },
    upsertSections: {
      scripts: {
        dev: 'wrangler dev',
      },
    },
  })

  const parsed = parse(next) as {
    scripts?: Record<string, string>
    dependencies?: Record<string, string>
    devDependencies?: Record<string, string>
  }

  assert.deepEqual(parsed.scripts, {
    dev: 'wrangler dev',
  })
  assert.equal(parsed.dependencies, undefined)
  assert.equal(parsed.devDependencies, undefined)
})
