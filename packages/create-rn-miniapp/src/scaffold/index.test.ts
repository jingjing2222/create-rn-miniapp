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
    ['루트 pnpm 설치하기', '루트 biome로 코드 정리하기'],
  )
  assert.deepEqual(plan[0], {
    cwd: targetRoot,
    command: 'pnpm',
    args: ['install'],
    label: '루트 pnpm 설치하기',
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
    ['루트 yarn 설치하기', '루트 yarn SDK 만들기', '루트 biome로 코드 정리하기'],
  )
  assert.deepEqual(plan[1], {
    cwd: targetRoot,
    command: 'yarn',
    args: ['dlx', '@yarnpkg/sdks', 'base'],
    label: '루트 yarn SDK 만들기',
  })
})

test('buildRootFinalizePlan keeps npm and bun finalize steps minimal', () => {
  const targetRoot = path.join('/tmp', 'ebook')
  const npmPlan = buildRootFinalizePlan({
    targetRoot,
    packageManager: 'npm',
  })
  const bunPlan = buildRootFinalizePlan({
    targetRoot,
    packageManager: 'bun',
  })

  assert.deepEqual(
    npmPlan.map((step) => step.label),
    ['루트 npm 설치하기', '루트 biome로 코드 정리하기'],
  )
  assert.deepEqual(npmPlan[0], {
    cwd: targetRoot,
    command: 'npm',
    args: ['install'],
    label: '루트 npm 설치하기',
  })
  assert.deepEqual(
    bunPlan.map((step) => step.label),
    ['루트 bun 설치하기', '루트 biome로 코드 정리하기'],
  )
  assert.deepEqual(bunPlan[0], {
    cwd: targetRoot,
    command: 'bun',
    args: ['install'],
    label: '루트 bun 설치하기',
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
    'frontend Granite 만들기',
    'frontend 의존성 설치하기',
    'frontend AppInToss Framework 설치하기',
    'frontend ait 초기화하기',
    'frontend TDS 설치하기',
    'server Supabase 준비하기',
    'server Supabase Edge Function 만들기',
    'backoffice Vite 만들기',
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
    'frontend Granite 만들기',
    'frontend 의존성 설치하기',
    'frontend AppInToss Framework 설치하기',
    'frontend ait 초기화하기',
    'frontend TDS 설치하기',
    'server 워크스페이스 준비하기',
    '루트 템플릿 적용하기',
    'server 워크스페이스 다듬기',
    'server provisioning 하기',
    'backoffice Vite 만들기',
    '루트 workspace manifest 맞추기',
    '루트 git 저장소 만들기',
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
