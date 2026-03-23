import type { PackageManager } from '../runtime/package-manager.js'
import { resolveRootHelperScriptCommands } from './root-script-catalog.js'
import { dedentWithTrailingNewline } from '../runtime/dedent.js'

type NativeImportPatternRule = {
  group: string[]
  message: string
}

type FrontendPolicyRestrictionDefinition = {
  id: string
  policyRules: string[]
  createMessage: () => string
  nativeImportPatternGroups?: string[][]
  reactNativeImportNames?: string[]
}

type ResolvedFrontendPolicyRestrictionDefinition = Omit<
  FrontendPolicyRestrictionDefinition,
  'createMessage'
> & {
  message: string
}

const FRONTEND_POLICY_SOURCE_EXTENSIONS = [
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.mts',
  '.cts',
]
const ROUTE_DYNAMIC_SEGMENT_DOLLAR_RULE_ID = 'route-dynamic-segment-dollar'
const FILENAME_DOLLAR_PATTERN_RULE_ID = 'filename-dollar-pattern'
const ROUTE_DYNAMIC_SEGMENT_DOLLAR_REGEX_SOURCE = '\\/\\$[a-zA-Z][a-zA-Z0-9_]*'
const FILENAME_DOLLAR_PATTERN_REGEX_SOURCE =
  '(?:^|[\\\\/])(?:\\$[a-zA-Z][a-zA-Z0-9_]*\\.[^.]+|[^\\\\/]+\\.\\$[a-zA-Z][a-zA-Z0-9_]*)'

export const FRONTEND_POLICY_DOC_PATH = 'docs/engineering/frontend-policy.md'
export const SHARED_FRONTEND_POLICY_REFERENCE_PATH = 'skills/shared/references/frontend-policy.md'
const FRONTEND_POLICY_DOC_REFERENCE = `자세한 기준은 \`${FRONTEND_POLICY_DOC_PATH}\`를 먼저 봐 주세요.`
const FRONTEND_POLICY_GRANITE_NATIVE_MESSAGE = `직접 import하지 말고 \`@granite-js/native\` 경로를 써 주세요. ${FRONTEND_POLICY_DOC_REFERENCE}`
const FRONTEND_POLICY_ASYNC_STORAGE_BASE_MESSAGE =
  'AsyncStorage는 쓰면 안 돼요. 대신 `@apps-in-toss/framework` storage API를 써 주세요.'
const FRONTEND_POLICY_REACT_NATIVE_BASE_MESSAGE =
  '`react-native` 기본 UI 컴포넌트는 바로 쓰지 말고 TDS를 써 주세요. 정말 이 컴포넌트를 써야 하면 `biome-ignore`에 이유를 같이 남겨 주세요.'

const FRONTEND_POLICY_RESTRICTION_DEFINITIONS: FrontendPolicyRestrictionDefinition[] = [
  {
    id: 'granite-native',
    policyRules: [
      '네이티브 연동은 `@granite-js/native`가 re-export한 경로만 사용한다.',
      '`react-native-webview`, `react-native-video` 같은 개별 native 패키지를 직접 import하지 않는다.',
    ],
    createMessage: () => FRONTEND_POLICY_GRANITE_NATIVE_MESSAGE,
    nativeImportPatternGroups: [
      ['@react-navigation/*'],
      ['@react-native-community/*'],
      ['react-native-*'],
      ['@shopify/flash-list', 'lottie-react-native', 'fingerprint'],
    ],
  },
  {
    id: 'async-storage',
    policyRules: [
      'AsyncStorage는 예외 없이 금지하고 `@apps-in-toss/framework` storage API를 사용한다.',
    ],
    createMessage: () =>
      `${FRONTEND_POLICY_ASYNC_STORAGE_BASE_MESSAGE} ${FRONTEND_POLICY_DOC_REFERENCE}`,
  },
  {
    id: 'react-native-ui',
    policyRules: [
      '`react-native` 기본 UI primitive는 직접 import하지 않는다.',
      '대표 금지 대상: `ActivityIndicator`, `Alert`, `Button`, `Modal`, `Switch`, `Text`, `TextInput`, `Touchable*`',
      '정말 이 컴포넌트를 써야 하면 `biome-ignore`에 이유를 같이 남긴다.',
      'UI는 TDS를 사용한다.',
    ],
    createMessage: () =>
      `${FRONTEND_POLICY_REACT_NATIVE_BASE_MESSAGE} ${FRONTEND_POLICY_DOC_REFERENCE}`,
    reactNativeImportNames: [
      'Button',
      'Modal',
      'Switch',
      'TextInput',
      'Text',
      'ActivityIndicator',
      'Alert',
      'TouchableOpacity',
      'TouchableHighlight',
      'TouchableWithoutFeedback',
      'Pressable',
    ],
  },
]

