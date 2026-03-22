import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { CommandExecutionError } from '../../commands.js'
import { extractJsonPayload } from '../../cli-structured-output.js'
import {
  buildCreateSupabaseProjectArgs,
  finalizeSupabaseProvisioning,
  isSupabaseAccessTokenRequiredError,
  formatSupabaseManualSetupNote,
  pollForNewSupabaseProject,
  promptSupabaseAccessToken,
  resolveSupabaseClientApiKey,
  shouldAutoApplySupabaseRemoteDatabase,
  shouldAutoDeploySupabaseEdgeFunctions,
  withSupabaseAccessTokenRequirement,
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
})

test('extractJsonPayload rejects mixed stdout instead of scraping a nested JSON block', () => {
  assert.throws(
    () =>
      extractJsonPayload<{ project: string[] }>({
        stdout: [
          'You are now logged in. Happy coding!',
          '➤ YN0000: Downloading supabase',
          '{"project":["one","two"]}',
        ].join('\n'),
        stderr: '',
      }),
    /JSON 결과를 해석하지 못했습니다/,
  )
})

test('extractJsonPayload strips OSC hyperlink control sequences around JSON output', () => {
  const payload = extractJsonPayload<{ project: string[] }>({
    stdout: '{"project":["one","two"]}\u001b]8;;https://example.com\u0007link\u001b]8;;\u0007',
    stderr: 'pnpm warning',
  })

  assert.deepEqual(payload, {
    project: ['one', 'two'],
  })
})

test('extractJsonPayload reads structured output from stdout only and ignores stderr noise', () => {
  const payload = extractJsonPayload<{ project: string[] }>({
    stdout: '{"project":["one","two"]}',
    stderr: '{"project":["wrong"]}',
  })

  assert.deepEqual(payload, {
    project: ['one', 'two'],
  })
})

test('extractJsonPayload accepts trailing JSON after Yarn dlx stdout prelude', () => {
  const payload = extractJsonPayload<Array<{ id: string; name: string }>>({
    stdout: [
      '➤ YN0000: · Yarn 4.12.0',
      '➤ YN0000: ┌ Resolution step',
      '➤ YN0085: │ + supabase@npm:2.83.0, @isaacs/fs-minipass@npm:4.0.1, and 22 more.',
      '➤ YN0000: └ Completed in 0s 325ms',
      '➤ YN0000: · Done with warnings in 6s 343ms',
      '',
      '[{"id":"project-ref","name":"ebook"}]',
    ].join('\n'),
    stderr: 'Cannot find project ref. Have you run supabase link?',
  })

  assert.deepEqual(payload, [
    {
      id: 'project-ref',
      name: 'ebook',
    },
  ])
})

test('buildCreateSupabaseProjectArgs appends only the project name positional arg', () => {
  assert.deepEqual(buildCreateSupabaseProjectArgs('test-project'), [
    'projects',
    'create',
    'test-project',
  ])
})

test('isSupabaseAccessTokenRequiredError detects token-first auth failures', () => {
  assert.equal(
    isSupabaseAccessTokenRequiredError(
      'Access token not provided. Supply an access token by running supabase login or setting the SUPABASE_ACCESS_TOKEN environment variable.',
    ),
    true,
  )
  assert.equal(
    isSupabaseAccessTokenRequiredError(
      'Cannot use automatic login flow inside non-TTY environments. Please provide --token flag or set the SUPABASE_ACCESS_TOKEN environment variable.',
    ),
    true,
  )
  assert.equal(
    isSupabaseAccessTokenRequiredError('Supabase API key 조회 중에 실패했어요. network timeout'),
    false,
  )
})

