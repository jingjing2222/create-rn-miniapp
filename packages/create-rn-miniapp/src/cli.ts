import path from 'node:path'
import { isCancel, log, select, text } from '@clack/prompts'
import yargs from 'yargs'
import { assertValidAppName, toDefaultDisplayName } from './layout.js'
import { PACKAGE_MANAGERS, type PackageManager } from './package-manager.js'
import { SERVER_PROJECT_MODES, type ServerProjectMode } from './server-project.js'
import {
  SERVER_PROVIDERS,
  SERVER_PROVIDER_OPTIONS,
  type ServerProvider,
} from './providers/index.js'
import type { WorkspaceInspection } from './workspace-inspector.js'

export type ParsedCliArgs = {
  add: boolean
  packageManager?: PackageManager
  name?: string
  displayName?: string
  noGit?: boolean
  serverProvider?: ServerProvider
  serverProjectMode?: ServerProjectMode
  withBackoffice?: boolean
  rootDir: string
  outputDir: string
  skipInstall: boolean
  yes: boolean
  help: boolean
  version: boolean
}

export type TextPromptOptions = {
  message: string
  guide?: string
  placeholder?: string
  initialValue?: string
  validate?: (value: string) => string | undefined
}

export type SelectPromptOptions<T extends string> = {
  message: string
  options: Array<{
    label: string
    value: T
  }>
  initialValue?: T
}

export type CliPrompter = {
  text(options: TextPromptOptions): Promise<string>
  select<T extends string>(options: SelectPromptOptions<T>): Promise<T>
}

type ClackPrompter = {
  text(options: TextPromptOptions): Promise<string | symbol>
  select<T extends string>(options: {
    message: string
    options: Array<{
      label: string
      value: T
    }>
    initialValue?: T
  }): Promise<T | symbol>
  isCancel(value: unknown): value is symbol
}

export type ResolvedCliOptions = {
  add: false
  packageManager: PackageManager
  appName: string
  displayName: string
  noGit: boolean
  serverProvider: ServerProvider | null
  serverProjectMode: ServerProjectMode | null
  skipServerProvisioning: boolean
  withServer: boolean
  withBackoffice: boolean
  outputDir: string
  skipInstall: boolean
}

export type ResolvedAddCliOptions = {
  add: true
  rootDir: string
  packageManager: PackageManager
  appName: string
  displayName: string
  existingServerProvider: ServerProvider | null
  existingHasBackoffice: boolean
  serverProvider: ServerProvider | null
  serverProjectMode: ServerProjectMode | null
  skipServerProvisioning: boolean
  withServer: boolean
  withBackoffice: boolean
  skipInstall: boolean
}

type CliEnvironment = Partial<Pick<NodeJS.ProcessEnv, 'npm_config_user_agent' | 'npm_execpath'>>

