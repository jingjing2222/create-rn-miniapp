type NativeImportPatternRule = {
  group: string[]
  message: string
}

export const FRONTEND_POLICY_DOC_PATH = 'docs/engineering/frontend-policy.md'
export const FRONTEND_POLICY_TDS_REFERENCE_PATH = '.agents/skills/core/tds/references/catalog.md'

export const FRONTEND_POLICY_ROUTE_RULES = [
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

export const FRONTEND_POLICY_NATIVE_UI_RULES = [
  '네이티브 연동은 `@granite-js/native`가 re-export한 경로만 사용한다.',
  '`react-native-webview`, `react-native-video` 같은 개별 native 패키지를 직접 import하지 않는다.',
  'AsyncStorage는 예외 없이 금지하고 `@apps-in-toss/framework` storage API를 사용한다.',
  '`react-native` 기본 UI primitive는 직접 import하지 않는다.',
  '대표 금지 대상: `ActivityIndicator`, `Alert`, `Button`, `Modal`, `Switch`, `Text`, `TextInput`, `Touchable*`',
  '`Pressable`은 정말 필요한 경우에만 이유를 남기고 사용한다.',
  'UI는 TDS 또는 Granite가 제공하는 컴포넌트를 우선한다.',
]

export const FRONTEND_POLICY_REFERENCE_PATHS = [
  {
    label: '기능 축과 공식 문서 진입',
    path: '.agents/skills/core/miniapp/SKILL.md',
  },
  {
    label: 'route / navigation 패턴',
    path: '.agents/skills/core/granite/SKILL.md',
  },
  {
    label: 'TDS component 선택',
    path: '.agents/skills/core/tds/SKILL.md',
  },
]

export const FRONTEND_POLICY_COMPLETION_CHECKS = [
  'route path와 파일명에 `$param` 패턴이 없는가',
  '`router.gen.ts`가 현재 entry 구조와 맞는가',
  'direct native import와 금지된 RN 기본 UI import가 없는가',
  '필요한 permission/loading/error/analytics 고려를 `Plan`에 남겼는가',
]

export const FRONTEND_POLICY_ASYNC_STORAGE_MESSAGE =
  'AsyncStorage는 쓰면 안 돼요. 대신 `@apps-in-toss/framework` storage API를 써 주세요. 자세한 기준은 `docs/engineering/frontend-policy.md`를 먼저 봐 주세요.'

export const FRONTEND_POLICY_REACT_NATIVE_IMPORT_NAMES = [
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
]

export const FRONTEND_POLICY_REACT_NATIVE_MESSAGE =
  '`react-native` 기본 UI 컴포넌트는 바로 쓰지 말고 TDS나 Granite가 제공하는 컴포넌트를 먼저 써 주세요. 특히 `Text` 대신 TDS `Txt`를 써 주세요. `Pressable`이 정말 필요하면 `biome-ignore`에 이유를 같이 남겨 주세요. 먼저 `.agents/skills/core/tds/references/catalog.md`와 `docs/engineering/frontend-policy.md`를 확인해 주세요.'

export const FRONTEND_POLICY_NATIVE_IMPORT_PATTERNS: NativeImportPatternRule[] = [
  {
    group: ['@react-navigation/*'],
    message:
      'react-navigation 패키지는 직접 import하지 말고 `@granite-js/native` 경로를 써 주세요. 자세한 기준은 `docs/engineering/frontend-policy.md`를 먼저 봐 주세요.',
  },
  {
    group: ['@react-native-community/*'],
    message:
      'react-native community 패키지는 직접 import하지 말고 `@granite-js/native` 경로를 써 주세요. 자세한 기준은 `docs/engineering/frontend-policy.md`를 먼저 봐 주세요.',
  },
  {
    group: ['react-native-*'],
    message:
      'react-native 네이티브 패키지는 직접 import하지 말고 `@granite-js/native` 경로를 써 주세요. 자세한 기준은 `docs/engineering/frontend-policy.md`를 먼저 봐 주세요.',
  },
  {
    group: ['@shopify/flash-list', 'lottie-react-native', 'fingerprint'],
    message:
      '이 네이티브 모듈은 직접 import하지 말고 `@granite-js/native` 경로를 써 주세요. 자세한 기준은 `docs/engineering/frontend-policy.md`를 먼저 봐 주세요.',
  },
]

export function renderFrontendPolicyMarkdown(packageManagerRunCommand: string) {
  return [
    '# Frontend Policy',
    '',
    '이 문서는 `frontend`에서 반드시 지켜야 하는 강제 규칙 문서입니다.',
    '',
    '## 라우팅 규칙',
    ...FRONTEND_POLICY_ROUTE_RULES.map((rule, index) => `${index + 1}. ${rule}`),
    '',
    '## 페이지 구조 규칙',
    ...FRONTEND_POLICY_PAGE_STRUCTURE_LAYERS.map((layer) => `- ${layer}`),
    '',
    '규칙:',
    ...FRONTEND_POLICY_PAGE_STRUCTURE_RULES.map((rule) => `- ${rule}`),
    '',
    '## Native / UI import 규칙',
    ...FRONTEND_POLICY_NATIVE_UI_RULES.map((rule, index) => `${index + 1}. ${rule}`),
    '',
    '## 정책 검사 스크립트',
    `- \`$param\` route 패턴 검사는 \`${packageManagerRunCommand} frontend:policy:check\`가 담당한다.`,
    '- import/UI 경계 규칙은 root `biome.json`이 막는다.',
    '',
    '## 구현 전 참고 경로',
    ...FRONTEND_POLICY_REFERENCE_PATHS.map(
      (reference) => `- ${reference.label}: \`${reference.path}\``,
    ),
    '',
    '## 완료 전 체크',
    ...FRONTEND_POLICY_COMPLETION_CHECKS.map((item) => `- ${item}`),
    '',
  ].join('\n')
}
