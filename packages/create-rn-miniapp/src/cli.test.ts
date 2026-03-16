import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import {
  type CliPrompter,
  createClackPrompter,
  detectInvocationPackageManager,
  formatCliHelp,
  parseCliArgs,
  resolveAddCliOptions,
  resolveCliOptions,
} from './cli.js'

test('parseCliArgs parses long-form CLI options with yargs', async () => {
  const argv = await parseCliArgs(
    [
      '--package-manager',
      'yarn',
      '--name',
      'ebook-miniapp',
      '--display-name',
      '전자책 미니앱',
      '--no-git',
      '--server-provider',
      'supabase',
      '--server-project-mode',
      'existing',
      '--with-backoffice',
      '--output-dir',
      '/tmp/create-miniapp',
      '--skip-install',
    ],
    '/workspace',
  )

  assert.equal(argv.packageManager, 'yarn')
  assert.equal(argv.name, 'ebook-miniapp')
  assert.equal(argv.displayName, '전자책 미니앱')
  assert.equal(argv.noGit, true)
  assert.equal(argv.serverProvider, 'supabase')
  assert.equal(argv.serverProjectMode, 'existing')
  assert.equal(argv.withBackoffice, true)
  assert.equal(argv.outputDir, '/tmp/create-miniapp')
  assert.equal(argv.skipInstall, true)
  assert.equal(argv.yes, false)
})

test('parseCliArgs accepts cloudflare as a server provider', async () => {
  const argv = await parseCliArgs(['--server-provider', 'cloudflare'], '/workspace')

  assert.equal(argv.serverProvider, 'cloudflare')
})

test('parseCliArgs accepts firebase as a server provider', async () => {
  const argv = await parseCliArgs(['--server-provider', 'firebase'], '/workspace')

  assert.equal(argv.serverProvider, 'firebase')
})

test('parseCliArgs parses trpc overlay flag', async () => {
  const argv = await parseCliArgs(['--server-provider', 'cloudflare', '--trpc'], '/workspace')

  assert.equal(argv.serverProvider, 'cloudflare')
  assert.equal(argv.trpc, true)
})

test('parseCliArgs rejects the removed with-server flag', async () => {
  await assert.rejects(
    () => parseCliArgs(['--with-server'], '/workspace'),
    /옵션을 읽지 못했어요\./,
  )
})

test('parseCliArgs parses add mode flags', async () => {
  const argv = await parseCliArgs(['--add', '--root-dir', '/tmp/existing-miniapp'], '/workspace')

  assert.equal(argv.add, true)
  assert.equal(argv.rootDir, '/tmp/existing-miniapp')
})

test('resolveCliOptions asks for missing values when interactive input is needed', async () => {
  const textCalls: Array<{
    message: string
    guide?: string
    initialValue?: string
  }> = []
  const selectMessages: string[] = []
  const promptValues = ['ebook-miniapp', '전자책 미니앱']
  const promptSelections: Array<'supabase' | 'cloudflare' | 'firebase' | 'yes' | 'no'> = [
    'supabase',
    'no',
    'no',
  ]

  const prompts: CliPrompter = {
    async text(options) {
      textCalls.push({
        message: options.message,
        guide: options.guide,
        initialValue: options.initialValue,
      })
      return promptValues.shift() ?? ''
    },
    async select(options) {
      const fallback = options.options[0]

      if (!fallback) {
        throw new Error('선택지가 없습니다.')
      }

      selectMessages.push(options.message)
      const nextSelection = promptSelections.shift()

      if (nextSelection && options.options.some((option) => option.value === nextSelection)) {
        return nextSelection as typeof fallback.value
      }

      return fallback.value
    },
  }

  const resolved = await resolveCliOptions(
    {
      add: false,
      rootDir: '/tmp/workspace',
      outputDir: '/tmp/workspace',
      skipInstall: false,
      yes: false,
      help: false,
      version: false,
    },
    prompts,
    {
      npm_config_user_agent: 'pnpm/10.32.1 npm/? node/v25.6.1 darwin arm64',
    },
  )

  assert.equal(resolved.appName, 'ebook-miniapp')
  assert.equal(resolved.displayName, '전자책 미니앱')
  assert.equal(resolved.packageManager, 'pnpm')
  assert.equal(resolved.withServer, true)
  assert.equal(resolved.serverProvider, 'supabase')
  assert.equal(resolved.serverProjectMode, null)
  assert.equal(resolved.withBackoffice, false)
  assert.equal(resolved.skipInstall, false)
  assert.equal(resolved.noGit, false)
  assert.equal(resolved.outputDir, path.resolve('/tmp/workspace'))
  assert.deepEqual(textCalls, [
    {
      message: 'appName을 입력해 주세요',
      guide: undefined,
      initialValue: undefined,
    },
    {
      message: 'displayName을 입력해 주세요',
      guide: '앱에서 보이는 이름이라서 자연스럽게 적어주면 돼요.',
      initialValue: undefined,
    },
  ])
  assert.deepEqual(selectMessages, [
    '`server` 제공자를 골라 주세요.',
    '`tRPC`도 같이 이어드릴까요?',
    '`backoffice`도 같이 만들까요?',
  ])
})