test('promptSupabaseAccessToken shows Korean guide and trims the entered token', async () => {
  const messages: string[] = []
  const token = await promptSupabaseAccessToken({
    async text() {
      throw new Error('password prompt를 써야 해요.')
    },
    async select() {
      throw new Error('select는 호출되면 안 돼요.')
    },
    async password(options) {
      messages.push(options.message)
      messages.push(options.guide ?? '')
      return '  sb_secret_token  '
    },
  })

  assert.equal(token, 'sb_secret_token')
  assert.equal(messages[0], 'Supabase access token을 붙여 넣어 주세요')
  assert.match(messages[1] ?? '', /아래 URL에서 token을 발급한 뒤 그대로 붙여 넣으면 돼요\./)
  assert.match(messages[1] ?? '', /https:\/\/supabase\.com\/dashboard\/account\/tokens/)
})

test('withSupabaseAccessTokenRequirement prompts for a token, retries once, and returns it', async () => {
  let attempts = 0
  const prompts: string[] = []
  const logins: string[] = []

  const result = await withSupabaseAccessTokenRequirement({
    packageManager: 'yarn',
    cwd: '/tmp/ebook-miniapp',
    prompt: {
      async text() {
        throw new Error('password prompt를 써야 해요.')
      },
      async select() {
        throw new Error('select는 호출되면 안 돼요.')
      },
      async password(options) {
        prompts.push(options.message)
        prompts.push(options.guide ?? '')
        return 'sb_secret_token'
      },
    },
    loginWithAccessToken: async ({ accessToken, cwd, packageManager }) => {
      logins.push(`${packageManager}:${cwd}:${accessToken}`)
    },
    action: async () => {
      attempts += 1

      if (attempts === 1) {
        throw new CommandExecutionError({
          label: 'Supabase 프로젝트 목록 조회',
          command: 'yarn',
          args: ['dlx', 'supabase@2.83.0', 'projects', 'list', '--output', 'json'],
          stdout: '',
          stderr:
            'Access token not provided. Supply an access token by running supabase login or setting the SUPABASE_ACCESS_TOKEN environment variable.',
          exitCode: 1,
        })
      }

      return 'ok'
    },
  })

  assert.equal(result.result, 'ok')
  assert.equal(result.accessToken, 'sb_secret_token')
  assert.equal(attempts, 2)
  assert.equal(prompts[0], 'Supabase access token을 붙여 넣어 주세요')
  assert.match(prompts[1] ?? '', /dashboard\/account\/tokens/)
  assert.deepEqual(logins, ['yarn:/tmp/ebook-miniapp:sb_secret_token'])
})

test('withSupabaseAccessTokenRequirement preserves unrelated failures', async () => {
  const expectedError = new Error('network timeout')

  await assert.rejects(
    withSupabaseAccessTokenRequirement({
      packageManager: 'pnpm',
      cwd: '/tmp/ebook-miniapp',
      prompt: {
        async text() {
          throw new Error('text는 호출되면 안 돼요.')
        },
        async select() {
          throw new Error('select는 호출되면 안 돼요.')
        },
      },
      action: async () => {
        throw expectedError
      },
    }),
    (error) => {
      assert.equal(error, expectedError)
      return true
    },
  )
})

test('shouldAutoApplySupabaseRemoteDatabase only enables remote db push for new projects', () => {
  assert.equal(shouldAutoApplySupabaseRemoteDatabase('create'), true)
  assert.equal(shouldAutoApplySupabaseRemoteDatabase('existing'), false)
  assert.equal(shouldAutoApplySupabaseRemoteDatabase('existing', true), true)
  assert.equal(shouldAutoApplySupabaseRemoteDatabase('existing', false), false)
})

