import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { patchBackofficeWorkspace, patchFrontendWorkspace } from './patch.js'

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
    { appName: 'ebook-miniapp', displayName: '전자책 미니앱' },
    { serverProvider: null },
  )

  const packageJson = JSON.parse(
    await readFile(path.join(frontendRoot, 'package.json'), 'utf8'),
  ) as {
    dependencies?: Record<string, string>
    devDependencies?: Record<string, string>
  }
  const graniteConfig = await readFile(path.join(frontendRoot, 'granite.config.ts'), 'utf8')
  const tsconfigSource = await readFile(path.join(frontendRoot, 'tsconfig.json'), 'utf8')

  assert.equal(packageJson.dependencies?.['@supabase/supabase-js'], undefined)
  assert.equal(packageJson.devDependencies?.['@granite-js/plugin-env'], undefined)
  assert.match(graniteConfig, /const repoRoot = path\.resolve\(__dirname, '\.\.\/\.\.'\)/)
  assert.match(graniteConfig, /watchFolders:\s*\[\s*repoRoot\s*\]/)
  assert.match(tsconfigSource, /"module": "esnext"/)
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
    { appName: 'ebook-miniapp', displayName: '전자책 미니앱' },
    { serverProvider: 'supabase' },
  )

  const packageJson = JSON.parse(
    await readFile(path.join(frontendRoot, 'package.json'), 'utf8'),
  ) as {
    dependencies?: Record<string, string>
    devDependencies?: Record<string, string>
  }
  const graniteConfig = await readFile(path.join(frontendRoot, 'granite.config.ts'), 'utf8')
  const envExample = await readFile(path.join(frontendRoot, '.env.local.example'), 'utf8')
  const envTypes = await readFile(path.join(frontendRoot, 'src', 'env.d.ts'), 'utf8')
  const supabaseClient = await readFile(
    path.join(frontendRoot, 'src', 'lib', 'supabase.ts'),
    'utf8',
  )

  assert.equal(packageJson.dependencies?.['@supabase/supabase-js'], '^2.57.4')
  assert.equal(packageJson.devDependencies?.['@granite-js/plugin-env'], '1.0.7')
  assert.equal(packageJson.devDependencies?.dotenv, '^16.4.7')
  assert.match(graniteConfig, /const repoRoot = path\.resolve\(__dirname, '\.\.\/\.\.'\)/)
  assert.match(graniteConfig, /watchFolders:\s*\[\s*repoRoot\s*\]/)
  assert.match(graniteConfig, /import \{ env \} from '@granite-js\/plugin-env'/)
  assert.match(graniteConfig, /import dotenv from 'dotenv'/)
  assert.match(graniteConfig, /const appRoot = __dirname/)
  assert.match(graniteConfig, /path\.join\(appRoot, '\.env'\)/)
  assert.match(graniteConfig, /MINIAPP_SUPABASE_URL: miniappSupabaseUrl/)
  assert.match(envExample, /MINIAPP_SUPABASE_URL=https:\/\/your-project\.supabase\.co/)
  assert.match(envExample, /MINIAPP_SUPABASE_PUBLISHABLE_KEY=your-publishable-key/)
  assert.match(envTypes, /readonly MINIAPP_SUPABASE_URL: string/)
  assert.match(supabaseClient, /createClient/)
  assert.match(supabaseClient, /process\.env\.MINIAPP_SUPABASE_URL/)
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
    { appName: 'ebook-miniapp', displayName: '전자책 미니앱' },
    { serverProvider: 'supabase' },
  )

  const packageJson = JSON.parse(
    await readFile(path.join(backofficeRoot, 'package.json'), 'utf8'),
  ) as {
    dependencies?: Record<string, string>
  }
  const envExample = await readFile(path.join(backofficeRoot, '.env.local.example'), 'utf8')
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

  assert.equal(packageJson.dependencies?.['@supabase/supabase-js'], '^2.57.4')
  assert.match(envExample, /VITE_SUPABASE_URL=https:\/\/your-project\.supabase\.co/)
  assert.match(envExample, /VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key/)
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
