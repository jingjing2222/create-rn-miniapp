import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { getPackageManagerAdapter } from '../package-manager.js'
import type { PackageManager } from '../package-manager.js'
import type { ServerProvider } from '../providers/index.js'
import type { TemplateTokens } from './index.js'

export const TRPC_WORKSPACE_PATH = 'packages/trpc' as const
export const TRPC_PACKAGE_NAME = '@workspace/trpc'
export const TRPC_SERVER_VERSION = '^11.13.4'
export const TRPC_CLIENT_VERSION = '^11.13.4'
export const ZOD_VERSION = '^4.3.6'
const NX_PROJECT_SCHEMA_URL =
  'https://raw.githubusercontent.com/nrwl/nx/master/packages/nx/schemas/project-schema.json'

type SupportedTrpcProvider = Extract<ServerProvider, 'supabase' | 'cloudflare'>

type ApplyTrpcWorkspaceTemplateOptions = {
  serverProvider: SupportedTrpcProvider
}

async function writeJsonFile(targetPath: string, value: unknown) {
  await mkdir(path.dirname(targetPath), { recursive: true })
  await writeFile(targetPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

async function writeTextFile(targetPath: string, contents: string) {
  await mkdir(path.dirname(targetPath), { recursive: true })
  await writeFile(targetPath, contents, 'utf8')
}

function renderTrpcWorkspacePackageJson(packageManager: PackageManager) {
  const adapter = getPackageManagerAdapter(packageManager)

  return {
    name: TRPC_PACKAGE_NAME,
    private: true,
    version: '0.1.0',
    type: 'module',
    sideEffects: false,
    packageManager: adapter.packageManagerField,
    exports: {
      '.': {
        types: './src/index.ts',
        default: './src/index.ts',
      },
    },
    types: './src/index.ts',
    scripts: {
      build: 'tsc -p tsconfig.json',
      typecheck: 'tsc -p tsconfig.json --noEmit',
      test: `node -e "console.log('trpc workspace test placeholder')"`,
    },
    dependencies: {
      '@trpc/server': TRPC_SERVER_VERSION,
      zod: ZOD_VERSION,
    },
  }
}

function renderTrpcWorkspaceTsconfig() {
  return {
    compilerOptions: {
      target: 'ES2022',
      module: 'ESNext',
      moduleResolution: 'Bundler',
      strict: true,
      skipLibCheck: true,
      declaration: true,
      outDir: 'dist',
      rootDir: 'src',
      composite: true,
      noEmitOnError: true,
    },
    include: ['src/**/*.ts'],
  }
}

function renderTrpcWorkspaceProjectJson(packageManager: PackageManager) {
  const adapter = getPackageManagerAdapter(packageManager)

  return {
    name: 'trpc',
    $schema: NX_PROJECT_SCHEMA_URL,
    sourceRoot: `${TRPC_WORKSPACE_PATH}/src`,
    targets: {
      build: {
        command: adapter.runScriptInDirectoryCommand(TRPC_WORKSPACE_PATH, 'build'),
      },
      typecheck: {
        command: adapter.runScriptInDirectoryCommand(TRPC_WORKSPACE_PATH, 'typecheck'),
      },
      test: {
        command: adapter.runScriptInDirectoryCommand(TRPC_WORKSPACE_PATH, 'test'),
      },
    },
  }
}

function renderTrpcWorkspaceReadme(options: ApplyTrpcWorkspaceTemplateOptions) {
  return [
    '# packages/trpc',
    '',
    '이 워크스페이스는 tRPC router와 `AppRouter` 타입의 source of truth예요.',
    '',
    '- `frontend`와 `backoffice`는 server를 직접 참조하지 않아요. 여기서 타입만 가져와요.',
    `- 지금 선택한 provider는 \`${options.serverProvider}\`라서, server runtime에서는 이 내용을 provider별 mirror 경로로 sync해서 써요.`,
    '- 그래서 generated repo에서 `../../server/...` import나 tsconfig path alias를 강제로 만들지 않아도 돼요.',
    '',
    '## 구조',
    '',
    '```text',
    'packages/trpc/',
    '  src/context.ts',
    '  src/init.ts',
    '  src/routers/example.ts',
    '  src/root.ts',
    '  src/index.ts',
    '```',
    '',
    '## 운영 메모',
    '',
    '- 이 패키지는 router 정의와 타입만 canonical로 관리해요.',
    '- Cloudflare / Supabase runtime adapter는 각 provider server workspace 안에서 따로 가져가요.',
    '',
  ].join('\n')
}

function renderTrpcContextSource() {
  return ['export type AppTrpcContext = {', '  requestId: string | null', '}', ''].join('\n')
}

function renderTrpcInitSource() {
  return [
    "import { initTRPC } from '@trpc/server'",
    "import type { AppTrpcContext } from './context'",
    '',
    'const t = initTRPC.context<AppTrpcContext>().create()',
    '',
    'export const createTRPCRouter = t.router',
    'export const publicProcedure = t.procedure',
    '',
  ].join('\n')
}

function renderTrpcExampleRouterSource() {
  return [
    "import { z } from 'zod'",
    "import { createTRPCRouter, publicProcedure } from '../init'",
    '',
    'export const exampleRouter = createTRPCRouter({',
    '  ping: publicProcedure.query(() => ({',
    '    ok: true,',
    "    message: 'pong',",
    '  })),',
    '  echo: publicProcedure',
    '    .input(',
    '      z.object({',
    '        message: z.string().min(1),',
    '      }),',
    '    )',
    '    .query(({ ctx, input }) => ({',
    '      message: input.message,',
    '      requestId: ctx.requestId,',
    '    })),',
    '})',
    '',
  ].join('\n')
}

function renderTrpcRootSource() {
  return [
    "import { createTRPCRouter } from './init'",
    "import { exampleRouter } from './routers/example'",
    '',
    'export const appRouter = createTRPCRouter({',
    '  example: exampleRouter,',
    '})',
    '',
    'export type AppRouter = typeof appRouter',
    '',
  ].join('\n')
}

function renderTrpcIndexSource() {
  return [
    "export { appRouter } from './root'",
    "export type { AppRouter } from './root'",
    "export type { AppTrpcContext } from './context'",
    '',
  ].join('\n')
}

export async function applyTrpcWorkspaceTemplate(
  targetRoot: string,
  tokens: TemplateTokens,
  options: ApplyTrpcWorkspaceTemplateOptions,
) {
  const trpcRoot = path.join(targetRoot, TRPC_WORKSPACE_PATH)

  await writeJsonFile(
    path.join(trpcRoot, 'package.json'),
    renderTrpcWorkspacePackageJson(tokens.packageManager),
  )
  await writeJsonFile(path.join(trpcRoot, 'tsconfig.json'), renderTrpcWorkspaceTsconfig())
  await writeJsonFile(
    path.join(trpcRoot, 'project.json'),
    renderTrpcWorkspaceProjectJson(tokens.packageManager),
  )
  await writeTextFile(path.join(trpcRoot, 'README.md'), renderTrpcWorkspaceReadme(options))
  await writeTextFile(path.join(trpcRoot, 'src', 'context.ts'), renderTrpcContextSource())
  await writeTextFile(path.join(trpcRoot, 'src', 'init.ts'), renderTrpcInitSource())
  await writeTextFile(
    path.join(trpcRoot, 'src', 'routers', 'example.ts'),
    renderTrpcExampleRouterSource(),
  )
  await writeTextFile(path.join(trpcRoot, 'src', 'root.ts'), renderTrpcRootSource())
  await writeTextFile(path.join(trpcRoot, 'src', 'index.ts'), renderTrpcIndexSource())
}
