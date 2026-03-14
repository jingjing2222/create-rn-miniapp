import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { buildCommandPlan } from './commands.js'

test('buildCommandPlan keeps AppInToss frontend steps first', () => {
  const targetRoot = path.join('/tmp', 'ebook')
  const plan = buildCommandPlan({
    appName: 'ebook',
    targetRoot,
    withServer: true,
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
    withServer: false,
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
