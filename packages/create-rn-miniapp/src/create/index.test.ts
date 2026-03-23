import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

test('runCreate keeps the create flow explicit in coordinator order', async () => {
  const coordinatorSource = await readFile(
    fileURLToPath(new URL('./index.ts', import.meta.url)),
    'utf8',
  )

  assert.match(coordinatorSource, /let ctx = await resolveCreateContext\(options\)/)
  assert.match(coordinatorSource, /ctx = await scaffoldCreateWorkspace\(ctx\)/)
  assert.match(coordinatorSource, /ctx = await provisionCreateWorkspace\(ctx\)/)
  assert.match(coordinatorSource, /ctx = await patchCreateWorkspace\(ctx\)/)
  assert.match(coordinatorSource, /ctx = await finalizeCreateWorkspace\(ctx\)/)
  assert.doesNotMatch(coordinatorSource, /runFlow\(/)
})
