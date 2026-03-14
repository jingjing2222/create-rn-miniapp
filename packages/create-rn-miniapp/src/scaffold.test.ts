import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { buildCreateExecutionOrder, buildRootFinalizePlan } from './scaffold.js'

test('buildRootFinalizePlan keeps pnpm root finalize steps minimal', () => {
  const targetRoot = path.join('/tmp', 'ebook')
  const plan = buildRootFinalizePlan({
    targetRoot,
    packageManager: 'pnpm',
  })

  assert.deepEqual(
    plan.map((step) => step.label),
    ['루트 pnpm install', '루트 biome check --write --unsafe'],
  )
  assert.deepEqual(plan[0], {
    cwd: targetRoot,
    command: 'pnpm',
    args: ['install'],
    label: '루트 pnpm install',
  })
})

test('buildRootFinalizePlan adds yarn sdk generation after root install', () => {
  const targetRoot = path.join('/tmp', 'ebook')
  const plan = buildRootFinalizePlan({
    targetRoot,
    packageManager: 'yarn',
  })

  assert.deepEqual(
    plan.map((step) => step.label),
    ['루트 yarn install', '루트 yarn sdks 생성', '루트 biome check --write --unsafe'],
  )
  assert.deepEqual(plan[1], {
    cwd: targetRoot,
    command: 'yarn',
    args: ['dlx', '@yarnpkg/sdks', 'base'],
    label: '루트 yarn sdks 생성',
  })
})

test('buildCreateExecutionOrder runs server scaffold before backoffice scaffold', () => {
  const labels = buildCreateExecutionOrder({
    appName: 'ebook',
    targetRoot: path.join('/tmp', 'ebook'),
    packageManager: 'pnpm',
    serverProvider: 'supabase',
    withBackoffice: true,
  })

  assert.deepEqual(labels, [
    'frontend Granite 생성',
    'frontend 의존성 설치',
    'frontend AppInToss Framework 설치',
    'frontend ait 초기화',
    'frontend TDS 설치',
    'server Supabase 초기화',
    'backoffice Vite 생성',
  ])
})