export async function parseCliArgs(rawArgs: string[], cwd = process.cwd()) {
  const argv = await yargs(rawArgs)
    .scriptName('create-miniapp')
    .help(false)
    .version(false)
    .exitProcess(false)
    .strict()
    .fail(() => {
      throw new Error('옵션을 읽지 못했어요. `--help`로 사용법을 확인해 주세요.')
    })
    .option('name', {
      type: 'string',
      describe: 'Granite appName과 생성 디렉터리 이름',
    })
    .option('package-manager', {
      choices: PACKAGE_MANAGERS,
      describe: '생성에 사용할 package manager 지정',
    })
    .option('add', {
      type: 'boolean',
      default: false,
      describe: '이미 생성된 워크스페이스에 빠진 `server`/`backoffice`를 추가',
    })
    .option('display-name', {
      type: 'string',
      describe: '사용자에게 보이는 앱 이름',
    })
    .option('git', {
      type: 'boolean',
      default: true,
      describe: '생성 완료 후 루트 git init 수행',
    })
    .option('server-provider', {
      choices: SERVER_PROVIDERS,
      describe: '`server` 워크스페이스 제공자 지정',
    })
    .option('server-project-mode', {
      choices: SERVER_PROJECT_MODES,
      describe: '`server` 제공자의 원격 리소스 연결 방식 지정',
    })
    .option('with-backoffice', {
      type: 'boolean',
      describe: '`backoffice` 워크스페이스 포함',
    })
    .option('output-dir', {
      type: 'string',
      default: cwd,
      describe: '생성할 모노레포의 상위 디렉터리',
    })
    .option('root-dir', {
      type: 'string',
      default: cwd,
      describe: '`--add`에서 수정할 기존 모노레포 루트 디렉터리',
    })
    .option('skip-install', {
      type: 'boolean',
      default: false,
      describe: '마지막 루트 package manager install 생략',
    })
    .option('yes', {
      type: 'boolean',
      default: false,
      describe: '선택형 질문을 기본값으로 진행',
    })
    .option('help', {
      type: 'boolean',
      default: false,
      describe: '도움말 보기',
    })
    .option('version', {
      type: 'boolean',
      default: false,
      describe: '버전 보기',
    })
    .parse()

  return {
    add: argv.add,
    packageManager: argv.packageManager,
    name: argv.name,
    displayName: argv.displayName,
    noGit: argv.git === false,
    serverProvider: argv.serverProvider,
    serverProjectMode: argv.serverProjectMode,
    withBackoffice: argv.withBackoffice,
    rootDir: argv.rootDir,
    outputDir: argv.outputDir,
    skipInstall: argv.skipInstall,
    yes: argv.yes,
    help: argv.help,
    version: argv.version,
  } satisfies ParsedCliArgs
}

export function formatCliHelp() {
  const serverProviderList = SERVER_PROVIDERS.join('|')

  return [
    '사용법',
    '  create-miniapp [옵션]',
    '',
    '옵션',
    '  --add                          이미 생성된 워크스페이스에 빠진 `server`/`backoffice` 추가',
    '  --package-manager <pnpm|yarn|npm|bun> package manager 지정',
    '  --name <app-name>              Granite appName과 생성 디렉터리 이름',
    '  --display-name <표시 이름>     사용자에게 보이는 앱 이름',
    '  --no-git                       생성 완료 후 루트 git init 생략',
    `  --server-provider <${serverProviderList}>   \`server\` 워크스페이스 제공자 지정`,
    '  --server-project-mode <create|existing> server 원격 리소스 연결 방식 지정',
    '  --with-backoffice              `backoffice` 워크스페이스 포함',
    '  --root-dir <디렉터리>          `--add`에서 수정할 기존 모노레포 루트 디렉터리',
    '  --output-dir <디렉터리>        생성할 모노레포의 상위 디렉터리',
    '  --skip-install                 마지막 루트 package manager install 생략',
    '  --yes                          선택형 질문을 기본값으로 진행',
    '  --help                         도움말 보기',
    '  --version                      버전 보기',
    '',
    '예시',
    '  create-miniapp --package-manager yarn --name my-miniapp --display-name "내 미니앱"',
    '  create-miniapp --name my-miniapp --display-name "내 미니앱"',
    '  create-miniapp --name my-miniapp --server-provider supabase --with-backoffice',
    '  create-miniapp --name my-miniapp --server-provider cloudflare',
    '  create-miniapp --name my-miniapp --server-provider firebase',
    '  create-miniapp --name my-miniapp --server-provider supabase --server-project-mode existing',
    '  create-miniapp --name my-miniapp --server-provider cloudflare --server-project-mode existing',
    '  create-miniapp --add --server-provider supabase',
    '  create-miniapp --add --root-dir /path/to/existing-miniapp --with-backoffice',
    '',
    '옵션으로 주어지지 않은 값은 인터랙티브 입력으로 이어집니다.',
  ].join('\n')
}

function validateServerProjectMode(
  serverProvider: ServerProvider | null,
  serverProjectMode: ServerProjectMode | undefined,
) {
  if (!serverProvider && serverProjectMode) {
    throw new Error(
      '`--server-project-mode`는 `server` provider를 선택했을 때만 사용할 수 있습니다.',
    )
  }
}

