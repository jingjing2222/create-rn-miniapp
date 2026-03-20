import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { getPackageManagerAdapter, type PackageManager } from '../package-manager.js'
import {
  applyDocsTemplates,
  applyFirebaseServerWorkspaceTemplate,
  applyRootTemplates,
  applyServerPackageTemplate,
  applyTrpcWorkspaceTemplate,
  applyWorkspaceProjectTemplate,
  FIREBASE_DEFAULT_FUNCTION_REGION,
  pathExists,
  syncOptionalDocsTemplates,
  syncRootWorkspaceManifest,
  type TemplateTokens,
} from './index.js'

function createTokens(packageManager: PackageManager): TemplateTokens {
  const adapter = getPackageManagerAdapter(packageManager)

  return {
    appName: 'ebook-miniapp',
    displayName: '전자책 미니앱',
    packageManager,
    packageManagerCommand: packageManager,
    packageManagerRunCommand: adapter.runCommandPrefix,
    packageManagerExecCommand: adapter.execCommandPrefix,
    verifyCommand: adapter.verifyCommand(),
  }
}

async function createTempTargetRoot(t: test.TestContext) {
  const targetRoot = await mkdtemp(path.join(os.tmpdir(), 'create-rn-miniapp-templates-'))
  t.after(async () => {
    await rm(targetRoot, { recursive: true, force: true })
  })
  return targetRoot
}

const NX_ROOT_SCHEMA_URL =
  'https://raw.githubusercontent.com/nrwl/nx/master/packages/nx/schemas/nx-schema.json'
const NX_PROJECT_SCHEMA_URL =
  'https://raw.githubusercontent.com/nrwl/nx/master/packages/nx/schemas/project-schema.json'

test('applyRootTemplates keeps pnpm workspace manifest for pnpm', async (t) => {
  const targetRoot = await createTempTargetRoot(t)

  await applyRootTemplates(targetRoot, createTokens('pnpm'), ['frontend'])

  const packageJson = JSON.parse(await readFile(path.join(targetRoot, 'package.json'), 'utf8')) as {
    packageManager?: string
    workspaces?: string[]
    scripts?: Record<string, string>
    devDependencies?: Record<string, string>
  }
  const nxJson = JSON.parse(await readFile(path.join(targetRoot, 'nx.json'), 'utf8')) as {
    $schema?: string
    namedInputs?: {
      sharedGlobals?: string[]
    }
    targetDefaults?: Record<string, { inputs?: string[]; dependsOn?: string[] }>
  }
  const gitignore = await readFile(path.join(targetRoot, '.gitignore'), 'utf8')
  const biomeJson = await readFile(path.join(targetRoot, 'biome.json'), 'utf8')

  assert.equal(packageJson.packageManager, 'pnpm@10.32.1')
  assert.equal(packageJson.workspaces, undefined)
  assert.equal(await pathExists(path.join(targetRoot, 'pnpm-workspace.yaml')), true)
  assert.equal(await pathExists(path.join(targetRoot, '.yarnrc.yml')), false)
  assert.equal(await pathExists(path.join(targetRoot, 'tsconfig.base.json')), false)
  assert.equal(
    await pathExists(path.join(targetRoot, 'scripts', 'verify-frontend-routes.mjs')),
    true,
  )
  assert.equal(
    packageJson.scripts?.verify,
    'pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm frontend:policy:check',
  )
  assert.equal(
    packageJson.scripts?.['frontend:policy:check'],
    'node ./scripts/verify-frontend-routes.mjs',
  )
  assert.equal(packageJson.devDependencies?.nx, '^22.5.4')
  assert.equal(packageJson.devDependencies?.typescript, '^5.9.3')
  assert.equal(packageJson.devDependencies?.['@biomejs/biome'], '^2.4.8')
  assert.equal(nxJson.$schema, NX_ROOT_SCHEMA_URL)
  assert.deepEqual(nxJson.namedInputs?.sharedGlobals, ['{workspaceRoot}/biome.json'])
  assert.deepEqual(nxJson.targetDefaults?.build?.dependsOn, ['^build'])
  assert.deepEqual(nxJson.targetDefaults?.typecheck?.dependsOn, ['^build'])
  assert.deepEqual(nxJson.targetDefaults?.test?.dependsOn, ['^build'])
  assert.doesNotMatch(gitignore, /^\.yarn\/?$/m)
  assert.doesNotMatch(gitignore, /^\.pnp\.\*$/m)
  assert.doesNotMatch(gitignore, /^server\/worker-configuration\.d\.ts$/m)
  assert.doesNotMatch(biomeJson, /\*\*\/\.yarn\/\*\*/)
  assert.doesNotMatch(biomeJson, /\*\*\/\.pnp\.\*/)
  assert.doesNotMatch(biomeJson, /\*\*\/server\/worker-configuration\.d\.ts/)
  assert.equal(
    await readFile(path.join(targetRoot, 'pnpm-workspace.yaml'), 'utf8'),
    'packages:\n  - frontend\n',
  )
  assert.match(biomeJson, /schemas\/2\.4\.8\/schema\.json/)
  assert.match(biomeJson, /noRestrictedImports/)
  assert.match(biomeJson, /@react-native-async-storage\/async-storage/)
  assert.match(biomeJson, /@react-navigation\/\*/)
  assert.match(biomeJson, /@react-native-community\/\*/)
  assert.match(biomeJson, /react-native-\*/)
  assert.match(biomeJson, /!!frontend\/\.granite/)
  assert.match(biomeJson, /ActivityIndicator/)
  assert.match(biomeJson, /Alert/)
  assert.match(biomeJson, /Text/)
  assert.match(biomeJson, /TDS `Txt`/)
  assert.match(biomeJson, /docs\/engineering\/native-modules-policy\.md/)
  assert.match(biomeJson, /docs\/engineering\/tds-react-native-index\.md/)
})

test('syncRootWorkspaceManifest normalizes package workspaces to packages/* in pnpm manifest', async (t) => {
  const targetRoot = await createTempTargetRoot(t)
  const tokens = createTokens('pnpm')

  await applyRootTemplates(targetRoot, tokens, ['frontend'])
  await syncRootWorkspaceManifest(targetRoot, 'pnpm', ['frontend', 'packages/contracts'])

  assert.equal(
    await readFile(path.join(targetRoot, 'pnpm-workspace.yaml'), 'utf8'),
    ['packages:', '  - frontend', '  - packages/*', ''].join('\n'),
  )
})