test('resolveCliOptions does not ask for a cloudflare worker mode when cloudflare is selected', async () => {
  const selectMessages: string[] = []
  const promptValues = ['ebook-miniapp', '전자책 미니앱']
  const promptSelections: Array<'supabase' | 'cloudflare' | 'firebase' | 'yes' | 'no'> = [
    'cloudflare',
    'yes',
    'yes',
  ]

  const resolved = await resolveCliOptions(
    {
      add: false,
      rootDir: '/tmp/workspace',
      outputDir: '/tmp/workspace',
      skipInstall: false,
      yes: false,
      help: false,
      version: false,
    },
    {
      async text() {
        return promptValues.shift() ?? ''
      },
      async select(options) {
        selectMessages.push(options.message)
        const fallback = options.options[0]

        if (!fallback) {
          throw new Error('선택지가 없습니다.')
        }

        const nextSelection = promptSelections.shift()

        if (nextSelection && options.options.some((option) => option.value === nextSelection)) {
          return nextSelection as typeof fallback.value
        }

        return fallback.value
      },
    },
    {
      npm_config_user_agent: 'pnpm/10.32.1 npm/? node/v25.6.1 darwin arm64',
    },
  )

  assert.equal(resolved.serverProvider, 'cloudflare')
  assert.equal(resolved.withTrpc, true)
  assert.equal(resolved.serverProjectMode, null)
  assert.deepEqual(selectMessages, [
    '`server` 제공자를 골라 주세요.',
    '`tRPC`도 같이 이어드릴까요?',
    '`backoffice`도 같이 만들까요?',
  ])
})

test('resolveCliOptions does not ask for trpc when firebase is selected', async () => {
  const selectMessages: string[] = []
  const promptValues = ['ebook-miniapp', '전자책 미니앱']
  const promptSelections: Array<'supabase' | 'cloudflare' | 'firebase' | 'yes' | 'no'> = [
    'firebase',
    'yes',
  ]

  const resolved = await resolveCliOptions(
    {
      add: false,
      rootDir: '/tmp/workspace',
      outputDir: '/tmp/workspace',
      skipInstall: false,
      yes: false,
      help: false,
      version: false,
    },
    {
      async text() {
        return promptValues.shift() ?? ''
      },
      async select(options) {
        selectMessages.push(options.message)
        const fallback = options.options[0]

        if (!fallback) {
          throw new Error('선택지가 없습니다.')
        }

        const nextSelection = promptSelections.shift()

        if (nextSelection && options.options.some((option) => option.value === nextSelection)) {
          return nextSelection as typeof fallback.value
        }

        return fallback.value
      },
    },
    {
      npm_config_user_agent: 'pnpm/10.32.1 npm/? node/v25.6.1 darwin arm64',
    },
  )

  assert.equal(resolved.serverProvider, 'firebase')
  assert.equal(resolved.withTrpc, false)
  assert.deepEqual(selectMessages, [
    '`server` 제공자를 골라 주세요.',
    '`backoffice`도 같이 만들까요?',
  ])
})

