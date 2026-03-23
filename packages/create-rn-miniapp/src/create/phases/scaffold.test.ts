import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

test('scaffoldCreateWorkspace writes the root skeleton before frontend scaffolding', async () => {
  const scaffoldSource = await readFile(
    fileURLToPath(new URL('./scaffold.ts', import.meta.url)),
    'utf8',
  )

  const applyRootTemplatesIndex = scaffoldSource.indexOf(
    'ctx = await applyCreateRootWorkspaceTemplates(ctx)',
  )
  const applyRootTemplatesMatches = scaffoldSource.match(
    /ctx = await applyCreateRootWorkspaceTemplates\(ctx\)/g,
  )
  const scaffoldFrontendIndex = scaffoldSource.indexOf('ctx = await scaffoldCreateFrontend(ctx)')

  assert.notEqual(applyRootTemplatesIndex, -1)
  assert.equal(applyRootTemplatesMatches?.length, 1)
  assert.notEqual(scaffoldFrontendIndex, -1)
  assert.ok(
    applyRootTemplatesIndex < scaffoldFrontendIndex,
    'root skeleton should be created before frontend scaffold commands run',
  )
})
