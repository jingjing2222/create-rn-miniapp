import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { inspectWorkspace } from './workspace-inspector.js'

async function createTempWorkspace(t: test.TestContext) {
  const targetRoot = await mkdtemp(path.join(os.tmpdir(), 'create-rn-miniapp-inspector-'))
  t.after(async () => {
    await rm(targetRoot, { recursive: true, force: true })
  })
  return targetRoot
}

test('inspectWorkspace reads package manager and frontend metadata from an existing workspace', async (t) => {
  const targetRoot = await createTempWorkspace(t)

  await mkdir(path.join(targetRoot, 'frontend'), { recursive: true })
  await mkdir(path.join(targetRoot, 'server'), { recursive: true })
  await writeFile(
    path.join(targetRoot, 'package.json'),
    JSON.stringify(
      {
        packageManager: 'yarn@4.13.0',
      },
      null,
      2,
    ),
    'utf8',
  )
  await writeFile(
    path.join(targetRoot, 'frontend', 'granite.config.ts'),
    [
      "import { appsInToss } from '@apps-in-toss/framework/plugins'",
      "import { defineConfig } from '@granite-js/react-native/config'",
      '',
      'export default defineConfig({',
      '  appName: "ebook-miniapp",',
      '  plugins: [',
      '    appsInToss({',
      '      brand: {',
      '        displayName: "전자책 미니앱",',
      '      },',
      '    }),',
      '  ],',
      '})',
      '',
    ].join('\n'),
    'utf8',
  )

  const inspection = await inspectWorkspace(targetRoot)

  assert.equal(inspection.packageManager, 'yarn')
  assert.equal(inspection.appName, 'ebook-miniapp')
  assert.equal(inspection.displayName, '전자책 미니앱')
  assert.equal(inspection.hasServer, true)
  assert.equal(inspection.hasBackoffice, false)
  assert.equal(inspection.serverProvider, 'supabase')
})

test('inspectWorkspace rejects roots without a supported packageManager field', async (t) => {
  const targetRoot = await createTempWorkspace(t)

  await mkdir(path.join(targetRoot, 'frontend'), { recursive: true })
  await writeFile(
    path.join(targetRoot, 'package.json'),
    JSON.stringify(
      {
        packageManager: 'npm@10.0.0',
      },
      null,
      2,
    ),
    'utf8',
  )
  await writeFile(
    path.join(targetRoot, 'frontend', 'granite.config.ts'),
    'export default {}',
    'utf8',
  )

  await assert.rejects(() => inspectWorkspace(targetRoot), /지원하지 않는 package manager/)
})