test('resolveCliOptions rejects trpc without a supported server provider', async () => {
  await assert.rejects(
    () =>
      resolveCliOptions(
        {
          add: false,
          name: 'ebook-miniapp',
          outputDir: '/tmp/workspace',
          rootDir: '/tmp/workspace',
          trpc: true,
          yes: true,
          skipInstall: false,
          help: false,
          version: false,
        },
        {
          async text() {
            throw new Error('text prompt should not be called')
          },
          async select() {
            throw new Error('select prompt should not be called')
          },
        },
        {
          npm_config_user_agent: 'pnpm/10.32.1 npm/? node/v25.6.1 darwin arm64',
        },
      ),
    /`--trpc`는 `supabase` 또는 `cloudflare` server provider와 함께만 사용할 수 있어요\./,
  )
})

test('resolveCliOptions rejects execution when the invoking package manager cannot be detected', async () => {
  await assert.rejects(
    () =>
      resolveCliOptions(
        {
          add: false,
          name: 'ebook-miniapp',
          rootDir: '/tmp/workspace',
          outputDir: '/tmp/workspace',
          skipInstall: false,
          yes: false,
          help: false,
          version: false,
        },
        {
          async text() {
            throw new Error('text prompt should not be called')
          },
          async select() {
            throw new Error('select prompt should not be called')
          },
        },
        {},
      ),
    /어떤 package manager로 시작했는지 감지하지 못했어요\./,
  )
})

test('resolveCliOptions keeps prompts optional when yes flag is set', async () => {
  let promptCalled = false
  const prompts: CliPrompter = {
    async text() {
      promptCalled = true
      return ''
    },
    async select(options) {
      promptCalled = true
      const fallback = options.options[0]

      if (!fallback) {
        throw new Error('선택지가 없습니다.')
      }

      return fallback.value
    },
  }

  const resolved = await resolveCliOptions(
    {
      add: false,
      name: 'ebook-miniapp',
      rootDir: '/tmp/workspace',
      outputDir: '/tmp/workspace',
      skipInstall: true,
      yes: true,
      help: false,
      version: false,
    },
    prompts,
    {
      npm_config_user_agent: 'pnpm/10.32.1 npm/? node/v24.0.0 darwin arm64',
    },
  )

  assert.equal(promptCalled, false)
  assert.equal(resolved.packageManager, 'pnpm')
  assert.equal(resolved.displayName, 'Ebook Miniapp')
  assert.equal(resolved.withServer, false)
  assert.equal(resolved.serverProvider, null)
  assert.equal(resolved.serverProjectMode, null)
  assert.equal(resolved.withBackoffice, false)
  assert.equal(resolved.skipInstall, true)
  assert.equal(resolved.noGit, false)
})

test('resolveCliOptions accepts an explicit server-provider without extra server prompts', async () => {
  const selectMessages: string[] = []
  const promptSelections: Array<'yes' | 'no'> = ['no', 'no']
  const resolved = await resolveCliOptions(
    {
      add: false,
      name: 'ebook-miniapp',
      displayName: '전자책 미니앱',
      serverProvider: 'cloudflare',
      rootDir: '/tmp/workspace',
      outputDir: '/tmp/workspace',
      skipInstall: false,
      yes: false,
      help: false,
      version: false,
    },
    {
      async text() {
        throw new Error('text prompt should not be called')
      },
      async select(options) {
        selectMessages.push(options.message)
        const fallback = options.options[0]

        if (!fallback) {
          throw new Error('선택지가 없습니다.')
        }

        const nextSelection = promptSelections.shift()

        if (nextSelection && options.options.some((option) => option.value === nextSelection)) {
          return nextSelection as typeof fallback.value
        }

        return fallback.value
      },
    },
    {
      npm_config_user_agent: 'pnpm/10.32.1 npm/? node/v25.6.1 darwin arm64',
    },
  )

  assert.equal(resolved.withServer, true)
  assert.equal(resolved.serverProvider, 'cloudflare')
  assert.equal(resolved.serverProjectMode, null)
  assert.deepEqual(selectMessages, ['`tRPC`도 같이 이어드릴까요?', '`backoffice`도 같이 만들까요?'])
})