test('applyTrpcWorkspaceTemplate creates shared contracts and app-router workspaces for cloudflare', async (t) => {
  const targetRoot = await createTempTargetRoot(t)
  const tokens = createTokens('pnpm')

  await applyRootTemplates(targetRoot, tokens, [
    'frontend',
    'server',
    'packages/contracts',
    'packages/app-router',
  ])
  await applyTrpcWorkspaceTemplate(targetRoot, tokens, { serverProvider: 'cloudflare' })

  const contractsPackageJson = JSON.parse(
    await readFile(path.join(targetRoot, 'packages', 'contracts', 'package.json'), 'utf8'),
  ) as {
    name?: string
    files?: string[]
    exports?: Record<
      string,
      { types?: string; import?: string; require?: string; default?: string }
    >
    types?: string
    main?: string
    dependencies?: Record<string, string>
    devDependencies?: Record<string, string>
    scripts?: Record<string, string>
  }
  const appRouterPackageJson = JSON.parse(
    await readFile(path.join(targetRoot, 'packages', 'app-router', 'package.json'), 'utf8'),
  ) as {
    name?: string
    files?: string[]
    exports?: Record<
      string,
      { types?: string; import?: string; require?: string; default?: string }
    >
    types?: string
    main?: string
    dependencies?: Record<string, string>
    devDependencies?: Record<string, string>
    scripts?: Record<string, string>
  }
  const appRouterTsconfig = JSON.parse(
    await readFile(path.join(targetRoot, 'packages', 'app-router', 'tsconfig.json'), 'utf8'),
  ) as {
    compilerOptions?: {
      allowImportingTsExtensions?: boolean
      composite?: boolean
      declaration?: boolean
      outDir?: string
      rewriteRelativeImportExtensions?: boolean
    }
  }
  const appRouterProjectJson = JSON.parse(
    await readFile(path.join(targetRoot, 'packages', 'app-router', 'project.json'), 'utf8'),
  ) as {
    targets?: Record<string, { command?: string }>
  }
  const contractsReadme = await readFile(
    path.join(targetRoot, 'packages', 'contracts', 'README.md'),
    'utf8',
  )
  const appRouterReadme = await readFile(
    path.join(targetRoot, 'packages', 'app-router', 'README.md'),
    'utf8',
  )
  const contractsIndexSource = await readFile(
    path.join(targetRoot, 'packages', 'contracts', 'src', 'index.ts'),
    'utf8',
  )
  const appRouterIndexSource = await readFile(
    path.join(targetRoot, 'packages', 'app-router', 'src', 'index.ts'),
    'utf8',
  )
  const appRouterExampleRouterSource = await readFile(
    path.join(targetRoot, 'packages', 'app-router', 'src', 'routers', 'example.ts'),
    'utf8',
  )
  const appRouterRootSource = await readFile(
    path.join(targetRoot, 'packages', 'app-router', 'src', 'root.ts'),
    'utf8',
  )
  assert.equal(contractsPackageJson.name, '@workspace/contracts')
  assert.deepEqual(contractsPackageJson.files, ['dist'])
  assert.equal(contractsPackageJson.exports?.['.']?.types, './dist/index.d.mts')
  assert.equal(contractsPackageJson.exports?.['.']?.import, './dist/index.mjs')
  assert.equal(contractsPackageJson.exports?.['.']?.require, './dist/index.cjs')
  assert.equal(contractsPackageJson.exports?.['.']?.default, './dist/index.mjs')
  assert.equal(contractsPackageJson.types, './dist/index.d.mts')
  assert.equal(contractsPackageJson.main, './dist/index.cjs')
  assert.equal(contractsPackageJson.dependencies?.zod, '^4.3.6')
  assert.equal(contractsPackageJson.devDependencies?.tsdown, '^0.21.4')
  assert.equal(appRouterPackageJson.name, '@workspace/app-router')
  assert.deepEqual(appRouterPackageJson.files, ['dist'])
  assert.equal(appRouterPackageJson.exports?.['.']?.types, './dist/index.d.mts')
  assert.equal(appRouterPackageJson.exports?.['.']?.import, './dist/index.mjs')
  assert.equal(appRouterPackageJson.exports?.['.']?.require, './dist/index.cjs')
  assert.equal(appRouterPackageJson.exports?.['.']?.default, './dist/index.mjs')
  assert.equal(appRouterPackageJson.types, './dist/index.d.mts')
  assert.equal(appRouterPackageJson.main, './dist/index.cjs')
  assert.equal(appRouterPackageJson.dependencies?.['@trpc/server'], '^11.13.4')
  assert.equal(appRouterPackageJson.dependencies?.['@workspace/contracts'], 'workspace:*')
  assert.equal(appRouterPackageJson.devDependencies?.tsdown, '^0.21.4')
  assert.equal(
    contractsPackageJson.scripts?.build,
    'tsdown src/index.ts --format esm,cjs --dts --clean --out-dir dist',
  )
  assert.equal(
    appRouterPackageJson.scripts?.build,
    'pnpm --dir ../contracts build && tsdown src/index.ts --format esm,cjs --dts --clean --out-dir dist',
  )
  assert.equal(appRouterTsconfig.compilerOptions?.composite, true)
  assert.equal(appRouterTsconfig.compilerOptions?.declaration, true)
  assert.equal(appRouterTsconfig.compilerOptions?.outDir, 'dist')
  assert.equal(appRouterTsconfig.compilerOptions?.allowImportingTsExtensions, true)
  assert.equal(appRouterTsconfig.compilerOptions?.rewriteRelativeImportExtensions, true)
  assert.equal(appRouterProjectJson.targets?.build?.command, 'pnpm --dir packages/app-router build')
  assert.equal(
    appRouterProjectJson.targets?.typecheck?.command,
    'pnpm --dir packages/app-router typecheck',
  )
  assert.match(contractsReadme, /packages\/contracts/)
  assert.match(appRouterReadme, /packages\/app-router/)
  assert.match(appRouterReadme, /packages\/contracts/)
  assert.match(contractsIndexSource, /ExampleEchoInputSchema/)
  assert.match(appRouterExampleRouterSource, /from '\.\.\/\.\.\/\.\.\/contracts\/src\/index\.ts'/)
  assert.match(appRouterIndexSource, /export type \{ AppRouter \} from '\.\/root\.ts'/)
  assert.match(appRouterRootSource, /from '\.\/routers\/example\.ts'/)
})

test('applyRootTemplates wires frontend route checker into root verify', async (t) => {
  const targetRoot = await createTempTargetRoot(t)
  const tokens = createTokens('pnpm')

  await applyRootTemplates(targetRoot, tokens, ['frontend'])

  const rootPackageJson = JSON.parse(
    await readFile(path.join(targetRoot, 'package.json'), 'utf8'),
  ) as {
    scripts?: Record<string, string>
  }
  const scriptSource = await readFile(
    path.join(targetRoot, 'scripts', 'verify-frontend-routes.mjs'),
    'utf8',
  )

  assert.equal(
    rootPackageJson.scripts?.['frontend:policy:check'],
    'node ./scripts/verify-frontend-routes.mjs',
  )
  assert.equal(
    rootPackageJson.scripts?.verify,
    'pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm frontend:policy:check',
  )
  assert.match(scriptSource, /route-dynamic-segment-dollar/)
  assert.match(scriptSource, /FRONTEND_ENTRY_ROOT/)
  assert.match(scriptSource, /FRONTEND_SOURCE_PAGES_ROOT/)
})

