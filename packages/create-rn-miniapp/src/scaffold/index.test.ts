import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import {
  buildCreateExecutionOrder,
  buildCreateLifecycleOrder,
  buildRootFinalizePlan,
} from './index.js'

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
    'server Supabase Edge Function 생성',
    'backoffice Vite 생성',
  ])
})

test('buildCreateLifecycleOrder applies root templates and server patch before firebase provisioning', () => {
  const labels = buildCreateLifecycleOrder({
    appName: 'ebook',
    targetRoot: path.join('/tmp', 'ebook'),
    packageManager: 'yarn',
    serverProvider: 'firebase',
    withBackoffice: true,
  })

  assert.deepEqual(labels, [
    'frontend Granite 생성',
    'frontend 의존성 설치',
    'frontend AppInToss Framework 설치',
    'frontend ait 초기화',
    'frontend TDS 설치',
    'server 워크스페이스 준비',
    '루트 템플릿 적용',
    'server 워크스페이스 patch',
    'server provisioning',
    'backoffice Vite 생성',
    '루트 workspace manifest 동기화',
    '루트 git init',
  ])
})

test('buildCreateLifecycleOrder omits root git init when no-git is enabled', () => {
  const labels = buildCreateLifecycleOrder({
    appName: 'ebook',
    targetRoot: path.join('/tmp', 'ebook'),
    packageManager: 'pnpm',
    noGit: true,
    serverProvider: null,
    withBackoffice: false,
  })

  assert.doesNotMatch(labels.join('\n'), /루트 git init/)
})