test('resolveCliOptions rejects server-project-mode without server-provider', async () => {
  await assert.rejects(
    () =>
      resolveCliOptions(
        {
          add: false,
          name: 'ebook-miniapp',
          displayName: '전자책 미니앱',
          serverProjectMode: 'existing',
          rootDir: '/tmp/workspace',
          outputDir: '/tmp/workspace',
          skipInstall: false,
          yes: false,
          help: false,
          version: false,
        },
        {
          async text() {
            throw new Error('text prompt should not be called')
          },
          async select(options) {
            const fallback = options.options[0]

            if (!fallback) {
              throw new Error('선택지가 없습니다.')
            }

            return fallback.value
          },
        },
        {
          npm_config_user_agent: 'pnpm/10.32.1 npm/? node/v25.6.1 darwin arm64',
        },
      ),
    /`--server-project-mode`는 `server` provider를 선택했을 때만 사용할 수 있습니다\./,
  )
})

test('resolveCliOptions does not create a server in yes mode without server-provider', async () => {
  const resolved = await resolveCliOptions(
    {
      add: false,
      name: 'ebook-miniapp',
      rootDir: '/tmp/workspace',
      outputDir: '/tmp/workspace',
      skipInstall: false,
      yes: true,
      help: false,
      version: false,
    },
    {
      async text() {
        throw new Error('text prompt should not be called')
      },
      async select() {
        throw new Error('select prompt should not be called')
      },
    },
    {
      npm_config_user_agent: 'pnpm/10.32.1 npm/? node/v25.6.1 darwin arm64',
    },
  )

  assert.equal(resolved.withServer, false)
  assert.equal(resolved.serverProvider, null)
  assert.equal(resolved.serverProjectMode, null)
})

test('resolveCliOptions rejects conflicting server flags', async () => {
  await assert.rejects(
    () =>
      resolveCliOptions(
        {
          add: false,
          name: 'ebook-miniapp',
          serverProjectMode: 'existing',
          rootDir: '/tmp/workspace',
          outputDir: '/tmp/workspace',
          skipInstall: false,
          yes: true,
          help: false,
          version: false,
        },
        {
          async text() {
            throw new Error('text prompt should not be called')
          },
          async select() {
            throw new Error('select prompt should not be called')
          },
        },
        {
          npm_config_user_agent: 'pnpm/10.32.1 npm/? node/v25.6.1 darwin arm64',
        },
      ),
    /`--server-project-mode`는 `server` provider를 선택했을 때만 사용할 수 있습니다\./,
  )
})

test('detectInvocationPackageManager infers pnpm, yarn, npm, and bun from invocation metadata', () => {
  assert.equal(
    detectInvocationPackageManager({
      npm_config_user_agent: 'pnpm/10.32.1 npm/? node/v25.6.1 darwin arm64',
    }),
    'pnpm',
  )
  assert.equal(
    detectInvocationPackageManager({
      npm_config_user_agent: 'yarn/4.13.0 npm/? node/v25.6.1 darwin arm64',
    }),
    'yarn',
  )
  assert.equal(
    detectInvocationPackageManager({
      npm_config_user_agent: 'npm/11.4.0 node/v25.6.1 darwin arm64 workspaces/false',
    }),
    'npm',
  )
  assert.equal(
    detectInvocationPackageManager({
      npm_config_user_agent: 'bun/1.3.4 bunfig/false node/v25.6.1 darwin arm64',
    }),
    'bun',
  )
  assert.equal(
    detectInvocationPackageManager({
      npm_execpath: '/opt/homebrew/bin/bun',
    }),
    'bun',
  )
})