test('generated frontend route checker allows fixed path routes', async (t) => {
  const targetRoot = await createTempTargetRoot(t)
  const tokens = createTokens('pnpm')

  await applyRootTemplates(targetRoot, tokens, ['frontend'])
  await mkdir(path.join(targetRoot, 'frontend', 'pages'), { recursive: true })
  await mkdir(path.join(targetRoot, 'frontend', 'src', 'pages'), { recursive: true })
  await writeFile(
    path.join(targetRoot, 'frontend', 'pages', 'book-detail.tsx'),
    ["export { BookDetailPage } from '../src/pages/book-detail'", ''].join('\n'),
    'utf8',
  )
  await writeFile(
    path.join(targetRoot, 'frontend', 'src', 'pages', 'book-detail.tsx'),
    [
      "export const BOOK_DETAIL_ROUTE = '/book-detail'",
      '',
      'export const BookDetailPage = () => null',
      '',
    ].join('\n'),
    'utf8',
  )

  const result = spawnSync(process.execPath, ['./scripts/verify-frontend-routes.mjs'], {
    cwd: targetRoot,
    encoding: 'utf8',
  })

  assert.equal(result.status, 0, result.stderr)
})

test('generated frontend route checker rejects dollar route filenames', async (t) => {
  const targetRoot = await createTempTargetRoot(t)
  const tokens = createTokens('pnpm')

  await applyRootTemplates(targetRoot, tokens, ['frontend'])
  await mkdir(path.join(targetRoot, 'frontend', 'pages', 'book'), { recursive: true })
  await writeFile(
    path.join(targetRoot, 'frontend', 'pages', 'book', '$bookId.tsx'),
    ["export { BookPage } from '../../src/pages/book/$bookId'", ''].join('\n'),
    'utf8',
  )

  const result = spawnSync(process.execPath, ['./scripts/verify-frontend-routes.mjs'], {
    cwd: targetRoot,
    encoding: 'utf8',
  })

  assert.equal(result.status, 1)
  assert.match(result.stderr, /frontend\/pages\/book\/\$bookId\.tsx/)
  assert.match(result.stderr, /\$param/)
  assert.match(result.stderr, /docs\/engineering\/granite-ssot\.md/)
})

test('generated frontend route checker rejects dollar route strings', async (t) => {
  const targetRoot = await createTempTargetRoot(t)
  const tokens = createTokens('pnpm')

  await applyRootTemplates(targetRoot, tokens, ['frontend'])
  await mkdir(path.join(targetRoot, 'frontend', 'src'), { recursive: true })
  await writeFile(
    path.join(targetRoot, 'frontend', 'src', 'navigation-bad.ts'),
    ["export const navigationBad = () => '/book/$bookId'", ''].join('\n'),
    'utf8',
  )

  const result = spawnSync(process.execPath, ['./scripts/verify-frontend-routes.mjs'], {
    cwd: targetRoot,
    encoding: 'utf8',
  })

  assert.equal(result.status, 1)
  assert.match(result.stderr, /frontend\/src\/navigation-bad\.ts/)
  assert.match(result.stderr, /\/\$bookId/)
  assert.match(result.stderr, /docs\/engineering\/granite-ssot\.md/)
})

test('generated frontend route checker reports every violation in one run', async (t) => {
  const targetRoot = await createTempTargetRoot(t)
  const tokens = createTokens('pnpm')

  await applyRootTemplates(targetRoot, tokens, ['frontend'])
  await mkdir(path.join(targetRoot, 'frontend', 'pages', 'book'), { recursive: true })
  await mkdir(path.join(targetRoot, 'frontend', 'src'), { recursive: true })
  await writeFile(
    path.join(targetRoot, 'frontend', 'pages', 'book', '$bookId.tsx'),
    ["export { BookPage } from '../../src/pages/book/$bookId'", ''].join('\n'),
    'utf8',
  )
  await writeFile(
    path.join(targetRoot, 'frontend', 'src', 'navigation-bad.ts'),
    ["export const navigationBad = () => '/book/$bookId'", ''].join('\n'),
    'utf8',
  )

  const result = spawnSync(process.execPath, ['./scripts/verify-frontend-routes.mjs'], {
    cwd: targetRoot,
    encoding: 'utf8',
  })

  assert.equal(result.status, 1)
  assert.match(result.stderr, /frontend\/pages\/book\/\$bookId\.tsx/)
  assert.match(result.stderr, /frontend\/src\/navigation-bad\.ts/)
  assert.match(result.stderr, /\/book\/\$bookId/)
  assert.match(result.stderr, /docs\/engineering\/granite-ssot\.md/)
})

test('applyDocsTemplates keeps optional workspace docs out of the base copy', async (t) => {
  const targetRoot = await createTempTargetRoot(t)
  const tokens = createTokens('pnpm')

  await applyDocsTemplates(targetRoot, tokens)

  const agents = await readFile(path.join(targetRoot, 'AGENTS.md'), 'utf8')
  const docsIndex = await readFile(path.join(targetRoot, 'docs', 'index.md'), 'utf8')

  assert.doesNotMatch(agents, /backoffice-react-best-practices/)
  assert.doesNotMatch(agents, /server-provider-supabase/)
  assert.doesNotMatch(agents, /server-provider-cloudflare/)
  assert.doesNotMatch(agents, /server-provider-firebase/)
  assert.doesNotMatch(agents, /Boundary types from schema only/)
  assert.doesNotMatch(docsIndex, /Backoffice React best practices/)
  assert.doesNotMatch(docsIndex, /Server provider guide/)
  assert.equal(
    await pathExists(
      path.join(targetRoot, 'docs', 'engineering', 'backoffice-react-best-practices.md'),
    ),
    false,
  )
  assert.equal(
    await pathExists(path.join(targetRoot, 'docs', 'engineering', 'server-provider-supabase.md')),
    false,
  )
})

