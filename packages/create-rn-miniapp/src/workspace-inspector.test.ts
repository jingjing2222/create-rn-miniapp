import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { getTestPackageManagerField } from './test-support/package-manager.js'
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
  await mkdir(path.join(targetRoot, 'server', 'supabase'), { recursive: true })
  await writeFile(
    path.join(targetRoot, 'server', 'supabase', 'config.toml'),
    'project_id = "local"\n',
    'utf8',
  )
  await writeFile(
    path.join(targetRoot, 'package.json'),
    JSON.stringify(
      {
        packageManager: getTestPackageManagerField('yarn'),
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
  assert.equal(inspection.hasTrpc, false)
  assert.equal(inspection.serverProvider, 'supabase')
})

test('inspectWorkspace detects cloudflare server workspaces from wrangler config', async (t) => {
  const targetRoot = await createTempWorkspace(t)

  await mkdir(path.join(targetRoot, 'frontend'), { recursive: true })
  await mkdir(path.join(targetRoot, 'server'), { recursive: true })
  await writeFile(
    path.join(targetRoot, 'package.json'),
    JSON.stringify(
      {
        packageManager: getTestPackageManagerField('pnpm'),
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
  await writeFile(
    path.join(targetRoot, 'server', 'wrangler.jsonc'),
    '{\n  "name": "server"\n}\n',
    'utf8',
  )

  const inspection = await inspectWorkspace(targetRoot)

  assert.equal(inspection.packageManager, 'pnpm')
  assert.equal(inspection.hasServer, true)
  assert.equal(inspection.hasTrpc, false)
  assert.equal(inspection.serverProvider, 'cloudflare')
})

test('inspectWorkspace reads existing scaffold state manifest when present', async (t) => {
  const targetRoot = await createTempWorkspace(t)

  await mkdir(path.join(targetRoot, 'frontend'), { recursive: true })
  await mkdir(path.join(targetRoot, 'server', '.create-rn-miniapp'), { recursive: true })
  await mkdir(path.join(targetRoot, 'packages', 'app-router'), { recursive: true })
  await writeFile(
    path.join(targetRoot, 'package.json'),
    JSON.stringify(
      {
        packageManager: getTestPackageManagerField('pnpm'),
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
  await writeFile(
    path.join(targetRoot, 'server', 'wrangler.jsonc'),
    '{\n  "name": "server"\n}\n',
    'utf8',
  )
  await writeFile(
    path.join(targetRoot, 'packages', 'app-router', 'package.json'),
    JSON.stringify({ name: '@workspace/app-router', private: true }, null, 2),
    'utf8',
  )
  await writeFile(
    path.join(targetRoot, 'server', '.create-rn-miniapp', 'state.json'),
    JSON.stringify(
      {
        serverProvider: 'cloudflare',
        serverProjectMode: 'create',
        remoteInitialization: 'applied',
        trpc: true,
        backoffice: false,
      },
      null,
      2,
    ),
    'utf8',
  )

  const inspection = await inspectWorkspace(targetRoot)

  assert.deepEqual(inspection.serverScaffoldState, {
    serverProvider: 'cloudflare',
    serverProjectMode: 'create',
    remoteInitialization: 'applied',
    trpc: true,
    backoffice: false,
  })
  assert.equal(inspection.hasTrpc, true)
})

test('inspectWorkspace rejects scaffold state that disagrees with workspace topology', async (t) => {
  const targetRoot = await createTempWorkspace(t)

  await mkdir(path.join(targetRoot, 'frontend'), { recursive: true })
  await mkdir(path.join(targetRoot, 'server', '.create-rn-miniapp'), { recursive: true })
  await writeFile(
    path.join(targetRoot, 'package.json'),
    JSON.stringify(
      {
        packageManager: getTestPackageManagerField('pnpm'),
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
  await writeFile(
    path.join(targetRoot, 'server', 'wrangler.jsonc'),
    '{\n  "name": "server"\n}\n',
    'utf8',
  )
  await writeFile(
    path.join(targetRoot, 'server', '.create-rn-miniapp', 'state.json'),
    JSON.stringify(
      {
        serverProvider: 'cloudflare',
        serverProjectMode: 'existing',
        remoteInitialization: 'skipped',
        trpc: true,
        backoffice: true,
      },
      null,
      2,
    ),
    'utf8',
  )

  await assert.rejects(
    () => inspectWorkspace(targetRoot),
    /state\.json과 실제 workspace topology가 서로 다릅니다/,
  )
})

test('inspectWorkspace detects firebase server workspaces from firebase config', async (t) => {
  const targetRoot = await createTempWorkspace(t)

  await mkdir(path.join(targetRoot, 'frontend'), { recursive: true })
  await mkdir(path.join(targetRoot, 'server'), { recursive: true })
  await writeFile(
    path.join(targetRoot, 'package.json'),
    JSON.stringify(
      {
        packageManager: getTestPackageManagerField('pnpm'),
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
  await writeFile(
    path.join(targetRoot, 'server', 'firebase.json'),
    '{\n  "functions": []\n}\n',
    'utf8',
  )

  const inspection = await inspectWorkspace(targetRoot)

  assert.equal(inspection.packageManager, 'pnpm')
  assert.equal(inspection.hasServer, true)
  assert.equal(inspection.hasTrpc, false)
  assert.equal(inspection.serverProvider, 'firebase')
})

test('inspectWorkspace detects tRPC workspace from packages/app-router/package.json', async (t) => {
  const targetRoot = await createTempWorkspace(t)

  await mkdir(path.join(targetRoot, 'frontend'), { recursive: true })
  await mkdir(path.join(targetRoot, 'server'), { recursive: true })
  await mkdir(path.join(targetRoot, 'packages', 'app-router'), { recursive: true })
  await writeFile(
    path.join(targetRoot, 'package.json'),
    JSON.stringify(
      {
        packageManager: getTestPackageManagerField('pnpm'),
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
  await writeFile(
    path.join(targetRoot, 'server', 'wrangler.jsonc'),
    '{\n  "name": "server"\n}\n',
    'utf8',
  )
  await writeFile(
    path.join(targetRoot, 'packages', 'app-router', 'package.json'),
    JSON.stringify({ name: '@workspace/app-router', private: true }, null, 2),
    'utf8',
  )

  const inspection = await inspectWorkspace(targetRoot)

  assert.equal(inspection.hasTrpc, true)
  assert.equal(inspection.serverProvider, 'cloudflare')
})

test('inspectWorkspace still detects legacy tRPC workspace from packages/trpc/package.json', async (t) => {
  const targetRoot = await createTempWorkspace(t)

  await mkdir(path.join(targetRoot, 'frontend'), { recursive: true })
  await mkdir(path.join(targetRoot, 'server'), { recursive: true })
  await mkdir(path.join(targetRoot, 'packages', 'trpc'), { recursive: true })
  await writeFile(
    path.join(targetRoot, 'package.json'),
    JSON.stringify(
      {
        packageManager: getTestPackageManagerField('pnpm'),
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
  await writeFile(
    path.join(targetRoot, 'server', 'wrangler.jsonc'),
    '{\n  "name": "server"\n}\n',
    'utf8',
  )
  await writeFile(
    path.join(targetRoot, 'packages', 'trpc', 'package.json'),
    JSON.stringify({ name: '@workspace/trpc', private: true }, null, 2),
    'utf8',
  )

  const inspection = await inspectWorkspace(targetRoot)

  assert.equal(inspection.hasTrpc, true)
  assert.equal(inspection.serverProvider, 'cloudflare')
})

test('inspectWorkspace rejects roots without a supported packageManager field', async (t) => {
  const targetRoot = await createTempWorkspace(t)

  await mkdir(path.join(targetRoot, 'frontend'), { recursive: true })
  await writeFile(
    path.join(targetRoot, 'package.json'),
    JSON.stringify(
      {
        packageManager: 'unknown@1.0.0',
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

test('inspectWorkspace accepts npm and bun packageManager fields', async (t) => {
  const npmRoot = await createTempWorkspace(t)
  const bunRoot = await createTempWorkspace(t)

  for (const [targetRoot, packageManager] of [
    [npmRoot, getTestPackageManagerField('npm')],
    [bunRoot, getTestPackageManagerField('bun')],
  ] as const) {
    await mkdir(path.join(targetRoot, 'frontend'), { recursive: true })
    await writeFile(
      path.join(targetRoot, 'package.json'),
      JSON.stringify({ packageManager }, null, 2),
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
  }

  const npmInspection = await inspectWorkspace(npmRoot)
  const bunInspection = await inspectWorkspace(bunRoot)

  assert.equal(npmInspection.packageManager, 'npm')
  assert.equal(bunInspection.packageManager, 'bun')
})