test('resolveCliOptions skips package-manager prompt when pnpm create invoked the CLI', async () => {
  const selectMessages: string[] = []
  const promptValues = ['ebook-miniapp', '전자책 미니앱']
  const promptSelections: Array<'supabase' | 'cloudflare' | 'firebase' | 'yes' | 'no'> = [
    'supabase',
    'no',
    'no',
  ]

  const resolved = await resolveCliOptions(
    {
      add: false,
      rootDir: '/tmp/workspace',
      outputDir: '/tmp/workspace',
      skipInstall: false,
      yes: false,
      help: false,
      version: false,
    },
    {
      async text() {
        return promptValues.shift() ?? ''
      },
      async select(options) {
        selectMessages.push(options.message)
        const fallback = options.options[0]

        if (!fallback) {
          throw new Error('선택지가 없습니다.')
        }

        const nextSelection = promptSelections.shift()

        if (nextSelection && options.options.some((option) => option.value === nextSelection)) {
          return nextSelection as typeof fallback.value
        }

        return fallback.value
      },
    },
    {
      npm_config_user_agent: 'pnpm/10.32.1 npm/? node/v25.6.1 darwin arm64',
    },
  )

  assert.equal(resolved.packageManager, 'pnpm')
  assert.deepEqual(selectMessages, [
    '`server` 제공자를 골라 주세요.',
    '`tRPC`도 같이 이어드릴까요?',
    '`backoffice`도 같이 만들까요?',
  ])
})

test('resolveCliOptions skips package-manager prompt when yarn create invoked the CLI', async () => {
  const selectMessages: string[] = []
  const promptValues = ['ebook-miniapp', '전자책 미니앱']
  const promptSelections: Array<'supabase' | 'cloudflare' | 'firebase' | 'yes' | 'no'> = [
    'firebase',
    'yes',
  ]

  const resolved = await resolveCliOptions(
    {
      add: false,
      rootDir: '/tmp/workspace',
      outputDir: '/tmp/workspace',
      skipInstall: false,
      yes: false,
      help: false,
      version: false,
    },
    {
      async text() {
        return promptValues.shift() ?? ''
      },
      async select(options) {
        selectMessages.push(options.message)
        const fallback = options.options[0]

        if (!fallback) {
          throw new Error('선택지가 없습니다.')
        }

        const nextSelection = promptSelections.shift()

        if (nextSelection && options.options.some((option) => option.value === nextSelection)) {
          return nextSelection as typeof fallback.value
        }

        return fallback.value
      },
    },
    {
      npm_config_user_agent: 'yarn/4.13.0 npm/? node/v25.6.1 darwin arm64',
    },
  )

  assert.equal(resolved.packageManager, 'yarn')
  assert.deepEqual(selectMessages, [
    '`server` 제공자를 골라 주세요.',
    '`backoffice`도 같이 만들까요?',
  ])
})

test('resolveCliOptions skips package-manager prompt when npm create invoked the CLI', async () => {
  const selectMessages: string[] = []
  const promptValues = ['ebook-miniapp', '전자책 미니앱']
  const promptSelections: Array<'supabase' | 'cloudflare' | 'firebase' | 'yes' | 'no'> = [
    'cloudflare',
    'no',
    'no',
  ]

  const resolved = await resolveCliOptions(
    {
      add: false,
      rootDir: '/tmp/workspace',
      outputDir: '/tmp/workspace',
      skipInstall: false,
      yes: false,
      help: false,
      version: false,
    },
    {
      async text() {
        return promptValues.shift() ?? ''
      },
      async select(options) {
        selectMessages.push(options.message)
        const fallback = options.options[0]

        if (!fallback) {
          throw new Error('선택지가 없습니다.')
        }

        const nextSelection = promptSelections.shift()

        if (nextSelection && options.options.some((option) => option.value === nextSelection)) {
          return nextSelection as typeof fallback.value
        }

        return fallback.value
      },
    },
    {
      npm_config_user_agent: 'npm/11.11.1 node/v25.6.1 darwin arm64 workspaces/false',
    },
  )

  assert.equal(resolved.packageManager, 'npm')
  assert.deepEqual(selectMessages, [
    '`server` 제공자를 골라 주세요.',
    '`tRPC`도 같이 이어드릴까요?',
    '`backoffice`도 같이 만들까요?',
  ])
})

