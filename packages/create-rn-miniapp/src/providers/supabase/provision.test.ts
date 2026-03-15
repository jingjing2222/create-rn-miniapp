import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import {
  extractJsonPayload,
  finalizeSupabaseProvisioning,
  formatSupabaseManualSetupNote,
  resolveSupabaseClientApiKey,
  writeSupabaseServerLocalEnvFile,
  writeSupabaseLocalEnvFiles,
} from './provision.js'

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
    hasDbPassword: false,
  })

  assert.equal(note.title, 'Supabase 연결 값을 이렇게 넣어 주세요')
  assert.match(note.body, /https:\/\/supabase\.com\/dashboard\/project\/abc123\/settings\/api/)
  assert.match(note.body, /frontend\/\.env\.local/)
  assert.match(note.body, /backoffice\/\.env\.local/)
  assert.match(note.body, /MINIAPP_SUPABASE_URL=https:\/\/abc123\.supabase\.co/)
  assert.match(
    note.body,
    /VITE_SUPABASE_PUBLISHABLE_KEY=<Supabase Settings > API에서 복사한 Publishable key>/,
  )
  assert.match(note.body, /SUPABASE_DB_PASSWORD 는 비어 있으니/)
  assert.match(note.body, /functions:deploy/)
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

test('writeSupabaseServerLocalEnvFile creates server env file and preserves an existing DB password', async () => {
  const targetRoot = await mkdtemp(path.join(os.tmpdir(), 'create-rn-miniapp-supabase-server-'))

  try {
    await writeSupabaseServerLocalEnvFile({
      targetRoot,
      projectRef: 'abc123',
    })

    const initialServerEnv = await readFile(path.join(targetRoot, 'server', '.env.local'), 'utf8')

    assert.equal(
      initialServerEnv,
      [
        '# Used by server/package.json db:apply and functions:deploy for remote Supabase operations.',
        'SUPABASE_PROJECT_REF=abc123',
        'SUPABASE_DB_PASSWORD=',
        '',
      ].join('\n'),
    )

    await writeFile(
      path.join(targetRoot, 'server', '.env.local'),
      [
        '# Used by server/package.json db:apply and functions:deploy for remote Supabase operations.',
        'SUPABASE_PROJECT_REF=old-project',
        'SUPABASE_DB_PASSWORD=secret-password',
        'EXTRA=value',
        '',
      ].join('\n'),
      'utf8',
    )

    await writeSupabaseServerLocalEnvFile({
      targetRoot,
      projectRef: 'next-project',
    })

    const updatedServerEnv = await readFile(path.join(targetRoot, 'server', '.env.local'), 'utf8')

    assert.match(updatedServerEnv, /^SUPABASE_PROJECT_REF=next-project$/m)
    assert.match(updatedServerEnv, /^SUPABASE_DB_PASSWORD=secret-password$/m)
    assert.match(updatedServerEnv, /^EXTRA=value$/m)
  } finally {
    await rm(targetRoot, { recursive: true, force: true })
  }
})

test('finalizeSupabaseProvisioning writes env files for existing projects when publishable key is available', async () => {
  const targetRoot = await mkdtemp(path.join(os.tmpdir(), 'create-rn-miniapp-supabase-finalize-'))

  try {
    const notes = await finalizeSupabaseProvisioning({
      targetRoot,
      provisionedProject: {
        projectRef: 'abc123',
        publishableKey: 'sb_publishable_123',
        mode: 'existing',
      },
    })

    const frontendEnv = await readFile(path.join(targetRoot, 'frontend', '.env.local'), 'utf8')
    const serverEnv = await readFile(path.join(targetRoot, 'server', '.env.local'), 'utf8')

    assert.equal(
      frontendEnv,
      [
        'MINIAPP_SUPABASE_URL=https://abc123.supabase.co',
        'MINIAPP_SUPABASE_PUBLISHABLE_KEY=sb_publishable_123',
        '',
      ].join('\n'),
    )
    assert.match(serverEnv, /^SUPABASE_PROJECT_REF=abc123$/m)
    assert.match(serverEnv, /^SUPABASE_DB_PASSWORD=$/m)
    assert.equal(notes[0]?.title, 'Supabase 연결 값을 적어뒀어요')
    assert.match(
      notes[0]?.body ?? '',
      /https:\/\/supabase\.com\/dashboard\/project\/abc123\/settings\/api/,
    )
    assert.match(notes[0]?.body ?? '', /server\/\.env\.local/)
    assert.match(notes[0]?.body ?? '', /SUPABASE_DB_PASSWORD 는 비어 있으니/)
    assert.match(notes[0]?.body ?? '', /db:apply/)
    assert.match(notes[0]?.body ?? '', /functions:deploy/)
  } finally {
    await rm(targetRoot, { recursive: true, force: true })
  }
})

test('finalizeSupabaseProvisioning skips password guidance when server db password already exists', async () => {
  const targetRoot = await mkdtemp(
    path.join(os.tmpdir(), 'create-rn-miniapp-supabase-finalize-existing-password-'),
  )

  try {
    await mkdir(path.join(targetRoot, 'server'), { recursive: true })

    await writeFile(
      path.join(targetRoot, 'server', '.env.local'),
      [
        '# Used by server/package.json db:apply and functions:deploy for remote Supabase operations.',
        'SUPABASE_PROJECT_REF=old-project',
        'SUPABASE_DB_PASSWORD=secret-password',
        '',
      ].join('\n'),
      'utf8',
    )

    const notes = await finalizeSupabaseProvisioning({
      targetRoot,
      provisionedProject: {
        projectRef: 'abc123',
        publishableKey: 'sb_publishable_123',
        mode: 'existing',
      },
    })

    const serverEnv = await readFile(path.join(targetRoot, 'server', '.env.local'), 'utf8')

    assert.match(serverEnv, /^SUPABASE_PROJECT_REF=abc123$/m)
    assert.match(serverEnv, /^SUPABASE_DB_PASSWORD=secret-password$/m)
    assert.doesNotMatch(notes[0]?.body ?? '', /SUPABASE_DB_PASSWORD 는 비어 있으니/)
  } finally {
    await rm(targetRoot, { recursive: true, force: true })
  }
})

test('finalizeSupabaseProvisioning falls back to manual setup guidance when publishable key is unavailable', async () => {
  const targetRoot = await mkdtemp(path.join(os.tmpdir(), 'create-rn-miniapp-supabase-manual-'))

  try {
    const notes = await finalizeSupabaseProvisioning({
      targetRoot,
      provisionedProject: {
        projectRef: 'abc123',
        publishableKey: null,
        mode: 'existing',
      },
    })

    const serverEnv = await readFile(path.join(targetRoot, 'server', '.env.local'), 'utf8')

    assert.equal(notes[0]?.title, 'Supabase 연결 값을 이렇게 넣어 주세요')
    assert.match(notes[0]?.body ?? '', /settings\/api/)
    assert.match(notes[0]?.body ?? '', /frontend\/\.env\.local/)
    assert.match(notes[0]?.body ?? '', /server\/\.env\.local/)
    assert.match(notes[0]?.body ?? '', /SUPABASE_DB_PASSWORD 는 비어 있으니/)
    assert.match(notes[0]?.body ?? '', /functions:deploy/)
    assert.match(serverEnv, /^SUPABASE_PROJECT_REF=abc123$/m)
  } finally {
    await rm(targetRoot, { recursive: true, force: true })
  }
})
