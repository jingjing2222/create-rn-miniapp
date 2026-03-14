import path from 'node:path'
import { isCancel, log, select, text } from '@clack/prompts'
import yargs from 'yargs'
import { assertValidAppName, toDefaultDisplayName } from './layout.js'
import { PACKAGE_MANAGERS, type PackageManager } from './package-manager.js'
import { SERVER_PROVIDERS, type ServerProvider } from './server-provider.js'
import type { WorkspaceInspection } from './workspace-inspector.js'

export type ParsedCliArgs = {
  add: boolean
  packageManager?: PackageManager
  name?: string
  displayName?: string
  withServer?: boolean
  serverProvider?: ServerProvider
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
  serverProvider: ServerProvider | null
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
  withServer: boolean
  withBackoffice: boolean
  skipInstall: boolean
}

export async function parseCliArgs(rawArgs: string[], cwd = process.cwd()) {
  const argv = await yargs(rawArgs)
    .scriptName('create-miniapp')
    .help(false)
    .version(false)
    .exitProcess(false)
    .strict()
    .fail(() => {
      throw new Error('옵션을 해석하지 못했습니다. `--help`로 사용법을 확인하세요.')
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
    .option('with-server', {
      type: 'boolean',
      describe: '`server` 워크스페이스 포함 (`--server-provider supabase`의 축약형)',
    })
    .option('server-provider', {
      choices: SERVER_PROVIDERS,
      describe: '`server` 워크스페이스 제공자 지정',
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
    withServer: argv.withServer,
    serverProvider: argv.serverProvider,
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
  return [
    '사용법',
    '  create-miniapp [옵션]',
    '',
    '옵션',
    '  --add                          이미 생성된 워크스페이스에 빠진 `server`/`backoffice` 추가',
    '  --package-manager <pnpm|yarn> package manager 지정',
    '  --name <app-name>              Granite appName과 생성 디렉터리 이름',
    '  --display-name <표시 이름>     사용자에게 보이는 앱 이름',
    '  --with-server                  `server` 워크스페이스 포함 (`--server-provider supabase`의 축약형)',
    '  --server-provider <supabase>   `server` 워크스페이스 제공자 지정',
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
    '  create-miniapp --add --with-server',
    '  create-miniapp --add --root-dir /path/to/existing-miniapp --with-backoffice',
    '',
    '옵션으로 주어지지 않은 값은 인터랙티브 입력으로 이어집니다.',
  ].join('\n')
}

export async function resolveCliOptions(argv: ParsedCliArgs, prompt: CliPrompter) {
  if (argv.withServer === false && argv.serverProvider) {
    throw new Error('`--with-server` 없이 `--server-provider`를 사용할 수 없습니다.')
  }

  const packageManager =
    argv.packageManager ??
    (argv.yes
      ? 'pnpm'
      : await prompt.select<PackageManager>({
          message: '패키지 매니저를 선택하세요.',
          options: [
            { label: 'pnpm', value: 'pnpm' },
            { label: 'yarn', value: 'yarn' },
          ],
          initialValue: 'pnpm',
        }))

  const rawName =
    argv.name ??
    (argv.yes
      ? undefined
      : await prompt.text({
          message: 'appName을 입력하세요',
          placeholder: 'my-miniapp',
          validate(value) {
            const candidate = value?.trim() ?? ''

            return candidate.length === 0 || candidate.includes(' ')
              ? 'kebab-case appName이 필요합니다.'
              : undefined
          },
        }))

  if (!rawName) {
    throw new Error('appName은 필수입니다. `--name` 옵션을 주거나 입력에서 작성하세요.')
  }

  const appName = assertValidAppName(rawName)
  const displayName =
    argv.displayName ??
    (argv.yes
      ? toDefaultDisplayName(appName)
      : await prompt.text({
          guide: '보여지는 이름이니 한글로 해주세요.',
          message: 'displayName을 입력하세요',
          validate(value) {
            return value.trim().length === 0 ? 'displayName을 입력하세요.' : undefined
          },
        }))

  const serverProvider =
    argv.serverProvider ??
    (argv.withServer
      ? 'supabase'
      : argv.withServer === false || argv.yes
        ? null
        : await prompt.select<'none' | ServerProvider>({
            message: '`server` 제공자를 선택하세요.',
            options: [
              { label: '생성 안 함', value: 'none' },
              { label: 'Supabase', value: 'supabase' },
            ],
            initialValue: 'none',
          }))

  const normalizedServerProvider = serverProvider === 'none' ? null : serverProvider
  const withServer = normalizedServerProvider !== null

  const withBackoffice =
    argv.withBackoffice ??
    (argv.yes
      ? false
      : (await prompt.select({
          message: '`backoffice` 워크스페이스를 같이 만들까요?',
          options: [
            { label: '예', value: 'yes' },
            { label: '아니오', value: 'no' },
          ],
          initialValue: 'no',
        })) === 'yes')

  return {
    add: false,
    packageManager,
    appName,
    displayName,
    serverProvider: normalizedServerProvider,
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
    throw new Error('`--add`에서는 기존 루트의 package manager와 다른 값을 사용할 수 없습니다.')
  }

  if (argv.withServer === false && argv.serverProvider) {
    throw new Error('`--with-server` 없이 `--server-provider`를 사용할 수 없습니다.')
  }

  const rootDir = path.resolve(argv.rootDir)
  const addServerProvider = inspection.hasServer
    ? null
    : (argv.serverProvider ??
      (argv.withServer
        ? 'supabase'
        : argv.withServer === false || argv.yes
          ? null
          : await prompt.select<'none' | ServerProvider>({
              message: '`server` 제공자를 선택하세요.',
              options: [
                { label: '추가 안 함', value: 'none' },
                { label: 'Supabase', value: 'supabase' },
              ],
              initialValue: 'none',
            })))

  const normalizedServerProvider = addServerProvider === 'none' ? null : addServerProvider
  const withServer = normalizedServerProvider !== null

  const withBackoffice = inspection.hasBackoffice
    ? false
    : (argv.withBackoffice ??
      (argv.yes
        ? false
        : (await prompt.select({
            message: '`backoffice` 워크스페이스를 추가할까요?',
            options: [
              { label: '예', value: 'yes' },
              { label: '아니오', value: 'no' },
            ],
            initialValue: 'no',
          })) === 'yes'))

  if (!withServer && !withBackoffice) {
    throw new Error('추가할 워크스페이스가 없습니다. 이미 모두 존재하거나 선택하지 않았습니다.')
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
        throw new Error('입력을 취소했습니다.')
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
        throw new Error('입력을 취소했습니다.')
      }

      return value
    },
  }
}
