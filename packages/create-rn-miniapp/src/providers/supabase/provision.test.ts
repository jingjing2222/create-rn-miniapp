import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import {
  buildCreateSupabaseProjectArgs,
  extractJsonPayload,
  finalizeSupabaseProvisioning,
  formatSupabaseManualSetupNote,
  pollForNewSupabaseProject,
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
  assert.match(
    note.body,
    /server\/\.env\.local 의 `SUPABASE_ACCESS_TOKEN`과 `SUPABASE_DB_PASSWORD`는 비어 있어요\./,
  )
  assert.match(note.body, /dashboard\/account\/tokens/)
  assert.match(note.body, /dashboard\/project\/abc123\/database\/settings/)
  assert.doesNotMatch(note.body, /functions:deploy/)
  assert.doesNotMatch(note.body, /db:apply/)
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

test('buildCreateSupabaseProjectArgs appends only the project name positional arg', () => {
  assert.deepEqual(buildCreateSupabaseProjectArgs('test-project'), [
    'projects',
    'create',
    'test-project',
  ])
})

test('pollForNewSupabaseProject waits 1, 2, 4, 5 seconds and stops when a new project appears', async () => {
  const delays: number[] = []
  const listedRefGroups: string[][] = []
  let attempt = 0

  const project = await pollForNewSupabaseProject(['existing-ref'], {
    delaysMs: [1000, 2000, 4000, 5000],
    sleep: async (delayMs) => {
      delays.push(delayMs)
    },
    listProjects: async () => {
      attempt += 1

      if (attempt < 3) {
        const projects = [
          {
            id: 'existing-ref',
            name: 'existing',
          },
        ]

        listedRefGroups.push(projects.map((candidate) => candidate.id))
        return projects
      }

      const projects = [
        {
          id: 'existing-ref',
          name: 'existing',
        },
        {
          id: 'created-ref',
          name: 'created',
        },
      ]

      listedRefGroups.push(projects.map((candidate) => candidate.id))
      return projects
    },
  })

  assert.deepEqual(delays, [1000, 2000, 4000])
  assert.deepEqual(listedRefGroups, [
    ['existing-ref'],
    ['existing-ref'],
    ['existing-ref', 'created-ref'],
  ])
  assert.equal(project?.id, 'created-ref')
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
      dbPassword: 'generated-password',
    })

    const initialServerEnv = await readFile(path.join(targetRoot, 'server', '.env.local'), 'utf8')

    assert.equal(
      initialServerEnv,
      [
        '# Used by server/package.json db:apply and functions:deploy for remote Supabase operations.',
        'SUPABASE_PROJECT_REF=abc123',
        'SUPABASE_DB_PASSWORD=generated-password',
        'SUPABASE_ACCESS_TOKEN=',
        '',
      ].join('\n'),
    )

    await writeFile(
      path.join(targetRoot, 'server', '.env.local'),
      [
        '# Used by server/package.json db:apply and functions:deploy for remote Supabase operations.',
        'SUPABASE_PROJECT_REF=old-project',
        'SUPABASE_DB_PASSWORD=secret-password',
        'SUPABASE_ACCESS_TOKEN=supabase-access-token',
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
    assert.match(updatedServerEnv, /^SUPABASE_ACCESS_TOKEN=supabase-access-token$/m)
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
        dbPassword: null,
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
    assert.match(serverEnv, /^SUPABASE_ACCESS_TOKEN=$/m)
    assert.equal(notes[0]?.title, 'Supabase 연결 값을 적어뒀어요')
    assert.match(notes[0]?.body ?? '', /server\/\.env\.local/)
    assert.match(
      notes[0]?.body ?? '',
      /server\/\.env\.local 의 `SUPABASE_ACCESS_TOKEN`과 `SUPABASE_DB_PASSWORD`는 비어 있어요\./,
    )
    assert.match(notes[0]?.body ?? '', /dashboard\/account\/tokens/)
    assert.match(notes[0]?.body ?? '', /dashboard\/project\/abc123\/database\/settings/)
    assert.doesNotMatch(notes[0]?.body ?? '', /functions:deploy/)
    assert.doesNotMatch(notes[0]?.body ?? '', /db:apply/)
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
        'SUPABASE_ACCESS_TOKEN=supabase-access-token',
        '',
      ].join('\n'),
      'utf8',
    )

    const notes = await finalizeSupabaseProvisioning({
      targetRoot,
      provisionedProject: {
        projectRef: 'abc123',
        publishableKey: 'sb_publishable_123',
        dbPassword: null,
        mode: 'existing',
      },
    })

    const serverEnv = await readFile(path.join(targetRoot, 'server', '.env.local'), 'utf8')

    assert.match(serverEnv, /^SUPABASE_PROJECT_REF=abc123$/m)
    assert.match(serverEnv, /^SUPABASE_DB_PASSWORD=secret-password$/m)
    assert.doesNotMatch(notes[0]?.body ?? '', /SUPABASE_DB_PASSWORD 는 비어 있어요/)
    assert.match(notes[0]?.body ?? '', /SUPABASE_ACCESS_TOKEN`은 비어 있어요/)
    assert.match(notes[0]?.body ?? '', /dashboard\/account\/tokens/)
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
        dbPassword: null,
        mode: 'existing',
      },
    })

    const serverEnv = await readFile(path.join(targetRoot, 'server', '.env.local'), 'utf8')

    assert.equal(notes[0]?.title, 'Supabase 연결 값을 이렇게 넣어 주세요')
    assert.match(notes[0]?.body ?? '', /settings\/api/)
    assert.match(notes[0]?.body ?? '', /frontend\/\.env\.local/)
    assert.match(notes[0]?.body ?? '', /server\/\.env\.local/)
    assert.match(
      notes[0]?.body ?? '',
      /server\/\.env\.local 의 `SUPABASE_ACCESS_TOKEN`과 `SUPABASE_DB_PASSWORD`는 비어 있어요\./,
    )
    assert.match(notes[0]?.body ?? '', /dashboard\/account\/tokens/)
    assert.match(notes[0]?.body ?? '', /dashboard\/project\/abc123\/database\/settings/)
    assert.doesNotMatch(notes[0]?.body ?? '', /functions:deploy/)
    assert.doesNotMatch(notes[0]?.body ?? '', /db:apply/)
    assert.match(serverEnv, /^SUPABASE_PROJECT_REF=abc123$/m)
  } finally {
    await rm(targetRoot, { recursive: true, force: true })
  }
})