function resolveServerProjectModeInput(serverProvider: ServerProvider | null, argv: ParsedCliArgs) {
  validateServerProjectMode(serverProvider, argv.serverProjectMode)
  return Promise.resolve(argv.serverProjectMode ?? null)
}

async function resolveServerProviderInput(
  argv: ParsedCliArgs,
  prompt: CliPrompter,
  options: {
    promptMessage: string
    noneLabel: string
  },
) {
  if (argv.serverProvider) {
    return argv.serverProvider
  }

  if (argv.yes) {
    return null
  }

  return await prompt.select<'none' | ServerProvider>({
    message: options.promptMessage,
    options: [{ label: options.noneLabel, value: 'none' }, ...SERVER_PROVIDER_OPTIONS],
    initialValue: 'none',
  })
}

export function detectInvocationPackageManager(
  env: CliEnvironment = process.env,
): PackageManager | null {
  const userAgent = env.npm_config_user_agent?.toLowerCase()

  if (userAgent?.startsWith('pnpm/')) {
    return 'pnpm'
  }

  if (userAgent?.startsWith('yarn/')) {
    return 'yarn'
  }

  if (userAgent?.startsWith('npm/')) {
    return 'npm'
  }

  if (userAgent?.startsWith('bun/')) {
    return 'bun'
  }

  const execPath = env.npm_execpath?.toLowerCase() ?? ''

  if (execPath.includes('pnpm')) {
    return 'pnpm'
  }

  if (execPath.includes('yarn')) {
    return 'yarn'
  }

  if (execPath.includes('bun')) {
    return 'bun'
  }

  if (execPath.includes('npm')) {
    return 'npm'
  }

  return null
}

export async function resolveCliOptions(
  argv: ParsedCliArgs,
  prompt: CliPrompter,
  env: CliEnvironment = process.env,
) {
  const invocationPackageManager = detectInvocationPackageManager(env)
  const packageManager = argv.packageManager ?? invocationPackageManager

  if (!packageManager) {
    throw new Error(
      '어떤 package manager로 시작했는지 감지하지 못했어요. `--package-manager <pnpm|yarn|npm|bun>`를 직접 넣어 주세요.',
    )
  }

  const rawName =
    argv.name ??
    (argv.yes
      ? undefined
      : await prompt.text({
          message: 'appName을 입력해 주세요',
          placeholder: 'my-miniapp',
          validate(value) {
            const candidate = value?.trim() ?? ''

            return candidate.length === 0 || candidate.includes(' ')
              ? 'kebab-case appName이 필요해요.'
              : undefined
          },
        }))

  if (!rawName) {
    throw new Error('appName은 꼭 필요해요. `--name` 옵션으로 주거나 입력해 주세요.')
  }

  const appName = assertValidAppName(rawName)
  const displayName =
    argv.displayName ??
    (argv.yes
      ? toDefaultDisplayName(appName)
      : await prompt.text({
          guide: '앱에서 보이는 이름이라서 자연스럽게 적어주면 돼요.',
          message: 'displayName을 입력해 주세요',
          validate(value) {
            return value.trim().length === 0 ? 'displayName을 입력해 주세요.' : undefined
          },
        }))

  const serverProvider = await resolveServerProviderInput(argv, prompt, {
    promptMessage: '`server` 제공자를 골라 주세요.',
    noneLabel: '이번엔 안 만들게요',
  })

  const normalizedServerProvider = serverProvider === 'none' ? null : serverProvider
  const withServer = normalizedServerProvider !== null
  const serverProjectMode = await resolveServerProjectModeInput(normalizedServerProvider, argv)
  const skipServerProvisioning = argv.yes && !serverProjectMode

  const withBackoffice =
    argv.withBackoffice ??
    (argv.yes
      ? false
      : (await prompt.select({
          message: '`backoffice`도 같이 만들까요?',
          options: [
            { label: '네, 같이 만들게요', value: 'yes' },
            { label: '아니요, 지금은 안 만들게요', value: 'no' },
          ],
          initialValue: 'no',
        })) === 'yes')

  return {
    add: false,
    packageManager,
    appName,
    displayName,
    noGit: argv.noGit ?? false,
    serverProvider: normalizedServerProvider,
    serverProjectMode,
    skipServerProvisioning,
    withServer,
    withBackoffice,
    outputDir: path.resolve(argv.outputDir),
    skipInstall: argv.skipInstall,
  } satisfies ResolvedCliOptions
}

