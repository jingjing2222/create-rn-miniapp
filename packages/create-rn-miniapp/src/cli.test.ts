import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import {
  buildSelectPromptProgram,
  formatCliHelp,
  parseCliArgs,
  resolveCliOptions,
  type CliPrompter,
} from './cli.js'

test('parseCliArgs parses long-form CLI options with yargs', async () => {
  const argv = await parseCliArgs(
    [
      '--name',
      'ebook-miniapp',
      '--display-name',
      '전자책 미니앱',
      '--with-server',
      '--with-backoffice',
      '--output-dir',
      '/tmp/create-miniapp',
      '--skip-install',
    ],
    '/workspace',
  )

  assert.equal(argv.name, 'ebook-miniapp')
  assert.equal(argv.displayName, '전자책 미니앱')
  assert.equal(argv.withServer, true)
  assert.equal(argv.withBackoffice, true)
  assert.equal(argv.outputDir, '/tmp/create-miniapp')
  assert.equal(argv.skipInstall, true)
  assert.equal(argv.yes, false)
})

test('resolveCliOptions asks for missing values when interactive input is needed', async () => {
  const textMessages: string[] = []
  const selectMessages: string[] = []
  const promptValues = ['ebook-miniapp', '전자책 미니앱']
  const promptSelections: Array<'yes' | 'no'> = ['yes', 'no']

  const prompts: CliPrompter = {
    async text(options) {
      textMessages.push(options.message)
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
  assert.equal(resolved.withServer, true)
  assert.equal(resolved.withBackoffice, false)
  assert.equal(resolved.skipInstall, false)
  assert.equal(resolved.outputDir, path.resolve('/tmp/workspace'))
  assert.deepEqual(textMessages, ['appName을 입력하세요', 'displayName을 입력하세요'])
  assert.deepEqual(selectMessages, [
    '`server` 워크스페이스를 같이 만들까요?',
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
  assert.equal(resolved.displayName, 'Ebook Miniapp')
  assert.equal(resolved.withServer, false)
  assert.equal(resolved.withBackoffice, false)
  assert.equal(resolved.skipInstall, true)
})

test('formatCliHelp renders Korean help text', () => {
  const help = formatCliHelp()

  assert.match(help, /사용법/)
  assert.match(help, /옵션/)
  assert.match(help, /도움말 보기/)
  assert.match(help, /버전 보기/)
})

test('buildSelectPromptProgram uses arrow keys, space to select, and enter to continue', () => {
  const program = buildSelectPromptProgram({
    message: '`server` 워크스페이스를 같이 만들까요?',
    options: [
      { label: '예', value: 'yes' },
      { label: '아니오', value: 'no' },
    ],
    initialValue: 'no',
  })

  assert.match(program, /↑ ↓로 이동, Space로 선택, Enter로 진행/)
  assert.match(program, /setRawMode\(true\)/)
  assert.equal(program.includes(String.raw`\u001b[A`), true)
  assert.equal(program.includes(String.raw`\u001b[B`), true)
  assert.match(program, /let selected = payload.initialIndex/)
  assert.match(program, /selected = cursor/)
  assert.match(program, /stdout.write\(String\(selected\)\)/)
  assert.doesNotMatch(program, /1\\. 예/)
})
