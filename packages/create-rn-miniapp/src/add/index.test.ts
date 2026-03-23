import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

test('runAdd keeps the add flow explicit in coordinator order', async () => {
  const coordinatorSource = await readFile(
    fileURLToPath(new URL('./index.ts', import.meta.url)),
    'utf8',
  )

  assert.match(coordinatorSource, /let ctx = await inspectAddWorkspace\(options\)/)
  assert.match(coordinatorSource, /ctx = await resolveAddContext\(ctx\)/)
  assert.match(coordinatorSource, /ctx = await scaffoldAddWorkspace\(ctx\)/)
  assert.match(coordinatorSource, /ctx = await provisionAddWorkspace\(ctx\)/)
  assert.match(coordinatorSource, /ctx = await patchAddWorkspace\(ctx\)/)
  assert.match(coordinatorSource, /ctx = await finalizeAddWorkspace\(ctx\)/)
  assert.doesNotMatch(coordinatorSource, /runFlow\(/)
})
