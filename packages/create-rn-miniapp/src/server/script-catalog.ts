import { FIREBASE_TOOLS_CLI, SUPABASE_CLI } from '../runtime/external-tooling.js'
import { getPackageManagerAdapter, type PackageManager } from '../runtime/package-manager.js'

export type ServerScriptCatalogEntry = {
  name: string
  command: string
  readmeDescription: string
  includeInReadme?: boolean
  remoteOp?: boolean
}

export function createServerScriptRecord(entries: ServerScriptCatalogEntry[]) {
  return Object.fromEntries(entries.map((entry) => [entry.name, entry.command]))
}

function renderServerScriptInvocation(packageManager: PackageManager, scriptName: string) {
  return getPackageManagerAdapter(packageManager).runScript(scriptName)
}

export function renderServerReadmeScriptLines(
  entries: ServerScriptCatalogEntry[],
  packageManager: PackageManager,
) {
  return entries
    .filter((entry) => entry.includeInReadme !== false)
    .map(
      (entry) =>
        `- \`cd server && ${renderServerScriptInvocation(packageManager, entry.name)}\`: ${entry.readmeDescription}`,
    )
}

export function renderServerRemoteOpsCommands(
  entries: ServerScriptCatalogEntry[],
  packageManager: PackageManager,
) {
  return entries
    .filter((entry) => entry.remoteOp === true)
    .map((entry) => `cd server && ${renderServerScriptInvocation(packageManager, entry.name)}`)
}

export function createSupabaseServerScriptCatalog(packageManager: PackageManager) {
  const adapter = getPackageManagerAdapter(packageManager)

  return [
    {
      name: 'dev',
      command: adapter.dlxCommand(SUPABASE_CLI, ['start', '--workdir', '.']),
      readmeDescription: '로컬 Supabase stack을 시작해요.',
    },
    {
      name: 'build',
      command: adapter.runScript('typecheck'),
      readmeDescription: '`typecheck` alias를 실행해요.',
      includeInReadme: false,
    },
    {
      name: 'deno:install',
      command: 'node ./scripts/supabase-install-deno.mjs',
      readmeDescription: 'Supabase Edge Function용 Deno stable 버전을 설치하거나 업그레이드해요.',
      includeInReadme: false,
    },
    {
      name: 'typecheck',
      command: 'node ./scripts/supabase-functions-typecheck.mjs',
      readmeDescription:
        '`supabase/functions/*/index.ts` entrypoint를 `deno check`로 정적 검사해요.',
    },
    {
      name: 'db:apply',
      command: 'node ./scripts/supabase-db-apply.mjs',
      readmeDescription:
        '`server/.env.local`의 `SUPABASE_DB_PASSWORD`를 사용해 linked remote project에 migration을 적용해요.',
      remoteOp: true,
    },
    {
      name: 'db:apply:remote',
      command: 'node ./scripts/supabase-db-apply.mjs',
      readmeDescription: '`db:apply`의 remote alias예요.',
      includeInReadme: false,
    },
    {
      name: 'functions:serve',
      command: adapter.dlxCommand(SUPABASE_CLI, [
        'functions',
        'serve',
        '--env-file',
        './.env.local',
        '--workdir',
        '.',
      ]),
      readmeDescription: '`server/.env.local`을 주입해 Edge Functions를 로컬에서 serve해요.',
    },
    {
      name: 'functions:deploy',
      command: 'node ./scripts/supabase-functions-deploy.mjs',
      readmeDescription:
        '`server/.env.local`의 `SUPABASE_PROJECT_REF`를 사용해 Edge Functions를 원격 Supabase project에 배포해요.',
      remoteOp: true,
    },
    {
      name: 'db:apply:local',
      command: adapter.dlxCommand(SUPABASE_CLI, ['db', 'push', '--local', '--workdir', '.']),
      readmeDescription: '로컬 Supabase DB에 migration을 적용해요.',
    },
    {
      name: 'db:reset',
      command: adapter.dlxCommand(SUPABASE_CLI, ['db', 'reset', '--local', '--workdir', '.']),
      readmeDescription: '로컬 Supabase DB를 리셋해요.',
    },
    {
      name: 'test',
      command: `node -e "console.log('server test placeholder')"`,
      readmeDescription: 'placeholder 테스트를 실행해요.',
    },
  ] satisfies ServerScriptCatalogEntry[]
}

