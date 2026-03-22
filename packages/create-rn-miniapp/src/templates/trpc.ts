import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { getPackageManagerAdapter } from '../package-manager.js'
import type { PackageManager } from '../package-manager.js'
import type { ServerProvider } from '../providers/index.js'
import { APP_ROUTER_WORKSPACE_PATH, CONTRACTS_WORKSPACE_PATH } from '../trpc-workspace-metadata.js'
import type { TemplateTokens } from './types.js'
import { dedentWithTrailingNewline } from '../dedent.js'

export const APP_ROUTER_PACKAGE_NAME = '@workspace/app-router'
export const APP_ROUTER_WORKSPACE_DEPENDENCY = 'workspace:*'
export const CONTRACTS_PACKAGE_NAME = '@workspace/contracts'
export const CONTRACTS_WORKSPACE_DEPENDENCY = 'workspace:*'
export const TRPC_CLIENT_VERSION = '^11.13.4'
export const TRPC_SERVER_VERSION = '^11.13.4'
export const ZOD_VERSION = '^4.3.6'
export const TSDOWN_VERSION = '^0.21.4'
const NX_PROJECT_SCHEMA_URL =
  'https://raw.githubusercontent.com/nrwl/nx/master/packages/nx/schemas/project-schema.json'

type SupportedTrpcProvider = Extract<ServerProvider, 'cloudflare'>

type ApplyTrpcWorkspaceTemplateOptions = {
  serverProvider: SupportedTrpcProvider
}

export const TRPC_WORKSPACE_AGENTS_LINE = `\`${CONTRACTS_WORKSPACE_PATH}\`, \`${APP_ROUTER_WORKSPACE_PATH}\`: optional shared tRPC boundary packages`

export const TRPC_WORKSPACE_TOPOLOGY_ROOT_LINES = [
  `\`${CONTRACTS_WORKSPACE_PATH}\`: optional tRPC boundary schema / type source`,
  `\`${APP_ROUTER_WORKSPACE_PATH}\`: optional tRPC router / \`AppRouter\` source`,
]

export const TRPC_CONTRACTS_WORKSPACE_ROLE_SECTION = {
  heading: CONTRACTS_WORKSPACE_PATH,
  lines: [
    '- boundary input/output schema와 경계 타입의 source of truth다.',
    '- consumer는 root import만 사용하고 src 상대 경로를 내려가지 않는다.',
  ],
}

export const TRPC_APP_ROUTER_WORKSPACE_ROLE_SECTION = {
  heading: APP_ROUTER_WORKSPACE_PATH,
  lines: [
    '- route shape와 `AppRouter` 타입의 source of truth다.',
    '- Worker runtime과 client는 이 package를 기준으로 타입을 맞춘다.',
  ],
}

export const TRPC_WORKSPACE_IMPORT_BOUNDARY_RULES = [
  `shared contract가 필요하면 \`${CONTRACTS_WORKSPACE_PATH}\`, \`${APP_ROUTER_WORKSPACE_PATH}\`로 올린다.`,
]

export const TRPC_SERVER_README_WORKSPACE_LINES = [
  `- tRPC를 같이 골랐다면 \`${CONTRACTS_WORKSPACE_PATH}\`가 boundary schema의 source of truth이고, \`${APP_ROUTER_WORKSPACE_PATH}\`가 router와 \`AppRouter\` 타입의 source of truth예요.`,
  '- miniapp frontend는 `frontend/src/lib/trpc.ts`, backoffice는 `backoffice/src/lib/trpc.ts`에서 Worker `/trpc` endpoint를 호출해요.',
  '- Worker runtime은 `@workspace/app-router`를 직접 import해서 같은 router를 바로 써요.',
  '- `GET /` 는 ready JSON을 반환하고, 실제 tRPC 호출은 `/trpc` endpoint로 들어가요.',
]

export const TRPC_SERVER_README_API_SSOT_LINES = [
  `- tRPC를 같이 골랐다면 \`${CONTRACTS_WORKSPACE_PATH}\`가 boundary type과 schema의 source of truth예요.`,
  `- 같은 경우 \`${APP_ROUTER_WORKSPACE_PATH}\`가 route shape와 \`AppRouter\` 타입의 source of truth예요.`,
  '- route shape를 바꾸고 싶으면 먼저 shared package 두 개를 수정한 뒤 `dev`, `build`, `deploy`를 다시 실행하면 돼요.',
  '- runtime verify는 `GET /`, 실제 router entry는 `/trpc` endpoint를 기준으로 보면 돼요.',
]

