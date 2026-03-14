import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import {
  extractJsonPayload,
  formatSupabaseManualSetupNote,
  resolveSupabaseClientApiKey,
  writeSupabaseLocalEnvFiles,
} from './supabase-provision.js'

test('resolveSupabaseClientApiKey prefers publishable keys over anon keys', () => {
  const key = resolveSupabaseClientApiKey([
    {
      name: 'anon',
      api_key: 'anon-key',
    },
    {
      name: 'service_role',
      api_key: 'service-role-key',
    },
    {
      name: 'publishable',
      api_key: 'publishable-key',
    },
  ])

  assert.equal(key, 'publishable-key')
})

test('formatSupabaseManualSetupNote includes frontend and backoffice env guidance', () => {
  const note = formatSupabaseManualSetupNote({
    targetRoot: '/tmp/ebook-miniapp',
    hasBackoffice: true,
    projectRef: 'abc123',
    publishableKey: 'sb_publishable_123',
  })

  assert.equal(note.title, 'Supabase 환경 변수 안내')
  assert.match(note.body, /frontend\/\.env\.local/)
  assert.match(note.body, /backoffice\/\.env\.local/)
  assert.match(note.body, /MINIAPP_SUPABASE_URL=https:\/\/abc123\.supabase\.co/)
  assert.match(note.body, /VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_123/)
})

test('extractJsonPayload strips package-manager log lines around JSON output', () => {
  const payload = extractJsonPayload<{ project: string[] }>({
    stdout: [
      'You are now logged in. Happy coding!',
      '➤ YN0000: Downloading supabase',
      '{"project":["one","two"]}',
    ].join('\n'),
    stderr: '',
  })

  assert.deepEqual(payload, {
    project: ['one', 'two'],
  })
})

test('writeSupabaseLocalEnvFiles writes frontend and backoffice .env.local files', async () => {
  const targetRoot = await mkdtemp(path.join(os.tmpdir(), 'create-rn-miniapp-supabase-'))

  try {
    await writeSupabaseLocalEnvFiles({
      targetRoot,
      hasBackoffice: true,
      projectRef: 'abc123',
      publishableKey: 'sb_publishable_123',
    })

    const frontendEnv = await readFile(path.join(targetRoot, 'frontend', '.env.local'), 'utf8')
    const backofficeEnv = await readFile(path.join(targetRoot, 'backoffice', '.env.local'), 'utf8')

    assert.equal(
      frontendEnv,
      [
        'MINIAPP_SUPABASE_URL=https://abc123.supabase.co',
        'MINIAPP_SUPABASE_PUBLISHABLE_KEY=sb_publishable_123',
        '',
      ].join('\n'),
    )
    assert.equal(
      backofficeEnv,
      [
        'VITE_SUPABASE_URL=https://abc123.supabase.co',
        'VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_123',
        '',
      ].join('\n'),
    )
  } finally {
    await rm(targetRoot, { recursive: true, force: true })
  }
})