export async function resolveAddCliOptions(
  argv: ParsedCliArgs,
  prompt: CliPrompter,
  inspection: WorkspaceInspection,
) {
  if (argv.packageManager && argv.packageManager !== inspection.packageManager) {
    throw new Error('`--add`에서는 기존 루트와 다른 package manager를 쓸 수 없어요.')
  }

  const rootDir = path.resolve(argv.rootDir)
  const addServerProvider = inspection.hasServer
    ? null
    : await resolveServerProviderInput(argv, prompt, {
        promptMessage: '`server` 제공자를 골라 주세요.',
        noneLabel: '이번엔 추가하지 않을게요',
      })

  const normalizedServerProvider = addServerProvider === 'none' ? null : addServerProvider
  const withServer = normalizedServerProvider !== null
  const serverProjectMode = await resolveServerProjectModeInput(normalizedServerProvider, argv)
  const skipServerProvisioning = argv.yes && !serverProjectMode

  const withBackoffice = inspection.hasBackoffice
    ? false
    : (argv.withBackoffice ??
      (argv.yes
        ? false
        : (await prompt.select({
            message: '`backoffice`도 같이 추가할까요?',
            options: [
              { label: '네, 같이 추가할게요', value: 'yes' },
              { label: '아니요, 지금은 안 할게요', value: 'no' },
            ],
            initialValue: 'no',
          })) === 'yes'))

  if (!withServer && !withBackoffice) {
    throw new Error('추가할 워크스페이스가 없어요. 이미 모두 있거나 이번엔 선택하지 않았어요.')
  }

  return {
    add: true,
    rootDir,
    packageManager: inspection.packageManager,
    appName: inspection.appName,
    displayName: inspection.displayName,
    existingServerProvider: inspection.serverProvider,
    existingHasBackoffice: inspection.hasBackoffice,
    serverProvider: normalizedServerProvider,
    serverProjectMode,
    skipServerProvisioning,
    withServer,
    withBackoffice,
    skipInstall: argv.skipInstall,
  } satisfies ResolvedAddCliOptions
}

const defaultClackPrompter: ClackPrompter = {
  async text(options: TextPromptOptions) {
    if (options.guide) {
      log.message(options.guide)
    }

    return text({
      message: options.message,
      placeholder: options.placeholder,
      initialValue: options.initialValue,
      validate(value) {
        return options.validate?.(value ?? '')
      },
    })
  },
  async select<T extends string>(options: {
    message: string
    options: Array<{
      label: string
      value: T
    }>
    initialValue?: T
  }) {
    return select<T>({
      message: options.message,
      options: options.options.map((option) => ({
        value: option.value,
        label: option.label,
      })) as never,
      initialValue: options.initialValue,
    })
  },
  isCancel(value): value is symbol {
    return isCancel(value)
  },
}

export function createClackPrompter(
  clackPrompter: ClackPrompter = defaultClackPrompter,
): CliPrompter {
  return {
    async text(options) {
      const value = await clackPrompter.text(options)

      if (clackPrompter.isCancel(value)) {
        throw new Error('입력을 취소했어요.')
      }

      return value
    },
    async select<T extends string>(options: SelectPromptOptions<T>) {
      const value = await clackPrompter.select<T>({
        message: options.message,
        options: options.options,
        initialValue: options.initialValue,
      })

      if (clackPrompter.isCancel(value)) {
        throw new Error('입력을 취소했어요.')
      }

      return value
    },
  }
}