test('resolveCliOptions skips package-manager prompt when bun create invoked the CLI', async () => {
  const selectMessages: string[] = []
  const promptValues = ['ebook-miniapp', '전자책 미니앱']
  const promptSelections: Array<'supabase' | 'cloudflare' | 'firebase' | 'yes' | 'no'> = [
    'firebase',
    'yes',
  ]

  const resolved = await resolveCliOptions(
    {
      add: false,
      rootDir: '/tmp/workspace',
      outputDir: '/tmp/workspace',
      skipInstall: false,
      yes: false,
      help: false,
      version: false,
    },
    {
      async text() {
        return promptValues.shift() ?? ''
      },
      async select(options) {
        selectMessages.push(options.message)
        const fallback = options.options[0]

        if (!fallback) {
          throw new Error('선택지가 없습니다.')
        }

        const nextSelection = promptSelections.shift()

        if (nextSelection && options.options.some((option) => option.value === nextSelection)) {
          return nextSelection as typeof fallback.value
        }

        return fallback.value
      },
    },
    {
      npm_config_user_agent: 'bun/1.3.4 bunfig/false node/v25.6.1 darwin arm64',
    },
  )

  assert.equal(resolved.packageManager, 'bun')
  assert.deepEqual(selectMessages, [
    '`server` 제공자를 골라 주세요.',
    '`backoffice`도 같이 만들까요?',
  ])
})

test('resolveCliOptions keeps no-git when explicitly requested', async () => {
  const resolved = await resolveCliOptions(
    {
      add: false,
      name: 'ebook-miniapp',
      noGit: true,
      rootDir: '/tmp/workspace',
      outputDir: '/tmp/workspace',
      skipInstall: false,
      yes: true,
      help: false,
      version: false,
    },
    {
      async text() {
        throw new Error('text prompt should not be called')
      },
      async select(options) {
        const fallback = options.options[0]

        if (!fallback) {
          throw new Error('선택지가 없습니다.')
        }

        return fallback.value
      },
    },
    {
      npm_config_user_agent: 'pnpm/10.32.1 npm/? node/v25.6.1 darwin arm64',
    },
  )

  assert.equal(resolved.noGit, true)
})

test('resolveAddCliOptions detects additive targets from an existing workspace', async () => {
  const selectMessages: string[] = []
  const promptSelections: Array<'supabase' | 'cloudflare' | 'firebase' | 'yes' | 'no'> = [
    'supabase',
    'no',
    'yes',
  ]

  const resolved = await resolveAddCliOptions(
    {
      add: true,
      rootDir: '/tmp/existing-miniapp',
      outputDir: '/tmp/workspace',
      skipInstall: false,
      yes: false,
      help: false,
      version: false,
    },
    {
      async text() {
        throw new Error('text prompt should not be called')
      },
      async select(options) {
        selectMessages.push(options.message)
        const fallback = options.options[0]

        if (!fallback) {
          throw new Error('선택지가 없습니다.')
        }

        const nextSelection = promptSelections.shift()

        if (nextSelection && options.options.some((option) => option.value === nextSelection)) {
          return nextSelection as typeof fallback.value
        }

        return fallback.value
      },
    },
    {
      rootDir: '/tmp/existing-miniapp',
      packageManager: 'pnpm',
      appName: 'ebook-miniapp',
      displayName: '전자책 미니앱',
      hasServer: false,
      hasBackoffice: false,
      hasTrpc: false,
      serverProvider: null,
    },
  )

  assert.equal(resolved.packageManager, 'pnpm')
  assert.equal(resolved.appName, 'ebook-miniapp')
  assert.equal(resolved.displayName, '전자책 미니앱')
  assert.equal(resolved.rootDir, path.resolve('/tmp/existing-miniapp'))
  assert.equal(resolved.withServer, true)
  assert.equal(resolved.serverProvider, 'supabase')
  assert.equal(resolved.withTrpc, false)
  assert.equal(resolved.serverProjectMode, null)
  assert.equal(resolved.withBackoffice, true)
  assert.equal(resolved.existingServerProvider, null)
  assert.equal(resolved.existingHasBackoffice, false)
  assert.equal(resolved.existingHasTrpc, false)
  assert.deepEqual(selectMessages, [
    '`server` 제공자를 골라 주세요.',
    '`tRPC`도 같이 이어드릴까요?',
    '`backoffice`도 같이 추가할까요?',
  ])
})

