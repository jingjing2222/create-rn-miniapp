import assert from 'node:assert/strict'
import test from 'node:test'
import type { CliPrompter } from '../cli.js'
import { promptShouldInitializeExistingRemoteContent } from './shared.js'

type SelectConfig = {
  message: string
  initialValue?: string
  options: Array<{
    label: string
    value: string
  }>
}

test('promptShouldInitializeExistingRemoteContent defaults to skipping remote initialization', async () => {
  let capturedMessage = ''
  let capturedInitialValue = ''
  let capturedLabels: string[] = []

  const prompt: CliPrompter = {
    async text() {
      throw new Error('text should not be called')
    },
    async select<T extends string>(options: SelectConfig) {
      capturedMessage = options.message
      capturedInitialValue = options.initialValue ?? ''
      capturedLabels = options.options.map((option) => option.label)
      return options.options[0]?.value as T
    },
  }

  const shouldInitialize = await promptShouldInitializeExistingRemoteContent(
    prompt,
    '이 프로젝트의 원격에 있는 내용을 초기화할까요?',
  )

  assert.equal(shouldInitialize, false)
  assert.equal(capturedMessage, '이 프로젝트의 원격에 있는 내용을 초기화할까요?')
  assert.equal(capturedInitialValue, '__skip_remote_content_initialization__')
  assert.deepEqual(capturedLabels, ['이번엔 건너뛸게요 (권장)', '초기화할게요'])
})

test('promptShouldInitializeExistingRemoteContent returns true when initialize is selected', async () => {
  const prompt: CliPrompter = {
    async text() {
      throw new Error('text should not be called')
    },
    async select<T extends string>(options: SelectConfig) {
      return options.options[1]?.value as T
    },
  }

  const shouldInitialize = await promptShouldInitializeExistingRemoteContent(
    prompt,
    '이 프로젝트의 원격에 있는 내용을 초기화할까요?',
  )

  assert.equal(shouldInitialize, true)
})
