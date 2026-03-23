import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { resolveCreateRootWorkspaces, resolveRootWorkspaces } from './helpers.js'

async function createTempTargetRoot(t: test.TestContext) {
  const targetRoot = await mkdtemp(path.join(os.tmpdir(), 'create-rn-miniapp-scaffold-helpers-'))
  t.after(async () => {
    await rm(targetRoot, { recursive: true, force: true })
  })
  return targetRoot
}

test('resolveRootWorkspaces preserves declared pnpm manifest order and appends newly discovered workspaces', async (t) => {
  const targetRoot = await createTempTargetRoot(t)

  await writeFile(
    path.join(targetRoot, 'pnpm-workspace.yaml'),
    ['packages:', '  - frontend', '  - marketing', '  - packages/*', ''].join('\n'),
    'utf8',
  )
  await mkdir(path.join(targetRoot, 'server'), { recursive: true })
  await writeFile(
    path.join(targetRoot, 'server', 'package.json'),
    '{\n  "name": "server"\n}\n',
    'utf8',
  )
  await mkdir(path.join(targetRoot, 'packages', 'contracts'), { recursive: true })
  await writeFile(
    path.join(targetRoot, 'packages', 'contracts', 'package.json'),
    '{\n  "name": "@workspace/contracts"\n}\n',
    'utf8',
  )

  assert.deepEqual(await resolveRootWorkspaces(targetRoot), [
    'frontend',
    'marketing',
    'packages/*',
    'server',
  ])
})

test('resolveRootWorkspaces reads package.json workspaces when a pnpm manifest is absent', async (t) => {
  const targetRoot = await createTempTargetRoot(t)

  await writeFile(
    path.join(targetRoot, 'package.json'),
    JSON.stringify(
      {
        private: true,
        workspaces: {
          packages: ['frontend', 'apps/marketing', 'packages/*'],
        },
      },
      null,
      2,
    ),
    'utf8',
  )
  await mkdir(path.join(targetRoot, 'backoffice'), { recursive: true })
  await writeFile(
    path.join(targetRoot, 'backoffice', 'package.json'),
    '{\n  "name": "backoffice"\n}\n',
    'utf8',
  )

  assert.deepEqual(await resolveRootWorkspaces(targetRoot), [
    'frontend',
    'apps/marketing',
    'packages/*',
    'backoffice',
  ])
})

test('resolveCreateRootWorkspaces derives the initial root manifest from create options', () => {
  assert.deepEqual(
    resolveCreateRootWorkspaces({
      serverProvider: 'cloudflare',
      withBackoffice: true,
      withTrpc: true,
    }),
    ['frontend', 'server', 'packages/*', 'backoffice'],
  )

  assert.deepEqual(
    resolveCreateRootWorkspaces({
      serverProvider: 'firebase',
      withBackoffice: false,
      withTrpc: true,
    }),
    ['frontend', 'server'],
  )

  assert.deepEqual(
    resolveCreateRootWorkspaces({
      serverProvider: null,
      withBackoffice: true,
      withTrpc: false,
    }),
    ['frontend', 'backoffice'],
  )
})