test('shouldAutoDeploySupabaseEdgeFunctions only enables auto deploy for new projects', () => {
  assert.equal(shouldAutoDeploySupabaseEdgeFunctions('create'), true)
  assert.equal(shouldAutoDeploySupabaseEdgeFunctions('existing'), false)
  assert.equal(shouldAutoDeploySupabaseEdgeFunctions('existing', true), true)
  assert.equal(shouldAutoDeploySupabaseEdgeFunctions('existing', false), false)
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

test('writeSupabaseServerLocalEnvFile writes the prompted access token when the env is blank', async () => {
  const targetRoot = await mkdtemp(
    path.join(os.tmpdir(), 'create-rn-miniapp-supabase-server-access-token-'),
  )

  try {
    await writeSupabaseServerLocalEnvFile({
      targetRoot,
      projectRef: 'abc123',
      accessToken: 'sb_secret_token',
    })

    const serverEnv = await readFile(path.join(targetRoot, 'server', '.env.local'), 'utf8')

    assert.match(serverEnv, /^SUPABASE_PROJECT_REF=abc123$/m)
    assert.match(serverEnv, /^SUPABASE_ACCESS_TOKEN=sb_secret_token$/m)
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
        accessToken: null,
        didApplyRemoteDb: false,
        didDeployEdgeFunctions: false,
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
    assert.match(
      notes[0]?.body ?? '',
      /기존 Supabase 프로젝트를 골라서 원격 DB 반영은 자동으로 건너뛰었어요\./,
    )
    assert.match(notes[0]?.body ?? '', /server\/package\.json 의 `db:apply`/)
    assert.match(
      notes[0]?.body ?? '',
      /기존 Supabase 프로젝트를 골라서 기본 Edge Function 배포도 자동으로 건너뛰었어요\./,
    )
    assert.match(notes[0]?.body ?? '', /server\/package\.json 의 `functions:deploy`/)
  } finally {
    await rm(targetRoot, { recursive: true, force: true })
  }
})

test('finalizeSupabaseProvisioning writes the prompted access token to server env', async () => {
  const targetRoot = await mkdtemp(
    path.join(os.tmpdir(), 'create-rn-miniapp-supabase-finalize-access-token-'),
  )

  try {
    const notes = await finalizeSupabaseProvisioning({
      targetRoot,
      provisionedProject: {
        projectRef: 'abc123',
        publishableKey: 'sb_publishable_123',
        dbPassword: null,
        accessToken: 'sb_secret_token',
        didApplyRemoteDb: false,
        didDeployEdgeFunctions: false,
        mode: 'existing',
      },
    })

    const serverEnv = await readFile(path.join(targetRoot, 'server', '.env.local'), 'utf8')

    assert.match(serverEnv, /^SUPABASE_ACCESS_TOKEN=sb_secret_token$/m)
    assert.doesNotMatch(notes[0]?.body ?? '', /SUPABASE_ACCESS_TOKEN`은 비어 있어요/)
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
        accessToken: null,
        didApplyRemoteDb: false,
        didDeployEdgeFunctions: false,
        mode: 'existing',
      },
    })

    const serverEnv = await readFile(path.join(targetRoot, 'server', '.env.local'), 'utf8')

    assert.match(serverEnv, /^SUPABASE_PROJECT_REF=abc123$/m)
    assert.match(serverEnv, /^SUPABASE_DB_PASSWORD=secret-password$/m)
    assert.doesNotMatch(notes[0]?.body ?? '', /SUPABASE_DB_PASSWORD 는 비어 있어요/)
    assert.match(
      notes[0]?.body ?? '',
      /기존 Supabase 프로젝트를 골라서 원격 DB 반영은 자동으로 건너뛰었어요\./,
    )
    assert.match(
      notes[0]?.body ?? '',
      /기존 Supabase 프로젝트를 골라서 기본 Edge Function 배포도 자동으로 건너뛰었어요\./,
    )
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
        accessToken: null,
        didApplyRemoteDb: false,
        didDeployEdgeFunctions: false,
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
    assert.match(
      notes[0]?.body ?? '',
      /기존 Supabase 프로젝트를 골라서 원격 DB 반영은 자동으로 건너뛰었어요\./,
    )
    assert.match(notes[0]?.body ?? '', /server\/package\.json 의 `db:apply`/)
    assert.match(
      notes[0]?.body ?? '',
      /기존 Supabase 프로젝트를 골라서 기본 Edge Function 배포도 자동으로 건너뛰었어요\./,
    )
    assert.match(notes[0]?.body ?? '', /server\/package\.json 의 `functions:deploy`/)
    assert.match(serverEnv, /^SUPABASE_PROJECT_REF=abc123$/m)
  } finally {
    await rm(targetRoot, { recursive: true, force: true })
  }
})
