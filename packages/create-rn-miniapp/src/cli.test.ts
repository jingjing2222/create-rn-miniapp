import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import {
  type CliPrompter,
  createClackPrompter,
  formatCliHelp,
  parseCliArgs,
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
      '--with-server',
      '--server-provider',
      'supabase',
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
  assert.equal(argv.withServer, true)
  assert.equal(argv.serverProvider, 'supabase')
  assert.equal(argv.withBackoffice, true)
  assert.equal(argv.outputDir, '/tmp/create-miniapp')
  assert.equal(argv.skipInstall, true)
  assert.equal(argv.yes, false)
})

test('resolveCliOptions asks for missing values when interactive input is needed', async () => {
  const textCalls: Array<{
    message: string
    guide?: string
    initialValue?: string
  }> = []
  const selectMessages: string[] = []
  const promptValues = ['ebook-miniapp', '전자책 미니앱']
  const promptSelections: Array<'pnpm' | 'yarn' | 'supabase' | 'yes' | 'no'> = [
    'yarn',
    'supabase',
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
      outputDir: '/tmp/workspace',
      skipInstall: false,
      yes: false,
      help: false,
      version: false,
    },
    prompts,
  )

  assert.equal(resolved.appName, 'ebook-miniapp')
  assert.equal(resolved.displayName, '전자책 미니앱')
  assert.equal(resolved.packageManager, 'yarn')
  assert.equal(resolved.withServer, true)
  assert.equal(resolved.serverProvider, 'supabase')
  assert.equal(resolved.withBackoffice, false)
  assert.equal(resolved.skipInstall, false)
  assert.equal(resolved.outputDir, path.resolve('/tmp/workspace'))
  assert.deepEqual(textCalls, [
    {
      message: 'appName을 입력하세요',
      guide: undefined,
      initialValue: undefined,
    },
    {
      message: 'displayName을 입력하세요',
      guide: '보여지는 이름이니 한글로 해주세요.',
      initialValue: undefined,
    },
  ])
  assert.deepEqual(selectMessages, [
    '패키지 매니저를 선택하세요.',
    '`server` 제공자를 선택하세요.',
    '`backoffice` 워크스페이스를 같이 만들까요?',
  ])
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
      name: 'ebook-miniapp',
      outputDir: '/tmp/workspace',
      skipInstall: true,
      yes: true,
      help: false,
      version: false,
    },
    prompts,
  )

  assert.equal(promptCalled, false)
  assert.equal(resolved.packageManager, 'pnpm')
  assert.equal(resolved.displayName, 'Ebook Miniapp')
  assert.equal(resolved.withServer, false)
  assert.equal(resolved.serverProvider, null)
  assert.equal(resolved.withBackoffice, false)
  assert.equal(resolved.skipInstall, true)
})

test('resolveCliOptions keeps with-server compatibility by defaulting provider to supabase', async () => {
  const resolved = await resolveCliOptions(
    {
      name: 'ebook-miniapp',
      withServer: true,
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
  )

  assert.equal(resolved.withServer, true)
  assert.equal(resolved.serverProvider, 'supabase')
})

test('resolveCliOptions rejects conflicting server flags', async () => {
  await assert.rejects(
    () =>
      resolveCliOptions(
        {
          name: 'ebook-miniapp',
          withServer: false,
          serverProvider: 'supabase',
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
      ),
    /`--with-server` 없이 `--server-provider`를 사용할 수 없습니다\./,
  )
})

test('formatCliHelp renders Korean help text', () => {
  const help = formatCliHelp()

  assert.match(help, /사용법/)
  assert.match(help, /옵션/)
  assert.match(help, /--package-manager <pnpm\|yarn>/)
  assert.match(help, /--server-provider <supabase>/)
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
    message: 'appName을 입력하세요',
    initialValue: 'ebook-miniapp',
  })
  await prompter.text({
    message: 'displayName을 입력하세요',
    guide: '보여지는 이름이니 한글로 해주세요.',
  })
  const selectValue = await prompter.select({
    message: '`server` 제공자를 선택하세요.',
    options: [
      { label: '생성 안 함', value: 'none' },
      { label: 'Supabase', value: 'supabase' },
    ],
    initialValue: 'none',
  })

  assert.equal(textValue, 'ebook-miniapp')
  assert.equal(selectValue, 'supabase')
  assert.deepEqual(messages, [
    'text:appName을 입력하세요',
    'guide:보여지는 이름이니 한글로 해주세요.',
    'text:displayName을 입력하세요',
    'select:`server` 제공자를 선택하세요.',
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
    () => prompter.text({ message: 'appName을 입력하세요' }),
    /입력을 취소했습니다\./,
  )
})
