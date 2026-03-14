import path from 'node:path'
import { isCancel, log, select, text } from '@clack/prompts'
import yargs from 'yargs'
import { assertValidAppName, toDefaultDisplayName } from './layout.js'
import { SERVER_PROVIDERS, type ServerProvider } from './server-provider.js'

export type ParsedCliArgs = {
  name?: string
  displayName?: string
  withServer?: boolean
  serverProvider?: ServerProvider
  withBackoffice?: boolean
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
  appName: string
  displayName: string
  serverProvider: ServerProvider | null
  withServer: boolean
  withBackoffice: boolean
  outputDir: string
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
    .option('skip-install', {
      type: 'boolean',
      default: false,
      describe: '마지막 루트 `pnpm install` 생략',
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
    name: argv.name,
    displayName: argv.displayName,
    withServer: argv.withServer,
    serverProvider: argv.serverProvider,
    withBackoffice: argv.withBackoffice,
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
    '  --name <app-name>              Granite appName과 생성 디렉터리 이름',
    '  --display-name <표시 이름>     사용자에게 보이는 앱 이름',
    '  --with-server                  `server` 워크스페이스 포함 (`--server-provider supabase`의 축약형)',
    '  --server-provider <supabase>   `server` 워크스페이스 제공자 지정',
    '  --with-backoffice              `backoffice` 워크스페이스 포함',
    '  --output-dir <디렉터리>        생성할 모노레포의 상위 디렉터리',
    '  --skip-install                 마지막 루트 `pnpm install` 생략',
    '  --yes                          선택형 질문을 기본값으로 진행',
    '  --help                         도움말 보기',
    '  --version                      버전 보기',
    '',
    '예시',
    '  create-miniapp --name my-miniapp --display-name "내 미니앱"',
    '  create-miniapp --name my-miniapp --server-provider supabase --with-backoffice',
    '',
    '옵션으로 주어지지 않은 값은 인터랙티브 입력으로 이어집니다.',
  ].join('\n')
}

export async function resolveCliOptions(argv: ParsedCliArgs, prompt: CliPrompter) {
  if (argv.withServer === false && argv.serverProvider) {
    throw new Error('`--with-server` 없이 `--server-provider`를 사용할 수 없습니다.')
  }

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
    appName,
    displayName,
    serverProvider: normalizedServerProvider,
    withServer,
    withBackoffice,
    outputDir: path.resolve(argv.outputDir),
    skipInstall: argv.skipInstall,
  } satisfies ResolvedCliOptions
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
