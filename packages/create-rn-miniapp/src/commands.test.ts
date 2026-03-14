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
      'frontend granite scaffold',
      'frontend install',
      'frontend install appintoss framework',
      'frontend ait init',
      'frontend install tds',
      'server supabase init',
      'backoffice vite scaffold',
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