function getFrontendPolicyRestrictionDefinition(
  id: string,
): ResolvedFrontendPolicyRestrictionDefinition {
  const definition = FRONTEND_POLICY_RESTRICTION_DEFINITIONS.find(
    (restriction) => restriction.id === id,
  )

  if (!definition) {
    throw new Error(`알 수 없는 frontend policy restriction id입니다: ${id}`)
  }

  return {
    id: definition.id,
    policyRules: definition.policyRules,
    message: definition.createMessage(),
    nativeImportPatternGroups: definition.nativeImportPatternGroups,
    reactNativeImportNames: definition.reactNativeImportNames,
  }
}

export const FRONTEND_POLICY_ROUTE_RULES = [
  '라우팅은 Granite router 규칙을 source of truth로 사용한다.',
  'App Router 스타일 동적 세그먼트(`/$param`)는 금지한다.',
  'Granite router의 `:param` path params와 `validateParams`는 허용한다.',
  'route path, 파일명, navigation 문자열 어디에도 `$param` 패턴을 남기지 않는다.',
  'route/page 구조를 바꾸면 `router.gen.ts` 동기화까지 확인한다.',
]

export const FRONTEND_POLICY_PAGE_STRUCTURE_LAYERS = [
  '`frontend/pages/*`: entry layer',
  '`frontend/src/pages/*`: implementation layer',
]

export const FRONTEND_POLICY_PAGE_STRUCTURE_RULES = [
  'entry layer는 re-export 또는 얇은 route entry만 둔다.',
  '화면 구현과 비즈니스 로직은 `frontend/src/pages/*`에 둔다.',
  '파일명과 route path는 고정 경로 또는 Granite `:param` 규칙과 정합해야 한다.',
]

function resolveFrontendPolicyReferenceLines() {
  return [
    '- 기능 축과 공식 문서 진입: MiniApp/AppInToss 공식 문서와 현재 runtime code를 같이 본다.',
    '- route / navigation 패턴: Granite router 규칙(`:param`, `validateParams`)을 source of truth로 사용한다.',
    '- TDS component 선택: TDS를 기준으로 구현한다.',
  ]
}

export const FRONTEND_POLICY_COMPLETION_CHECKS = [
  'route path와 파일명에 `$param` 패턴이 없는가',
  '`router.gen.ts`가 현재 entry 구조와 맞는가',
  'direct native import와 금지된 RN 기본 UI import가 없는가',
  '필요한 permission/loading/error/analytics 고려를 `Plan`에 남겼는가',
]

export function renderSharedFrontendPolicyReferenceMarkdown() {
  return dedentWithTrailingNewline`
  <!-- This file is generated by scripts/sync-skill-shared-references.ts. -->
  # Frontend Policy Reference

  - generated repo의 강제 규칙 문서: \`${FRONTEND_POLICY_DOC_PATH}\`
  - 라우팅, native import, React Native 기본 UI 제한은 항상 이 문서를 먼저 기준으로 본다.
  - 개별 skill은 구현 패턴과 예시를 보완할 뿐이고, 강제 규칙을 다시 복제하지 않는다.
`
}
export function resolveFrontendPolicyRuleSet() {
  const asyncStorageRestriction = getFrontendPolicyRestrictionDefinition('async-storage')
  const reactNativeRestriction = getFrontendPolicyRestrictionDefinition('react-native-ui')

  return {
    nativeUiRules: FRONTEND_POLICY_RESTRICTION_DEFINITIONS.flatMap(
      (restriction) => restriction.policyRules,
    ),
    referenceLines: resolveFrontendPolicyReferenceLines(),
    asyncStorageMessage: asyncStorageRestriction.message,
    reactNativeImportNames: reactNativeRestriction.reactNativeImportNames ?? [],
    reactNativeMessage: reactNativeRestriction.message,
    nativeImportPatterns: FRONTEND_POLICY_RESTRICTION_DEFINITIONS.flatMap((restriction) =>
      (restriction.nativeImportPatternGroups ?? []).map((group) => ({
        group,
        message: restriction.createMessage(),
      })),
    ) satisfies NativeImportPatternRule[],
  }
}

