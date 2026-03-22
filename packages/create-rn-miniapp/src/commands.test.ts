import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { buildAddCommandPlan, buildCommandPlan, runCommandWithOutput } from './commands.js'

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
      'frontend Granite 만들기',
      'frontend 의존성 설치하기',
      'frontend AppInToss Framework 설치하기',
      'frontend ait 초기화하기',
      'frontend TDS 설치하기',
      'server Supabase 준비하기',
      'server Supabase Edge Function 만들기',
      'backoffice Vite 만들기',
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
      'frontend Granite 만들기',
      'frontend 의존성 설치하기',
      'frontend AppInToss Framework 설치하기',
      'frontend ait 초기화하기',
      'frontend TDS 설치하기',
      'backoffice Vite 만들기',
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
    'supabase',
    'functions',
    'new',
    'api',
    '--workdir',
    '.',
    '--yes',
  ])
  assert.deepEqual(plan[7]?.args, [
    'dlx',
    'create-vite',
    'backoffice',
    '--template',
    'react-ts',
    '--no-interactive',
  ])
})

test('buildCommandPlan emits plain npm install commands when workspace npmrc handles peer resolution', () => {
  const targetRoot = path.join('/tmp', 'ebook')
  const plan = buildCommandPlan({
    appName: 'ebook',
    targetRoot,
    packageManager: 'npm',
    serverProvider: null,
    withBackoffice: false,
  })

  assert.equal(plan[0]?.command, 'npx')
  assert.deepEqual(plan[1]?.args, ['install'])
  assert.deepEqual(plan[2]?.args, ['install', '@apps-in-toss/framework'])
  assert.deepEqual(plan[4]?.args, ['install', '@toss/tds-react-native@2.0.2'])
})

test('buildCommandPlan emits Cloudflare C3 commands when cloudflare is selected', () => {
  const targetRoot = path.join('/tmp', 'ebook')
  const plan = buildCommandPlan({
    appName: 'ebook',
    targetRoot,
    packageManager: 'pnpm',
    serverProvider: 'cloudflare',
    withBackoffice: false,
  })

  assert.deepEqual(
    plan.map((step) => step.label),
    [
      'frontend Granite 만들기',
      'frontend 의존성 설치하기',
      'frontend AppInToss Framework 설치하기',
      'frontend ait 초기화하기',
      'frontend TDS 설치하기',
      'server Cloudflare Workers 준비하기',
    ],
  )
  assert.deepEqual(plan[5]?.args, [
    'create',
    'cloudflare@latest',
    'server',
    '--type',
    'hello-world',
    '--lang',
    'ts',
    '--no-deploy',
    '--no-git',
    '--accept-defaults',
  ])
})

test('buildCommandPlan keeps firebase server preparation out of external command phases', () => {
  const targetRoot = path.join('/tmp', 'ebook')
  const plan = buildCommandPlan({
    appName: 'ebook',
    targetRoot,
    packageManager: 'pnpm',
    serverProvider: 'firebase',
    withBackoffice: false,
  })

  assert.deepEqual(
    plan.map((step) => step.label),
    [
      'frontend Granite 만들기',
      'frontend 의존성 설치하기',
      'frontend AppInToss Framework 설치하기',
      'frontend ait 초기화하기',
      'frontend TDS 설치하기',
    ],
  )
})

test('buildAddCommandPlan only includes requested missing workspaces', () => {
  const targetRoot = path.join('/tmp', 'ebook')
  const plan = buildAddCommandPlan({
    targetRoot,
    packageManager: 'pnpm',
    serverProvider: 'supabase',
    withBackoffice: true,
  })

  assert.deepEqual(
    plan.map((step) => step.label),
    ['server Supabase 준비하기', 'server Supabase Edge Function 만들기', 'backoffice Vite 만들기'],
  )
  assert.deepEqual(plan[0]?.args, ['dlx', 'supabase', 'init'])
  assert.deepEqual(plan[1]?.args, [
    'dlx',
    'supabase',
    'functions',
    'new',
    'api',
    '--workdir',
    '.',
    '--yes',
  ])
  assert.deepEqual(plan[2]?.args, [
    'dlx',
    'create-vite',
    'backoffice',
    '--template',
    'react-ts',
    '--no-interactive',
  ])
})

test('buildAddCommandPlan emits cloudflare add step when requested', () => {
  const targetRoot = path.join('/tmp', 'ebook')
  const plan = buildAddCommandPlan({
    targetRoot,
    packageManager: 'yarn',
    serverProvider: 'cloudflare',
    withBackoffice: false,
  })

  assert.deepEqual(
    plan.map((step) => step.label),
    ['server Cloudflare Workers 준비하기'],
  )
  assert.deepEqual(plan[0]?.args, [
    'create',
    'cloudflare@latest',
    'server',
    '--type',
    'hello-world',
    '--lang',
    'ts',
    '--no-deploy',
    '--no-git',
    '--accept-defaults',
  ])
})

test('buildCommandPlan emits npm and bun scaffold commands for supported managers', () => {
  const targetRoot = path.join('/tmp', 'ebook')
  const npmPlan = buildCommandPlan({
    appName: 'ebook',
    targetRoot,
    packageManager: 'npm',
    serverProvider: 'supabase',
    withBackoffice: true,
  })
  const bunPlan = buildCommandPlan({
    appName: 'ebook',
    targetRoot,
    packageManager: 'bun',
    serverProvider: 'cloudflare',
    withBackoffice: false,
  })

  assert.equal(npmPlan[0]?.command, 'npx')
  assert.deepEqual(npmPlan[0]?.args, ['create-granite-app', 'frontend', '--tools', 'biome'])
  assert.deepEqual(npmPlan[1]?.args, ['install'])
  assert.deepEqual(npmPlan[2]?.args, ['install', '@apps-in-toss/framework'])
  assert.deepEqual(npmPlan[5]?.args, ['supabase', 'init'])
  assert.deepEqual(npmPlan[7]?.args, [
    'create-vite',
    'backoffice',
    '--template',
    'react-ts',
    '--no-interactive',
  ])

  assert.equal(bunPlan[0]?.command, 'bunx')
  assert.deepEqual(bunPlan[0]?.args, ['create-granite-app', 'frontend', '--tools', 'biome'])
  assert.deepEqual(bunPlan[5]?.args, [
    'create-cloudflare@latest',
    'server',
    '--type',
    'hello-world',
    '--lang',
    'ts',
    '--no-deploy',
    '--no-git',
    '--accept-defaults',
  ])
})

test('runCommandWithOutput includes stdout and stderr in failure messages', async () => {
  await assert.rejects(
    runCommandWithOutput({
      cwd: '/tmp',
      command: 'node',
      args: ['-e', "console.log('stdout marker'); console.error('stderr marker'); process.exit(1)"],
      label: '실패 테스트',
    }),
    (error: unknown) => {
      assert.ok(error instanceof Error)
      assert.match(error.message, /stdout marker/)
      assert.match(error.message, /stderr marker/)
      return true
    },
  )
})

test('runCommandWithOutput wraps missing executable errors with the command label', async () => {
  await assert.rejects(
    runCommandWithOutput({
      cwd: '/tmp',
      command: '__definitely_missing_create_rn_miniapp_command__',
      args: [],
      label: '실패 테스트',
    }),
    (error: unknown) => {
      assert.ok(error instanceof Error)
      assert.match(error.message, /실패 테스트 중에 실패했어요/)
      assert.match(error.message, /__definitely_missing_create_rn_miniapp_command__/)
      return true
    },
  )
})