test('syncOptionalDocsTemplates copies and indexes selected backoffice and server provider docs', async (t) => {
  const targetRoot = await createTempTargetRoot(t)
  const tokens = createTokens('yarn')

  await applyDocsTemplates(targetRoot, tokens)
  await syncOptionalDocsTemplates(targetRoot, tokens, {
    hasBackoffice: true,
    serverProvider: 'firebase',
    hasTrpc: false,
    hasWorktreePolicy: false,
  })

  const agents = await readFile(path.join(targetRoot, 'AGENTS.md'), 'utf8')
  const docsIndex = await readFile(path.join(targetRoot, 'docs', 'index.md'), 'utf8')

  assert.match(agents, /backoffice-react-best-practices/)
  assert.match(agents, /server-provider-firebase/)
  assert.doesNotMatch(agents, /server-provider-supabase/)
  assert.doesNotMatch(agents, /server-provider-cloudflare/)
  assert.doesNotMatch(agents, /server-api-ssot-trpc/)
  assert.doesNotMatch(agents, /Boundary types from schema only/)
  assert.match(docsIndex, /Backoffice React best practices/)
  assert.match(docsIndex, /Server provider guide \(Firebase\)/)
  assert.doesNotMatch(docsIndex, /Server API SSOT \(tRPC\)/)
  assert.equal(
    await pathExists(
      path.join(targetRoot, 'docs', 'engineering', 'backoffice-react-best-practices.md'),
    ),
    true,
  )
  assert.equal(
    await pathExists(path.join(targetRoot, 'docs', 'engineering', 'server-provider-firebase.md')),
    true,
  )
  assert.equal(
    await pathExists(path.join(targetRoot, 'docs', 'engineering', 'server-provider-supabase.md')),
    false,
  )
  assert.equal(
    await pathExists(path.join(targetRoot, 'docs', 'engineering', 'server-api-ssot-trpc.md')),
    false,
  )
})

test('syncOptionalDocsTemplates adds the tRPC boundary type golden rule only when trpc is enabled', async (t) => {
  const targetRoot = await createTempTargetRoot(t)
  const tokens = createTokens('pnpm')

  await applyDocsTemplates(targetRoot, tokens)
  await syncOptionalDocsTemplates(targetRoot, tokens, {
    hasBackoffice: false,
    serverProvider: 'cloudflare',
    hasTrpc: true,
    hasWorktreePolicy: false,
  })

  const agents = await readFile(path.join(targetRoot, 'AGENTS.md'), 'utf8')
  const docsIndex = await readFile(path.join(targetRoot, 'docs', 'index.md'), 'utf8')

  assert.match(agents, /9\. Boundary types from schema only:/)
  assert.match(agents, /server-api-ssot-trpc/)
  assert.match(docsIndex, /Server API SSOT \(tRPC\)/)
  assert.equal(
    await pathExists(path.join(targetRoot, 'docs', 'engineering', 'server-api-ssot-trpc.md')),
    true,
  )
})

test('syncOptionalDocsTemplates can patch legacy docs files without markers', async (t) => {
  const targetRoot = await createTempTargetRoot(t)
  const tokens = createTokens('pnpm')

  await mkdir(path.join(targetRoot, 'docs'), { recursive: true })
  await writeFile(
    path.join(targetRoot, 'AGENTS.md'),
    [
      '## 어떤 문서를 볼지',
      '- `docs/engineering/tds-react-native-index.md`',
      '  - TDS 컴포넌트와 UI 구현 참고',
      '- `docs/engineering/native-modules-policy.md`',
      '  - 네이티브 연동 제약과 허용 범위',
      '',
    ].join('\n'),
    'utf8',
  )
  await writeFile(
    path.join(targetRoot, 'docs', 'index.md'),
    [
      '## 주요 문서',
      '- TDS RN index: `engineering/tds-react-native-index.md`',
      '- Native modules policy: `engineering/native-modules-policy.md`',
      '',
    ].join('\n'),
    'utf8',
  )

  await syncOptionalDocsTemplates(targetRoot, tokens, {
    hasBackoffice: true,
    serverProvider: 'supabase',
    hasTrpc: true,
    hasWorktreePolicy: false,
  })

  const agents = await readFile(path.join(targetRoot, 'AGENTS.md'), 'utf8')
  const docsIndex = await readFile(path.join(targetRoot, 'docs', 'index.md'), 'utf8')

  assert.match(agents, /optional-doc-links:start/)
  assert.match(agents, /Boundary types from schema only/)
  assert.match(agents, /backoffice-react-best-practices/)
  assert.match(agents, /server-provider-supabase/)
  assert.match(agents, /server-api-ssot-trpc/)
  assert.match(docsIndex, /optional-engineering-links:start/)
  assert.match(docsIndex, /Backoffice React best practices/)
  assert.match(docsIndex, /Server provider guide \(Supabase\)/)
  assert.match(docsIndex, /Server API SSOT \(tRPC\)/)
  assert.equal(
    await pathExists(path.join(targetRoot, 'docs', 'engineering', 'server-api-ssot-trpc.md')),
    true,
  )
})