const FRONTEND_POLICY_FILENAME_DOLLAR_GUIDANCE =
  "파일명에 $param 세그먼트를 쓰면 안 돼요. 대신 '/book-detail'이나 '/book/:bookId'처럼 Granite가 이해하는 경로 기준으로 바꿔 주세요."

const FRONTEND_POLICY_ROUTE_DYNAMIC_SEGMENT_GUIDANCE =
  "같은 $param 라우트는 쓰면 안 돼요. 대신 '/book-detail', '/book/:bookId', validateParams 조합으로 바꿔 주세요."

const FRONTEND_POLICY_ROUTE_SUMMARY_GUIDANCE =
  "MiniApp 라우트에서는 $param 대신 Granite가 지원하는 '/book/:bookId'나 `createRoute(... validateParams ...)` 조합을 써 주세요."

export function renderFrontendPolicyVerifierSource() {
  const placeholder = (identifier: string) => ['$', `{${identifier}}`].join('')
  const displayPathExpr = placeholder('displayPath')
  const filenameRuleIdExpr = placeholder('FILENAME_DOLLAR_PATTERN_RULE_ID')
  const filenameGuidanceExpr = placeholder('FILENAME_DOLLAR_GUIDANCE')
  const routeRuleIdExpr = placeholder('ROUTE_DYNAMIC_SEGMENT_DOLLAR_RULE_ID')
  const matchedValueExpr = placeholder('matchedValue')
  const routeGuidanceExpr = placeholder('ROUTE_DYNAMIC_SEGMENT_GUIDANCE')
  const graniteRouteDocPathExpr = placeholder('GRANITE_ROUTE_DOC_PATH')
  const errorExpr = placeholder('error')
  const routeSummaryExpr = placeholder('ROUTE_SUMMARY_GUIDANCE')

  return dedentWithTrailingNewline`
    import { readFile, readdir, stat } from 'node:fs/promises'
    import path from 'node:path'
    import process from 'node:process'
    
    const FRONTEND_ROOT = path.resolve(process.cwd(), 'frontend')
    const FRONTEND_ENTRY_ROOT = path.join(FRONTEND_ROOT, 'pages')
    const FRONTEND_SOURCE_ROOT = path.join(FRONTEND_ROOT, 'src')
    const FRONTEND_SOURCE_PAGES_ROOT = path.join(FRONTEND_SOURCE_ROOT, 'pages')
    const SOURCE_EXTENSIONS = new Set(${JSON.stringify(FRONTEND_POLICY_SOURCE_EXTENSIONS)})
    const ROUTE_DYNAMIC_SEGMENT_DOLLAR_RULE_ID = ${JSON.stringify(ROUTE_DYNAMIC_SEGMENT_DOLLAR_RULE_ID)}
    const FILENAME_DOLLAR_PATTERN_RULE_ID = ${JSON.stringify(FILENAME_DOLLAR_PATTERN_RULE_ID)}
    const ROUTE_DYNAMIC_SEGMENT_DOLLAR_REGEX_SOURCE = ${JSON.stringify(
      ROUTE_DYNAMIC_SEGMENT_DOLLAR_REGEX_SOURCE,
    )}
    const FILENAME_DOLLAR_PATTERN_REGEX_SOURCE = ${JSON.stringify(
      FILENAME_DOLLAR_PATTERN_REGEX_SOURCE,
    )}
    const ROUTE_DYNAMIC_SEGMENT_DOLLAR_REGEX = new RegExp(ROUTE_DYNAMIC_SEGMENT_DOLLAR_REGEX_SOURCE, 'g')
    const FILENAME_DOLLAR_PATTERN_REGEX = new RegExp(FILENAME_DOLLAR_PATTERN_REGEX_SOURCE)
    const GRANITE_ROUTE_DOC_PATH = ${JSON.stringify(FRONTEND_POLICY_DOC_PATH)}
    const FILENAME_DOLLAR_GUIDANCE = ${JSON.stringify(FRONTEND_POLICY_FILENAME_DOLLAR_GUIDANCE)}
    const ROUTE_DYNAMIC_SEGMENT_GUIDANCE = ${JSON.stringify(
      FRONTEND_POLICY_ROUTE_DYNAMIC_SEGMENT_GUIDANCE,
    )}
    const ROUTE_SUMMARY_GUIDANCE = ${JSON.stringify(FRONTEND_POLICY_ROUTE_SUMMARY_GUIDANCE)}
    
    async function pathExists(targetPath) {
      try {
        await stat(targetPath)
        return true
      } catch {
        return false
      }
    }
    
    async function listSourceFiles(rootDir) {
      const files = []
    
      if (!(await pathExists(rootDir))) {
        return files
      }
    
      const entries = await readdir(rootDir, { withFileTypes: true })
    
      for (const entry of entries) {
        const entryPath = path.join(rootDir, entry.name)
    
        if (entry.isDirectory()) {
          files.push(...(await listSourceFiles(entryPath)))
          continue
        }
    
        if (SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
          files.push(entryPath)
        }
      }
    
      return files
    }
    
    function formatPathForDisplay(filePath) {
      return path.relative(process.cwd(), filePath)
    }
    
    async function main() {
      const errors = []
      const fileRoots = [FRONTEND_ENTRY_ROOT, FRONTEND_SOURCE_ROOT]
      const files = []
    
      for (const rootDir of fileRoots) {
        files.push(...(await listSourceFiles(rootDir)))
      }
    
      const uniqueFiles = [...new Set(files)]
    
      for (const filePath of uniqueFiles) {
        const displayPath = formatPathForDisplay(filePath)
    
        if (
          filePath.startsWith(FRONTEND_ENTRY_ROOT) ||
          filePath.startsWith(FRONTEND_SOURCE_PAGES_ROOT)
        ) {
          const filenameMatch = displayPath.match(FILENAME_DOLLAR_PATTERN_REGEX)
    
          if (filenameMatch) {
            errors.push(
    ${
      '          `' +
      displayPathExpr +
      ': ' +
      filenameRuleIdExpr +
      ' - ' +
      filenameGuidanceExpr +
      ' 자세한 기준은 \\`' +
      graniteRouteDocPathExpr +
      '\\`를 봐 주세요.`'
    }
            )
          }
        }
    
        const source = await readFile(filePath, 'utf8')
    
        for (const match of source.matchAll(ROUTE_DYNAMIC_SEGMENT_DOLLAR_REGEX)) {
          const matchedValue = match[0]
          errors.push(
    ${
      '        `' +
      displayPathExpr +
      ': ' +
      routeRuleIdExpr +
      ' - "' +
      matchedValueExpr +
      '" ' +
      routeGuidanceExpr +
      ' 자세한 기준은 \\`' +
      graniteRouteDocPathExpr +
      '\\`를 봐 주세요.`'
    }
          )
        }
      }
    
      if (errors.length === 0) {
        process.exit(0)
      }
    
      const normalizedErrors = [...new Set(errors)].sort((left, right) => left.localeCompare(right))
    
      console.error('[frontend policy] frontend 라우트에서 $param 패턴을 찾았어요.')
      for (const error of normalizedErrors) {
        console.error(\`- ${errorExpr}\`)
      }
      console.error(
    ${
      '    `- ' +
      routeSummaryExpr +
      ' 자세한 기준은 \\`' +
      graniteRouteDocPathExpr +
      '\\`를 봐 주세요.`'
    }
      )
      process.exit(1)
    }
    
    await main()
  `
}

export function renderFrontendPolicyMarkdown(packageManager: PackageManager) {
  const helperScriptCommands = resolveRootHelperScriptCommands(packageManager)
  const policyRules = resolveFrontendPolicyRuleSet()

  return dedentWithTrailingNewline`
    # Frontend Policy
    
    이 문서는 \`frontend\`에서 반드시 지켜야 하는 강제 규칙 문서입니다.
    
    ## 라우팅 규칙
    ${(FRONTEND_POLICY_ROUTE_RULES.map((rule, index) => `${index + 1}. ${rule}`)).join('\n')}
    
    ## 페이지 구조 규칙
    ${(FRONTEND_POLICY_PAGE_STRUCTURE_LAYERS.map((layer) => `- ${layer}`)).join('\n')}
    
    규칙:
    ${(FRONTEND_POLICY_PAGE_STRUCTURE_RULES.map((rule) => `- ${rule}`)).join('\n')}
    
    ## Native / UI import 규칙
    ${(policyRules.nativeUiRules.map((rule, index) => `${index + 1}. ${rule}`)).join('\n')}
    
    ## 정책 검사 스크립트
    - \`$param\` route 패턴 검사는 \`${helperScriptCommands.frontendPolicyCheck}\`가 담당한다.
    - import/UI 경계 규칙은 root \`biome.json\`이 막는다.
    
    ## 구현 전 참고 경로
    ${(policyRules.referenceLines).join('\n')}
    
    ## 완료 전 체크
    ${(FRONTEND_POLICY_COMPLETION_CHECKS.map((item) => `- ${item}`)).join('\n')}
  `
}