export function createCloudflareServerScriptCatalog(options: {
  devCommand: string
  buildCommand: string
  typecheckCommand: string
  deployCommand: string
  testCommand?: string | null
}) {
  const entries = [
    {
      name: 'dev',
      command: options.devCommand,
      readmeDescription: '로컬 Worker 개발 서버를 실행해요.',
    },
    {
      name: 'build',
      command: options.buildCommand,
      readmeDescription: '`wrangler deploy --dry-run`으로 번들을 검증해요.',
    },
    {
      name: 'typecheck',
      command: options.typecheckCommand,
      readmeDescription: '`wrangler types`와 TypeScript 검사를 함께 실행해요.',
    },
    {
      name: 'deploy',
      command: options.deployCommand,
      readmeDescription:
        '`server/.env.local`의 auth 값을 읽고 `wrangler.jsonc` 기준으로 원격 Worker를 배포해요.',
      remoteOp: true,
    },
  ] satisfies ServerScriptCatalogEntry[]

  if (options.testCommand) {
    entries.push({
      name: 'test',
      command: options.testCommand,
      readmeDescription:
        '`wrangler.vitest.jsonc`의 local D1/R2 binding으로 Worker 테스트를 실행해요.',
    })
  }

  return entries
}

export function renderFirebaseFunctionsInstallCommand(
  packageManager: PackageManager,
  directory: string,
) {
  const adapter = getPackageManagerAdapter(packageManager)

  if (packageManager === 'pnpm') {
    return `${adapter.installInDirectoryCommand(directory)} --ignore-workspace`
  }

  return adapter.installInDirectoryCommand(directory)
}

export function createFirebaseServerScriptCatalog(options: {
  packageManager: PackageManager
  firestoreRegion: string
}) {
  const adapter = getPackageManagerAdapter(options.packageManager)
  const functionsDirectory = './functions'
  const installFunctionsCommand = renderFirebaseFunctionsInstallCommand(
    options.packageManager,
    functionsDirectory,
  )

  return [
    {
      name: 'dev',
      command: `${installFunctionsCommand} && ${adapter.dlxCommand(FIREBASE_TOOLS_CLI, ['emulators:start', '--only', 'functions,firestore', '--config', 'firebase.json'])}`,
      readmeDescription: 'Firebase emulators로 Functions와 Firestore를 로컬에서 띄워요.',
      includeInReadme: false,
    },
    {
      name: 'build',
      command: `${installFunctionsCommand} && ${adapter.runScriptInDirectoryCommand(functionsDirectory, 'build')}`,
      readmeDescription: '`server/functions`의 TypeScript를 빌드해요.',
    },
    {
      name: 'typecheck',
      command: `${installFunctionsCommand} && ${adapter.runScriptInDirectoryCommand(functionsDirectory, 'typecheck')}`,
      readmeDescription: '`server/functions` 타입 검사를 실행해요.',
    },
    {
      name: 'test',
      command: `${installFunctionsCommand} && ${adapter.runScriptInDirectoryCommand(functionsDirectory, 'test')}`,
      readmeDescription: '`server/functions` 테스트를 실행해요.',
      includeInReadme: false,
    },
    {
      name: 'firestore:ensure',
      command: 'node ./scripts/firebase-ensure-firestore.mjs',
      readmeDescription: `Firestore API를 확인하고 없으면 \`(default)\` DB를 \`${options.firestoreRegion}\`에 만들어요.`,
    },
    {
      name: 'deploy',
      command: `${installFunctionsCommand} && node ./scripts/firebase-functions-deploy.mjs`,
      readmeDescription:
        '`server/.env.local`의 auth 값을 읽고 Firebase Functions + Firestore 리소스를 현재 project로 배포해요.',
      remoteOp: true,
    },
    {
      name: 'deploy:firestore',
      command:
        'node ./scripts/firebase-functions-deploy.mjs --only firestore:rules,firestore:indexes',
      readmeDescription: 'Firestore rules와 indexes를 현재 project에 배포해요.',
    },
    {
      name: 'seed:public-status',
      command: `${installFunctionsCommand} && ${adapter.runScriptInDirectoryCommand(functionsDirectory, 'seed:public-status')}`,
      readmeDescription: 'frontend가 읽을 `publicAppStatus/current` 문서를 Firestore에 써요.',
    },
    {
      name: 'setup:public-status',
      command: `${adapter.runScript('firestore:ensure')} && ${adapter.runScript('deploy:firestore')} && ${adapter.runScript('seed:public-status')}`,
      readmeDescription: 'Firestore 생성, rules 배포, seed 문서 작성을 한 번에 실행해요.',
      remoteOp: true,
    },
    {
      name: 'logs',
      command: adapter.dlxCommand(FIREBASE_TOOLS_CLI, ['functions:log']),
      readmeDescription: 'Firebase Functions 로그를 확인해요.',
    },
  ] satisfies ServerScriptCatalogEntry[]
}