test('resolveAddCliOptions accepts explicit server-provider in yes mode', async () => {
  const resolved = await resolveAddCliOptions(
    {
      add: true,
      serverProvider: 'firebase',
      rootDir: '/tmp/existing-miniapp',
      outputDir: '/tmp/workspace',
      skipInstall: false,
      yes: true,
      help: false,
      version: false,
    },
    {
      async text() {
        throw new Error('text prompt should not be called')
      },
      async select() {
        throw new Error('select prompt should not be called')
      },
    },
    {
      rootDir: '/tmp/existing-miniapp',
      packageManager: 'pnpm',
      appName: 'ebook-miniapp',
      displayName: '전자책 미니앱',
      hasServer: false,
      hasBackoffice: false,
      hasTrpc: false,
      serverProvider: null,
    },
  )

  assert.equal(resolved.withServer, true)
  assert.equal(resolved.serverProvider, 'firebase')
  assert.equal(resolved.withTrpc, false)
  assert.equal(resolved.serverProjectMode, null)
})

test('resolveAddCliOptions can add trpc to an existing cloudflare server workspace', async () => {
  const selectMessages: string[] = []
  const promptSelections: Array<'yes' | 'no'> = ['yes', 'no']

  const resolved = await resolveAddCliOptions(
    {
      add: true,
      rootDir: '/tmp/existing-miniapp',
      outputDir: '/tmp/workspace',
      skipInstall: false,
      yes: false,
      help: false,
      version: false,
    },
    {
      async text() {
        throw new Error('text prompt should not be called')
      },
      async select(options) {
        selectMessages.push(options.message)
        const fallback = options.options[0]

        if (!fallback) {
          throw new Error('선택지가 없습니다.')
        }

        const nextSelection = promptSelections.shift()

        if (nextSelection && options.options.some((option) => option.value === nextSelection)) {
          return nextSelection as typeof fallback.value
        }

        return fallback.value
      },
    },
    {
      rootDir: '/tmp/existing-miniapp',
      packageManager: 'pnpm',
      appName: 'ebook-miniapp',
      displayName: '전자책 미니앱',
      hasServer: true,
      hasBackoffice: false,
      hasTrpc: false,
      serverProvider: 'cloudflare',
    },
  )

  assert.equal(resolved.withServer, false)
  assert.equal(resolved.withBackoffice, false)
  assert.equal(resolved.withTrpc, true)
  assert.equal(resolved.serverProvider, null)
  assert.equal(resolved.existingServerProvider, 'cloudflare')
  assert.equal(resolved.existingHasTrpc, false)
  assert.deepEqual(selectMessages, [
    '`tRPC`도 같이 이어드릴까요?',
    '`backoffice`도 같이 추가할까요?',
  ])
})

