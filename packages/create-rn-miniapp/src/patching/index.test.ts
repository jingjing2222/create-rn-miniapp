import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import {
  patchBackofficeWorkspace,
  patchCloudflareServerWorkspace,
  patchFirebaseServerWorkspace,
  patchFrontendWorkspace,
  patchSupabaseServerWorkspace,
} from './index.js'

async function createTempWorkspace(t: test.TestContext) {
  const targetRoot = await mkdtemp(path.join(os.tmpdir(), 'create-rn-miniapp-patch-'))
  t.after(async () => {
    await rm(targetRoot, { recursive: true, force: true })
  })
  return targetRoot
}

async function writeJson(filePath: string, value: unknown) {
  await mkdir(path.dirname(filePath), { recursive: true })
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

async function pathExists(targetPath: string) {
  try {
    await readFile(targetPath, 'utf8')
    return true
  } catch {
    return false
  }
}

test('patchFrontendWorkspace keeps supabase bootstrap out when no server provider is selected', async (t) => {
  const targetRoot = await createTempWorkspace(t)
  const frontendRoot = path.join(targetRoot, 'frontend')

  await mkdir(path.join(frontendRoot, 'src'), { recursive: true })
  await writeJson(path.join(frontendRoot, 'package.json'), {
    name: 'ebook-miniapp',
    private: true,
    scripts: {
      dev: 'granite dev',
      build: 'ait build',
    },
    dependencies: {
      '@apps-in-toss/framework': '^2.0.5',
    },
    devDependencies: {
      '@granite-js/plugin-hermes': '1.0.7',
      '@granite-js/plugin-router': '1.0.7',
      typescript: '^5.8.3',
    },
  })
  await writeFile(
    path.join(frontendRoot, 'tsconfig.json'),
    [
      '{',
      '  // frontend tsconfig comment',
      '  "compilerOptions": {',
      '    "module": "commonjs",',
      '    "target": "es2020"',
      '  }',
      '}',
      '',
    ].join('\n'),
    'utf8',
  )
  await writeFile(
    path.join(frontendRoot, 'granite.config.ts'),
    [
      "import { appsInToss } from '@apps-in-toss/framework/plugins'",
      "import { defineConfig } from '@granite-js/react-native/config'",
      '',
      'export default defineConfig(',
      '  {',
      '    scheme: "intoss",',
      '    appName: "ebook-miniapp",',
      '    plugins: [',
      '      appsInToss({',
      '        brand: {',
      '          displayName: "전자책 미니앱",',
      '          primaryColor: "#3182F6",',
      '          icon: null,',
      '        },',
      '        permissions: [],',
      '      }),',
      '    ],',
      '  },',
      ')',
      '',
    ].join('\n'),
    'utf8',
  )

  await patchFrontendWorkspace(
    targetRoot,
    {
      appName: 'ebook-miniapp',
      displayName: '전자책 미니앱',
      packageManager: 'pnpm',
      packageManagerCommand: 'pnpm',
      packageManagerRunCommand: 'pnpm',
      packageManagerExecCommand: 'pnpm exec',
      verifyCommand: 'pnpm verify',
    },
    { packageManager: 'pnpm', serverProvider: null },
  )

  const packageJson = JSON.parse(
    await readFile(path.join(frontendRoot, 'package.json'), 'utf8'),
  ) as {
    dependencies?: Record<string, string>
    devDependencies?: Record<string, string>
  }
  const graniteConfig = await readFile(path.join(frontendRoot, 'granite.config.ts'), 'utf8')
  const tsconfigSource = await readFile(path.join(frontendRoot, 'tsconfig.json'), 'utf8')
  const tsconfig = JSON.parse(tsconfigSource) as {
    compilerOptions?: {
      module?: string
      types?: string[]
    }
  }

  assert.equal(packageJson.dependencies?.['@supabase/supabase-js'], undefined)
  assert.equal(packageJson.dependencies?.['@apps-in-toss/framework'], '^2.0.5')
  assert.equal(packageJson.devDependencies?.['@granite-js/plugin-env'], undefined)
  assert.equal(packageJson.devDependencies?.['@granite-js/plugin-router'], '1.0.7')
  assert.equal(packageJson.devDependencies?.typescript, '^5.8.3')
  assert.equal(packageJson.devDependencies?.['@types/node'], '^24.10.1')
  assert.doesNotMatch(graniteConfig, /^\/\/\/ <reference types="node" \/>/)
  assert.match(graniteConfig, /import path from 'node:path';\n\nconst repoRoot = path\.resolve/)
  assert.match(graniteConfig, /const repoRoot = path\.resolve\(__dirname, '\.\.\/\.\.'\)/)
  assert.match(graniteConfig, /watchFolders:\s*\[\s*repoRoot\s*\]/)
  assert.equal(tsconfig.compilerOptions?.module, 'esnext')
  assert.deepEqual(tsconfig.compilerOptions?.types, ['node'])
  assert.doesNotMatch(tsconfigSource, /frontend tsconfig comment/)
  assert.equal(await pathExists(path.join(frontendRoot, '.env.local.example')), false)
  assert.equal(await pathExists(path.join(frontendRoot, 'src', 'lib', 'supabase.ts')), false)
})

test('patchFrontendWorkspace adds supabase bootstrap when supabase server provider is selected', async (t) => {
  const targetRoot = await createTempWorkspace(t)
  const frontendRoot = path.join(targetRoot, 'frontend')

  await mkdir(path.join(frontendRoot, 'src'), { recursive: true })
  await writeJson(path.join(frontendRoot, 'package.json'), {
    name: 'ebook-miniapp',
    private: true,
    scripts: {
      dev: 'granite dev',
      build: 'ait build',
    },
    dependencies: {
      '@apps-in-toss/framework': '^2.0.5',
    },
    devDependencies: {
      '@granite-js/plugin-hermes': '1.0.7',
      '@granite-js/plugin-router': '1.0.7',
      typescript: '^5.8.3',
    },
  })
  await writeFile(
    path.join(frontendRoot, 'tsconfig.json'),
    [
      '{',
      '  "compilerOptions": {',
      '    "module": "commonjs",',
      '    "target": "es2020"',
      '  }',
      '}',
      '',
    ].join('\n'),
    'utf8',
  )
  await writeFile(
    path.join(frontendRoot, 'granite.config.ts'),
    [
      "import { appsInToss } from '@apps-in-toss/framework/plugins'",
      "import { defineConfig } from '@granite-js/react-native/config'",
      '',
      'export default defineConfig(',
      '  {',
      '    scheme: "intoss",',
      '    appName: "ebook-miniapp",',
      '    plugins: [',
      '      appsInToss({',
      '        brand: {',
      '          displayName: "전자책 미니앱",',
      '          primaryColor: "#3182F6",',
      '          icon: null,',
      '        },',
      '        permissions: [],',
      '      }),',
      '    ],',
      '  },',
      ')',
      '',
    ].join('\n'),
    'utf8',
  )

  await patchFrontendWorkspace(
    targetRoot,
    {
      appName: 'ebook-miniapp',
      displayName: '전자책 미니앱',
      packageManager: 'pnpm',
      packageManagerCommand: 'pnpm',
      packageManagerRunCommand: 'pnpm',
      packageManagerExecCommand: 'pnpm exec',
      verifyCommand: 'pnpm verify',
    },
    { packageManager: 'pnpm', serverProvider: 'supabase' },
  )

  const packageJson = JSON.parse(
    await readFile(path.join(frontendRoot, 'package.json'), 'utf8'),
  ) as {
    dependencies?: Record<string, string>
    devDependencies?: Record<string, string>
  }
  const graniteConfig = await readFile(path.join(frontendRoot, 'granite.config.ts'), 'utf8')
  const envTypes = await readFile(path.join(frontendRoot, 'src', 'env.d.ts'), 'utf8')
  const tsconfig = JSON.parse(await readFile(path.join(frontendRoot, 'tsconfig.json'), 'utf8')) as {
    compilerOptions?: {
      module?: string
      types?: string[]
    }
  }
  const supabaseClient = await readFile(
    path.join(frontendRoot, 'src', 'lib', 'supabase.ts'),
    'utf8',
  )

  assert.equal(packageJson.dependencies?.['@supabase/supabase-js'], '^2.57.4')
  assert.equal(packageJson.dependencies?.['@apps-in-toss/framework'], '^2.0.5')
  assert.equal(packageJson.devDependencies?.['@granite-js/plugin-env'], '1.0.7')
  assert.equal(packageJson.devDependencies?.['@granite-js/plugin-router'], '1.0.7')
  assert.equal(packageJson.devDependencies?.typescript, '^5.8.3')
  assert.equal(packageJson.devDependencies?.['@types/node'], '^24.10.1')
  assert.equal(packageJson.devDependencies?.dotenv, '^16.4.7')
  assert.doesNotMatch(graniteConfig, /^\/\/\/ <reference types="node" \/>/)
  assert.match(graniteConfig, /import dotenv from 'dotenv';\n\nconst repoRoot = path\.resolve/)
  assert.match(graniteConfig, /const repoRoot = path\.resolve\(__dirname, '\.\.\/\.\.'\)/)
  assert.match(graniteConfig, /watchFolders:\s*\[\s*repoRoot\s*\]/)
  assert.match(graniteConfig, /import \{ env \} from '@granite-js\/plugin-env'/)
  assert.match(graniteConfig, /import dotenv from 'dotenv'/)
  assert.match(graniteConfig, /const appRoot = __dirname/)
  assert.match(graniteConfig, /const appRoot = __dirname;\n\ndotenv\.config/)
  assert.match(graniteConfig, /path\.join\(appRoot, '\.env'\)/)
  assert.doesNotMatch(graniteConfig, /function resolveOptionalMiniappEnv/)
  assert.match(graniteConfig, /\}\n\nconst miniappSupabaseUrl = resolveMiniappEnv/)
  assert.doesNotMatch(graniteConfig, /function resolveOptionalMiniappEnv\(/)
  assert.match(
    graniteConfig,
    /const miniappSupabasePublishableKey = resolveMiniappEnv\('MINIAPP_SUPABASE_PUBLISHABLE_KEY'\);\n\nexport default defineConfig/,
  )
  assert.match(graniteConfig, /MINIAPP_SUPABASE_URL: miniappSupabaseUrl/)
  assert.equal(tsconfig.compilerOptions?.module, 'esnext')
  assert.deepEqual(tsconfig.compilerOptions?.types, ['node'])
  assert.equal(await pathExists(path.join(frontendRoot, '.env.local.example')), false)
  assert.match(envTypes, /readonly MINIAPP_SUPABASE_URL: string/)
  assert.match(supabaseClient, /createClient/)
  assert.match(supabaseClient, /import\.meta\.env\.MINIAPP_SUPABASE_URL/)
  assert.doesNotMatch(supabaseClient, /process\.env\./)
})

test('patchFrontendWorkspace adds cloudflare API bootstrap when cloudflare server provider is selected', async (t) => {
  const targetRoot = await createTempWorkspace(t)
  const frontendRoot = path.join(targetRoot, 'frontend')

  await mkdir(path.join(frontendRoot, 'src'), { recursive: true })
  await writeJson(path.join(frontendRoot, 'package.json'), {
    name: 'ebook-miniapp',
    private: true,
    scripts: {
      dev: 'granite dev',
      build: 'ait build',
    },
    dependencies: {
      '@apps-in-toss/framework': '^2.0.5',
    },
    devDependencies: {
      '@granite-js/plugin-hermes': '1.0.7',
      '@granite-js/plugin-router': '1.0.7',
      typescript: '^5.8.3',
    },
  })
  await writeFile(
    path.join(frontendRoot, 'tsconfig.json'),
    [
      '{',
      '  "compilerOptions": {',
      '    "module": "commonjs",',
      '    "target": "es2020"',
      '  }',
      '}',
      '',
    ].join('\n'),
    'utf8',
  )
  await writeFile(
    path.join(frontendRoot, 'granite.config.ts'),
    [
      "import { appsInToss } from '@apps-in-toss/framework/plugins'",
      "import { defineConfig } from '@granite-js/react-native/config'",
      '',
      'export default defineConfig(',
      '  {',
      '    scheme: "intoss",',
      '    appName: "ebook-miniapp",',
      '    plugins: [',
      '      appsInToss({',
      '        brand: {',
      '          displayName: "전자책 미니앱",',
      '          primaryColor: "#3182F6",',
      '          icon: null,',
      '        },',
      '        permissions: [],',
      '      }),',
      '    ],',
      '  },',
      ')',
      '',
    ].join('\n'),
    'utf8',
  )

  await patchFrontendWorkspace(
    targetRoot,
    {
      appName: 'ebook-miniapp',
      displayName: '전자책 미니앱',
      packageManager: 'pnpm',
      packageManagerCommand: 'pnpm',
      packageManagerRunCommand: 'pnpm',
      packageManagerExecCommand: 'pnpm exec',
      verifyCommand: 'pnpm verify',
    },
    { packageManager: 'pnpm', serverProvider: 'cloudflare' },
  )

  const packageJson = JSON.parse(
    await readFile(path.join(frontendRoot, 'package.json'), 'utf8'),
  ) as {
    dependencies?: Record<string, string>
    devDependencies?: Record<string, string>
  }
  const graniteConfig = await readFile(path.join(frontendRoot, 'granite.config.ts'), 'utf8')
  const envTypes = await readFile(path.join(frontendRoot, 'src', 'env.d.ts'), 'utf8')
  const apiClient = await readFile(path.join(frontendRoot, 'src', 'lib', 'api.ts'), 'utf8')

  assert.equal(packageJson.dependencies?.['@supabase/supabase-js'], undefined)
  assert.equal(packageJson.devDependencies?.['@granite-js/plugin-env'], '1.0.7')
  assert.equal(packageJson.devDependencies?.dotenv, '^16.4.7')
  assert.doesNotMatch(graniteConfig, /function resolveOptionalMiniappEnv/)
  assert.match(graniteConfig, /MINIAPP_API_BASE_URL: miniappApiBaseUrl/)
  assert.doesNotMatch(graniteConfig, /function resolveOptionalMiniappEnv\(/)
  assert.match(
    graniteConfig,
    /const miniappApiBaseUrl = resolveMiniappEnv\('MINIAPP_API_BASE_URL'\)/,
  )
  assert.match(envTypes, /readonly MINIAPP_API_BASE_URL: string/)
  assert.match(apiClient, /import\.meta\.env\.MINIAPP_API_BASE_URL/)
  assert.match(apiClient, /export async function apiFetch/)
})

test('patchFrontendWorkspace adds cloudflare trpc client when trpc overlay is selected', async (t) => {
  const targetRoot = await createTempWorkspace(t)
  const frontendRoot = path.join(targetRoot, 'frontend')

  await mkdir(path.join(frontendRoot, 'src'), { recursive: true })
  await writeJson(path.join(frontendRoot, 'package.json'), {
    name: 'ebook-miniapp',
    private: true,
    scripts: {
      dev: 'granite dev',
      build: 'ait build',
    },
    dependencies: {
      '@apps-in-toss/framework': '^2.0.5',
    },
    devDependencies: {
      '@granite-js/plugin-hermes': '1.0.7',
      '@granite-js/plugin-router': '1.0.7',
      typescript: '^5.8.3',
    },
  })
  await writeFile(
    path.join(frontendRoot, 'tsconfig.json'),
    ['{', '  "compilerOptions": {', '    "module": "commonjs"', '  }', '}', ''].join('\n'),
    'utf8',
  )
  await writeFile(
    path.join(frontendRoot, 'granite.config.ts'),
    [
      "import { appsInToss } from '@apps-in-toss/framework/plugins'",
      "import { defineConfig } from '@granite-js/react-native/config'",
      '',
      'export default defineConfig({',
      '  appName: "ebook-miniapp",',
      '  plugins: [appsInToss({ brand: { displayName: "전자책 미니앱" } })],',
      '})',
      '',
    ].join('\n'),
    'utf8',
  )

  await patchFrontendWorkspace(
    targetRoot,
    {
      appName: 'ebook-miniapp',
      displayName: '전자책 미니앱',
      packageManager: 'pnpm',
      packageManagerCommand: 'pnpm',
      packageManagerRunCommand: 'pnpm',
      packageManagerExecCommand: 'pnpm exec',
      verifyCommand: 'pnpm verify',
    },
    { packageManager: 'pnpm', serverProvider: 'cloudflare', trpc: true },
  )

  const packageJson = JSON.parse(
    await readFile(path.join(frontendRoot, 'package.json'), 'utf8'),
  ) as {
    dependencies?: Record<string, string>
    devDependencies?: Record<string, string>
  }
  const tsconfig = JSON.parse(await readFile(path.join(frontendRoot, 'tsconfig.json'), 'utf8')) as {
    compilerOptions?: {
      allowImportingTsExtensions?: boolean
      moduleResolution?: string
      noEmit?: boolean
    }
  }
  const trpcClient = await readFile(path.join(frontendRoot, 'src', 'lib', 'trpc.ts'), 'utf8')

  assert.equal(packageJson.dependencies?.['@trpc/client'], '^11.13.4')
  assert.equal(packageJson.devDependencies?.['@workspace/app-router'], 'workspace:*')
  assert.equal(tsconfig.compilerOptions?.allowImportingTsExtensions, true)
  assert.equal(tsconfig.compilerOptions?.moduleResolution, 'bundler')
  assert.equal(tsconfig.compilerOptions?.noEmit, true)
  assert.equal(await pathExists(path.join(frontendRoot, 'src', 'lib', 'api.ts')), false)
  assert.match(trpcClient, /createTRPCProxyClient/)
  assert.match(trpcClient, /import type \{ AppRouter \} from '@workspace\/app-router'/)
  assert.match(trpcClient, /import\.meta\.env\.MINIAPP_API_BASE_URL/)
  assert.doesNotMatch(trpcClient, /from '\.\/api'/)
})

test('patchFrontendWorkspace adds supabase trpc client and ts extension support when trpc overlay is selected', async (t) => {
  const targetRoot = await createTempWorkspace(t)
  const frontendRoot = path.join(targetRoot, 'frontend')

  await mkdir(path.join(frontendRoot, 'src'), { recursive: true })
  await writeJson(path.join(frontendRoot, 'package.json'), {
    name: 'ebook-miniapp',
    private: true,
    scripts: {
      dev: 'granite dev',
      build: 'ait build',
    },
    dependencies: {
      '@apps-in-toss/framework': '^2.0.5',
    },
    devDependencies: {
      '@granite-js/plugin-hermes': '1.0.7',
      '@granite-js/plugin-router': '1.0.7',
      typescript: '^5.8.3',
    },
  })
  await writeFile(
    path.join(frontendRoot, 'tsconfig.json'),
    ['{', '  "compilerOptions": {', '    "module": "commonjs"', '  }', '}', ''].join('\n'),
    'utf8',
  )
  await writeFile(
    path.join(frontendRoot, 'granite.config.ts'),
    [
      "import { appsInToss } from '@apps-in-toss/framework/plugins'",
      "import { defineConfig } from '@granite-js/react-native/config'",
      '',
      'export default defineConfig({',
      '  appName: "ebook-miniapp",',
      '  plugins: [appsInToss({ brand: { displayName: "전자책 미니앱" } })],',
      '})',
      '',
    ].join('\n'),
    'utf8',
  )

  await patchFrontendWorkspace(
    targetRoot,
    {
      appName: 'ebook-miniapp',
      displayName: '전자책 미니앱',
      packageManager: 'pnpm',
      packageManagerCommand: 'pnpm',
      packageManagerRunCommand: 'pnpm',
      packageManagerExecCommand: 'pnpm exec',
      verifyCommand: 'pnpm verify',
    },
    { packageManager: 'pnpm', serverProvider: 'supabase', trpc: true },
  )

  const packageJson = JSON.parse(
    await readFile(path.join(frontendRoot, 'package.json'), 'utf8'),
  ) as {
    dependencies?: Record<string, string>
    devDependencies?: Record<string, string>
  }
  const tsconfig = JSON.parse(await readFile(path.join(frontendRoot, 'tsconfig.json'), 'utf8')) as {
    compilerOptions?: {
      allowImportingTsExtensions?: boolean
      moduleResolution?: string
      noEmit?: boolean
    }
  }
  const trpcClient = await readFile(path.join(frontendRoot, 'src', 'lib', 'trpc.ts'), 'utf8')

  assert.equal(packageJson.dependencies?.['@trpc/client'], '^11.13.4')
  assert.equal(packageJson.devDependencies?.['@workspace/app-router'], 'workspace:*')
  assert.equal(tsconfig.compilerOptions?.allowImportingTsExtensions, true)
  assert.equal(tsconfig.compilerOptions?.moduleResolution, 'bundler')
  assert.equal(tsconfig.compilerOptions?.noEmit, true)
  assert.match(trpcClient, /createTRPCProxyClient/)
  assert.match(trpcClient, /import type \{ AppRouter \} from '@workspace\/app-router'/)
  assert.match(trpcClient, /functions\/v1\/api\/trpc/)
  assert.match(trpcClient, /supabase\.auth\.getSession/)
})

test('patchFrontendWorkspace removes existing cloudflare api helper when trpc cleanup is requested', async (t) => {
  const targetRoot = await createTempWorkspace(t)
  const frontendRoot = path.join(targetRoot, 'frontend')

  await mkdir(path.join(frontendRoot, 'src', 'lib'), { recursive: true })
  await writeJson(path.join(frontendRoot, 'package.json'), {
    name: 'ebook-miniapp',
    private: true,
    scripts: {
      dev: 'granite dev',
      build: 'ait build',
    },
    dependencies: {
      '@apps-in-toss/framework': '^2.0.5',
    },
    devDependencies: {
      '@granite-js/plugin-hermes': '1.0.7',
      '@granite-js/plugin-router': '1.0.7',
      typescript: '^5.8.3',
    },
  })
  await writeFile(
    path.join(frontendRoot, 'tsconfig.json'),
    ['{', '  "compilerOptions": {', '    "module": "commonjs"', '  }', '}', ''].join('\n'),
    'utf8',
  )
  await writeFile(
    path.join(frontendRoot, 'granite.config.ts'),
    [
      "import { appsInToss } from '@apps-in-toss/framework/plugins'",
      "import { defineConfig } from '@granite-js/react-native/config'",
      '',
      'export default defineConfig({',
      '  appName: "ebook-miniapp",',
      '  plugins: [appsInToss({ brand: { displayName: "전자책 미니앱" } })],',
      '})',
      '',
    ].join('\n'),
    'utf8',
  )
  await writeFile(
    path.join(frontendRoot, 'src', 'lib', 'api.ts'),
    'export function apiFetch() { return Promise.resolve(null) }\n',
    'utf8',
  )

  await patchFrontendWorkspace(
    targetRoot,
    {
      appName: 'ebook-miniapp',
      displayName: '전자책 미니앱',
      packageManager: 'pnpm',
      packageManagerCommand: 'pnpm',
      packageManagerRunCommand: 'pnpm',
      packageManagerExecCommand: 'pnpm exec',
      verifyCommand: 'pnpm verify',
    },
    {
      packageManager: 'pnpm',
      serverProvider: 'cloudflare',
      trpc: true,
      removeCloudflareApiClientHelpers: true,
    },
  )

  assert.equal(await pathExists(path.join(frontendRoot, 'src', 'lib', 'api.ts')), false)
})

test('patchFrontendWorkspace adds firebase bootstrap when firebase server provider is selected', async (t) => {
  const targetRoot = await createTempWorkspace(t)
  const frontendRoot = path.join(targetRoot, 'frontend')

  await mkdir(path.join(frontendRoot, 'src'), { recursive: true })
  await writeJson(path.join(frontendRoot, 'package.json'), {
    name: 'ebook-miniapp',
    private: true,
    scripts: {
      dev: 'granite dev',
      build: 'ait build',
    },
    dependencies: {
      '@apps-in-toss/framework': '^2.0.5',
    },
    devDependencies: {
      '@granite-js/plugin-hermes': '1.0.7',
      '@granite-js/plugin-router': '1.0.7',
      typescript: '^5.8.3',
    },
  })
  await writeFile(
    path.join(frontendRoot, 'tsconfig.json'),
    ['{', '  "compilerOptions": {', '    "module": "commonjs"', '  }', '}', ''].join('\n'),
    'utf8',
  )
  await writeFile(
    path.join(frontendRoot, 'granite.config.ts'),
    [
      "import { appsInToss } from '@apps-in-toss/framework/plugins'",
      "import { defineConfig } from '@granite-js/react-native/config'",
      '',
      'export default defineConfig({',
      '  appName: "ebook-miniapp",',
      '  plugins: [appsInToss({ brand: { displayName: "전자책 미니앱" } })],',
      '})',
      '',
    ].join('\n'),
    'utf8',
  )

  await patchFrontendWorkspace(
    targetRoot,
    {
      appName: 'ebook-miniapp',
      displayName: '전자책 미니앱',
      packageManager: 'pnpm',
      packageManagerCommand: 'pnpm',
      packageManagerRunCommand: 'pnpm',
      packageManagerExecCommand: 'pnpm exec',
      verifyCommand: 'pnpm verify',
    },
    { packageManager: 'pnpm', serverProvider: 'firebase' },
  )

  const packageJson = JSON.parse(
    await readFile(path.join(frontendRoot, 'package.json'), 'utf8'),
  ) as {
    dependencies?: Record<string, string>
    devDependencies?: Record<string, string>
  }
  const graniteConfig = await readFile(path.join(frontendRoot, 'granite.config.ts'), 'utf8')
  const envTypes = await readFile(path.join(frontendRoot, 'src', 'env.d.ts'), 'utf8')
  const firebaseClient = await readFile(
    path.join(frontendRoot, 'src', 'lib', 'firebase.ts'),
    'utf8',
  )
  const firestoreClient = await readFile(
    path.join(frontendRoot, 'src', 'lib', 'firestore.ts'),
    'utf8',
  )
  const storageClient = await readFile(path.join(frontendRoot, 'src', 'lib', 'storage.ts'), 'utf8')

  assert.equal(packageJson.dependencies?.firebase, '^12.10.0')
  assert.equal(packageJson.devDependencies?.['@granite-js/plugin-env'], '1.0.7')
  assert.equal(packageJson.devDependencies?.dotenv, '^16.4.7')
  assert.match(graniteConfig, /MINIAPP_FIREBASE_API_KEY: miniappFirebaseApiKey/)
  assert.match(graniteConfig, /function resolveOptionalMiniappEnv\(/)
  assert.match(
    graniteConfig,
    /const miniappFirebaseMeasurementId = resolveOptionalMiniappEnv\('MINIAPP_FIREBASE_MEASUREMENT_ID'\)/,
  )
  assert.match(envTypes, /readonly MINIAPP_FIREBASE_STORAGE_BUCKET: string/)
  assert.match(firebaseClient, /initializeApp/)
  assert.match(firebaseClient, /import\.meta\.env\.MINIAPP_FIREBASE_PROJECT_ID/)
  assert.match(firestoreClient, /getFirestore/)
  assert.match(storageClient, /getStorage/)
})

test('patchBackofficeWorkspace adds supabase bootstrap when supabase server provider is selected', async (t) => {
  const targetRoot = await createTempWorkspace(t)
  const backofficeRoot = path.join(targetRoot, 'backoffice')

  await mkdir(path.join(backofficeRoot, 'src'), { recursive: true })
  await writeJson(path.join(backofficeRoot, 'package.json'), {
    name: 'backoffice',
    private: true,
    version: '0.0.0',
    type: 'module',
    scripts: {
      dev: 'vite',
      build: 'tsc -b && vite build',
      test: 'vitest',
    },
    dependencies: {
      react: '^19.2.4',
      'react-dom': '^19.2.4',
    },
    devDependencies: {
      vite: '^8.0.0',
      typescript: '~5.9.3',
    },
  })
  await writeJson(path.join(backofficeRoot, 'tsconfig.json'), {
    compilerOptions: {
      module: 'commonjs',
    },
    files: [],
    references: [{ path: './tsconfig.app.json' }, { path: './tsconfig.node.json' }],
  })
  await writeFile(
    path.join(backofficeRoot, 'tsconfig.app.json'),
    [
      '{',
      '  "compilerOptions": {',
      '    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.app.tsbuildinfo",',
      '    "target": "ES2022",',
      '    "useDefineForClassFields": true,',
      '    "lib": ["ES2022", "DOM", "DOM.Iterable"],',
      '    "module": "commonjs",',
      '    "skipLibCheck": true,',
      '',
      '    /* Bundler mode */',
      '    "moduleResolution": "bundler",',
      '    "allowImportingTsExtensions": true,',
      '    "verbatimModuleSyntax": true,',
      '    "moduleDetection": "force",',
      '    "noEmit": true,',
      '    "jsx": "react-jsx"',
      '  },',
      '  "include": ["src"]',
      '}',
      '',
    ].join('\n'),
    'utf8',
  )
  await writeJson(path.join(backofficeRoot, 'tsconfig.node.json'), {
    compilerOptions: {
      composite: true,
      module: 'commonjs',
    },
    include: ['vite.config.ts'],
  })
  await writeFile(
    path.join(backofficeRoot, 'src', 'main.tsx'),
    [
      "import { StrictMode } from 'react'",
      "import { createRoot } from 'react-dom/client'",
      "import './index.css'",
      "import App from './App.tsx'",
      '',
      'createRoot(document.getElementById("root")!).render(',
      '  <StrictMode>',
      '    <App />',
      '  </StrictMode>,',
      ')',
      '',
    ].join('\n'),
    'utf8',
  )
  await writeFile(
    path.join(backofficeRoot, 'src', 'App.tsx'),
    [
      'export default function App() {',
      '  return (',
      "    <button data-kind='counter' className='counter'>count is 0</button>",
      '  )',
      '}',
      '',
    ].join('\n'),
    'utf8',
  )

  await patchBackofficeWorkspace(
    targetRoot,
    {
      appName: 'ebook-miniapp',
      displayName: '전자책 미니앱',
      packageManager: 'pnpm',
      packageManagerCommand: 'pnpm',
      packageManagerRunCommand: 'pnpm',
      packageManagerExecCommand: 'pnpm exec',
      verifyCommand: 'pnpm verify',
    },
    { packageManager: 'pnpm', serverProvider: 'supabase' },
  )

  const packageJson = JSON.parse(
    await readFile(path.join(backofficeRoot, 'package.json'), 'utf8'),
  ) as {
    scripts?: Record<string, string>
    dependencies?: Record<string, string>
  }
  const envTypes = await readFile(path.join(backofficeRoot, 'src', 'vite-env.d.ts'), 'utf8')
  const mainSource = await readFile(path.join(backofficeRoot, 'src', 'main.tsx'), 'utf8')
  const appSource = await readFile(path.join(backofficeRoot, 'src', 'App.tsx'), 'utf8')
  const tsconfigSource = await readFile(path.join(backofficeRoot, 'tsconfig.json'), 'utf8')
  const tsconfigAppSource = await readFile(path.join(backofficeRoot, 'tsconfig.app.json'), 'utf8')
  const tsconfigNodeSource = await readFile(path.join(backofficeRoot, 'tsconfig.node.json'), 'utf8')
  const supabaseClient = await readFile(
    path.join(backofficeRoot, 'src', 'lib', 'supabase.ts'),
    'utf8',
  )

  assert.equal(packageJson.scripts?.dev, 'vite')
  assert.equal(packageJson.scripts?.build, 'tsc -b && vite build')
  assert.equal(packageJson.scripts?.typecheck, 'tsc -b --pretty false')
  assert.equal(packageJson.scripts?.test, 'vitest run')
  assert.equal(packageJson.dependencies?.['@supabase/supabase-js'], '^2.57.4')
  assert.equal(await pathExists(path.join(backofficeRoot, '.env.local.example')), false)
  assert.match(envTypes, /readonly VITE_SUPABASE_URL: string/)
  assert.match(tsconfigSource, /"module": "esnext"/)
  assert.match(tsconfigAppSource, /"module": "esnext"/)
  assert.match(tsconfigNodeSource, /"module": "esnext"/)
  assert.doesNotMatch(tsconfigAppSource, /Bundler mode/)
  assert.match(mainSource, /const rootElement = document\.getElementById\('root'\)/)
  assert.match(mainSource, /throw new Error\('Root element not found'\)/)
  assert.match(appSource, /type=["']button["']/)
  assert.match(supabaseClient, /createClient/)
  assert.match(supabaseClient, /import\.meta\.env\.VITE_SUPABASE_URL/)
})

test('patchBackofficeWorkspace adds cloudflare API bootstrap when cloudflare server provider is selected', async (t) => {
  const targetRoot = await createTempWorkspace(t)
  const backofficeRoot = path.join(targetRoot, 'backoffice')

  await mkdir(path.join(backofficeRoot, 'src'), { recursive: true })
  await writeJson(path.join(backofficeRoot, 'package.json'), {
    name: 'backoffice',
    private: true,
    version: '0.0.0',
    type: 'module',
    scripts: {
      dev: 'vite',
      build: 'tsc -b && vite build',
    },
    dependencies: {
      react: '^19.2.4',
      'react-dom': '^19.2.4',
    },
    devDependencies: {
      vite: '^8.0.0',
      typescript: '~5.9.3',
    },
  })
  await writeJson(path.join(backofficeRoot, 'tsconfig.json'), {
    compilerOptions: {
      module: 'commonjs',
    },
    files: [],
    references: [{ path: './tsconfig.app.json' }, { path: './tsconfig.node.json' }],
  })
  await writeJson(path.join(backofficeRoot, 'tsconfig.app.json'), {
    compilerOptions: {
      module: 'commonjs',
    },
    include: ['src'],
  })
  await writeJson(path.join(backofficeRoot, 'tsconfig.node.json'), {
    compilerOptions: {
      composite: true,
      module: 'commonjs',
    },
    include: ['vite.config.ts'],
  })
  await writeFile(
    path.join(backofficeRoot, 'src', 'main.tsx'),
    [
      "import { StrictMode } from 'react'",
      "import { createRoot } from 'react-dom/client'",
      "import './index.css'",
      "import App from './App.tsx'",
      '',
      'createRoot(document.getElementById("root")!).render(',
      '  <StrictMode>',
      '    <App />',
      '  </StrictMode>,',
      ')',
      '',
    ].join('\n'),
    'utf8',
  )
  await writeFile(
    path.join(backofficeRoot, 'src', 'App.tsx'),
    [
      'export default function App() {',
      '  return (',
      "    <button data-kind='counter' className='counter'>count is 0</button>",
      '  )',
      '}',
      '',
    ].join('\n'),
    'utf8',
  )

  await patchBackofficeWorkspace(
    targetRoot,
    {
      appName: 'ebook-miniapp',
      displayName: '전자책 미니앱',
      packageManager: 'pnpm',
      packageManagerCommand: 'pnpm',
      packageManagerRunCommand: 'pnpm',
      packageManagerExecCommand: 'pnpm exec',
      verifyCommand: 'pnpm verify',
    },
    { packageManager: 'pnpm', serverProvider: 'cloudflare' },
  )

  const packageJson = JSON.parse(
    await readFile(path.join(backofficeRoot, 'package.json'), 'utf8'),
  ) as {
    dependencies?: Record<string, string>
  }
  const envTypes = await readFile(path.join(backofficeRoot, 'src', 'vite-env.d.ts'), 'utf8')
  const apiClient = await readFile(path.join(backofficeRoot, 'src', 'lib', 'api.ts'), 'utf8')

  assert.equal(packageJson.dependencies?.['@supabase/supabase-js'], undefined)
  assert.match(envTypes, /readonly VITE_API_BASE_URL: string/)
  assert.match(apiClient, /import\.meta\.env\.VITE_API_BASE_URL/)
  assert.match(apiClient, /export async function apiFetch/)
})

test('patchBackofficeWorkspace adds firebase bootstrap when firebase server provider is selected', async (t) => {
  const targetRoot = await createTempWorkspace(t)
  const backofficeRoot = path.join(targetRoot, 'backoffice')

  await mkdir(path.join(backofficeRoot, 'src'), { recursive: true })
  await writeJson(path.join(backofficeRoot, 'package.json'), {
    name: 'backoffice',
    private: true,
    version: '0.0.0',
    type: 'module',
    scripts: {
      dev: 'vite',
      build: 'tsc -b && vite build',
    },
    dependencies: {
      react: '^19.2.4',
      'react-dom': '^19.2.4',
    },
    devDependencies: {
      vite: '^8.0.0',
      typescript: '~5.9.3',
    },
  })
  await writeJson(path.join(backofficeRoot, 'tsconfig.json'), {
    compilerOptions: {
      module: 'commonjs',
    },
    files: [],
    references: [{ path: './tsconfig.app.json' }, { path: './tsconfig.node.json' }],
  })
  await writeJson(path.join(backofficeRoot, 'tsconfig.app.json'), {
    compilerOptions: {
      module: 'commonjs',
    },
    include: ['src'],
  })
  await writeJson(path.join(backofficeRoot, 'tsconfig.node.json'), {
    compilerOptions: {
      composite: true,
      module: 'commonjs',
    },
    include: ['vite.config.ts'],
  })
  await writeFile(
    path.join(backofficeRoot, 'src', 'main.tsx'),
    [
      "import { StrictMode } from 'react'",
      "import { createRoot } from 'react-dom/client'",
      "import './index.css'",
      "import App from './App.tsx'",
      '',
      'createRoot(document.getElementById("root")!).render(',
      '  <StrictMode>',
      '    <App />',
      '  </StrictMode>,',
      ')',
      '',
    ].join('\n'),
    'utf8',
  )
  await writeFile(
    path.join(backofficeRoot, 'src', 'App.tsx'),
    [
      'export default function App() {',
      '  return (',
      "    <button data-kind='counter' className='counter'>count is 0</button>",
      '  )',
      '}',
      '',
    ].join('\n'),
    'utf8',
  )

  await patchBackofficeWorkspace(
    targetRoot,
    {
      appName: 'ebook-miniapp',
      displayName: '전자책 미니앱',
      packageManager: 'pnpm',
      packageManagerCommand: 'pnpm',
      packageManagerRunCommand: 'pnpm',
      packageManagerExecCommand: 'pnpm exec',
      verifyCommand: 'pnpm verify',
    },
    { packageManager: 'pnpm', serverProvider: 'firebase' },
  )

  const packageJson = JSON.parse(
    await readFile(path.join(backofficeRoot, 'package.json'), 'utf8'),
  ) as {
    dependencies?: Record<string, string>
  }
  const envTypes = await readFile(path.join(backofficeRoot, 'src', 'vite-env.d.ts'), 'utf8')
  const firebaseClient = await readFile(
    path.join(backofficeRoot, 'src', 'lib', 'firebase.ts'),
    'utf8',
  )
  const firestoreClient = await readFile(
    path.join(backofficeRoot, 'src', 'lib', 'firestore.ts'),
    'utf8',
  )
  const storageClient = await readFile(
    path.join(backofficeRoot, 'src', 'lib', 'storage.ts'),
    'utf8',
  )

  assert.equal(packageJson.dependencies?.firebase, '^12.10.0')
  assert.match(envTypes, /readonly VITE_FIREBASE_STORAGE_BUCKET: string/)
  assert.match(firebaseClient, /initializeApp/)
  assert.match(firebaseClient, /import\.meta\.env\.VITE_FIREBASE_PROJECT_ID/)
  assert.match(firestoreClient, /getFirestore/)
  assert.match(storageClient, /getStorage/)
})

test('patchBackofficeWorkspace adds supabase trpc client when trpc overlay is selected', async (t) => {
  const targetRoot = await createTempWorkspace(t)
  const backofficeRoot = path.join(targetRoot, 'backoffice')

  await mkdir(path.join(backofficeRoot, 'src'), { recursive: true })
  await writeJson(path.join(backofficeRoot, 'package.json'), {
    name: 'backoffice',
    private: true,
    version: '0.0.0',
    type: 'module',
    scripts: {
      dev: 'vite',
      build: 'tsc -b && vite build',
    },
    dependencies: {
      react: '^19.2.4',
      'react-dom': '^19.2.4',
      '@supabase/supabase-js': '^2.57.4',
    },
    devDependencies: {
      vite: '^8.0.0',
      typescript: '~5.9.3',
    },
  })
  await writeJson(path.join(backofficeRoot, 'tsconfig.json'), {
    compilerOptions: { module: 'commonjs' },
    files: [],
    references: [{ path: './tsconfig.app.json' }, { path: './tsconfig.node.json' }],
  })
  await writeJson(path.join(backofficeRoot, 'tsconfig.app.json'), {
    compilerOptions: { module: 'commonjs' },
    include: ['src'],
  })
  await writeJson(path.join(backofficeRoot, 'tsconfig.node.json'), {
    compilerOptions: { composite: true, module: 'commonjs' },
    include: ['vite.config.ts'],
  })
  await writeFile(
    path.join(backofficeRoot, 'src', 'main.tsx'),
    [
      "import { StrictMode } from 'react'",
      "import { createRoot } from 'react-dom/client'",
      "import App from './App.tsx'",
      '',
      "createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)",
      '',
    ].join('\n'),
    'utf8',
  )
  await writeFile(
    path.join(backofficeRoot, 'src', 'App.tsx'),
    'export default function App() { return null }\n',
    'utf8',
  )

  await patchBackofficeWorkspace(
    targetRoot,
    {
      appName: 'ebook-miniapp',
      displayName: '전자책 미니앱',
      packageManager: 'pnpm',
      packageManagerCommand: 'pnpm',
      packageManagerRunCommand: 'pnpm',
      packageManagerExecCommand: 'pnpm exec',
      verifyCommand: 'pnpm verify',
    },
    { packageManager: 'pnpm', serverProvider: 'supabase', trpc: true },
  )

  const packageJson = JSON.parse(
    await readFile(path.join(backofficeRoot, 'package.json'), 'utf8'),
  ) as {
    dependencies?: Record<string, string>
    devDependencies?: Record<string, string>
  }
  const trpcClient = await readFile(path.join(backofficeRoot, 'src', 'lib', 'trpc.ts'), 'utf8')

  assert.equal(packageJson.dependencies?.['@trpc/client'], '^11.13.4')
  assert.equal(packageJson.devDependencies?.['@workspace/app-router'], 'workspace:*')
  assert.match(trpcClient, /createTRPCProxyClient/)
  assert.match(trpcClient, /import type \{ AppRouter \} from '@workspace\/app-router'/)
  assert.match(trpcClient, /Authorization/)
  assert.match(trpcClient, /functions\/v1\/api\/trpc/)
})

test('patchBackofficeWorkspace adds cloudflare trpc client without api helper when trpc overlay is selected', async (t) => {
  const targetRoot = await createTempWorkspace(t)
  const backofficeRoot = path.join(targetRoot, 'backoffice')

  await mkdir(path.join(backofficeRoot, 'src'), { recursive: true })
  await writeJson(path.join(backofficeRoot, 'package.json'), {
    name: 'backoffice',
    private: true,
    version: '0.0.0',
    type: 'module',
    scripts: {
      dev: 'vite',
      build: 'tsc -b && vite build',
    },
    dependencies: {
      react: '^19.2.4',
      'react-dom': '^19.2.4',
    },
    devDependencies: {
      vite: '^8.0.0',
      typescript: '~5.9.3',
    },
  })
  await writeJson(path.join(backofficeRoot, 'tsconfig.json'), {
    compilerOptions: { module: 'commonjs' },
    files: [],
    references: [{ path: './tsconfig.app.json' }, { path: './tsconfig.node.json' }],
  })
  await writeJson(path.join(backofficeRoot, 'tsconfig.app.json'), {
    compilerOptions: { module: 'commonjs' },
    include: ['src'],
  })
  await writeJson(path.join(backofficeRoot, 'tsconfig.node.json'), {
    compilerOptions: { composite: true, module: 'commonjs' },
    include: ['vite.config.ts'],
  })
  await writeFile(
    path.join(backofficeRoot, 'src', 'main.tsx'),
    [
      "import { StrictMode } from 'react'",
      "import { createRoot } from 'react-dom/client'",
      "import App from './App.tsx'",
      '',
      "createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)",
      '',
    ].join('\n'),
    'utf8',
  )
  await writeFile(
    path.join(backofficeRoot, 'src', 'App.tsx'),
    'export default function App() { return null }\n',
    'utf8',
  )

  await patchBackofficeWorkspace(
    targetRoot,
    {
      appName: 'ebook-miniapp',
      displayName: '전자책 미니앱',
      packageManager: 'pnpm',
      packageManagerCommand: 'pnpm',
      packageManagerRunCommand: 'pnpm',
      packageManagerExecCommand: 'pnpm exec',
      verifyCommand: 'pnpm verify',
    },
    { packageManager: 'pnpm', serverProvider: 'cloudflare', trpc: true },
  )

  const packageJson = JSON.parse(
    await readFile(path.join(backofficeRoot, 'package.json'), 'utf8'),
  ) as {
    dependencies?: Record<string, string>
    devDependencies?: Record<string, string>
  }
  const trpcClient = await readFile(path.join(backofficeRoot, 'src', 'lib', 'trpc.ts'), 'utf8')

  assert.equal(packageJson.dependencies?.['@trpc/client'], '^11.13.4')
  assert.equal(packageJson.devDependencies?.['@workspace/app-router'], 'workspace:*')
  assert.equal(await pathExists(path.join(backofficeRoot, 'src', 'lib', 'api.ts')), false)
  assert.match(trpcClient, /createTRPCProxyClient/)
  assert.match(trpcClient, /import type \{ AppRouter \} from '@workspace\/app-router'/)
  assert.match(trpcClient, /import\.meta\.env\.VITE_API_BASE_URL/)
  assert.doesNotMatch(trpcClient, /from '\.\/api'/)
})

test('patchBackofficeWorkspace removes existing cloudflare api helper when trpc cleanup is requested', async (t) => {
  const targetRoot = await createTempWorkspace(t)
  const backofficeRoot = path.join(targetRoot, 'backoffice')

  await mkdir(path.join(backofficeRoot, 'src', 'lib'), { recursive: true })
  await writeJson(path.join(backofficeRoot, 'package.json'), {
    name: 'backoffice',
    private: true,
    version: '0.0.0',
    type: 'module',
    scripts: {
      dev: 'vite',
      build: 'tsc -b && vite build',
    },
    dependencies: {
      react: '^19.2.4',
      'react-dom': '^19.2.4',
    },
    devDependencies: {
      vite: '^8.0.0',
      typescript: '~5.9.3',
    },
  })
  await writeJson(path.join(backofficeRoot, 'tsconfig.json'), {
    compilerOptions: { module: 'commonjs' },
    files: [],
    references: [{ path: './tsconfig.app.json' }, { path: './tsconfig.node.json' }],
  })
  await writeJson(path.join(backofficeRoot, 'tsconfig.app.json'), {
    compilerOptions: { module: 'commonjs' },
    include: ['src'],
  })
  await writeJson(path.join(backofficeRoot, 'tsconfig.node.json'), {
    compilerOptions: { composite: true, module: 'commonjs' },
    include: ['vite.config.ts'],
  })
  await writeFile(
    path.join(backofficeRoot, 'src', 'main.tsx'),
    [
      "import { StrictMode } from 'react'",
      "import { createRoot } from 'react-dom/client'",
      "import App from './App.tsx'",
      '',
      "createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)",
      '',
    ].join('\n'),
    'utf8',
  )
  await writeFile(
    path.join(backofficeRoot, 'src', 'App.tsx'),
    'export default function App() { return null }\n',
    'utf8',
  )
  await writeFile(
    path.join(backofficeRoot, 'src', 'lib', 'api.ts'),
    'export function apiFetch() { return Promise.resolve(null) }\n',
    'utf8',
  )

  await patchBackofficeWorkspace(
    targetRoot,
    {
      appName: 'ebook-miniapp',
      displayName: '전자책 미니앱',
      packageManager: 'pnpm',
      packageManagerCommand: 'pnpm',
      packageManagerRunCommand: 'pnpm',
      packageManagerExecCommand: 'pnpm exec',
      verifyCommand: 'pnpm verify',
    },
    {
      packageManager: 'pnpm',
      serverProvider: 'cloudflare',
      trpc: true,
      removeCloudflareApiClientHelpers: true,
    },
  )

  assert.equal(await pathExists(path.join(backofficeRoot, 'src', 'lib', 'api.ts')), false)
})

test('patchCloudflareServerWorkspace keeps worker scripts and removes local tooling files', async (t) => {
  const targetRoot = await createTempWorkspace(t)
  const serverRoot = path.join(targetRoot, 'server')
  const tokenGuideImageSourcePath = path.join(
    targetRoot,
    'fixtures',
    'cloudflare-api-token-guide.png',
  )

  await mkdir(path.join(serverRoot, '.vscode'), { recursive: true })
  await mkdir(path.join(serverRoot, 'src'), { recursive: true })
  await mkdir(path.dirname(tokenGuideImageSourcePath), { recursive: true })
  await writeJson(path.join(serverRoot, 'package.json'), {
    name: 'my-worker',
    private: true,
    scripts: {
      deploy: 'wrangler deploy',
      dev: 'wrangler dev',
      start: 'wrangler dev',
      test: 'vitest',
      'cf-typegen': 'wrangler types',
    },
    devDependencies: {
      wrangler: '^4.73.0',
      vitest: '~3.2.0',
      typescript: '^5.5.2',
    },
  })
  await writeFile(path.join(serverRoot, '.gitignore'), '.wrangler\n', 'utf8')
  await writeFile(path.join(serverRoot, '.prettierrc'), '{}\n', 'utf8')
  await writeFile(path.join(serverRoot, '.editorconfig'), 'root = true\n', 'utf8')
  await writeFile(path.join(serverRoot, 'AGENTS.md'), '# local agent\n', 'utf8')
  await writeFile(path.join(serverRoot, '.vscode', 'settings.json'), '{}\n', 'utf8')
  await writeFile(
    path.join(targetRoot, '.gitignore'),
    ['node_modules', 'dist', 'coverage', '.nx', '.DS_Store', '.env', '.env.local', ''].join('\n'),
    'utf8',
  )
  await writeFile(
    path.join(targetRoot, 'biome.json'),
    `${JSON.stringify(
      {
        $schema: 'https://biomejs.dev/schemas/2.4.7/schema.json',
        files: {
          includes: ['**', '!!**/.nx', '!!**/node_modules', '!!**/dist'],
        },
      },
      null,
      2,
    )}\n`,
    'utf8',
  )
  await writeFile(
    path.join(serverRoot, 'wrangler.jsonc'),
    '{\n  "$schema": "node_modules/wrangler/config-schema.json",\n  "name": "server"\n}\n',
    'utf8',
  )
  await writeFile(tokenGuideImageSourcePath, 'fake-image', 'utf8')

  await patchCloudflareServerWorkspace(
    targetRoot,
    {
      appName: 'ebook-miniapp',
      displayName: '전자책 미니앱',
      packageManager: 'pnpm',
      packageManagerCommand: 'pnpm',
      packageManagerRunCommand: 'pnpm',
      packageManagerExecCommand: 'pnpm exec',
      verifyCommand: 'pnpm verify',
    },
    { packageManager: 'pnpm', tokenGuideImageSourcePath },
  )

  const packageJson = JSON.parse(await readFile(path.join(serverRoot, 'package.json'), 'utf8')) as {
    name?: string
    scripts?: Record<string, string>
  }
  const projectJson = JSON.parse(await readFile(path.join(serverRoot, 'project.json'), 'utf8')) as {
    targets?: Record<string, { command?: string }>
  }
  const wranglerConfig = JSON.parse(
    await readFile(path.join(serverRoot, 'wrangler.jsonc'), 'utf8'),
  ) as {
    $schema?: string
  }
  const rootGitignore = await readFile(path.join(targetRoot, '.gitignore'), 'utf8')
  const rootBiome = JSON.parse(await readFile(path.join(targetRoot, 'biome.json'), 'utf8')) as {
    files?: {
      includes?: string[]
    }
  }
  const readme = await readFile(path.join(serverRoot, 'README.md'), 'utf8')
  const deployScript = await readFile(
    path.join(serverRoot, 'scripts', 'cloudflare-deploy.mjs'),
    'utf8',
  )
  const copiedTokenGuide = path.join(serverRoot, 'assets', 'cloudflare-api-token-guide.png')

  assert.equal(packageJson.name, 'server')
  assert.equal(packageJson.scripts?.dev, 'wrangler dev')
  assert.equal(packageJson.scripts?.build, 'wrangler deploy --dry-run')
  assert.equal(packageJson.scripts?.typecheck, 'wrangler types && tsc --noEmit')
  assert.equal(packageJson.scripts?.deploy, 'node ./scripts/cloudflare-deploy.mjs')
  assert.equal(packageJson.scripts?.['deploy:remote'], undefined)
  assert.equal(packageJson.scripts?.test, 'vitest run')
  assert.equal(wranglerConfig.$schema, 'https://unpkg.com/wrangler@4.73.0/config-schema.json')
  assert.equal(projectJson.targets?.build?.command, 'pnpm --dir server build')
  assert.equal(projectJson.targets?.typecheck?.command, 'pnpm --dir server typecheck')
  assert.match(rootGitignore, /^server\/worker-configuration\.d\.ts$/m)
  assert.deepEqual(rootBiome.files?.includes, [
    '**',
    '!!**/.nx',
    '!!**/node_modules',
    '!!**/dist',
    '!!**/server/worker-configuration.d.ts',
  ])
  assert.match(readme, /^# server$/m)
  assert.match(readme, /Cloudflare Worker/)
  assert.match(readme, /D1/)
  assert.match(readme, /R2/)
  assert.match(readme, /wrangler\.jsonc/)
  assert.match(readme, /worker-configuration\.d\.ts/)
  assert.match(readme, /cd server && pnpm deploy/)
  assert.match(readme, /frontend\/\.env\.local/)
  assert.match(readme, /MINIAPP_API_BASE_URL/)
  assert.match(readme, /backoffice\/\.env\.local/)
  assert.match(readme, /VITE_API_BASE_URL/)
  assert.match(readme, /## Cloudflare API token/)
  assert.match(readme, /CLOUDFLARE_API_TOKEN=/)
  assert.match(readme, /Workers Scripts > Write/)
  assert.match(readme, /Workers R2 Storage > Write/)
  assert.match(readme, /D1 > Write/)
  assert.match(readme, /dash\.cloudflare\.com\/profile\/api-tokens/)
  assert.match(
    readme,
    /!\[Cloudflare API token 발급 화면\]\(\.\/assets\/cloudflare-api-token-guide\.png\)/,
  )
  assert.match(deployScript, /CLOUDFLARE_API_TOKEN/)
  assert.match(deployScript, /CLOUDFLARE_ACCOUNT_ID/)
  assert.equal(await pathExists(copiedTokenGuide), true)
  assert.equal(await pathExists(path.join(serverRoot, '.gitignore')), false)
  assert.equal(await pathExists(path.join(serverRoot, '.prettierrc')), false)
  assert.equal(await pathExists(path.join(serverRoot, '.editorconfig')), false)
  assert.equal(await pathExists(path.join(serverRoot, 'AGENTS.md')), false)
  assert.equal(await pathExists(path.join(serverRoot, '.vscode', 'settings.json')), false)
})

test('patchCloudflareServerWorkspace wires local worker test config and handler when trpc overlay is selected', async (t) => {
  const targetRoot = await createTempWorkspace(t)
  const serverRoot = path.join(targetRoot, 'server')

  await mkdir(path.join(serverRoot, 'src'), { recursive: true })
  await writeJson(path.join(serverRoot, 'package.json'), {
    name: 'my-worker',
    private: true,
    scripts: {
      dev: 'wrangler dev',
      deploy: 'wrangler deploy',
      test: 'vitest',
    },
    dependencies: {},
    devDependencies: {
      wrangler: '^4.73.0',
      vitest: '~3.2.0',
      typescript: '^5.5.2',
    },
  })
  await writeFile(
    path.join(serverRoot, 'wrangler.jsonc'),
    '{\n  "$schema": "node_modules/wrangler/config-schema.json",\n  "name": "server"\n}\n',
    'utf8',
  )

  await patchCloudflareServerWorkspace(
    targetRoot,
    {
      appName: 'ebook-miniapp',
      displayName: '전자책 미니앱',
      packageManager: 'pnpm',
      packageManagerCommand: 'pnpm',
      packageManagerRunCommand: 'pnpm',
      packageManagerExecCommand: 'pnpm exec',
      verifyCommand: 'pnpm verify',
    },
    { packageManager: 'pnpm', trpc: true },
  )

  const packageJson = JSON.parse(await readFile(path.join(serverRoot, 'package.json'), 'utf8')) as {
    scripts?: Record<string, string>
    dependencies?: Record<string, string>
  }
  const indexSource = await readFile(path.join(serverRoot, 'src', 'index.ts'), 'utf8')
  const contextSource = await readFile(path.join(serverRoot, 'src', 'trpc', 'context.ts'), 'utf8')
  const vitestConfig = await readFile(path.join(serverRoot, 'vitest.config.mts'), 'utf8')
  const wranglerVitestConfig = JSON.parse(
    await readFile(path.join(serverRoot, 'wrangler.vitest.jsonc'), 'utf8'),
  ) as {
    name?: string
    d1_databases?: Array<Record<string, unknown>>
    r2_buckets?: Array<Record<string, unknown>>
  }
  const readme = await readFile(path.join(serverRoot, 'README.md'), 'utf8')

  assert.equal(packageJson.dependencies?.['@trpc/server'], '^11.13.4')
  assert.equal(packageJson.dependencies?.['@workspace/app-router'], 'workspace:*')
  assert.equal(packageJson.dependencies?.['@workspace/contracts'], 'workspace:*')
  assert.equal(packageJson.scripts?.['trpc:sync'], undefined)
  assert.equal(packageJson.scripts?.dev, 'wrangler dev')
  assert.equal(packageJson.scripts?.build, 'wrangler deploy --dry-run')
  assert.match(indexSource, /fetchRequestHandler/)
  assert.match(indexSource, /from '@workspace\/app-router'/)
  assert.match(contextSource, /export type CloudflareTrpcContext/)
  assert.match(vitestConfig, /configPath: '\.\/wrangler\.vitest\.jsonc'/)
  assert.equal(wranglerVitestConfig.name, 'server')
  assert.deepEqual(wranglerVitestConfig.d1_databases, undefined)
  assert.deepEqual(wranglerVitestConfig.r2_buckets, undefined)
  assert.match(readme, /packages\/contracts/)
  assert.match(readme, /packages\/app-router/)
  assert.match(readme, /frontend\/src\/lib\/trpc\.ts/)
  assert.match(readme, /API SSOT/)
  assert.match(readme, /boundary type과 schema의 source of truth/)
  assert.match(readme, /route shape와 `AppRouter` 타입의 source of truth/)
  assert.match(readme, /wrangler\.vitest\.jsonc/)
  assert.match(readme, /local D1\/R2 binding/)
  assert.doesNotMatch(readme, /trpc:sync/)
})

test('patchSupabaseServerWorkspace creates a server README with remote and local guidance', async (t) => {
  const targetRoot = await createTempWorkspace(t)
  const serverRoot = path.join(targetRoot, 'server')
  const accessTokenGuideImageSourcePath1 = path.join(
    targetRoot,
    'fixtures',
    'supabase-access-token-guide1.png',
  )
  const accessTokenGuideImageSourcePath2 = path.join(
    targetRoot,
    'fixtures',
    'supabase-access-token-guide2.png',
  )

  await mkdir(path.dirname(accessTokenGuideImageSourcePath1), { recursive: true })
  await writeFile(accessTokenGuideImageSourcePath1, 'fake-image-1', 'utf8')
  await writeFile(accessTokenGuideImageSourcePath2, 'fake-image-2', 'utf8')

  await patchSupabaseServerWorkspace(
    targetRoot,
    {
      appName: 'ebook-miniapp',
      displayName: '전자책 미니앱',
      packageManager: 'pnpm',
      packageManagerCommand: 'pnpm',
      packageManagerRunCommand: 'pnpm',
      packageManagerExecCommand: 'pnpm exec',
      verifyCommand: 'pnpm verify',
    },
    {
      packageManager: 'pnpm',
      accessTokenGuideImageSourcePaths: [
        accessTokenGuideImageSourcePath1,
        accessTokenGuideImageSourcePath2,
      ],
    },
  )

  const serverPackageJson = JSON.parse(
    await readFile(path.join(targetRoot, 'server', 'package.json'), 'utf8'),
  ) as {
    scripts?: Record<string, string>
  }
  const readme = await readFile(path.join(targetRoot, 'server', 'README.md'), 'utf8')
  const copiedGuide1 = path.join(serverRoot, 'assets', 'supabase-access-token-guide1.png')
  const copiedGuide2 = path.join(serverRoot, 'assets', 'supabase-access-token-guide2.png')

  assert.equal(serverPackageJson.scripts?.['db:apply'], 'node ./scripts/supabase-db-apply.mjs')
  assert.match(readme, /^# server$/m)
  assert.match(readme, /Supabase/)
  assert.match(readme, /supabase\/config\.toml/)
  assert.match(readme, /supabase\/migrations\//)
  assert.match(readme, /supabase\/functions\/api\/index\.ts/)
  assert.match(readme, /cd server && pnpm db:apply/)
  assert.match(readme, /cd server && pnpm functions:serve/)
  assert.match(readme, /cd server && pnpm functions:deploy/)
  assert.match(readme, /cd server && pnpm db:apply:local/)
  assert.match(readme, /frontend\/src\/lib\/supabase\.ts/)
  assert.match(readme, /supabase\.functions\.invoke\('api'\)/)
  assert.match(readme, /MINIAPP_SUPABASE_URL/)
  assert.match(readme, /backoffice\/src\/lib\/supabase\.ts/)
  assert.match(readme, /VITE_SUPABASE_URL/)
  assert.doesNotMatch(readme, /API SSOT/)
  assert.match(readme, /## Supabase access token/)
  assert.match(readme, /SUPABASE_ACCESS_TOKEN=/)
  assert.match(readme, /dashboard\/account\/tokens/)
  assert.match(
    readme,
    /!\[Supabase access token 발급 화면 1\]\(\.\/assets\/supabase-access-token-guide1\.png\)/,
  )
  assert.match(
    readme,
    /!\[Supabase access token 발급 화면 2\]\(\.\/assets\/supabase-access-token-guide2\.png\)/,
  )
  assert.equal(await readFile(copiedGuide1, 'utf8'), 'fake-image-1')
  assert.equal(await readFile(copiedGuide2, 'utf8'), 'fake-image-2')
})

test('patchSupabaseServerWorkspace wires tRPC through function-local deno.json aliases when tRPC overlay is selected', async (t) => {
  const targetRoot = await createTempWorkspace(t)
  const serverRoot = path.join(targetRoot, 'server')

  await mkdir(path.join(serverRoot, 'supabase', 'functions', 'api'), { recursive: true })

  await patchSupabaseServerWorkspace(
    targetRoot,
    {
      appName: 'ebook-miniapp',
      displayName: '전자책 미니앱',
      packageManager: 'pnpm',
      packageManagerCommand: 'pnpm',
      packageManagerRunCommand: 'pnpm',
      packageManagerExecCommand: 'pnpm exec',
      verifyCommand: 'pnpm verify',
    },
    { packageManager: 'pnpm', trpc: true },
  )

  const serverPackageJson = JSON.parse(
    await readFile(path.join(serverRoot, 'package.json'), 'utf8'),
  ) as {
    scripts?: Record<string, string>
  }
  const functionSource = await readFile(
    path.join(serverRoot, 'supabase', 'functions', 'api', 'index.ts'),
    'utf8',
  )
  const denoConfig = JSON.parse(
    await readFile(path.join(serverRoot, 'supabase', 'functions', 'api', 'deno.json'), 'utf8'),
  ) as {
    imports?: Record<string, string>
  }
  const readme = await readFile(path.join(serverRoot, 'README.md'), 'utf8')

  assert.equal(serverPackageJson.scripts?.['trpc:sync'], undefined)
  assert.doesNotMatch(serverPackageJson.scripts?.['functions:serve'] ?? '', /trpc:sync/)
  assert.doesNotMatch(serverPackageJson.scripts?.['functions:deploy'] ?? '', /trpc:sync/)
  assert.match(functionSource, /fetchRequestHandler/)
  assert.match(functionSource, /npm:@trpc\/server\/adapters\/fetch/)
  assert.match(functionSource, /from '@workspace\/app-router'/)
  assert.equal(
    denoConfig.imports?.['@workspace/app-router'],
    '../../../../packages/app-router/src/index.ts',
  )
  assert.equal(
    denoConfig.imports?.['@workspace/contracts'],
    '../../../../packages/contracts/src/index.ts',
  )
  assert.equal(denoConfig.imports?.['@trpc/server'], 'npm:@trpc/server@^11.13.4')
  assert.equal(denoConfig.imports?.zod, 'npm:zod@^4.3.6')
  assert.match(readme, /packages\/contracts/)
  assert.match(readme, /packages\/app-router/)
  assert.match(readme, /frontend\/src\/lib\/trpc\.ts/)
  assert.match(readme, /functions\/api\/deno\.json/)
  assert.match(readme, /@workspace\/app-router/)
  assert.match(readme, /@workspace\/contracts/)
  assert.match(readme, /API SSOT/)
  assert.match(readme, /boundary type과 schema의 source of truth/)
  assert.match(readme, /route shape와 `AppRouter` 타입의 source of truth/)
  assert.doesNotMatch(readme, /trpc:sync/)
  assert.doesNotMatch(readme, /supabase\.functions\.invoke\('api'\)/)
})

test('patchFirebaseServerWorkspace creates a server README for firebase functions', async (t) => {
  const targetRoot = await createTempWorkspace(t)
  const serverRoot = path.join(targetRoot, 'server')
  const loginCiGuideImageSourcePath = path.join(
    targetRoot,
    'fixtures',
    'firebase-login-ci-guide.png',
  )
  const serviceAccountGuideImageSourcePath1 = path.join(
    targetRoot,
    'fixtures',
    'firebase-service-account-guide1.png',
  )
  const serviceAccountGuideImageSourcePath2 = path.join(
    targetRoot,
    'fixtures',
    'firebase-service-account-guide2.png',
  )

  await mkdir(path.join(serverRoot, 'functions', 'src'), { recursive: true })
  await mkdir(path.dirname(loginCiGuideImageSourcePath), { recursive: true })
  await writeFile(path.join(targetRoot, '.gitignore'), 'node_modules\n', 'utf8')
  await writeJson(path.join(targetRoot, 'biome.json'), {
    files: {
      includes: ['**', '!!node_modules'],
    },
  })
  await writeJson(path.join(serverRoot, 'package.json'), {
    name: 'server',
    private: true,
    scripts: {
      deploy: 'pnpm dlx firebase-tools deploy --only functions --config firebase.json',
      build: 'pnpm --dir ./functions install && pnpm --dir ./functions build',
      typecheck: 'pnpm --dir ./functions install && pnpm --dir ./functions typecheck',
      logs: 'pnpm dlx firebase-tools functions:log',
      test: `node -e "console.log('firebase server test placeholder')"`,
    },
  })
  await writeFile(loginCiGuideImageSourcePath, 'firebase-login-ci', 'utf8')
  await writeFile(serviceAccountGuideImageSourcePath1, 'firebase-service-account-1', 'utf8')
  await writeFile(serviceAccountGuideImageSourcePath2, 'firebase-service-account-2', 'utf8')

  await patchFirebaseServerWorkspace(
    targetRoot,
    {
      appName: 'ebook-miniapp',
      displayName: '전자책 미니앱',
      packageManager: 'pnpm',
      packageManagerCommand: 'pnpm',
      packageManagerRunCommand: 'pnpm',
      packageManagerExecCommand: 'pnpm exec',
      verifyCommand: 'pnpm verify',
    },
    {
      packageManager: 'pnpm',
      loginCiGuideImageSourcePath,
      serviceAccountGuideImageSourcePaths: [
        serviceAccountGuideImageSourcePath1,
        serviceAccountGuideImageSourcePath2,
      ],
    },
  )

  const projectJson = JSON.parse(await readFile(path.join(serverRoot, 'project.json'), 'utf8')) as {
    targets?: Record<string, { command?: string }>
  }
  const readme = await readFile(path.join(serverRoot, 'README.md'), 'utf8')
  const rootGitignore = await readFile(path.join(targetRoot, '.gitignore'), 'utf8')
  const rootBiome = JSON.parse(await readFile(path.join(targetRoot, 'biome.json'), 'utf8')) as {
    files?: {
      includes?: string[]
    }
  }
  const copiedLoginCiGuide = path.join(serverRoot, 'assets', 'firebase-login-ci-guide.png')
  const copiedServiceAccountGuide1 = path.join(
    serverRoot,
    'assets',
    'firebase-service-account-guide1.png',
  )
  const copiedServiceAccountGuide2 = path.join(
    serverRoot,
    'assets',
    'firebase-service-account-guide2.png',
  )

  assert.equal(projectJson.targets?.build?.command, 'pnpm --dir server build')
  assert.match(readme, /^# server$/m)
  assert.match(readme, /Firebase Functions/)
  assert.match(readme, /server\/functions\/src\/index\.ts/)
  assert.match(readme, /cd server && pnpm deploy/)
  assert.match(readme, /frontend\/src\/lib\/firebase\.ts/)
  assert.match(readme, /frontend\/src\/lib\/firestore\.ts/)
  assert.match(readme, /frontend\/src\/lib\/storage\.ts/)
  assert.match(readme, /MINIAPP_FIREBASE_API_KEY/)
  assert.match(readme, /VITE_FIREBASE_API_KEY/)
  assert.match(readme, /## Firebase deploy auth/)
  assert.match(readme, /firebase login:ci/)
  assert.match(readme, /GOOGLE_APPLICATION_CREDENTIALS/)
  assert.match(readme, /Cloud Functions Developer/)
  assert.match(
    readme,
    /!\[Firebase login:ci 발급 화면\]\(\.\/assets\/firebase-login-ci-guide\.png\)/,
  )
  assert.match(
    readme,
    /!\[Firebase service account 발급 화면 1\]\(\.\/assets\/firebase-service-account-guide1\.png\)/,
  )
  assert.match(
    readme,
    /!\[Firebase service account 발급 화면 2\]\(\.\/assets\/firebase-service-account-guide2\.png\)/,
  )
  assert.equal(await readFile(copiedLoginCiGuide, 'utf8'), 'firebase-login-ci')
  assert.equal(await readFile(copiedServiceAccountGuide1, 'utf8'), 'firebase-service-account-1')
  assert.equal(await readFile(copiedServiceAccountGuide2, 'utf8'), 'firebase-service-account-2')
  assert.match(rootGitignore, /^server\/functions\/lib\/$/m)
  assert.deepEqual(rootBiome.files?.includes, ['**', '!!node_modules', '!!**/server/functions/lib'])
})

test('patchFirebaseServerWorkspace adds firebase-only yarn packageExtensions to root yarnrc', async (t) => {
  const targetRoot = await createTempWorkspace(t)
  const serverRoot = path.join(targetRoot, 'server')

  await mkdir(path.join(serverRoot, 'functions', 'src'), { recursive: true })
  await writeJson(path.join(serverRoot, 'package.json'), {
    name: 'server',
    private: true,
    scripts: {
      deploy: 'yarn dlx firebase-tools deploy --only functions --config firebase.json',
    },
  })
  await writeFile(
    path.join(targetRoot, '.yarnrc.yml'),
    [
      'nodeLinker: pnp',
      '',
      'packageExtensions:',
      '  "@react-native-community/cli-debugger-ui@*":',
      '    dependencies:',
      '      "@babel/runtime": "^7.0.0"',
      '',
    ].join('\n'),
    'utf8',
  )

  await patchFirebaseServerWorkspace(
    targetRoot,
    {
      appName: 'ebook-miniapp',
      displayName: '전자책 미니앱',
      packageManager: 'yarn',
      packageManagerCommand: 'yarn',
      packageManagerRunCommand: 'yarn',
      packageManagerExecCommand: 'yarn exec',
      verifyCommand: 'yarn verify',
    },
    { packageManager: 'yarn' },
  )

  const yarnrc = await readFile(path.join(targetRoot, '.yarnrc.yml'), 'utf8')

  assert.match(yarnrc, /"@react-native-community\/cli-debugger-ui@\*":/)
  assert.match(yarnrc, /"@apphosting\/build@\*":/)
  assert.match(yarnrc, /yaml: "\^2\.4\.1"/)
})