test('applyRootTemplates and workspace templates emit yarn-specific files and commands', async (t) => {
  const targetRoot = await createTempTargetRoot(t)
  const tokens = createTokens('yarn')

  await applyRootTemplates(targetRoot, tokens, ['frontend', 'server'])
  await applyWorkspaceProjectTemplate(targetRoot, 'frontend', tokens)
  await applyServerPackageTemplate(targetRoot, tokens)

  const packageJsonSource = await readFile(path.join(targetRoot, 'package.json'), 'utf8')
  const packageJson = JSON.parse(packageJsonSource) as {
    packageManager?: string
    workspaces?: string[]
    scripts?: Record<string, string>
    devDependencies?: Record<string, string>
  }
  const gitignore = await readFile(path.join(targetRoot, '.gitignore'), 'utf8')
  const yarnrc = await readFile(path.join(targetRoot, '.yarnrc.yml'), 'utf8')
  const biomeJson = await readFile(path.join(targetRoot, 'biome.json'), 'utf8')
  const frontendProject = JSON.parse(
    await readFile(path.join(targetRoot, 'frontend', 'project.json'), 'utf8'),
  ) as {
    $schema?: string
    targets?: Record<string, { command?: string }>
  }
  const serverPackageJson = JSON.parse(
    await readFile(path.join(targetRoot, 'server', 'package.json'), 'utf8'),
  ) as {
    scripts?: Record<string, string>
    dependencies?: Record<string, string>
  }
  const serverDbApplyScript = await readFile(
    path.join(targetRoot, 'server', 'scripts', 'supabase-db-apply.mjs'),
    'utf8',
  )
  const serverTypecheckScript = await readFile(
    path.join(targetRoot, 'server', 'scripts', 'supabase-functions-typecheck.mjs'),
    'utf8',
  )
  const serverFunctionsDeployScript = await readFile(
    path.join(targetRoot, 'server', 'scripts', 'supabase-functions-deploy.mjs'),
    'utf8',
  )

  assert.equal(packageJson.packageManager, 'yarn@4.13.0')
  assert.deepEqual(packageJson.workspaces, ['frontend', 'server'])
  assert.equal(await pathExists(path.join(targetRoot, 'pnpm-workspace.yaml')), false)
  assert.equal(
    packageJson.scripts?.verify,
    'yarn format:check && yarn lint && yarn typecheck && yarn test && yarn frontend:policy:check',
  )
  assert.ok(
    packageJsonSource.indexOf('"packageManager"') < packageJsonSource.indexOf('"workspaces"'),
  )
  assert.equal(packageJson.devDependencies?.nx, '^22.5.4')
  assert.equal(packageJson.devDependencies?.typescript, '^5.9.3')
  assert.equal(packageJson.devDependencies?.['@biomejs/biome'], '^2.4.8')
  assert.equal(frontendProject.$schema, NX_PROJECT_SCHEMA_URL)
  assert.match(gitignore, /^\.yarn\/?$/m)
  assert.match(gitignore, /^\.pnp\.\*$/m)
  assert.match(yarnrc, /nodeLinker: pnp/)
  assert.match(yarnrc, /packageExtensions:/)
  assert.match(yarnrc, /"@react-native-community\/cli-debugger-ui@\*":/)
  assert.match(yarnrc, /"@babel\/runtime": "\^7\.0\.0"/)
  assert.doesNotMatch(yarnrc, /"@apphosting\/build@\*":/)
  assert.doesNotMatch(yarnrc, /yaml: "\^2\.4\.1"/)
  assert.match(biomeJson, /!!\*\*\/\.yarn/)
  assert.match(biomeJson, /!!\*\*\/\.pnp\.\*/)
  assert.doesNotMatch(gitignore, /^server\/worker-configuration\.d\.ts$/m)
  assert.doesNotMatch(biomeJson, /\*\*\/server\/worker-configuration\.d\.ts/)
  assert.doesNotMatch(gitignore, /^server\/functions\/lib\/$/m)
  assert.doesNotMatch(biomeJson, /\*\*\/server\/functions\/lib\/\*\*/)
  assert.equal(frontendProject.targets?.build.command, 'yarn workspace frontend build')
  assert.equal(frontendProject.targets?.typecheck.command, 'yarn workspace frontend typecheck')
  assert.equal(serverPackageJson.scripts?.dev, 'yarn dlx supabase start --workdir .')
  assert.equal(serverPackageJson.scripts?.build, 'yarn typecheck')
  assert.equal(
    serverPackageJson.scripts?.typecheck,
    'node ./scripts/supabase-functions-typecheck.mjs',
  )
  assert.equal(serverPackageJson.scripts?.['db:apply'], 'node ./scripts/supabase-db-apply.mjs')
  assert.equal(
    serverPackageJson.scripts?.['functions:serve'],
    'yarn dlx supabase functions serve --env-file ./.env.local --workdir .',
  )
  assert.equal(
    serverPackageJson.scripts?.['functions:deploy'],
    'node ./scripts/supabase-functions-deploy.mjs',
  )
  assert.equal(
    serverPackageJson.scripts?.['db:apply:local'],
    'yarn dlx supabase db push --local --workdir .',
  )
  assert.equal(
    serverPackageJson.scripts?.['db:reset'],
    'yarn dlx supabase db reset --local --workdir .',
  )
  assert.match(serverDbApplyScript, /SUPABASE_DB_PASSWORD/)
  assert.match(serverDbApplyScript, /baseArgs = \["dlx","supabase","db","push"/)
  assert.match(serverDbApplyScript, /yarn/)
  assert.doesNotMatch(serverDbApplyScript, /value: string/)
  assert.match(serverTypecheckScript, /const denoCommand =/)
  assert.match(serverTypecheckScript, /\['check'/)
  assert.match(serverTypecheckScript, /path\.join\(serverRoot, 'supabase', 'functions'\)/)
  assert.match(serverFunctionsDeployScript, /SUPABASE_PROJECT_REF/)
  assert.match(serverFunctionsDeployScript, /baseArgs = \["dlx","supabase","functions","deploy"/)
  assert.match(serverFunctionsDeployScript, /--project-ref/)
  assert.match(serverFunctionsDeployScript, /yarn/)
  assert.doesNotMatch(serverFunctionsDeployScript, /value: string/)
})

test('applyRootTemplates emits npm-specific workspace manifest and scripts', async (t) => {
  const targetRoot = await createTempTargetRoot(t)
  const tokens = createTokens('npm')

  await applyRootTemplates(targetRoot, tokens, ['frontend', 'server'])
  await applyWorkspaceProjectTemplate(targetRoot, 'frontend', tokens)
  await applyServerPackageTemplate(targetRoot, tokens)

  const packageJson = JSON.parse(await readFile(path.join(targetRoot, 'package.json'), 'utf8')) as {
    packageManager?: string
    workspaces?: string[]
    scripts?: Record<string, string>
  }
  const npmrc = await readFile(path.join(targetRoot, '.npmrc'), 'utf8')
  const frontendProject = JSON.parse(
    await readFile(path.join(targetRoot, 'frontend', 'project.json'), 'utf8'),
  ) as {
    targets?: Record<string, { command?: string }>
  }
  const serverPackageJson = JSON.parse(
    await readFile(path.join(targetRoot, 'server', 'package.json'), 'utf8'),
  ) as {
    scripts?: Record<string, string>
    dependencies?: Record<string, string>
  }
  const serverDbApplyScript = await readFile(
    path.join(targetRoot, 'server', 'scripts', 'supabase-db-apply.mjs'),
    'utf8',
  )
  const serverTypecheckScript = await readFile(
    path.join(targetRoot, 'server', 'scripts', 'supabase-functions-typecheck.mjs'),
    'utf8',
  )

  assert.equal(packageJson.packageManager, 'npm@11.11.1')
  assert.deepEqual(packageJson.workspaces, ['frontend', 'server'])
  assert.equal(await pathExists(path.join(targetRoot, 'pnpm-workspace.yaml')), false)
  assert.equal(npmrc, 'legacy-peer-deps=true\n')
  assert.equal(frontendProject.targets?.build.command, 'npm --workspace frontend run build')
  assert.equal(serverPackageJson.scripts?.dev, 'npx supabase start --workdir .')
  assert.equal(
    serverPackageJson.scripts?.['functions:serve'],
    'npx supabase functions serve --env-file ./.env.local --workdir .',
  )
  assert.equal(
    serverPackageJson.scripts?.['db:apply:local'],
    'npx supabase db push --local --workdir .',
  )
  assert.equal(serverPackageJson.scripts?.build, 'npm run typecheck')
  assert.equal(
    serverPackageJson.scripts?.typecheck,
    'node ./scripts/supabase-functions-typecheck.mjs',
  )
  assert.equal(
    packageJson.scripts?.verify,
    'npm run format:check && npm run lint && npm run typecheck && npm run test && npm run frontend:policy:check',
  )
  assert.equal(
    await readFile(path.join(targetRoot, 'server', '.npmrc'), 'utf8'),
    'legacy-peer-deps=true\n',
  )
  assert.match(serverDbApplyScript, /npx/)
  assert.match(serverTypecheckScript, /const denoCommand =/)
  assert.match(serverTypecheckScript, /\['check'/)
  assert.match(serverTypecheckScript, /path\.join\(serverRoot, 'supabase', 'functions'\)/)
})

test('applyRootTemplates emits bun-specific workspace manifest and scripts', async (t) => {
  const targetRoot = await createTempTargetRoot(t)
  const tokens = createTokens('bun')

  await applyRootTemplates(targetRoot, tokens, ['frontend', 'server'])
  await applyWorkspaceProjectTemplate(targetRoot, 'frontend', tokens)
  await applyServerPackageTemplate(targetRoot, tokens)

  const packageJson = JSON.parse(await readFile(path.join(targetRoot, 'package.json'), 'utf8')) as {
    packageManager?: string
    workspaces?: string[]
    scripts?: Record<string, string>
  }
  const frontendProject = JSON.parse(
    await readFile(path.join(targetRoot, 'frontend', 'project.json'), 'utf8'),
  ) as {
    targets?: Record<string, { command?: string }>
  }
  const serverPackageJson = JSON.parse(
    await readFile(path.join(targetRoot, 'server', 'package.json'), 'utf8'),
  ) as {
    scripts?: Record<string, string>
    dependencies?: Record<string, string>
  }
  const serverDbApplyScript = await readFile(
    path.join(targetRoot, 'server', 'scripts', 'supabase-db-apply.mjs'),
    'utf8',
  )
  const serverTypecheckScript = await readFile(
    path.join(targetRoot, 'server', 'scripts', 'supabase-functions-typecheck.mjs'),
    'utf8',
  )

  assert.equal(packageJson.packageManager, 'bun@1.3.4')
  assert.deepEqual(packageJson.workspaces, ['frontend', 'server'])
  assert.equal(frontendProject.targets?.build.command, 'bun run --cwd frontend build')
  assert.equal(serverPackageJson.scripts?.dev, 'bunx supabase start --workdir .')
  assert.equal(
    serverPackageJson.scripts?.['functions:serve'],
    'bunx supabase functions serve --env-file ./.env.local --workdir .',
  )
  assert.equal(
    serverPackageJson.scripts?.['db:apply:local'],
    'bunx supabase db push --local --workdir .',
  )
  assert.equal(serverPackageJson.scripts?.build, 'bun run typecheck')
  assert.equal(
    serverPackageJson.scripts?.typecheck,
    'node ./scripts/supabase-functions-typecheck.mjs',
  )
  assert.equal(
    packageJson.scripts?.verify,
    'bun run format:check && bun run lint && bun run typecheck && bun run test && bun run frontend:policy:check',
  )
  assert.match(serverDbApplyScript, /bunx/)
  assert.match(serverTypecheckScript, /const denoCommand =/)
  assert.match(serverTypecheckScript, /\['check'/)
  assert.match(serverTypecheckScript, /path\.join\(serverRoot, 'supabase', 'functions'\)/)
})

test('applyFirebaseServerWorkspaceTemplate creates firebase server skeleton with package-manager aware scripts', async (t) => {
  const targetRoot = await createTempTargetRoot(t)
  const tokens = createTokens('pnpm')

  await applyFirebaseServerWorkspaceTemplate(targetRoot, tokens, {
    projectId: 'ebook-firebase',
    functionRegion: 'us-central1',
  })

  const serverPackageJson = JSON.parse(
    await readFile(path.join(targetRoot, 'server', 'package.json'), 'utf8'),
  ) as {
    scripts?: Record<string, string>
    dependencies?: Record<string, string>
  }
  const firebaserc = JSON.parse(
    await readFile(path.join(targetRoot, 'server', '.firebaserc'), 'utf8'),
  ) as {
    projects?: {
      default?: string
    }
  }
  const firebaseJson = JSON.parse(
    await readFile(path.join(targetRoot, 'server', 'firebase.json'), 'utf8'),
  ) as {
    functions?: Array<{
      predeploy?: string[]
    }>
    firestore?: {
      rules?: string
      indexes?: string
    }
  }
  const functionsTsconfig = JSON.parse(
    await readFile(path.join(targetRoot, 'server', 'functions', 'tsconfig.json'), 'utf8'),
  ) as {
    compilerOptions?: {
      skipLibCheck?: boolean
    }
  }
  const functionsPackageJson = JSON.parse(
    await readFile(path.join(targetRoot, 'server', 'functions', 'package.json'), 'utf8'),
  ) as {
    scripts?: Record<string, string>
    engines?: {
      node?: string
    }
    dependencies?: Record<string, string>
    devDependencies?: Record<string, string>
  }
  const serverFirestoreRules = await readFile(
    path.join(targetRoot, 'server', 'firestore.rules'),
    'utf8',
  )
  const serverFirestoreIndexes = JSON.parse(
    await readFile(path.join(targetRoot, 'server', 'firestore.indexes.json'), 'utf8'),
  ) as {
    indexes?: unknown[]
    fieldOverrides?: unknown[]
  }
  const ensureFirestoreScript = await readFile(
    path.join(targetRoot, 'server', 'scripts', 'firebase-ensure-firestore.mjs'),
    'utf8',
  )
  const functionEntry = await readFile(
    path.join(targetRoot, 'server', 'functions', 'src', 'index.ts'),
    'utf8',
  )
  const publicStatusSource = await readFile(
    path.join(targetRoot, 'server', 'functions', 'src', 'public-status.ts'),
    'utf8',
  )
  const seedPublicStatusSource = await readFile(
    path.join(targetRoot, 'server', 'functions', 'src', 'seed-public-status.ts'),
    'utf8',
  )
  const deployScript = await readFile(
    path.join(targetRoot, 'server', 'scripts', 'firebase-functions-deploy.mjs'),
    'utf8',
  )

  assert.equal(firebaserc.projects?.default, 'ebook-firebase')
  assert.equal(serverPackageJson.dependencies?.['google-auth-library'], '^10.6.1')
  assert.equal(
    serverPackageJson.scripts?.build,
    'pnpm --dir ./functions install --ignore-workspace && pnpm --dir ./functions build',
  )
  assert.equal(
    serverPackageJson.scripts?.typecheck,
    'pnpm --dir ./functions install --ignore-workspace && pnpm --dir ./functions typecheck',
  )
  assert.equal(
    serverPackageJson.scripts?.deploy,
    'pnpm --dir ./functions install --ignore-workspace && node ./scripts/firebase-functions-deploy.mjs',
  )
  assert.equal(
    serverPackageJson.scripts?.['firestore:ensure'],
    'node ./scripts/firebase-ensure-firestore.mjs',
  )
  assert.equal(
    serverPackageJson.scripts?.['deploy:firestore'],
    'node ./scripts/firebase-functions-deploy.mjs --only firestore:rules,firestore:indexes',
  )
  assert.equal(
    serverPackageJson.scripts?.['seed:public-status'],
    'pnpm --dir ./functions install --ignore-workspace && pnpm --dir ./functions seed:public-status',
  )
  assert.equal(
    serverPackageJson.scripts?.['setup:public-status'],
    'pnpm firestore:ensure && pnpm deploy:firestore && pnpm seed:public-status',
  )
  assert.equal(
    firebaseJson.functions?.[0]?.predeploy?.[0],
    'pnpm --dir "$RESOURCE_DIR" install --ignore-workspace && pnpm --dir "$RESOURCE_DIR" build',
  )
  assert.equal(firebaseJson.firestore?.rules, 'firestore.rules')
  assert.equal(firebaseJson.firestore?.indexes, 'firestore.indexes.json')
  assert.equal(functionsTsconfig.compilerOptions?.skipLibCheck, true)
  assert.equal(functionsPackageJson.dependencies?.['firebase-admin'], '^13.6.0')
  assert.equal(functionsPackageJson.dependencies?.['firebase-functions'], '^7.0.0')
  assert.equal(functionsPackageJson.dependencies?.['@google-cloud/functions-framework'], '^3.4.5')
  assert.equal(functionsPackageJson.engines?.node, '22')
  assert.equal(functionsPackageJson.scripts?.test, 'tsx --test src/**/*.test.ts')
  assert.equal(
    functionsPackageJson.scripts?.['seed:public-status'],
    'tsx src/seed-public-status.ts',
  )
  assert.equal(functionsPackageJson.devDependencies?.tsx, '^4.20.5')
  assert.equal(functionsPackageJson.devDependencies?.typescript, '^5.7.3')
  assert.match(serverFirestoreRules, /rules_version = '2'/)
  assert.deepEqual(serverFirestoreIndexes.indexes, [])
  assert.deepEqual(serverFirestoreIndexes.fieldOverrides, [])
  assert.match(functionEntry, /region: 'us-central1'/)
  assert.match(functionEntry, /export const getPublicStatus = onCall/)
  assert.match(functionEntry, /normalizedPath === '\/public-status'/)
  assert.match(publicStatusSource, /buildPublicAppStatusDocument/)
  assert.match(seedPublicStatusSource, /function stripWrappingQuotes\(value: string\)/)
  assert.match(seedPublicStatusSource, /function loadLocalEnv\(filePath: string\)/)
  assert.match(seedPublicStatusSource, /const result: Record<string, string> = \{\}/)
  assert.match(seedPublicStatusSource, /FIREBASE_PROJECT_ID is required/)
  assert.doesNotMatch(functionEntry, new RegExp(FIREBASE_DEFAULT_FUNCTION_REGION))
  assert.match(deployScript, /FIREBASE_PROJECT_ID/)
  assert.match(deployScript, /functions,firestore:rules,firestore:indexes/)
  assert.match(deployScript, /--only/)
  assert.match(deployScript, /FIREBASE_TOKEN/)
  assert.match(deployScript, /GOOGLE_APPLICATION_CREDENTIALS/)
  assert.match(deployScript, /firebase-tools/)
  assert.match(ensureFirestoreScript, /google-auth-library/)
  assert.match(ensureFirestoreScript, /firestore\.googleapis\.com:enable/)
})

test('applyFirebaseServerWorkspaceTemplate emits bun-compatible predeploy commands', async (t) => {
  const targetRoot = await createTempTargetRoot(t)
  const tokens = createTokens('bun')

  await applyFirebaseServerWorkspaceTemplate(targetRoot, tokens, {
    projectId: 'ebook-firebase',
    functionRegion: 'us-central1',
  })

  const serverPackageJson = JSON.parse(
    await readFile(path.join(targetRoot, 'server', 'package.json'), 'utf8'),
  ) as {
    scripts?: Record<string, string>
  }
  const firebaseJson = JSON.parse(
    await readFile(path.join(targetRoot, 'server', 'firebase.json'), 'utf8'),
  ) as {
    functions?: Array<{
      predeploy?: string[]
    }>
  }

  assert.equal(
    serverPackageJson.scripts?.build,
    'bun install --cwd ./functions && bun run --cwd ./functions build',
  )
  assert.equal(
    firebaseJson.functions?.[0]?.predeploy?.[0],
    'bun install --cwd "$RESOURCE_DIR" && bun run --cwd "$RESOURCE_DIR" build',
  )
})

test('applyFirebaseServerWorkspaceTemplate emits plain npm predeploy commands and writes npmrc files', async (t) => {
  const targetRoot = await createTempTargetRoot(t)
  const tokens = createTokens('npm')

  await applyFirebaseServerWorkspaceTemplate(targetRoot, tokens, {
    projectId: 'ebook-firebase',
    functionRegion: 'us-central1',
  })

  const serverPackageJson = JSON.parse(
    await readFile(path.join(targetRoot, 'server', 'package.json'), 'utf8'),
  ) as {
    scripts?: Record<string, string>
  }
  const firebaseJson = JSON.parse(
    await readFile(path.join(targetRoot, 'server', 'firebase.json'), 'utf8'),
  ) as {
    functions?: Array<{
      predeploy?: string[]
    }>
  }
  const serverNpmrc = await readFile(path.join(targetRoot, 'server', '.npmrc'), 'utf8')
  const functionsNpmrc = await readFile(
    path.join(targetRoot, 'server', 'functions', '.npmrc'),
    'utf8',
  )

  assert.equal(
    serverPackageJson.scripts?.build,
    'npm --prefix ./functions install && npm --prefix ./functions run build',
  )
  assert.equal(
    firebaseJson.functions?.[0]?.predeploy?.[0],
    'npm --prefix "$RESOURCE_DIR" install && npm --prefix "$RESOURCE_DIR" run build',
  )
  assert.equal(serverNpmrc, 'legacy-peer-deps=true\n')
  assert.equal(functionsNpmrc, 'legacy-peer-deps=true\n')
})

test('applyFirebaseServerWorkspaceTemplate creates yarn-isolated functions project assets for yarn', async (t) => {
  const targetRoot = await createTempTargetRoot(t)
  const tokens = createTokens('yarn')

  await applyFirebaseServerWorkspaceTemplate(targetRoot, tokens, {
    projectId: 'ebook-firebase',
  })

  const functionsGitignore = await readFile(
    path.join(targetRoot, 'server', 'functions', '.gitignore'),
    'utf8',
  )
  const functionsYarnrc = await readFile(
    path.join(targetRoot, 'server', 'functions', '.yarnrc.yml'),
    'utf8',
  )
  const functionsYarnLock = await readFile(
    path.join(targetRoot, 'server', 'functions', 'yarn.lock'),
    'utf8',
  )
  const firebaseJson = JSON.parse(
    await readFile(path.join(targetRoot, 'server', 'firebase.json'), 'utf8'),
  ) as {
    functions?: Array<{
      predeploy?: string[]
    }>
  }
  const serverPackageJson = JSON.parse(
    await readFile(path.join(targetRoot, 'server', 'package.json'), 'utf8'),
  ) as {
    scripts?: Record<string, string>
  }

  assert.equal(functionsYarnLock, '')
  assert.match(functionsYarnrc, /nodeLinker: node-modules/)
  assert.match(functionsGitignore, /^\.yarn\/?$/m)
  assert.match(functionsGitignore, /^\.pnp\.\*$/m)
  assert.equal(
    serverPackageJson.scripts?.build,
    'yarn --cwd ./functions install && yarn --cwd ./functions build',
  )
  assert.equal(
    firebaseJson.functions?.[0]?.predeploy?.[0],
    'yarn --cwd "$RESOURCE_DIR" install && yarn --cwd "$RESOURCE_DIR" build',
  )
})

test('syncRootWorkspaceManifest adds newly added workspaces to existing root manifests', async (t) => {
  const pnpmRoot = await createTempTargetRoot(t)
  const yarnRoot = await createTempTargetRoot(t)
  const npmRoot = await createTempTargetRoot(t)
  const bunRoot = await createTempTargetRoot(t)

  await applyRootTemplates(pnpmRoot, createTokens('pnpm'), ['frontend'])
  await applyRootTemplates(yarnRoot, createTokens('yarn'), ['frontend'])
  await applyRootTemplates(npmRoot, createTokens('npm'), ['frontend'])
  await applyRootTemplates(bunRoot, createTokens('bun'), ['frontend'])

  await syncRootWorkspaceManifest(pnpmRoot, 'pnpm', [
    'frontend',
    'server',
    'packages/contracts',
    'packages/app-router',
  ])
  await syncRootWorkspaceManifest(yarnRoot, 'yarn', [
    'frontend',
    'backoffice',
    'packages/contracts',
    'packages/app-router',
  ])
  await syncRootWorkspaceManifest(npmRoot, 'npm', [
    'frontend',
    'server',
    'packages/contracts',
    'packages/app-router',
  ])
  await syncRootWorkspaceManifest(bunRoot, 'bun', [
    'frontend',
    'backoffice',
    'packages/contracts',
    'packages/app-router',
  ])

  const pnpmWorkspaceManifest = await readFile(path.join(pnpmRoot, 'pnpm-workspace.yaml'), 'utf8')
  const yarnPackageJson = JSON.parse(
    await readFile(path.join(yarnRoot, 'package.json'), 'utf8'),
  ) as {
    workspaces?: string[]
  }
  const npmPackageJson = JSON.parse(await readFile(path.join(npmRoot, 'package.json'), 'utf8')) as {
    workspaces?: string[]
  }
  const bunPackageJson = JSON.parse(await readFile(path.join(bunRoot, 'package.json'), 'utf8')) as {
    workspaces?: string[]
  }

  assert.equal(pnpmWorkspaceManifest, 'packages:\n  - frontend\n  - server\n  - packages/*\n')
  assert.deepEqual(yarnPackageJson.workspaces, ['frontend', 'packages/*', 'backoffice'])
  assert.deepEqual(npmPackageJson.workspaces, ['frontend', 'server', 'packages/*'])
  assert.deepEqual(bunPackageJson.workspaces, ['frontend', 'packages/*', 'backoffice'])
})

test('syncOptionalDocsTemplates injects worktree docs and golden rule when worktree is enabled', async (t) => {
  const targetRoot = await createTempTargetRoot(t)
  const tokens = createTokens('pnpm')

  await applyDocsTemplates(targetRoot, tokens)
  await syncOptionalDocsTemplates(targetRoot, tokens, {
    hasBackoffice: false,
    serverProvider: null,
    hasTrpc: false,
    hasWorktreePolicy: true,
  })

  const agents = await readFile(path.join(targetRoot, 'AGENTS.md'), 'utf8')
  const docsIndex = await readFile(path.join(targetRoot, 'docs', 'index.md'), 'utf8')
  const harnessGuide = await readFile(
    path.join(targetRoot, 'docs', 'engineering', '하네스-실행가이드.md'),
    'utf8',
  )

  assert.match(agents, /worktree-workflow\.md/)
  assert.match(agents, /9\. Worktree discipline:/)
  assert.match(docsIndex, /Worktree workflow/)
  assert.match(
    agents,
    /plain clone 상태라면 README의 bootstrap 절차를 먼저 실행하고, 새 작업은 반드시 control root에서 `git -C main worktree add -b <branch-name> \.\.\/<branch-name> main`으로 시작하며, 브랜치명에는 `\/`를 쓰지 않고 1-depth kebab-case를 쓰며, `main\/`과 sibling worktree에서만 작업하며/,
  )
  assert.match(
    harnessGuide,
    /14\. 이 repo는 control root worktree 운영을 기준으로 한다\. plain clone 상태라면 README bootstrap을 먼저 실행하고, 새 브랜치 작업은 control root에서 `git -C main worktree add -b <branch-name> \.\.\/<branch-name> main`으로 시작하며, 브랜치명에는 `\/`를 쓰지 않고 1-depth kebab-case를 쓴다\./,
  )
  assert.match(harnessGuide, /15\. 브랜치 생성, 커밋, 브랜치 푸시, PR 생성 순으로 마무리한다\./)
  assert.equal(
    await pathExists(path.join(targetRoot, 'docs', 'engineering', 'worktree-workflow.md')),
    true,
  )
  assert.equal(
    await pathExists(path.join(targetRoot, 'scripts', 'worktree', 'bootstrap-control-root.mjs')),
    true,
  )
  assert.equal(
    await pathExists(path.join(targetRoot, 'scripts', 'worktree', 'post-merge-cleanup.sh')),
    true,
  )
})

test('syncOptionalDocsTemplates numbers worktree golden rule after trpc when both are enabled', async (t) => {
  const targetRoot = await createTempTargetRoot(t)
  const tokens = createTokens('pnpm')

  await applyDocsTemplates(targetRoot, tokens)
  await syncOptionalDocsTemplates(targetRoot, tokens, {
    hasBackoffice: false,
    serverProvider: 'cloudflare',
    hasTrpc: true,
    hasWorktreePolicy: true,
  })

  const agents = await readFile(path.join(targetRoot, 'AGENTS.md'), 'utf8')

  assert.match(agents, /9\. Boundary types from schema only:/)
  assert.match(agents, /10\. Worktree discipline:/)
})
