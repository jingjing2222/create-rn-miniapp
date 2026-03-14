import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { buildCommandPlan } from './commands.js'

test('buildCommandPlan keeps AppInToss frontend steps first', () => {
  const targetRoot = path.join('/tmp', 'ebook')
  const plan = buildCommandPlan({
    appName: 'ebook',
    targetRoot,
    packageManager: 'pnpm',
    serverProvider: 'supabase',
    withBackoffice: true,
  })

  assert.deepEqual(
    plan.map((step) => step.label),
    [
      'frontend Granite 생성',
      'frontend 의존성 설치',
      'frontend AppInToss Framework 설치',
      'frontend ait 초기화',
      'frontend TDS 설치',
      'server Supabase 초기화',
      'backoffice Vite 생성',
    ],
  )
})

test('buildCommandPlan makes ait init non-interactive', () => {
  const targetRoot = path.join('/tmp', 'ebook')
  const plan = buildCommandPlan({
    appName: 'ebook',
    targetRoot,
    packageManager: 'pnpm',
    serverProvider: null,
    withBackoffice: false,
  })

  assert.deepEqual(plan[3]?.args, [
    'exec',
    'ait',
    'init',
    '--template',
    'react-native',
    '--app-name',
    'ebook',
    '--skip-input',
  ])
})

test('buildCommandPlan only adds server step when a provider is selected', () => {
  const targetRoot = path.join('/tmp', 'ebook')
  const plan = buildCommandPlan({
    appName: 'ebook',
    targetRoot,
    packageManager: 'pnpm',
    serverProvider: null,
    withBackoffice: true,
  })

  assert.deepEqual(
    plan.map((step) => step.label),
    [
      'frontend Granite 생성',
      'frontend 의존성 설치',
      'frontend AppInToss Framework 설치',
      'frontend ait 초기화',
      'frontend TDS 설치',
      'backoffice Vite 생성',
    ],
  )
})

test('buildCommandPlan emits yarn commands when yarn is selected', () => {
  const targetRoot = path.join('/tmp', 'ebook')
  const plan = buildCommandPlan({
    appName: 'ebook',
    targetRoot,
    packageManager: 'yarn',
    serverProvider: 'supabase',
    withBackoffice: true,
  })

  assert.equal(plan[0]?.command, 'yarn')
  assert.deepEqual(plan[0]?.args, ['dlx', 'create-granite-app', 'frontend', '--tools', 'biome'])
  assert.deepEqual(plan[1]?.args, ['install'])
  assert.deepEqual(plan[2]?.args, ['add', '@apps-in-toss/framework'])
  assert.deepEqual(plan[3]?.args, [
    'exec',
    'ait',
    'init',
    '--template',
    'react-native',
    '--app-name',
    'ebook',
    '--skip-input',
  ])
  assert.deepEqual(plan[5]?.args, ['dlx', 'supabase', 'init'])
  assert.deepEqual(plan[6]?.args, [
    'dlx',
    'create-vite',
    'backoffice',
    '--template',
    'react-ts',
    '--no-interactive',
  ])
})