export const TRPC_SERVER_README_OPERATION_NOTE = `- tRPC를 같이 썼다면 boundary contract은 \`${CONTRACTS_WORKSPACE_PATH}\`, router는 \`${APP_ROUTER_WORKSPACE_PATH}\`만 수정하고 \`dev\`, \`build\`, \`deploy\`를 다시 실행하면 돼요.`

async function writeJsonFile(targetPath: string, value: unknown) {
  await mkdir(path.dirname(targetPath), { recursive: true })
  await writeFile(targetPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

async function writeTextFile(targetPath: string, contents: string) {
  await mkdir(path.dirname(targetPath), { recursive: true })
  await writeFile(targetPath, contents, 'utf8')
}

function renderSharedWorkspaceTsconfig() {
  return {
    compilerOptions: {
      target: 'ES2022',
      module: 'ESNext',
      moduleResolution: 'Bundler',
      strict: true,
      skipLibCheck: true,
      allowImportingTsExtensions: true,
      rewriteRelativeImportExtensions: true,
      declaration: true,
      outDir: 'dist',
      rootDir: 'src',
      composite: true,
      noEmitOnError: true,
    },
    include: ['src/**/*.ts'],
  }
}

function renderContractsPackageJson(packageManager: PackageManager) {
  const adapter = getPackageManagerAdapter(packageManager)

  return {
    name: CONTRACTS_PACKAGE_NAME,
    private: true,
    version: '0.1.0',
    type: 'module',
    sideEffects: false,
    files: ['dist'],
    packageManager: adapter.packageManagerField,
    exports: {
      '.': {
        types: './dist/index.d.mts',
        import: './dist/index.mjs',
        require: './dist/index.cjs',
        default: './dist/index.mjs',
      },
    },
    main: './dist/index.cjs',
    types: './dist/index.d.mts',
    scripts: {
      build: 'tsdown src/index.ts --format esm,cjs --dts --clean --out-dir dist',
      typecheck: 'tsc -p tsconfig.json --noEmit',
      test: `node -e "console.log('contracts workspace test placeholder')"`,
    },
    dependencies: {
      zod: ZOD_VERSION,
    },
    devDependencies: {
      tsdown: TSDOWN_VERSION,
    },
  }
}

function renderAppRouterPackageJson(packageManager: PackageManager) {
  const adapter = getPackageManagerAdapter(packageManager)
  const buildContractsCommand = adapter.runScriptInDirectoryCommand('../contracts', 'build')

  return {
    name: APP_ROUTER_PACKAGE_NAME,
    private: true,
    version: '0.1.0',
    type: 'module',
    sideEffects: false,
    files: ['dist'],
    packageManager: adapter.packageManagerField,
    exports: {
      '.': {
        types: './dist/index.d.mts',
        import: './dist/index.mjs',
        require: './dist/index.cjs',
        default: './dist/index.mjs',
      },
    },
    main: './dist/index.cjs',
    types: './dist/index.d.mts',
    scripts: {
      build: `${buildContractsCommand} && tsdown src/index.ts --format esm,cjs --dts --clean --out-dir dist`,
      typecheck: `${buildContractsCommand} && tsc -p tsconfig.json --noEmit`,
      test: `node -e "console.log('app-router workspace test placeholder')"`,
    },
    dependencies: {
      '@trpc/server': TRPC_SERVER_VERSION,
      [CONTRACTS_PACKAGE_NAME]: CONTRACTS_WORKSPACE_DEPENDENCY,
    },
    devDependencies: {
      tsdown: TSDOWN_VERSION,
    },
  }
}

function renderSharedWorkspaceProjectJson(
  packageManager: PackageManager,
  options: {
    name: 'contracts' | 'app-router'
    sourceRoot: string
    workspacePath: typeof CONTRACTS_WORKSPACE_PATH | typeof APP_ROUTER_WORKSPACE_PATH
  },
) {
  const adapter = getPackageManagerAdapter(packageManager)

  return {
    name: options.name,
    $schema: NX_PROJECT_SCHEMA_URL,
    sourceRoot: options.sourceRoot,
    targets: {
      build: {
        command: adapter.runScriptInDirectoryCommand(options.workspacePath, 'build'),
      },
      typecheck: {
        command: adapter.runScriptInDirectoryCommand(options.workspacePath, 'typecheck'),
      },
      test: {
        command: adapter.runScriptInDirectoryCommand(options.workspacePath, 'test'),
      },
    },
  }
}

function renderContractsReadme() {
  return dedentWithTrailingNewline`
  # ${CONTRACTS_WORKSPACE_PATH}

  이 워크스페이스는 client-server boundary contract의 source of truth예요.

  - Zod schema는 여기서만 정의해요.
  - boundary type은 \`z.infer\`로만 파생해요.
  - 같은 DTO를 \`interface\`나 별도 수동 type alias로 중복 선언하지 않아요.

  ## 구조

  \`\`\`text
  ${CONTRACTS_WORKSPACE_PATH}/
    src/example.ts
    src/index.ts
  \`\`\`

  ## 운영 메모

  - 경계 타입이 바뀌면 먼저 여기 schema를 수정해요.
  - package root import는 \`dist\`를 보게 되고, build는 \`tsdown\`이 맡아요.
  - client와 server는 같은 schema를 runtime과 type 양쪽에서 공유해요.
`
}

function renderAppRouterReadme(_options: ApplyTrpcWorkspaceTemplateOptions) {
  return dedentWithTrailingNewline`
  # ${APP_ROUTER_WORKSPACE_PATH}

  이 워크스페이스는 tRPC router와 \`AppRouter\` 타입의 source of truth예요.

  - \`${CONTRACTS_WORKSPACE_PATH}\`의 schema를 써서 procedure input/output을 맞춰요.
  - \`frontend\`와 \`backoffice\`는 server를 직접 참조하지 않고 여기서 \`AppRouter\` 타입만 가져와요.
  - 지금 선택한 provider는 \`cloudflare\`라서, Worker runtime이 이 워크스페이스를 직접 import해요.

  ## 구조

  \`\`\`text
  ${APP_ROUTER_WORKSPACE_PATH}/
    src/context.ts
    src/init.ts
    src/routers/example.ts
    src/root.ts
    src/index.ts
  \`\`\`

  ## 운영 메모

  - route shape를 바꾸고 싶으면 먼저 \`${CONTRACTS_WORKSPACE_PATH}\`와 \`${APP_ROUTER_WORKSPACE_PATH}\`를 확인해요.
  - package root import는 \`dist\`를 보게 하니 \`src\` 상대 경로로 내려가지 말고 \`@workspace/app-router\`를 그대로 써요.
  - provider-specific runtime adapter는 각 \`server\` workspace 안에 남겨요.
`
}

function renderContractsExampleSource() {
  return dedentWithTrailingNewline`
  import { z } from 'zod'

  export const ExamplePingOutputSchema = z.object({
    ok: z.literal(true),
    message: z.literal('pong'),
  })

  export const ExampleEchoInputSchema = z.object({
    message: z.string().min(1),
  })

  export const ExampleEchoOutputSchema = z.object({
    message: z.string().min(1),
    requestId: z.string().nullable(),
  })

  export type ExamplePingOutput = z.infer<typeof ExamplePingOutputSchema>
  export type ExampleEchoInput = z.infer<typeof ExampleEchoInputSchema>
  export type ExampleEchoOutput = z.infer<typeof ExampleEchoOutputSchema>
`
}

function renderContractsIndexSource() {
  return dedentWithTrailingNewline`
  export { ExampleEchoInputSchema, ExampleEchoOutputSchema, ExamplePingOutputSchema } from './example.ts'
  export type { ExampleEchoInput, ExampleEchoOutput, ExamplePingOutput } from './example.ts'
`
}

function renderAppRouterContextSource() {
  return dedentWithTrailingNewline`
  export type AppTrpcContext = {
    requestId: string | null
  }
`
}

function renderAppRouterInitSource() {
  return dedentWithTrailingNewline`
  import { initTRPC } from '@trpc/server'
  import type { AppTrpcContext } from './context.ts'

  const t = initTRPC.context<AppTrpcContext>().create()

  export const createTRPCRouter = t.router
  export const publicProcedure = t.procedure
`
}

function renderAppRouterExampleRouterSource() {
  return dedentWithTrailingNewline`
  import { ExampleEchoInputSchema, ExampleEchoOutputSchema, ExamplePingOutputSchema } from '../../../contracts/src/index.ts'
  import { createTRPCRouter, publicProcedure } from '../init.ts'

  export const exampleRouter = createTRPCRouter({
    ping: publicProcedure.output(ExamplePingOutputSchema).query(() => ({
      ok: true,
      message: 'pong',
    })),
    echo: publicProcedure
      .input(ExampleEchoInputSchema)
      .output(ExampleEchoOutputSchema)
      .query(({ ctx, input }) => ({
        message: input.message,
        requestId: ctx.requestId,
      })),
  })
`
}

function renderAppRouterRootSource() {
  return dedentWithTrailingNewline`
  import { createTRPCRouter } from './init.ts'
  import { exampleRouter } from './routers/example.ts'

  export const appRouter = createTRPCRouter({
    example: exampleRouter,
  })

  export type AppRouter = typeof appRouter
`
}

function renderAppRouterIndexSource() {
  return dedentWithTrailingNewline`
  export { appRouter } from './root.ts'
  export type { AppRouter } from './root.ts'
  export type { AppTrpcContext } from './context.ts'
`
}

export async function applyTrpcWorkspaceTemplate(
  targetRoot: string,
  tokens: TemplateTokens,
  options: ApplyTrpcWorkspaceTemplateOptions,
) {
  const contractsRoot = path.join(targetRoot, CONTRACTS_WORKSPACE_PATH)
  const appRouterRoot = path.join(targetRoot, APP_ROUTER_WORKSPACE_PATH)

  await writeJsonFile(
    path.join(contractsRoot, 'package.json'),
    renderContractsPackageJson(tokens.packageManager),
  )
  await writeJsonFile(path.join(contractsRoot, 'tsconfig.json'), renderSharedWorkspaceTsconfig())
  await writeJsonFile(
    path.join(contractsRoot, 'project.json'),
    renderSharedWorkspaceProjectJson(tokens.packageManager, {
      name: 'contracts',
      sourceRoot: `${CONTRACTS_WORKSPACE_PATH}/src`,
      workspacePath: CONTRACTS_WORKSPACE_PATH,
    }),
  )
  await writeTextFile(path.join(contractsRoot, 'README.md'), renderContractsReadme())
  await writeTextFile(path.join(contractsRoot, 'src', 'example.ts'), renderContractsExampleSource())
  await writeTextFile(path.join(contractsRoot, 'src', 'index.ts'), renderContractsIndexSource())

  await writeJsonFile(
    path.join(appRouterRoot, 'package.json'),
    renderAppRouterPackageJson(tokens.packageManager),
  )
  await writeJsonFile(path.join(appRouterRoot, 'tsconfig.json'), renderSharedWorkspaceTsconfig())
  await writeJsonFile(
    path.join(appRouterRoot, 'project.json'),
    renderSharedWorkspaceProjectJson(tokens.packageManager, {
      name: 'app-router',
      sourceRoot: `${APP_ROUTER_WORKSPACE_PATH}/src`,
      workspacePath: APP_ROUTER_WORKSPACE_PATH,
    }),
  )
  await writeTextFile(path.join(appRouterRoot, 'README.md'), renderAppRouterReadme(options))
  await writeTextFile(path.join(appRouterRoot, 'src', 'context.ts'), renderAppRouterContextSource())
  await writeTextFile(path.join(appRouterRoot, 'src', 'init.ts'), renderAppRouterInitSource())
  await writeTextFile(
    path.join(appRouterRoot, 'src', 'routers', 'example.ts'),
    renderAppRouterExampleRouterSource(),
  )
  await writeTextFile(path.join(appRouterRoot, 'src', 'root.ts'), renderAppRouterRootSource())
  await writeTextFile(path.join(appRouterRoot, 'src', 'index.ts'), renderAppRouterIndexSource())
}
