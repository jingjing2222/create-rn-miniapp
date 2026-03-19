import type { CliPrompter } from '../cli.js'

const INITIALIZE_REMOTE_CONTENT_SENTINEL = '__initialize_remote_content__'
const SKIP_REMOTE_CONTENT_INITIALIZATION_SENTINEL = '__skip_remote_content_initialization__'

export async function promptShouldInitializeExistingRemoteContent(
  prompt: CliPrompter,
  message: string,
) {
  const selection = await prompt.select({
    message,
    options: [
      {
        value: SKIP_REMOTE_CONTENT_INITIALIZATION_SENTINEL,
        label: '이번엔 건너뛸게요 (권장)',
      },
      {
        value: INITIALIZE_REMOTE_CONTENT_SENTINEL,
        label: '초기화할게요',
      },
    ],
    initialValue: SKIP_REMOTE_CONTENT_INITIALIZATION_SENTINEL,
  })

  return selection === INITIALIZE_REMOTE_CONTENT_SENTINEL
}