test('resolveAddCliOptions rejects server-project-mode without server-provider', async () => {
  await assert.rejects(
    () =>
      resolveAddCliOptions(
        {
          add: true,
          serverProjectMode: 'existing',
          rootDir: '/tmp/existing-miniapp',
          outputDir: '/tmp/workspace',
          skipInstall: false,
          yes: false,
          help: false,
          version: false,
        },
        {
          async text() {
            throw new Error('text prompt should not be called')
          },
          async select(options) {
            const fallback = options.options[0]

            if (!fallback) {
              throw new Error('선택지가 없습니다.')
            }

            return fallback.value
          },
        },
        {
          rootDir: '/tmp/existing-miniapp',
          packageManager: 'pnpm',
          appName: 'ebook-miniapp',
          displayName: '전자책 미니앱',
          hasServer: false,
          hasBackoffice: false,
          hasTrpc: false,
          serverProvider: null,
        },
      ),
    /`--server-project-mode`는 `server` provider를 선택했을 때만 사용할 수 있습니다\./,
  )
})

test('formatCliHelp renders Korean help text', () => {
  const help = formatCliHelp()

  assert.match(help, /사용법/)
  assert.match(help, /옵션/)
  assert.match(help, /--package-manager <pnpm\|yarn\|npm\|bun>/)
  assert.match(help, /--add/)
  assert.match(help, /--root-dir <디렉터리>/)
  assert.match(help, /--server-provider <supabase\|cloudflare\|firebase>/)
  assert.match(help, /--trpc/)
  assert.match(help, /--server-project-mode <create\|existing>/)
  assert.doesNotMatch(help, /--with-server/)
  assert.match(help, /도움말 보기/)
  assert.match(help, /버전 보기/)
})

test('createClackPrompter delegates text input and single-choice selection to clack prompts', async () => {
  const messages: string[] = []
  const prompter = createClackPrompter({
    async text(options) {
      if (options.guide) {
        messages.push(`guide:${options.guide}`)
      }

      messages.push(`text:${options.message}`)
      return options.initialValue ?? 'ebook-miniapp'
    },
    async select<T extends string>(options: {
      message: string
      options: Array<{
        label: string
        value: T
      }>
      initialValue?: T
    }) {
      messages.push(`select:${options.message}`)
      const secondary = options.options[1]?.value

      if (secondary) {
        return secondary
      }

      const primary = options.options[0]?.value

      if (!primary) {
        throw new Error('선택지가 없습니다.')
      }

      return primary
    },
    isCancel(_value): _value is symbol {
      return false
    },
  })

  const textValue = await prompter.text({
    message: 'appName을 입력해 주세요',
    initialValue: 'ebook-miniapp',
  })
  await prompter.text({
    message: 'displayName을 입력해 주세요',
    guide: '앱에서 보이는 이름이라서 자연스럽게 적어주면 돼요.',
  })
  const selectValue = await prompter.select({
    message: '`server` 제공자를 골라 주세요.',
    options: [
      { label: '생성 안 함', value: 'none' },
      { label: 'Firebase', value: 'firebase' },
    ],
    initialValue: 'none',
  })

  assert.equal(textValue, 'ebook-miniapp')
  assert.equal(selectValue, 'firebase')
  assert.deepEqual(messages, [
    'text:appName을 입력해 주세요',
    'guide:앱에서 보이는 이름이라서 자연스럽게 적어주면 돼요.',
    'text:displayName을 입력해 주세요',
    'select:`server` 제공자를 골라 주세요.',
  ])
})

test('createClackPrompter turns prompt cancellation into a user-facing error', async () => {
  const cancelled = Symbol('cancelled')
  const prompter = createClackPrompter({
    async text() {
      return cancelled
    },
    async select<T extends string>(options: {
      message: string
      options: Array<{
        label: string
        value: T
      }>
      initialValue?: T
    }) {
      return options.options[0]?.value ?? cancelled
    },
    isCancel(value): value is symbol {
      return value === cancelled
    },
  })

  await assert.rejects(
    () => prompter.text({ message: 'appName을 입력해 주세요' }),
    /입력을 취소했어요\./,
  )
})
