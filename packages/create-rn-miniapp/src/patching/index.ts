import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import { getPackageManagerAdapter, type PackageManager } from '../package-manager.js'
import type { ServerProvider } from '../providers/index.js'
import {
  applyServerPackageTemplate,
  applyWorkspaceProjectTemplate,
  getFirebaseWebSdkVersion,
  pathExists,
  removePathIfExists,
  SUPABASE_DEFAULT_FUNCTION_NAME,
  type TemplateTokens,
  writeWorkspaceNpmrc,
} from '../templates/index.js'
import {
  patchBackofficeAppSource,
  patchBackofficeMainSource,
  patchGraniteConfigSource,
} from './ast/index.js'
import {
  createCloudflareVitestWranglerConfigSource,
  patchTsconfigModuleSource,
  patchWranglerConfigSource,
} from './jsonc.js'
import { patchPackageJsonSource } from './package-json.js'
import {
  APP_ROUTER_WORKSPACE_DEPENDENCY,
  CONTRACTS_WORKSPACE_DEPENDENCY,
  renderCloudflareServerIndexSource,
  renderCloudflareServerTrpcContextSource,
  renderCloudflareTrpcClientSource,
  TRPC_CLIENT_VERSION,
  TRPC_SERVER_VERSION,
} from './trpc.js'

const STATIC_TOOLING_FILES = [
  'biome.json',
  '.biome.json',
  'eslint.config.js',
  '.eslintrc',
  '.eslintrc.js',
  '.eslintrc.cjs',
  '.eslintrc.json',
  '.prettierrc',
  '.prettierrc.js',
  '.prettierrc.cjs',
  '.prettierrc.json',
  'prettier.config.js',
  'prettier.config.cjs',
  'prettier.config.mjs',
] as const

const CLOUDFLARE_SERVER_LOCAL_FILES = [
  '.gitignore',
  '.prettierrc',
  '.editorconfig',
  '.vscode',
  'AGENTS.md',
] as const

const TOOLING_DEPENDENCIES = [
  '@biomejs/biome',
  '@eslint/js',
  'eslint',
  'eslint-config-prettier',
  'eslint-plugin-react',
  'eslint-plugin-react-hooks',
  'eslint-plugin-react-refresh',
  'typescript-eslint',
  'prettier',
] as const

const SUPABASE_JS_VERSION = '^2.57.4'
const FIREBASE_JS_VERSION = getFirebaseWebSdkVersion()
const DOTENV_VERSION = '^16.4.7'
const NODE_TYPES_VERSION = '^24.10.1'
const FALLBACK_GRANITE_PLUGIN_VERSION = '1.0.7'
const SUPABASE_ACCESS_TOKENS_DASHBOARD_URL = 'https://supabase.com/dashboard/account/tokens'
const SUPABASE_MANAGEMENT_API_DOC_URL = 'https://supabase.com/docs/reference/api/introduction'
const WRANGLER_PACKAGE_NAME = 'wrangler'
const CLOUDFLARE_API_TOKENS_DASHBOARD_URL = 'https://dash.cloudflare.com/profile/api-tokens'
const CLOUDFLARE_CREATE_TOKEN_DOC_URL =
  'https://developers.cloudflare.com/fundamentals/api/get-started/create-token/'
const CLOUDFLARE_WORKERS_AUTH_DOC_URL =
  'https://developers.cloudflare.com/workers/wrangler/migration/v1-to-v2/wrangler-legacy/authentication/'
const CLOUDFLARE_ROOT_GITIGNORE_ENTRY = 'server/worker-configuration.d.ts'
const CLOUDFLARE_ROOT_BIOME_IGNORE_ENTRY = '**/server/worker-configuration.d.ts'
const CLOUDFLARE_D1_BINDING_NAME = 'DB'
const CLOUDFLARE_R2_BINDING_NAME = 'STORAGE'
const FIREBASE_ROOT_GITIGNORE_ENTRY = 'server/functions/lib/'
const FIREBASE_ROOT_BIOME_IGNORE_ENTRY = '**/server/functions/lib/**'
const FIREBASE_YARN_PACKAGE_EXTENSION_KEY = '"@apphosting/build@*"'
const FIREBASE_YARN_PACKAGE_EXTENSION_BLOCK = [
  '  "@apphosting/build@*":',
  '    dependencies:',
  '      yaml: "^2.4.1"',
].join('\n')
const SUPABASE_ACCESS_TOKEN_GUIDE_ASSET_CANDIDATES = [
  'optional/server-supabase/assets/supabase-access-token-guide1.png',
  'optional/server-supabase/assets/supabase-access-token-guide2.png',
] as const
const CLOUDFLARE_TOKEN_GUIDE_ASSET_CANDIDATES = [
  'optional/server-cloudflare/assets/cloudflare-api-token-guide.png',
  'optional/server-cloudflare/assets/cloudflare-api-token-guide.jpg',
  'optional/server-cloudflare/assets/cloudflare-api-token-guide.jpeg',
  'optional/server-cloudflare/assets/cloudflare-api-token-guide.webp',
  'optional/server-cloudflare/assets/cloudflare-api-token-guide.gif',
] as const
const FIREBASE_LOGIN_CI_GUIDE_ASSET_CANDIDATES = [
  'optional/server-firebase/assets/firebase-login-ci-guide.png',
] as const
const FIREBASE_SERVICE_ACCOUNT_GUIDE_ASSET_CANDIDATES = [
  'optional/server-firebase/assets/firebase-service-account-guide1.png',
  'optional/server-firebase/assets/firebase-service-account-guide2.png',
] as const
const FRONTEND_STARTER_HERO_ASSET_RELATIVE_PATH =
  'root/assets/frontend/miniapp-starter-hero.lottie.json'
const FRONTEND_STARTER_HERO_ASSET_FILE_NAME = 'miniapp-starter-hero.lottie.json'
const FRONTEND_FIREBASE_CRYPTO_SHIM_RELATIVE_PATH = 'root/assets/frontend/firebase-crypto-shim.ts'
const FRONTEND_FIREBASE_CRYPTO_SHIM_FILE_NAME = 'crypto.ts'
const SERVER_GUIDE_ASSET_TARGET_DIR = 'assets'
const FIREBASE_CLI_DOC_URL = 'https://firebase.google.com/docs/cli'
const FIREBASE_ADMIN_SETUP_URL = 'https://firebase.google.com/docs/admin/setup'
const GOOGLE_CLOUD_SERVICE_ACCOUNTS_CONSOLE_URL =
  'https://console.cloud.google.com/iam-admin/serviceaccounts'

const require = createRequire(import.meta.url)

const FRONTEND_ENV_TYPES = [
  'interface ImportMetaEnv {',
  '  readonly MINIAPP_SUPABASE_URL: string',
  '  readonly MINIAPP_SUPABASE_PUBLISHABLE_KEY: string',
  '}',
  '',
  'interface ImportMeta {',
  '  readonly env: ImportMetaEnv',
  '}',
  '',
].join('\n')

const FRONTEND_CLOUDFLARE_ENV_TYPES = [
  'interface ImportMetaEnv {',
  '  readonly MINIAPP_API_BASE_URL: string',
  '}',
  '',
  'interface ImportMeta {',
  '  readonly env: ImportMetaEnv',
  '}',
  '',
].join('\n')

const FRONTEND_FIREBASE_ENV_TYPES = [
  'interface ImportMetaEnv {',
  '  readonly MINIAPP_FIREBASE_API_KEY: string',
  '  readonly MINIAPP_FIREBASE_AUTH_DOMAIN: string',
  '  readonly MINIAPP_FIREBASE_PROJECT_ID: string',
  '  readonly MINIAPP_FIREBASE_STORAGE_BUCKET: string',
  '  readonly MINIAPP_FIREBASE_MESSAGING_SENDER_ID: string',
  '  readonly MINIAPP_FIREBASE_APP_ID: string',
  '  readonly MINIAPP_FIREBASE_MEASUREMENT_ID: string',
  '  readonly MINIAPP_FIREBASE_FUNCTION_REGION: string',
  '}',
  '',
  'interface ImportMeta {',
  '  readonly env: ImportMetaEnv',
  '}',
  '',
].join('\n')

const BACKOFFICE_ENV_TYPES = [
  '/// <reference types="vite/client" />',
  '',
  'interface ImportMetaEnv {',
  '  readonly VITE_SUPABASE_URL: string',
  '  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string',
  '}',
  '',
  'interface ImportMeta {',
  '  readonly env: ImportMetaEnv',
  '}',
  '',
].join('\n')

const BACKOFFICE_CLOUDFLARE_ENV_TYPES = [
  '/// <reference types="vite/client" />',
  '',
  'interface ImportMetaEnv {',
  '  readonly VITE_API_BASE_URL: string',
  '}',
  '',
  'interface ImportMeta {',
  '  readonly env: ImportMetaEnv',
  '}',
  '',
].join('\n')

const BACKOFFICE_FIREBASE_ENV_TYPES = [
  '/// <reference types="vite/client" />',
  '',
  'interface ImportMetaEnv {',
  '  readonly VITE_FIREBASE_API_KEY: string',
  '  readonly VITE_FIREBASE_AUTH_DOMAIN: string',
  '  readonly VITE_FIREBASE_PROJECT_ID: string',
  '  readonly VITE_FIREBASE_STORAGE_BUCKET: string',
  '  readonly VITE_FIREBASE_MESSAGING_SENDER_ID: string',
  '  readonly VITE_FIREBASE_APP_ID: string',
  '  readonly VITE_FIREBASE_MEASUREMENT_ID: string',
  '}',
  '',
  'interface ImportMeta {',
  '  readonly env: ImportMetaEnv',
  '}',
  '',
].join('\n')

const FRONTEND_SUPABASE_CLIENT = [
  "import { createClient, type SupabaseClient } from '@supabase/supabase-js'",
  '',
  'function isSafeHttpUrl(value: string) {',
  '  try {',
  '    const parsed = new URL(value)',
  "    return parsed.protocol === 'http:' || parsed.protocol === 'https:'",
  '  } catch {',
  '    return false',
  '  }',
  '}',
  '',
  'function resolveSupabaseUrl() {',
  "  const configured = import.meta.env.MINIAPP_SUPABASE_URL?.trim() ?? ''",
  '',
  '  if (!isSafeHttpUrl(configured)) {',
  '    throw new Error(',
  "      '[frontend] MINIAPP_SUPABASE_URL must be a valid http(s) URL. Received: ' + (configured || '<empty>')",
  '    )',
  '  }',
  '',
  '  return configured',
  '}',
  '',
  'function resolveSupabasePublishableKey() {',
  "  const configured = import.meta.env.MINIAPP_SUPABASE_PUBLISHABLE_KEY?.trim() ?? ''",
  '',
  '  if (!configured) {',
  "    throw new Error('[frontend] MINIAPP_SUPABASE_PUBLISHABLE_KEY is required.')",
  '  }',
  '',
  '  return configured',
  '}',
  '',
  'export const supabase: SupabaseClient = createClient(',
  '  resolveSupabaseUrl(),',
  '  resolveSupabasePublishableKey(),',
  '  {',
  '    auth: {',
  '      persistSession: false,',
  '      detectSessionInUrl: false,',
  '    },',
  '  },',
  ')',
  '',
].join('\n')

const FRONTEND_CLOUDFLARE_API_CLIENT = [
  'function isSafeHttpUrl(value: string) {',
  '  try {',
  '    const parsed = new URL(value)',
  "    return parsed.protocol === 'http:' || parsed.protocol === 'https:'",
  '  } catch {',
  '    return false',
  '  }',
  '}',
  '',
  'function resolveApiBaseUrl() {',
  "  const configured = import.meta.env.MINIAPP_API_BASE_URL?.trim() ?? ''",
  '',
  '  if (!isSafeHttpUrl(configured)) {',
  '    throw new Error(',
  "      '[frontend] MINIAPP_API_BASE_URL must be a valid http(s) URL. Received: ' + (configured || '<empty>')",
  '    )',
  '  }',
  '',
  "  return configured.replace(/\\/$/, '')",
  '}',
  '',
  'export const apiBaseUrl = resolveApiBaseUrl()',
  '',
  'export function resolveApiUrl(pathname: string) {',
  "  const normalizedPath = pathname.replace(/^\\//, '')",
  "  return new URL(normalizedPath, apiBaseUrl + '/').toString()",
  '}',
  '',
  'export async function apiFetch(pathname: string, init?: RequestInit) {',
  '  return fetch(resolveApiUrl(pathname), init)',
  '}',
  '',
].join('\n')

const FRONTEND_SAFE_STARTER_INDEX_PAGE = [
  "import LottieView from '@granite-js/native/lottie-react-native'",
  "import { createRoute } from '@granite-js/react-native'",
  "import { Button, Txt } from '@toss/tds-react-native'",
  "import starterHeroLottie from '../assets/miniapp-starter-hero.lottie.json'",
  "import { StyleSheet, View } from 'react-native'",
  '',
  "export const Route = createRoute('/', {",
  '  component: Page,',
  '})',
  '',
  'function Page() {',
  '  const navigation = Route.useNavigation()',
  '',
  '  return (',
  '    <View style={styles.container}>',
  '      <View style={styles.heroCard}>',
  '        <View style={styles.heroAnimation}>',
  '          <LottieView',
  '            source={starterHeroLottie}',
  '            autoPlay={true}',
  '            loop={true}',
  '            style={styles.heroAnimationView}',
  '          />',
  '        </View>',
  '        <View style={styles.heroCopy}>',
  '          <Txt typography="t4" fontWeight="bold" style={styles.title}>',
  '            MiniApp 준비가 끝났어요.',
  '          </Txt>',
  '          <Txt typography="t6" color="#4A5568" style={styles.description}>',
  '            이제 `frontend/src/pages`에서 화면을 만들고 AppInToss framework, TDS를 활용해 개발하면 돼요.',
  '          </Txt>',
  '        </View>',
  '      </View>',
  '      <View style={styles.guideCard}>',
  '        <Txt typography="t6" fontWeight="bold" style={styles.guideTitle}>',
  '          먼저 이 순서로 보면 돼요',
  '        </Txt>',
  '        <Txt typography="t7" color="#4A5568" style={styles.guideItem}>',
  '          1. `docs/product`에 기능 명세를 적어요.',
  '        </Txt>',
  '        <Txt typography="t7" color="#4A5568" style={styles.guideItem}>',
  '          2. `AGENTS.md`와 `docs/engineering`을 먼저 읽어요.',
  '        </Txt>',
  '        <Txt typography="t7" color="#4A5568" style={styles.guideItem}>',
  '          3. 필요한 화면부터 `frontend/src/pages`에서 만들어요.',
  '        </Txt>',
  '      </View>',
  '      <Button',
  '        type="light"',
  '        style="weak"',
  '        size="medium"',
  '        display="block"',
  "        onPress={() => navigation.navigate('/about')}",
  '      >',
  '        안내 페이지 보기',
  '      </Button>',
  '    </View>',
  '  )',
  '}',
  '',
  'const styles = StyleSheet.create({',
  '  container: {',
  '    flex: 1,',
  '    paddingHorizontal: 24,',
  '    paddingVertical: 32,',
  '    backgroundColor: "#F4F8FF",',
  '    gap: 16,',
  '    justifyContent: "center",',
  '  },',
  '  heroCard: {',
  '    backgroundColor: "#FFFFFF",',
  '    borderRadius: 28,',
  '    paddingHorizontal: 20,',
  '    paddingVertical: 24,',
  '    shadowColor: "#3182F6",',
  '    shadowOpacity: 0.08,',
  '    shadowRadius: 20,',
  '    shadowOffset: { width: 0, height: 12 },',
  '    elevation: 8,',
  '  },',
  '  heroAnimation: {',
  '    alignItems: "center",',
  '    marginBottom: 12,',
  '  },',
  '  heroAnimationView: {',
  '    width: 160,',
  '    height: 160,',
  '  },',
  '  heroCopy: {',
  '    gap: 6,',
  '  },',
  '  title: {',
  '    color: "#1A202C",',
  '  },',
  '  description: {',
  '    marginTop: 2,',
  '  },',
  '  guideCard: {',
  '    backgroundColor: "#FFFFFF",',
  '    borderRadius: 24,',
  '    paddingHorizontal: 20,',
  '    paddingVertical: 18,',
  '    gap: 8,',
  '  },',
  '  guideTitle: {',
  '    color: "#1A202C",',
  '  },',
  '  guideItem: {',
  '    lineHeight: 22,',
  '  },',
  '})',
  '',
].join('\n')

const FRONTEND_SAFE_STARTER_ABOUT_PAGE = [
  "import { createRoute } from '@granite-js/react-native'",
  "import { Button, Txt } from '@toss/tds-react-native'",
  "import { StyleSheet, View } from 'react-native'",
  '',
  "export const Route = createRoute('/about', {",
  '  component: Page,',
  '})',
  '',
  'function Page() {',
  '  const navigation = Route.useNavigation()',
  '',
  '  return (',
  '    <View style={styles.container}>',
  '      <View style={styles.card}>',
  '        <Txt typography="t4" fontWeight="bold" style={styles.title}>',
  '          이 starter는 이렇게 쓰면 돼요',
  '        </Txt>',
  '        <Txt typography="t6" color="#334155" style={styles.description}>',
  '          이 페이지는 starter route라서 자유롭게 지워도 돼요.',
  '        </Txt>',
  '        <Txt typography="t7" color="#64748B" style={styles.caption}>',
  '          먼저 `AGENTS.md`와 `docs/engineering`을 보고, 필요한 화면과 데이터 흐름으로 바꿔 주세요.',
  '        </Txt>',
  '      </View>',
  '      <Button',
  '        type="light"',
  '        style="weak"',
  '        size="medium"',
  '        display="block"',
  '        onPress={() => navigation.goBack()}',
  '      >',
  '        홈으로 돌아가기',
  '      </Button>',
  '    </View>',
  '  )',
  '}',
  '',
  'const styles = StyleSheet.create({',
  '  container: {',
  '    flex: 1,',
  '    paddingHorizontal: 24,',
  '    paddingVertical: 32,',
  '    backgroundColor: "#F8FAFC",',
  '    gap: 16,',
  '    justifyContent: "center",',
  '  },',
  '  card: {',
  '    backgroundColor: "#FFFFFF",',
  '    borderRadius: 24,',
  '    paddingHorizontal: 20,',
  '    paddingVertical: 20,',
  '    gap: 8,',
  '  },',
  '  title: {',
  '    color: "#1A202C",',
  '  },',
  '  description: {',
  '    lineHeight: 24,',
  '  },',
  '  caption: {',
  '    lineHeight: 22,',
  '  },',
  '})',
  '',
].join('\n')

const FRONTEND_SAFE_NOT_FOUND_PAGE = [
  "import { Txt } from '@toss/tds-react-native'",
  "import { View } from 'react-native'",
  '',
  'export default function NotFoundPage() {',
  '  return (',
  '    <View',
  '      style={{',
  '        flex: 1,',
  "        alignItems: 'center',",
  "        justifyContent: 'center',",
  '      }}',
  '    >',
  '      <Txt>404 Not Found</Txt>',
  '    </View>',
  '  )',
  '}',
  '',
].join('\n')

const FRONTEND_FIREBASE_APP = [
  "import { getApp, getApps, initializeApp } from 'firebase/app'",
  '',
  'const measurementId = import.meta.env.MINIAPP_FIREBASE_MEASUREMENT_ID?.trim()',
  '',
  'const firebaseConfig = {',
  '  apiKey: import.meta.env.MINIAPP_FIREBASE_API_KEY,',
  '  authDomain: import.meta.env.MINIAPP_FIREBASE_AUTH_DOMAIN,',
  '  projectId: import.meta.env.MINIAPP_FIREBASE_PROJECT_ID,',
  '  storageBucket: import.meta.env.MINIAPP_FIREBASE_STORAGE_BUCKET,',
  '  messagingSenderId: import.meta.env.MINIAPP_FIREBASE_MESSAGING_SENDER_ID,',
  '  appId: import.meta.env.MINIAPP_FIREBASE_APP_ID,',
  '  ...(measurementId ? { measurementId } : {}),',
  '}',
  '',
  'export const firebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig)',
  '',
].join('\n')

const FRONTEND_FIREBASE_FIRESTORE = [
  "import { getFirestore } from 'firebase/firestore'",
  "import { firebaseApp } from './firebase'",
  '',
  'export const firestore = getFirestore(firebaseApp)',
  '',
].join('\n')

const FRONTEND_FIREBASE_FUNCTIONS = [
  "import { getFunctions } from 'firebase/functions'",
  "import { firebaseApp } from './firebase'",
  '',
  "const region = import.meta.env.MINIAPP_FIREBASE_FUNCTION_REGION?.trim() || 'asia-northeast3'",
  '',
  'export const functions = getFunctions(firebaseApp, region)',
  '',
].join('\n')

const FRONTEND_FIREBASE_PUBLIC_APP_STATUS = [
  "import { httpsCallable } from 'firebase/functions'",
  "import { doc, getDoc } from 'firebase/firestore'",
  "import { functions } from './functions'",
  "import { firestore } from './firestore'",
  '',
  'export interface PublicAppStatusItem {',
  '  label: string',
  '  value: string',
  '}',
  '',
  'export interface PublicAppStatus {',
  '  title: string',
  '  message: string',
  '  source: string',
  '  updatedAtLabel: string',
  '  items: PublicAppStatusItem[]',
  '}',
  '',
  "const publicAppStatusReference = doc(firestore, 'publicAppStatus', 'current')",
  '',
  'export async function getPublicAppStatus(): Promise<PublicAppStatus> {',
  '  try {',
  '    const snapshot = await getDoc(publicAppStatusReference)',
  '',
  '    if (!snapshot.exists()) {',
  "      throw new Error('Firebase 상태 문서가 아직 준비되지 않았어요.')",
  '    }',
  '',
  '    return parsePublicAppStatus(snapshot.data())',
  '  } catch (error: unknown) {',
  '    if (!shouldFallbackToFunctions(error)) {',
  '      throw error',
  '    }',
  '',
  '    return getPublicAppStatusFromFunctions()',
  '  }',
  '}',
  '',
  'function parsePublicAppStatus(raw: unknown): PublicAppStatus {',
  "  if (!raw || typeof raw !== 'object') {",
  "    throw new Error('Firebase 상태 문서 형식이 올바르지 않아요.')",
  '  }',
  '',
  '  const document = raw as Record<string, unknown>',
  '',
  '  return {',
  "    title: readRequiredString(document.title, 'title'),",
  "    message: readRequiredString(document.message, 'message'),",
  "    source: readRequiredString(document.source, 'source'),",
  "    updatedAtLabel: readRequiredString(document.updatedAtLabel, 'updatedAtLabel'),",
  '    items: readItems(document.items),',
  '  }',
  '}',
  '',
  'function readRequiredString(value: unknown, fieldName: string): string {',
  "  if (typeof value !== 'string' || value.trim().length === 0) {",
  `    throw new Error(\`Firebase 상태 문서의 \${fieldName} 값이 올바르지 않아요.\`)`,
  '  }',
  '',
  '  return value.trim()',
  '}',
  '',
  'function readItems(value: unknown): PublicAppStatusItem[] {',
  '  if (!Array.isArray(value)) {',
  "    throw new Error('Firebase 상태 문서의 items 값이 올바르지 않아요.')",
  '  }',
  '',
  '  return value.map((item, index) => {',
  "    if (!item || typeof item !== 'object') {",
  `      throw new Error(\`Firebase 상태 문서의 items[\${index}] 값이 올바르지 않아요.\`)`,
  '    }',
  '',
  '    const record = item as Record<string, unknown>',
  '',
  '    return {',
  `      label: readRequiredString(record.label, \`items[\${index}].label\`),`,
  `      value: readRequiredString(record.value, \`items[\${index}].value\`),`,
  '    }',
  '  })',
  '}',
  '',
  'async function getPublicAppStatusFromFunctions(): Promise<PublicAppStatus> {',
  "  const getPublicStatus = httpsCallable<undefined, unknown>(functions, 'getPublicStatus')",
  '  const result = await getPublicStatus()',
  '',
  '  return parsePublicAppStatus(result.data)',
  '}',
  '',
  'function shouldFallbackToFunctions(error: unknown): boolean {',
  '  if (!(error instanceof Error)) {',
  '    return false',
  '  }',
  '',
  '  return (',
  "    error.message.includes('Missing or insufficient permissions') ||",
  "    error.message.includes('permission-denied')",
  '  )',
  '}',
  '',
].join('\n')

const FRONTEND_FIREBASE_STORAGE = [
  "import { getStorage } from 'firebase/storage'",
  "import { firebaseApp } from './firebase'",
  '',
  'export const storage = getStorage(firebaseApp)',
  '',
].join('\n')

const BACKOFFICE_SUPABASE_CLIENT = [
  "import { createClient, type SupabaseClient } from '@supabase/supabase-js'",
  '',
  'function resolveSupabaseUrl() {',
  "  const value = import.meta.env.VITE_SUPABASE_URL?.trim() ?? ''",
  '',
  '  if (!value) {',
  "    throw new Error('[backoffice] VITE_SUPABASE_URL is required.')",
  '  }',
  '',
  '  return value',
  '}',
  '',
  'function resolveSupabasePublishableKey() {',
  "  const value = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ?? ''",
  '',
  '  if (!value) {',
  "    throw new Error('[backoffice] VITE_SUPABASE_PUBLISHABLE_KEY is required.')",
  '  }',
  '',
  '  return value',
  '}',
  '',
  'function isSafeHttpUrl(value: string) {',
  '  try {',
  '    const parsed = new URL(value)',
  "    return parsed.protocol === 'http:' || parsed.protocol === 'https:'",
  '  } catch {',
  '    return false',
  '  }',
  '}',
  '',
  'const supabaseUrl = resolveSupabaseUrl()',
  'if (!isSafeHttpUrl(supabaseUrl)) {',
  '  throw new Error(',
  "    '[backoffice] VITE_SUPABASE_URL must be a valid http(s) URL. Received: ' + supabaseUrl",
  '  )',
  '}',
  '',
  'export const supabase: SupabaseClient = createClient(',
  '  supabaseUrl,',
  '  resolveSupabasePublishableKey(),',
  '  {',
  '    auth: {',
  '      persistSession: true,',
  '      autoRefreshToken: true,',
  '      detectSessionInUrl: false,',
  '    },',
  '  },',
  ')',
  '',
].join('\n')

const BACKOFFICE_CLOUDFLARE_API_CLIENT = [
  'function isSafeHttpUrl(value: string) {',
  '  try {',
  '    const parsed = new URL(value)',
  "    return parsed.protocol === 'http:' || parsed.protocol === 'https:'",
  '  } catch {',
  '    return false',
  '  }',
  '}',
  '',
  'function resolveApiBaseUrl() {',
  "  const configured = import.meta.env.VITE_API_BASE_URL?.trim() ?? ''",
  '',
  '  if (!isSafeHttpUrl(configured)) {',
  '    throw new Error(',
  "      '[backoffice] VITE_API_BASE_URL must be a valid http(s) URL. Received: ' + (configured || '<empty>')",
  '    )',
  '  }',
  '',
  "  return configured.replace(/\\/$/, '')",
  '}',
  '',
  'export const apiBaseUrl = resolveApiBaseUrl()',
  '',
  'export function resolveApiUrl(pathname: string) {',
  "  const normalizedPath = pathname.replace(/^\\//, '')",
  "  return new URL(normalizedPath, apiBaseUrl + '/').toString()",
  '}',
  '',
  'export async function apiFetch(pathname: string, init?: RequestInit) {',
  '  return fetch(resolveApiUrl(pathname), init)',
  '}',
  '',
].join('\n')

const BACKOFFICE_FIREBASE_APP = [
  "import { getApp, getApps, initializeApp } from 'firebase/app'",
  '',
  'const measurementId = import.meta.env.VITE_FIREBASE_MEASUREMENT_ID?.trim()',
  '',
  'const firebaseConfig = {',
  '  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,',
  '  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,',
  '  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,',
  '  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,',
  '  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,',
  '  appId: import.meta.env.VITE_FIREBASE_APP_ID,',
  '  ...(measurementId ? { measurementId } : {}),',
  '}',
  '',
  'export const firebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig)',
  '',
].join('\n')

const BACKOFFICE_FIREBASE_FIRESTORE = [
  "import { getFirestore } from 'firebase/firestore'",
  "import { firebaseApp } from './firebase'",
  '',
  'export const firestore = getFirestore(firebaseApp)',
  '',
].join('\n')

const BACKOFFICE_FIREBASE_STORAGE = [
  "import { getStorage } from 'firebase/storage'",
  "import { firebaseApp } from './firebase'",
  '',
  'export const storage = getStorage(firebaseApp)',
  '',
].join('\n')

type PackageJson = {
  name?: string
  scripts?: Record<string, string>
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
}

type WorkspacePatchOptions = {
  packageManager: PackageManager
  serverProvider: ServerProvider | null
  trpc?: boolean
  removeCloudflareApiClientHelpers?: boolean
}

type ReactVersionAlignment = {
  react: string | null
  reactDom: string | null
  reactTypes: string | null
  reactDomTypes: string | null
}

async function readPackageJson(packageJsonPath: string) {
  return JSON.parse(await readFile(packageJsonPath, 'utf8')) as PackageJson
}

async function writeTextFile(filePath: string, contents: string) {
  await mkdir(path.dirname(filePath), { recursive: true })
  await writeFile(filePath, contents, 'utf8')
}

function resolvePackageVersion(packageJson: PackageJson, packageName: string) {
  return (
    packageJson.dependencies?.[packageName] ?? packageJson.devDependencies?.[packageName] ?? null
  )
}

function stripSimpleVersionPrefix(version: string) {
  return version.replace(/^[~^]/, '')
}

function applyExistingVersionPrefix(currentVersion: string, targetVersion: string) {
  const prefix = currentVersion.match(/^[~^]/)?.[0] ?? ''
  return `${prefix}${stripSimpleVersionPrefix(targetVersion)}`
}

async function resolveFrontendReactVersionAlignment(targetRoot: string) {
  const frontendPackageJsonPath = path.join(targetRoot, 'frontend', 'package.json')

  if (!(await pathExists(frontendPackageJsonPath))) {
    return null
  }

  const frontendPackageJson = await readPackageJson(frontendPackageJsonPath)
  const reactVersion = resolvePackageVersion(frontendPackageJson, 'react')

  if (!reactVersion) {
    return null
  }

  return {
    react: reactVersion,
    reactDom: resolvePackageVersion(frontendPackageJson, 'react-dom') ?? reactVersion,
    reactTypes: resolvePackageVersion(frontendPackageJson, '@types/react'),
    reactDomTypes: resolvePackageVersion(frontendPackageJson, '@types/react-dom'),
  } satisfies ReactVersionAlignment
}

function isGraniteStarterIndexPage(source: string) {
  return (
    source.includes("createRoute('/', {") &&
    source.includes('This is a demo page for the') &&
    source.includes('Granite</Text> Framework.') &&
    source.includes('TouchableOpacity')
  )
}

function isGraniteStarterAboutPage(source: string) {
  return (
    source.includes("createRoute('/about', {") &&
    source.includes('About Granite') &&
    source.includes('Go Back') &&
    source.includes('TouchableOpacity')
  )
}

function isGraniteStarterNotFoundPage(source: string) {
  return (
    source.includes("import { Text, View } from 'react-native'") &&
    source.includes('export default function NotFoundPage()') &&
    source.includes('<Text>404 Not Found</Text>')
  )
}

async function maybeReplaceGraniteStarterPage(
  filePath: string,
  matcher: (source: string) => boolean,
  replacementSource: string,
) {
  if (!(await pathExists(filePath))) {
    return
  }

  const source = await readFile(filePath, 'utf8')

  if (!matcher(source)) {
    return
  }

  await writeTextFile(filePath, replacementSource)
}

async function patchGraniteStarterPages(frontendRoot: string) {
  await maybeReplaceGraniteStarterPage(
    path.join(frontendRoot, 'src', 'pages', 'index.tsx'),
    isGraniteStarterIndexPage,
    FRONTEND_SAFE_STARTER_INDEX_PAGE,
  )
  await maybeReplaceGraniteStarterPage(
    path.join(frontendRoot, 'src', 'pages', 'about.tsx'),
    isGraniteStarterAboutPage,
    FRONTEND_SAFE_STARTER_ABOUT_PAGE,
  )
  await maybeReplaceGraniteStarterPage(
    path.join(frontendRoot, 'pages', '_404.tsx'),
    isGraniteStarterNotFoundPage,
    FRONTEND_SAFE_NOT_FOUND_PAGE,
  )
}

function resolveTemplatesPackageRoot() {
  const packageJsonPath = require.resolve('@create-rn-miniapp/scaffold-templates/package.json')
  return path.dirname(packageJsonPath)
}

async function ensureFrontendStarterHeroAsset(frontendRoot: string) {
  const sourcePath = path.join(
    resolveTemplatesPackageRoot(),
    FRONTEND_STARTER_HERO_ASSET_RELATIVE_PATH,
  )
  const targetPath = path.join(frontendRoot, 'src', 'assets', FRONTEND_STARTER_HERO_ASSET_FILE_NAME)

  if (await pathExists(targetPath)) {
    return
  }

  if (!(await pathExists(sourcePath))) {
    return
  }

  await mkdir(path.dirname(targetPath), { recursive: true })
  await copyFile(sourcePath, targetPath)
}

async function ensureFrontendFirebaseCryptoShim(frontendRoot: string) {
  const sourcePath = path.join(
    resolveTemplatesPackageRoot(),
    FRONTEND_FIREBASE_CRYPTO_SHIM_RELATIVE_PATH,
  )
  const targetPath = path.join(
    frontendRoot,
    'src',
    'shims',
    FRONTEND_FIREBASE_CRYPTO_SHIM_FILE_NAME,
  )

  if (await pathExists(targetPath)) {
    return
  }

  if (!(await pathExists(sourcePath))) {
    return
  }

  await mkdir(path.dirname(targetPath), { recursive: true })
  await copyFile(sourcePath, targetPath)
}

async function copyGuideAssets(
  serverRoot: string,
  sourcePathOverrides: readonly (string | null | undefined)[],
  assetCandidates?: readonly string[],
) {
  const overridePaths = sourcePathOverrides.filter(
    (sourcePath): sourcePath is string => typeof sourcePath === 'string' && sourcePath.length > 0,
  )
  const resolvedAssetCandidates =
    overridePaths.length > 0
      ? overridePaths
      : (assetCandidates ?? []).map((relativePath) =>
          path.join(resolveTemplatesPackageRoot(), relativePath),
        )
  const copiedPaths: string[] = []

  for (const sourcePath of resolvedAssetCandidates) {
    if (!(await pathExists(sourcePath))) {
      continue
    }

    const targetFileName = path.basename(sourcePath)
    const targetPath = path.join(serverRoot, SERVER_GUIDE_ASSET_TARGET_DIR, targetFileName)

    await mkdir(path.dirname(targetPath), { recursive: true })
    await copyFile(sourcePath, targetPath)
    copiedPaths.push(`./${SERVER_GUIDE_ASSET_TARGET_DIR}/${targetFileName}`)
  }

  return copiedPaths
}

async function copyCloudflareTokenGuideAsset(
  serverRoot: string,
  sourcePathOverride?: string | null,
) {
  const copiedPaths = await copyGuideAssets(
    serverRoot,
    [sourcePathOverride],
    CLOUDFLARE_TOKEN_GUIDE_ASSET_CANDIDATES,
  )

  return copiedPaths[0] ?? null
}

function renderCloudflareDeployScript(tokens: TemplateTokens) {
  const packageManager = getPackageManagerAdapter(tokens.packageManager)
  const command = packageManager.dlx('wrangler', ['deploy'])

  return [
    "import { spawnSync } from 'node:child_process'",
    "import { existsSync, readFileSync } from 'node:fs'",
    "import path from 'node:path'",
    "import process from 'node:process'",
    "import { fileURLToPath } from 'node:url'",
    '',
    "const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')",
    "const envPath = path.join(serverRoot, '.env.local')",
    '',
    'function stripWrappingQuotes(value) {',
    `  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {`,
    '    return value.slice(1, -1)',
    '  }',
    '',
    '  return value',
    '}',
    '',
    'function loadLocalEnv(filePath) {',
    '  if (!existsSync(filePath)) {',
    '    return',
    '  }',
    '',
    "  const source = readFileSync(filePath, 'utf8')",
    '',
    '  for (const line of source.split(/\\r?\\n/)) {',
    '    const trimmed = line.trim()',
    '',
    "    if (!trimmed || trimmed.startsWith('#')) {",
    '      continue',
    '    }',
    '',
    "    const separatorIndex = trimmed.indexOf('=')",
    '    if (separatorIndex <= 0) {',
    '      continue',
    '    }',
    '',
    '    const key = trimmed.slice(0, separatorIndex).trim()',
    '    const value = stripWrappingQuotes(trimmed.slice(separatorIndex + 1).trim())',
    '',
    '    if (process.env[key] === undefined) {',
    '      process.env[key] = value',
    '    }',
    '  }',
    '}',
    '',
    'loadLocalEnv(envPath)',
    '',
    "const apiToken = process.env.CLOUDFLARE_API_TOKEN?.trim() ?? ''",
    "const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim() ?? ''",
    '',
    'const commandEnv = { ...process.env }',
    '',
    'if (apiToken) {',
    '  commandEnv.CLOUDFLARE_API_TOKEN = apiToken',
    '} else {',
    '  delete commandEnv.CLOUDFLARE_API_TOKEN',
    '}',
    '',
    'if (accountId) {',
    '  commandEnv.CLOUDFLARE_ACCOUNT_ID = accountId',
    '} else {',
    '  delete commandEnv.CLOUDFLARE_ACCOUNT_ID',
    '}',
    '',
    `const packageManagerCommand = process.platform === 'win32' ? '${command.command}.cmd' : '${command.command}'`,
    `const result = spawnSync(packageManagerCommand, ${JSON.stringify(command.args)}, {`,
    '  cwd: serverRoot,',
    "  stdio: 'inherit',",
    '  env: commandEnv,',
    '})',
    '',
    "if (typeof result.status === 'number') {",
    '  process.exit(result.status)',
    '}',
    '',
    'if (result.error) {',
    '  throw result.error',
    '}',
    '',
    'process.exit(1)',
    '',
  ].join('\n')
}

function renderCloudflareVitestConfigSource() {
  return [
    "import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config'",
    '',
    'export default defineWorkersConfig({',
    '  test: {',
    '    poolOptions: {',
    '      workers: {',
    "        wrangler: { configPath: './wrangler.vitest.jsonc' },",
    '      },',
    '    },',
    '  },',
    '})',
    '',
  ].join('\n')
}

function renderSupabaseServerReadme(
  tokens: TemplateTokens,
  options?: {
    accessTokenGuideImagePaths?: string[] | null
  },
) {
  return [
    '# server',
    '',
    '이 워크스페이스는 Supabase 프로젝트 연결, SQL migration, Edge Functions 배포를 관리하는 server 워크스페이스예요.',
    '',
    '## 디렉토리 구조',
    '',
    '```text',
    'server/',
    '  supabase/config.toml',
    '  supabase/migrations/',
    `  supabase/functions/${SUPABASE_DEFAULT_FUNCTION_NAME}/index.ts`,
    '  scripts/supabase-db-apply.mjs',
    '  scripts/supabase-functions-typecheck.mjs',
    '  scripts/supabase-functions-deploy.mjs',
    '  .env.local',
    '  package.json',
    '```',
    '',
    '## 주요 스크립트',
    '',
    `- \`cd server && ${tokens.packageManagerRunCommand} dev\`: 로컬 Supabase stack을 시작해요.`,
    `- \`cd server && ${tokens.packageManagerRunCommand} typecheck\`: \`supabase/functions/*/index.ts\` entrypoint를 \`deno check\`로 정적 검사해요.`,
    `- \`cd server && ${tokens.packageManagerRunCommand} db:apply\`: \`server/.env.local\`의 \`SUPABASE_DB_PASSWORD\`를 사용해 linked remote project에 migration을 적용해요.`,
    `- \`cd server && ${tokens.packageManagerRunCommand} functions:serve\`: \`server/.env.local\`을 주입해 Edge Functions를 로컬에서 serve해요.`,
    `- \`cd server && ${tokens.packageManagerRunCommand} functions:deploy\`: \`server/.env.local\`의 \`SUPABASE_PROJECT_REF\`를 사용해 Edge Functions를 원격 Supabase project에 배포해요.`,
    `- \`cd server && ${tokens.packageManagerRunCommand} db:apply:local\`: 로컬 Supabase DB에 migration을 적용해요.`,
    `- \`cd server && ${tokens.packageManagerRunCommand} db:reset\`: 로컬 Supabase DB를 리셋해요.`,
    `- \`cd server && ${tokens.packageManagerRunCommand} test\`: placeholder 테스트를 실행해요.`,
    '',
    '## Miniapp / Backoffice 연결',
    '',
    '- miniapp frontend는 `frontend/src/lib/supabase.ts`에서 Supabase client를 생성해요.',
    '- miniapp frontend `.env.local`은 `frontend/.env.local`에 두고 `MINIAPP_SUPABASE_URL`, `MINIAPP_SUPABASE_PUBLISHABLE_KEY`를 사용해요.',
    '- frontend `granite.config.ts`는 `.env.local` 값을 읽어 `MINIAPP_SUPABASE_URL`, `MINIAPP_SUPABASE_PUBLISHABLE_KEY`를 주입해요.',
    `- miniapp frontend는 \`supabase.functions.invoke('${SUPABASE_DEFAULT_FUNCTION_NAME}')\` 형태로 Edge Function을 호출할 수 있어요.`,
    '- backoffice가 있으면 `backoffice/src/lib/supabase.ts`에서 별도 browser client를 생성해요.',
    '- backoffice `.env.local`은 `backoffice/.env.local`에 두고 `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`를 사용해요.',
    '- backoffice도 `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`를 사용해요.',
    `- backoffice도 동일하게 \`supabase.functions.invoke('${SUPABASE_DEFAULT_FUNCTION_NAME}')\`를 사용할 수 있어요.`,
    '',
    '## 운영 메모',
    '',
    '- 원격 SQL push를 계속하려면 `server/.env.local`의 `SUPABASE_DB_PASSWORD`를 채워주세요.',
    '- 다른 Edge Function을 추가하려면 `supabase functions new <name> --workdir .`로 생성한 뒤 `functions:deploy`를 다시 실행하면 돼요.',
    '- frontend/backoffice의 `.env.local`은 server provisioning 결과와 같은 Supabase project를 가리키게 맞춰두는 걸 권장해요.',
    '',
    '## Supabase access token',
    '',
    '- 브라우저 로그인 없이 CI나 비대화형 배포를 할 때만 필요해요.',
    '- Supabase Dashboard > Account > Access Tokens 에서 새 personal access token을 만들어 주세요.',
    '- Supabase access token은 별도 scope를 고르는 방식이 아니라, 토큰을 만든 계정 권한을 그대로 따라가요.',
    '- 프로젝트 생성이나 배포가 필요하면 해당 organization / project에 접근 가능한 계정으로 만들어 주세요.',
    '- 발급된 token은 `server/.env.local`의 `SUPABASE_ACCESS_TOKEN=` 뒤에 붙여 넣으면 돼요.',
    `- ${SUPABASE_ACCESS_TOKENS_DASHBOARD_URL}`,
    `- ${SUPABASE_MANAGEMENT_API_DOC_URL}`,
    ...(options?.accessTokenGuideImagePaths?.length
      ? [
          '',
          '### 발급 화면 예시',
          '',
          ...options.accessTokenGuideImagePaths.map(
            (imagePath, index) => `![Supabase access token 발급 화면 ${index + 1}](${imagePath})`,
          ),
        ]
      : []),
    '',
  ].join('\n')
}

function renderCloudflareServerReadme(
  tokens: TemplateTokens,
  options?: {
    tokenGuideImagePath?: string | null
    trpc?: boolean
  },
) {
  const trpcEnabled = options?.trpc === true

  return [
    '# server',
    '',
    '이 워크스페이스는 Cloudflare Worker를 배포하는 server 워크스페이스예요.',
    '',
    '## 디렉토리 구조',
    '',
    '```text',
    'server/',
    '  src/index.ts',
    ...(trpcEnabled ? ['  src/trpc/context.ts'] : []),
    '  wrangler.jsonc',
    '  wrangler.vitest.jsonc',
    '  vitest.config.mts',
    '  worker-configuration.d.ts',
    '  .env.local',
    '  package.json',
    '```',
    '',
    '## 주요 스크립트',
    '',
    `- \`cd server && ${tokens.packageManagerRunCommand} dev\`: 로컬 Worker 개발 서버를 실행해요.`,
    `- \`cd server && ${tokens.packageManagerRunCommand} build\`: \`wrangler deploy --dry-run\`으로 번들을 검증해요.`,
    `- \`cd server && ${tokens.packageManagerRunCommand} typecheck\`: \`wrangler types\`와 TypeScript 검사를 함께 실행해요.`,
    `- \`cd server && ${tokens.packageManagerRunCommand} deploy\`: \`server/.env.local\`의 auth 값을 읽고 \`wrangler.jsonc\` 기준으로 원격 Worker를 배포해요.`,
    `- \`cd server && ${tokens.packageManagerRunCommand} test\`: \`wrangler.vitest.jsonc\`의 local D1/R2 binding으로 Worker 테스트를 실행해요.`,
    '',
    '## Miniapp / Backoffice 연결',
    '',
    '- miniapp frontend `.env.local`은 `frontend/.env.local`에 두고 `MINIAPP_API_BASE_URL`을 사용해요.',
    '- backoffice `.env.local`은 `backoffice/.env.local`에 두고 `VITE_API_BASE_URL`을 사용해요.',
    '- provisioning이 성공하면 frontend/backoffice `.env.local`에 Worker URL이 자동으로 기록돼요.',
    `- Worker 코드는 \`${CLOUDFLARE_D1_BINDING_NAME}\` D1 binding과 \`${CLOUDFLARE_R2_BINDING_NAME}\` R2 binding을 사용할 수 있어요.`,
    ...(trpcEnabled
      ? [
          '- tRPC를 같이 골랐다면 `packages/contracts`가 boundary schema의 source of truth이고, `packages/app-router`가 router와 `AppRouter` 타입의 source of truth예요.',
          '- miniapp frontend는 `frontend/src/lib/trpc.ts`, backoffice는 `backoffice/src/lib/trpc.ts`에서 Worker `/trpc` endpoint를 호출해요.',
          '- Worker runtime은 `@workspace/app-router`를 직접 import해서 같은 router를 바로 써요.',
          '- `GET /` 는 ready JSON을 반환하고, 실제 tRPC 호출은 `/trpc` endpoint로 들어가요.',
        ]
      : [
          '- miniapp frontend는 `frontend/src/lib/api.ts`에서 API helper를 만들고 `MINIAPP_API_BASE_URL`을 사용해요.',
          '- backoffice가 있으면 `backoffice/src/lib/api.ts`에서 `VITE_API_BASE_URL` 기반 helper를 사용해요.',
        ]),
    ...(trpcEnabled
      ? [
          '',
          '## API SSOT',
          '',
          '- tRPC를 같이 골랐다면 `packages/contracts`가 boundary type과 schema의 source of truth예요.',
          '- 같은 경우 `packages/app-router`가 route shape와 `AppRouter` 타입의 source of truth예요.',
          '- route shape를 바꾸고 싶으면 먼저 shared package 두 개를 수정한 뒤 `dev`, `build`, `deploy`를 다시 실행하면 돼요.',
          '- runtime verify는 `GET /`, 실제 router entry는 `/trpc` endpoint를 기준으로 보면 돼요.',
        ]
      : []),
    '',
    '## 운영 메모',
    '',
    '- `worker-configuration.d.ts`는 `wrangler types`가 생성하는 파일이에요.',
    '- `server/.env.local`은 Cloudflare account/worker/D1/R2 메타데이터를 기록해요.',
    '- `wrangler.jsonc`는 원격 deploy 기준 설정이고, `wrangler.vitest.jsonc`는 local D1/R2 binding으로 테스트를 돌리기 위한 설정이에요.',
    ...(trpcEnabled
      ? [
          '- tRPC를 같이 썼다면 boundary contract은 `packages/contracts`, router는 `packages/app-router`만 수정하고 `dev`, `build`, `deploy`를 다시 실행하면 돼요.',
        ]
      : []),
    '',
    '## Cloudflare API token',
    '',
    '- 브라우저 로그인 없이 다시 배포하거나 CI에서 쓸 때만 필요해요.',
    '- Cloudflare Dashboard > My Profile > API Tokens 에서 만들어 주세요.',
    '- 가장 빠른 방법은 `Edit Cloudflare Workers` 템플릿으로 시작하는 거예요.',
    '- 권한은 최소한 `Account > Workers Scripts > Write`, `Account > D1 > Write`, `Account > Workers R2 Storage > Write`를 포함해 주세요.',
    '- 발급된 secret은 `server/.env.local`의 `CLOUDFLARE_API_TOKEN=` 뒤에 붙여 넣으면 돼요.',
    `- ${CLOUDFLARE_API_TOKENS_DASHBOARD_URL}`,
    `- ${CLOUDFLARE_CREATE_TOKEN_DOC_URL}`,
    `- ${CLOUDFLARE_WORKERS_AUTH_DOC_URL}`,
    ...(options?.tokenGuideImagePath
      ? [
          '',
          '### 발급 화면 예시',
          '',
          `![Cloudflare API token 발급 화면](${options.tokenGuideImagePath})`,
        ]
      : []),
    '',
  ].join('\n')
}

function renderFirebaseServerReadme(
  tokens: TemplateTokens,
  options?: {
    loginCiGuideImagePath?: string | null
    serviceAccountGuideImagePaths?: string[] | null
  },
) {
  return [
    '# server',
    '',
    '이 워크스페이스는 Firebase Functions, Firestore 리소스, Firebase 프로젝트 연결을 관리하는 server 워크스페이스예요.',
    '',
    '## 디렉토리 구조',
    '',
    '```text',
    'server/',
    '  firebase.json',
    '  firestore.rules',
    '  firestore.indexes.json',
    '  .firebaserc',
    '  .env.local',
    '  scripts/',
    '    firebase-ensure-firestore.mjs',
    '  functions/',
    '    src/index.ts',
    '    package.json',
    '    tsconfig.json',
    '  package.json',
    '```',
    '',
    '## 주요 스크립트',
    '',
    `- \`cd server && ${tokens.packageManagerRunCommand} build\`: \`server/functions\`의 TypeScript를 빌드해요.`,
    `- \`cd server && ${tokens.packageManagerRunCommand} typecheck\`: \`server/functions\` 타입 검사를 실행해요.`,
    `- \`cd server && ${tokens.packageManagerRunCommand} firestore:ensure\`: Firestore API를 확인하고 없으면 \`(default)\` DB를 \`asia-northeast3\`에 만들어요.`,
    `- \`cd server && ${tokens.packageManagerRunCommand} deploy:firestore\`: Firestore rules와 indexes를 현재 project에 배포해요.`,
    `- \`cd server && ${tokens.packageManagerRunCommand} seed:public-status\`: frontend가 읽을 \`publicAppStatus/current\` 문서를 Firestore에 써요.`,
    `- \`cd server && ${tokens.packageManagerRunCommand} setup:public-status\`: Firestore 생성, rules 배포, seed 문서 작성을 한 번에 실행해요.`,
    `- \`cd server && ${tokens.packageManagerRunCommand} deploy\`: \`server/.env.local\`의 auth 값을 읽고 Firebase Functions + Firestore 리소스를 현재 project로 배포해요.`,
    `- \`cd server && ${tokens.packageManagerRunCommand} logs\`: Firebase Functions 로그를 확인해요.`,
    '',
    '## Miniapp / Backoffice 연결',
    '',
    '- miniapp frontend는 `frontend/src/lib/firebase.ts`, `frontend/src/lib/firestore.ts`, `frontend/src/lib/storage.ts`에서 Firebase Web SDK를 초기화해요.',
    '- miniapp frontend `.env.local`은 `frontend/.env.local`에 두고 `MINIAPP_FIREBASE_API_KEY`, `MINIAPP_FIREBASE_AUTH_DOMAIN`, `MINIAPP_FIREBASE_PROJECT_ID`, `MINIAPP_FIREBASE_STORAGE_BUCKET`, `MINIAPP_FIREBASE_MESSAGING_SENDER_ID`, `MINIAPP_FIREBASE_APP_ID`, `MINIAPP_FIREBASE_MEASUREMENT_ID`, `MINIAPP_FIREBASE_FUNCTION_REGION`를 사용해요.',
    '- frontend `granite.config.ts`는 `process.cwd()` 기준으로 `.env.local` 값을 읽어 같은 `MINIAPP_FIREBASE_*` 값을 주입해요.',
    '- `frontend/src/lib/public-app-status.ts`는 Firestore direct read를 먼저 시도하고, 권한 오류가 나면 `getPublicStatus` callable function으로 fallback 해요.',
    '- backoffice가 있으면 `backoffice/src/lib/firebase.ts`, `backoffice/src/lib/firestore.ts`, `backoffice/src/lib/storage.ts`가 같은 Firebase project를 사용해요.',
    '- backoffice `.env.local`은 `backoffice/.env.local`에 두고 `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`, `VITE_FIREBASE_MEASUREMENT_ID`를 사용해요.',
    '',
    '## 운영 메모',
    '',
    '- `server/.env.local`의 `FIREBASE_PROJECT_ID`, `FIREBASE_FUNCTION_REGION`은 배포 기준 메타데이터예요.',
    '- `server/.env.local`의 `FIREBASE_TOKEN` 또는 `GOOGLE_APPLICATION_CREDENTIALS`를 채우면 비대화형 deploy에 사용할 수 있어요.',
    '- `server/functions/package.json`의 Node runtime은 Firebase 지원 범위에 맞춰 `22`를 사용해요.',
    '- `server/functions/src/index.ts`는 `api` HTTP 함수와 `getPublicStatus` callable function을 함께 배포해요.',
    '',
    '## Firebase deploy auth',
    '',
    '- 브라우저 로그인 없이 CI나 비대화형 배포를 할 때만 필요해요.',
    '- `FIREBASE_TOKEN`은 `firebase login:ci`로 발급받아 `server/.env.local`의 `FIREBASE_TOKEN=` 뒤에 넣어 주세요.',
    '- `GOOGLE_APPLICATION_CREDENTIALS`는 Google Cloud Service Accounts 페이지에서 JSON 키를 발급받아 파일 경로를 넣어 주세요.',
    '- 서비스 계정을 따로 쓸 때는 보통 `Cloud Functions Developer`와 `Service Account User` 역할이 먼저 필요해요.',
    '- 프로젝트 설정에 따라 Cloud Build, Cloud Run, Artifact Registry 쪽 권한이 더 필요할 수 있고, 이 생성기는 가능한 자동 보정을 먼저 시도해요.',
    `- ${FIREBASE_CLI_DOC_URL}`,
    `- ${GOOGLE_CLOUD_SERVICE_ACCOUNTS_CONSOLE_URL}`,
    `- ${FIREBASE_ADMIN_SETUP_URL}`,
    ...(options?.loginCiGuideImagePath
      ? [
          '',
          '### `FIREBASE_TOKEN` 발급 화면 예시',
          '',
          `![Firebase login:ci 발급 화면](${options.loginCiGuideImagePath})`,
        ]
      : []),
    ...(options?.serviceAccountGuideImagePaths?.length
      ? [
          '',
          '### `GOOGLE_APPLICATION_CREDENTIALS` 발급 화면 예시',
          '',
          ...options.serviceAccountGuideImagePaths.map(
            (imagePath, index) =>
              `![Firebase service account 발급 화면 ${index + 1}](${imagePath})`,
          ),
        ]
      : []),
    '',
  ].join('\n')
}

async function patchTsconfigModuleFile(
  filePath: string,
  options?: {
    includeNodeTypes?: boolean
    allowImportingTsExtensions?: boolean
  },
) {
  if (!(await pathExists(filePath))) {
    return
  }

  const source = await readFile(filePath, 'utf8')
  const next = patchTsconfigModuleSource(source, options)
  await writeFile(filePath, next, 'utf8')
}

function stripToolingFromPackageJson(packageJson: PackageJson) {
  for (const scriptName of ['lint', 'lint:fix', 'format', 'format:check']) {
    delete packageJson.scripts?.[scriptName]
  }

  for (const dependencyName of TOOLING_DEPENDENCIES) {
    delete packageJson.dependencies?.[dependencyName]
    delete packageJson.devDependencies?.[dependencyName]
  }

  return packageJson
}

async function patchPackageJsonFile(
  packageJsonPath: string,
  patch: Parameters<typeof patchPackageJsonSource>[1],
) {
  const source = await readFile(packageJsonPath, 'utf8')
  const next = patchPackageJsonSource(source, patch)
  await writeFile(packageJsonPath, next, 'utf8')
}

function resolveGranitePluginVersion(packageJson: PackageJson) {
  return (
    packageJson.devDependencies?.['@granite-js/plugin-hermes'] ??
    packageJson.devDependencies?.['@granite-js/plugin-router'] ??
    packageJson.dependencies?.['@granite-js/react-native'] ??
    FALLBACK_GRANITE_PLUGIN_VERSION
  )
}

function normalizePackageVersionSpec(versionSpec: string | undefined) {
  const match = versionSpec?.match(/\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?/)
  return match?.[0] ?? null
}

function resolveWranglerSchemaUrl(packageJson: PackageJson) {
  const version =
    normalizePackageVersionSpec(packageJson.devDependencies?.[WRANGLER_PACKAGE_NAME]) ?? 'latest'
  return `https://unpkg.com/${WRANGLER_PACKAGE_NAME}@${version}/config-schema.json`
}

async function ensureRootGitignoreEntry(targetRoot: string, entry: string) {
  const gitignorePath = path.join(targetRoot, '.gitignore')

  if (!(await pathExists(gitignorePath))) {
    return
  }

  const source = await readFile(gitignorePath, 'utf8')
  const lines = source.split(/\r?\n/)

  if (lines.includes(entry)) {
    return
  }

  const nextLines = [...lines]

  while (nextLines.length > 0 && nextLines.at(-1) === '') {
    nextLines.pop()
  }

  nextLines.push(entry, '')
  await writeFile(gitignorePath, nextLines.join('\n'), 'utf8')
}

async function ensureRootBiomeIgnoreEntry(targetRoot: string, entry: string) {
  const biomePath = path.join(targetRoot, 'biome.json')

  if (!(await pathExists(biomePath))) {
    return
  }

  const biomeJson = JSON.parse(await readFile(biomePath, 'utf8')) as {
    files?: {
      ignore?: string[]
      includes?: string[]
    }
  }

  const includes = biomeJson.files?.includes

  if (includes) {
    const forceIgnoreEntry = toBiomeForceIgnorePattern(entry)

    if (includes.includes(forceIgnoreEntry) || includes.includes(entry)) {
      return
    }

    biomeJson.files = {
      ...(biomeJson.files ?? {}),
      includes: [...includes, forceIgnoreEntry],
    }
  } else {
    const ignore = biomeJson.files?.ignore ?? []

    if (ignore.includes(entry)) {
      return
    }

    biomeJson.files = {
      ...(biomeJson.files ?? {}),
      ignore: [...ignore, entry],
    }
  }

  await writeFile(biomePath, `${JSON.stringify(biomeJson, null, 2)}\n`, 'utf8')
}

function toBiomeForceIgnorePattern(entry: string) {
  if (entry.startsWith('!')) {
    return entry
  }

  if (entry.endsWith('/**')) {
    return `!!${entry.slice(0, -3)}`
  }

  return `!!${entry}`
}

async function ensureRootYarnPackageExtension(targetRoot: string) {
  const yarnrcPath = path.join(targetRoot, '.yarnrc.yml')

  if (!(await pathExists(yarnrcPath))) {
    return
  }

  const source = await readFile(yarnrcPath, 'utf8')

  if (source.includes(FIREBASE_YARN_PACKAGE_EXTENSION_KEY)) {
    return
  }

  const normalizedSource = source.endsWith('\n') ? source : `${source}\n`
  const nextSource = normalizedSource.includes('packageExtensions:')
    ? `${normalizedSource}${FIREBASE_YARN_PACKAGE_EXTENSION_BLOCK}\n`
    : `${normalizedSource}\npackageExtensions:\n${FIREBASE_YARN_PACKAGE_EXTENSION_BLOCK}\n`

  await writeFile(yarnrcPath, nextSource, 'utf8')
}

async function removeToolingFiles(workspaceRoot: string, packageManager: PackageManager) {
  const adapter = getPackageManagerAdapter(packageManager)
  await Promise.all(
    [...STATIC_TOOLING_FILES, ...adapter.toolingFiles].map((fileName) =>
      removePathIfExists(path.join(workspaceRoot, fileName)),
    ),
  )
}

async function removeWorkspaceArtifacts(workspaceRoot: string, packageManager: PackageManager) {
  const adapter = getPackageManagerAdapter(packageManager)
  await Promise.all(
    adapter.workspaceArtifacts.map((fileName) =>
      removePathIfExists(path.join(workspaceRoot, fileName)),
    ),
  )
}

async function patchGraniteConfig(
  frontendRoot: string,
  tokens: TemplateTokens,
  serverProvider: ServerProvider | null,
) {
  const graniteConfigPath = path.join(frontendRoot, 'granite.config.ts')

  if (!(await pathExists(graniteConfigPath))) {
    return
  }

  const source = await readFile(graniteConfigPath, 'utf8')
  const next = patchGraniteConfigSource(source, tokens, serverProvider)

  await writeFile(graniteConfigPath, next, 'utf8')
}

async function patchWorkspaceTsconfigModules(
  workspaceRoot: string,
  filePatches: Array<{
    fileName: string
    includeNodeTypes?: boolean
    allowImportingTsExtensions?: boolean
  }>,
) {
  await Promise.all(
    filePatches.map(({ fileName, includeNodeTypes, allowImportingTsExtensions }) =>
      patchTsconfigModuleFile(path.join(workspaceRoot, fileName), {
        includeNodeTypes,
        allowImportingTsExtensions,
      }),
    ),
  )
}

async function writeCloudflareVitestConfigFiles(serverRoot: string) {
  const wranglerConfigPath = path.join(serverRoot, 'wrangler.jsonc')

  if (!(await pathExists(wranglerConfigPath))) {
    return
  }

  const wranglerSource = await readFile(wranglerConfigPath, 'utf8')
  await writeTextFile(
    path.join(serverRoot, 'wrangler.vitest.jsonc'),
    createCloudflareVitestWranglerConfigSource(wranglerSource),
  )
  await writeTextFile(
    path.join(serverRoot, 'vitest.config.mts'),
    renderCloudflareVitestConfigSource(),
  )
}

async function writeFrontendSupabaseBootstrap(frontendRoot: string) {
  await writeTextFile(path.join(frontendRoot, 'src', 'env.d.ts'), FRONTEND_ENV_TYPES)
  await writeTextFile(
    path.join(frontendRoot, 'src', 'lib', 'supabase.ts'),
    FRONTEND_SUPABASE_CLIENT,
  )
}

async function writeFrontendCloudflareBootstrap(frontendRoot: string) {
  await writeTextFile(path.join(frontendRoot, 'src', 'env.d.ts'), FRONTEND_CLOUDFLARE_ENV_TYPES)
  await writeTextFile(
    path.join(frontendRoot, 'src', 'lib', 'api.ts'),
    FRONTEND_CLOUDFLARE_API_CLIENT,
  )
}

async function writeFrontendCloudflareTrpcBootstrap(frontendRoot: string) {
  await writeTextFile(
    path.join(frontendRoot, 'src', 'lib', 'trpc.ts'),
    renderCloudflareTrpcClientSource({
      urlExpression: 'import.meta.env.MINIAPP_API_BASE_URL',
    }),
  )
}

async function writeFrontendFirebaseBootstrap(frontendRoot: string) {
  await writeTextFile(path.join(frontendRoot, 'src', 'env.d.ts'), FRONTEND_FIREBASE_ENV_TYPES)
  await writeTextFile(path.join(frontendRoot, 'src', 'lib', 'firebase.ts'), FRONTEND_FIREBASE_APP)
  await writeTextFile(
    path.join(frontendRoot, 'src', 'lib', 'firestore.ts'),
    FRONTEND_FIREBASE_FIRESTORE,
  )
  await writeTextFile(
    path.join(frontendRoot, 'src', 'lib', 'functions.ts'),
    FRONTEND_FIREBASE_FUNCTIONS,
  )
  await writeTextFile(
    path.join(frontendRoot, 'src', 'lib', 'public-app-status.ts'),
    FRONTEND_FIREBASE_PUBLIC_APP_STATUS,
  )
  await writeTextFile(
    path.join(frontendRoot, 'src', 'lib', 'storage.ts'),
    FRONTEND_FIREBASE_STORAGE,
  )
}

async function writeBackofficeSupabaseBootstrap(backofficeRoot: string) {
  await writeTextFile(path.join(backofficeRoot, 'src', 'vite-env.d.ts'), BACKOFFICE_ENV_TYPES)
  await writeTextFile(
    path.join(backofficeRoot, 'src', 'lib', 'supabase.ts'),
    BACKOFFICE_SUPABASE_CLIENT,
  )
}

async function writeBackofficeCloudflareBootstrap(backofficeRoot: string) {
  await writeTextFile(
    path.join(backofficeRoot, 'src', 'vite-env.d.ts'),
    BACKOFFICE_CLOUDFLARE_ENV_TYPES,
  )
  await writeTextFile(
    path.join(backofficeRoot, 'src', 'lib', 'api.ts'),
    BACKOFFICE_CLOUDFLARE_API_CLIENT,
  )
}

async function writeBackofficeCloudflareTrpcBootstrap(backofficeRoot: string) {
  await writeTextFile(
    path.join(backofficeRoot, 'src', 'lib', 'trpc.ts'),
    renderCloudflareTrpcClientSource({
      urlExpression: 'import.meta.env.VITE_API_BASE_URL',
    }),
  )
}

async function writeBackofficeFirebaseBootstrap(backofficeRoot: string) {
  await writeTextFile(
    path.join(backofficeRoot, 'src', 'vite-env.d.ts'),
    BACKOFFICE_FIREBASE_ENV_TYPES,
  )
  await writeTextFile(
    path.join(backofficeRoot, 'src', 'lib', 'firebase.ts'),
    BACKOFFICE_FIREBASE_APP,
  )
  await writeTextFile(
    path.join(backofficeRoot, 'src', 'lib', 'firestore.ts'),
    BACKOFFICE_FIREBASE_FIRESTORE,
  )
  await writeTextFile(
    path.join(backofficeRoot, 'src', 'lib', 'storage.ts'),
    BACKOFFICE_FIREBASE_STORAGE,
  )
}

async function writeCloudflareTrpcServerBootstrap(serverRoot: string) {
  await writeTextFile(
    path.join(serverRoot, 'src', 'trpc', 'context.ts'),
    renderCloudflareServerTrpcContextSource(),
  )
  await writeTextFile(path.join(serverRoot, 'src', 'index.ts'), renderCloudflareServerIndexSource())
}

async function patchBackofficeEntryFiles(backofficeRoot: string) {
  const mainPath = path.join(backofficeRoot, 'src', 'main.tsx')
  const appPath = path.join(backofficeRoot, 'src', 'App.tsx')

  if (await pathExists(mainPath)) {
    const source = await readFile(mainPath, 'utf8')
    const next = patchBackofficeMainSource(source)

    await writeFile(mainPath, next, 'utf8')
  }

  if (await pathExists(appPath)) {
    const source = await readFile(appPath, 'utf8')
    const next = patchBackofficeAppSource(source)
    await writeFile(appPath, next, 'utf8')
  }
}

async function patchWranglerConfigSchema(serverRoot: string, packageJson: PackageJson) {
  const wranglerConfigPath = path.join(serverRoot, 'wrangler.jsonc')

  if (!(await pathExists(wranglerConfigPath))) {
    return
  }

  const source = await readFile(wranglerConfigPath, 'utf8')
  const next = patchWranglerConfigSource(source, {
    schemaUrl: resolveWranglerSchemaUrl(packageJson),
  })

  await writeFile(wranglerConfigPath, next, 'utf8')
}

function normalizeVitestTestScript(script: string) {
  if (script === 'vitest') {
    return 'vitest run'
  }

  return script
}

function renderTrpcWorkspaceBuildCommand(packageManager: PackageManager) {
  return getPackageManagerAdapter(packageManager).runScriptInDirectoryCommand(
    '../packages/app-router',
    'build',
  )
}

function prefixTrpcWorkspaceBuild(command: string, packageManager: PackageManager) {
  return `${renderTrpcWorkspaceBuildCommand(packageManager)} && ${command}`
}

async function ensureFrontendPackageJsonForWorkspace(
  frontendRoot: string,
  packageJson: PackageJson,
  packageManager: PackageManager,
  serverProvider: ServerProvider | null,
  trpc = false,
) {
  const scripts: Record<string, string> = {}
  const dependencies: Record<string, string> = {}
  const devDependencies: Record<string, string> = {}

  if (!packageJson.scripts?.typecheck) {
    scripts.typecheck = 'tsc --noEmit'
  }

  if (!packageJson.scripts?.test) {
    scripts.test = `node -e "console.log('frontend test placeholder')"`
  } else if (packageJson.scripts.test === 'vitest') {
    scripts.test = normalizeVitestTestScript(packageJson.scripts.test)
  }

  if (!packageJson.devDependencies?.['@types/node']) {
    devDependencies['@types/node'] = NODE_TYPES_VERSION
  }

  if (serverProvider === 'supabase') {
    if (!packageJson.dependencies?.['@supabase/supabase-js']) {
      dependencies['@supabase/supabase-js'] = SUPABASE_JS_VERSION
    }
  }

  if (serverProvider === 'firebase' && !packageJson.dependencies?.firebase) {
    dependencies.firebase = FIREBASE_JS_VERSION
  }

  if (
    serverProvider === 'supabase' ||
    serverProvider === 'cloudflare' ||
    serverProvider === 'firebase'
  ) {
    if (!packageJson.devDependencies?.['@granite-js/plugin-env']) {
      devDependencies['@granite-js/plugin-env'] = resolveGranitePluginVersion(packageJson)
    }
  }

  if (
    (serverProvider === 'supabase' ||
      serverProvider === 'cloudflare' ||
      serverProvider === 'firebase') &&
    !packageJson.devDependencies?.dotenv
  ) {
    devDependencies.dotenv = DOTENV_VERSION
  }

  if (trpc && serverProvider === 'cloudflare') {
    if (!packageJson.dependencies?.['@trpc/client']) {
      dependencies['@trpc/client'] = TRPC_CLIENT_VERSION
    }

    if (!packageJson.devDependencies?.['@workspace/app-router']) {
      devDependencies['@workspace/app-router'] = APP_ROUTER_WORKSPACE_DEPENDENCY
    }

    scripts.typecheck = prefixTrpcWorkspaceBuild(
      packageJson.scripts?.typecheck ?? 'tsc --noEmit',
      packageManager,
    )
  }

  await patchPackageJsonFile(path.join(frontendRoot, 'package.json'), {
    upsertTopLevel: [
      {
        key: 'name',
        value: packageJson.name,
      },
    ],
    upsertSections: {
      scripts,
      dependencies,
      devDependencies,
    },
  })
}

async function ensureBackofficePackageJsonForWorkspace(
  backofficeRoot: string,
  packageJson: PackageJson,
  packageManager: PackageManager,
  serverProvider: ServerProvider | null,
  trpc = false,
  reactVersionAlignment: ReactVersionAlignment | null = null,
) {
  const scripts: Record<string, string> = {
    typecheck: 'tsc -b --pretty false',
  }
  const dependencies: Record<string, string> = {}
  const devDependencies: Record<string, string> = {}

  if (!packageJson.scripts?.test) {
    scripts.test = `node -e "console.log('backoffice test placeholder')"`
  } else if (packageJson.scripts.test === 'vitest') {
    scripts.test = normalizeVitestTestScript(packageJson.scripts.test)
  }

  if (serverProvider === 'supabase') {
    if (!packageJson.dependencies?.['@supabase/supabase-js']) {
      dependencies['@supabase/supabase-js'] = SUPABASE_JS_VERSION
    }
  }

  if (serverProvider === 'firebase' && !packageJson.dependencies?.firebase) {
    dependencies.firebase = FIREBASE_JS_VERSION
  }

  if (
    reactVersionAlignment?.react &&
    packageJson.dependencies?.react &&
    packageJson.dependencies.react !== reactVersionAlignment.react
  ) {
    dependencies.react = reactVersionAlignment.react
  }

  if (
    reactVersionAlignment?.reactDom &&
    packageJson.dependencies?.['react-dom'] &&
    packageJson.dependencies['react-dom'] !== reactVersionAlignment.reactDom
  ) {
    dependencies['react-dom'] = reactVersionAlignment.reactDom
  }

  if (
    reactVersionAlignment?.reactTypes &&
    packageJson.devDependencies?.['@types/react'] &&
    packageJson.devDependencies['@types/react'] !== reactVersionAlignment.reactTypes
  ) {
    devDependencies['@types/react'] = reactVersionAlignment.reactTypes
  }

  const alignedReactDomTypesVersion =
    reactVersionAlignment?.reactDomTypes ??
    (reactVersionAlignment?.react && packageJson.devDependencies?.['@types/react-dom']
      ? applyExistingVersionPrefix(
          packageJson.devDependencies['@types/react-dom'],
          reactVersionAlignment.react,
        )
      : null)

  if (
    alignedReactDomTypesVersion &&
    packageJson.devDependencies?.['@types/react-dom'] &&
    packageJson.devDependencies['@types/react-dom'] !== alignedReactDomTypesVersion
  ) {
    devDependencies['@types/react-dom'] = alignedReactDomTypesVersion
  }

  if (trpc && serverProvider === 'cloudflare') {
    if (!packageJson.dependencies?.['@trpc/client']) {
      dependencies['@trpc/client'] = TRPC_CLIENT_VERSION
    }

    if (!packageJson.devDependencies?.['@workspace/app-router']) {
      devDependencies['@workspace/app-router'] = APP_ROUTER_WORKSPACE_DEPENDENCY
    }

    scripts.typecheck = prefixTrpcWorkspaceBuild(scripts.typecheck, packageManager)
  }

  await patchPackageJsonFile(path.join(backofficeRoot, 'package.json'), {
    upsertTopLevel: [
      {
        key: 'name',
        value: packageJson.name,
      },
    ],
    upsertSections: {
      scripts,
      dependencies,
      devDependencies,
    },
  })
}

export async function ensureFrontendSupabaseBootstrap(targetRoot: string, tokens: TemplateTokens) {
  const frontendRoot = path.join(targetRoot, 'frontend')
  const packageJsonPath = path.join(frontendRoot, 'package.json')
  const packageJson = await readPackageJson(packageJsonPath)

  await ensureFrontendPackageJsonForWorkspace(
    frontendRoot,
    packageJson,
    tokens.packageManager,
    'supabase',
  )
  await patchGraniteConfig(frontendRoot, tokens, 'supabase')
  await patchWorkspaceTsconfigModules(frontendRoot, [
    {
      fileName: 'tsconfig.json',
      includeNodeTypes: true,
    },
  ])
  await writeFrontendSupabaseBootstrap(frontendRoot)
  await applyWorkspaceProjectTemplate(targetRoot, 'frontend', tokens)
}

export async function ensureBackofficeSupabaseBootstrap(
  targetRoot: string,
  tokens: TemplateTokens,
) {
  const backofficeRoot = path.join(targetRoot, 'backoffice')
  const packageJsonPath = path.join(backofficeRoot, 'package.json')
  const packageJson = await readPackageJson(packageJsonPath)

  await ensureBackofficePackageJsonForWorkspace(
    backofficeRoot,
    packageJson,
    tokens.packageManager,
    'supabase',
  )
  await patchWorkspaceTsconfigModules(backofficeRoot, [
    { fileName: 'tsconfig.json' },
    { fileName: 'tsconfig.app.json' },
    { fileName: 'tsconfig.node.json' },
  ])
  await patchBackofficeEntryFiles(backofficeRoot)
  await writeBackofficeSupabaseBootstrap(backofficeRoot)
  await applyWorkspaceProjectTemplate(targetRoot, 'backoffice', tokens)
}

export async function ensureFrontendCloudflareBootstrap(
  targetRoot: string,
  tokens: TemplateTokens,
) {
  const frontendRoot = path.join(targetRoot, 'frontend')
  const packageJsonPath = path.join(frontendRoot, 'package.json')
  const packageJson = await readPackageJson(packageJsonPath)

  await ensureFrontendPackageJsonForWorkspace(
    frontendRoot,
    packageJson,
    tokens.packageManager,
    'cloudflare',
  )
  await patchGraniteConfig(frontendRoot, tokens, 'cloudflare')
  await patchWorkspaceTsconfigModules(frontendRoot, [
    {
      fileName: 'tsconfig.json',
      includeNodeTypes: true,
    },
  ])
  await writeFrontendCloudflareBootstrap(frontendRoot)
  await applyWorkspaceProjectTemplate(targetRoot, 'frontend', tokens)
}

export async function ensureFrontendFirebaseBootstrap(targetRoot: string, tokens: TemplateTokens) {
  const frontendRoot = path.join(targetRoot, 'frontend')
  const packageJsonPath = path.join(frontendRoot, 'package.json')
  const packageJson = await readPackageJson(packageJsonPath)

  await ensureFrontendPackageJsonForWorkspace(
    frontendRoot,
    packageJson,
    tokens.packageManager,
    'firebase',
  )
  await patchGraniteConfig(frontendRoot, tokens, 'firebase')
  await patchWorkspaceTsconfigModules(frontendRoot, [
    {
      fileName: 'tsconfig.json',
      includeNodeTypes: true,
    },
  ])
  await writeFrontendFirebaseBootstrap(frontendRoot)
  await applyWorkspaceProjectTemplate(targetRoot, 'frontend', tokens)
}

export async function ensureBackofficeCloudflareBootstrap(
  targetRoot: string,
  tokens: TemplateTokens,
) {
  const backofficeRoot = path.join(targetRoot, 'backoffice')
  const packageJsonPath = path.join(backofficeRoot, 'package.json')
  const packageJson = await readPackageJson(packageJsonPath)

  await ensureBackofficePackageJsonForWorkspace(
    backofficeRoot,
    packageJson,
    tokens.packageManager,
    'cloudflare',
  )
  await patchWorkspaceTsconfigModules(backofficeRoot, [
    { fileName: 'tsconfig.json' },
    { fileName: 'tsconfig.app.json' },
    { fileName: 'tsconfig.node.json' },
  ])
  await patchBackofficeEntryFiles(backofficeRoot)
  await writeBackofficeCloudflareBootstrap(backofficeRoot)
  await applyWorkspaceProjectTemplate(targetRoot, 'backoffice', tokens)
}

export async function ensureBackofficeFirebaseBootstrap(
  targetRoot: string,
  tokens: TemplateTokens,
) {
  const backofficeRoot = path.join(targetRoot, 'backoffice')
  const packageJsonPath = path.join(backofficeRoot, 'package.json')
  const packageJson = await readPackageJson(packageJsonPath)

  await ensureBackofficePackageJsonForWorkspace(
    backofficeRoot,
    packageJson,
    tokens.packageManager,
    'firebase',
  )
  await patchWorkspaceTsconfigModules(backofficeRoot, [
    { fileName: 'tsconfig.json' },
    { fileName: 'tsconfig.app.json' },
    { fileName: 'tsconfig.node.json' },
  ])
  await patchBackofficeEntryFiles(backofficeRoot)
  await writeBackofficeFirebaseBootstrap(backofficeRoot)
  await applyWorkspaceProjectTemplate(targetRoot, 'backoffice', tokens)
}

export async function patchFrontendWorkspace(
  targetRoot: string,
  tokens: TemplateTokens,
  options: WorkspacePatchOptions,
) {
  const frontendRoot = path.join(targetRoot, 'frontend')
  const packageJsonPath = path.join(frontendRoot, 'package.json')
  const packageJson = stripToolingFromPackageJson(await readPackageJson(packageJsonPath))

  packageJson.name = 'frontend'
  await patchPackageJsonFile(packageJsonPath, {
    upsertTopLevel: [
      {
        key: 'name',
        value: packageJson.name,
      },
    ],
    removeFromSections: {
      scripts: ['lint', 'lint:fix', 'format', 'format:check'],
      dependencies: [...TOOLING_DEPENDENCIES],
      devDependencies: [...TOOLING_DEPENDENCIES],
    },
  })
  await ensureFrontendPackageJsonForWorkspace(
    frontendRoot,
    packageJson,
    options.packageManager,
    options.serverProvider,
    options.trpc,
  )
  await removeToolingFiles(frontendRoot, options.packageManager)
  await removeWorkspaceArtifacts(frontendRoot, options.packageManager)
  await patchGraniteConfig(frontendRoot, tokens, options.serverProvider)
  await ensureFrontendStarterHeroAsset(frontendRoot)
  await patchGraniteStarterPages(frontendRoot)
  await patchWorkspaceTsconfigModules(frontendRoot, [
    {
      fileName: 'tsconfig.json',
      includeNodeTypes: true,
      allowImportingTsExtensions: options.trpc && options.serverProvider === 'cloudflare',
    },
  ])
  if (options.packageManager === 'npm') {
    await writeWorkspaceNpmrc(frontendRoot)
  }

  if (options.serverProvider === 'supabase') {
    await writeFrontendSupabaseBootstrap(frontendRoot)
  }

  if (options.serverProvider === 'cloudflare') {
    await writeTextFile(path.join(frontendRoot, 'src', 'env.d.ts'), FRONTEND_CLOUDFLARE_ENV_TYPES)
    if (options.trpc) {
      await writeFrontendCloudflareTrpcBootstrap(frontendRoot)
      if (options.removeCloudflareApiClientHelpers) {
        await removePathIfExists(path.join(frontendRoot, 'src', 'lib', 'api.ts'))
      }
    } else {
      await writeTextFile(
        path.join(frontendRoot, 'src', 'lib', 'api.ts'),
        FRONTEND_CLOUDFLARE_API_CLIENT,
      )
    }
  }

  if (options.serverProvider === 'firebase') {
    await ensureFrontendFirebaseCryptoShim(frontendRoot)
    await writeFrontendFirebaseBootstrap(frontendRoot)
  }

  await applyWorkspaceProjectTemplate(targetRoot, 'frontend', tokens)
}

export async function patchBackofficeWorkspace(
  targetRoot: string,
  tokens: TemplateTokens,
  options: WorkspacePatchOptions,
) {
  const backofficeRoot = path.join(targetRoot, 'backoffice')
  const packageJsonPath = path.join(backofficeRoot, 'package.json')
  const packageJson = stripToolingFromPackageJson(await readPackageJson(packageJsonPath))
  const reactVersionAlignment = await resolveFrontendReactVersionAlignment(targetRoot)

  packageJson.name = 'backoffice'
  await patchPackageJsonFile(packageJsonPath, {
    upsertTopLevel: [
      {
        key: 'name',
        value: packageJson.name,
      },
    ],
    removeFromSections: {
      scripts: ['lint', 'lint:fix', 'format', 'format:check'],
      dependencies: [...TOOLING_DEPENDENCIES],
      devDependencies: [...TOOLING_DEPENDENCIES],
    },
  })
  await ensureBackofficePackageJsonForWorkspace(
    backofficeRoot,
    packageJson,
    options.packageManager,
    options.serverProvider,
    options.trpc,
    reactVersionAlignment,
  )
  await patchWorkspaceTsconfigModules(backofficeRoot, [
    { fileName: 'tsconfig.json' },
    { fileName: 'tsconfig.app.json' },
    { fileName: 'tsconfig.node.json' },
  ])
  await patchBackofficeEntryFiles(backofficeRoot)
  if (options.packageManager === 'npm') {
    await writeWorkspaceNpmrc(backofficeRoot)
  }
  await removeToolingFiles(backofficeRoot, options.packageManager)
  await removeWorkspaceArtifacts(backofficeRoot, options.packageManager)

  if (options.serverProvider === 'supabase') {
    await writeBackofficeSupabaseBootstrap(backofficeRoot)
  }

  if (options.serverProvider === 'cloudflare') {
    await writeTextFile(
      path.join(backofficeRoot, 'src', 'vite-env.d.ts'),
      BACKOFFICE_CLOUDFLARE_ENV_TYPES,
    )
    if (options.trpc) {
      await writeBackofficeCloudflareTrpcBootstrap(backofficeRoot)
      if (options.removeCloudflareApiClientHelpers) {
        await removePathIfExists(path.join(backofficeRoot, 'src', 'lib', 'api.ts'))
      }
    } else {
      await writeTextFile(
        path.join(backofficeRoot, 'src', 'lib', 'api.ts'),
        BACKOFFICE_CLOUDFLARE_API_CLIENT,
      )
    }
  }

  if (options.serverProvider === 'firebase') {
    await writeBackofficeFirebaseBootstrap(backofficeRoot)
  }

  await applyWorkspaceProjectTemplate(targetRoot, 'backoffice', tokens)
}

export async function patchSupabaseServerWorkspace(
  targetRoot: string,
  tokens: TemplateTokens,
  options: Pick<WorkspacePatchOptions, 'packageManager'> & {
    accessTokenGuideImageSourcePaths?: string[] | null
  },
) {
  const serverRoot = path.join(targetRoot, 'server')
  const accessTokenGuideImagePaths = await copyGuideAssets(
    serverRoot,
    options.accessTokenGuideImageSourcePaths ?? [],
    SUPABASE_ACCESS_TOKEN_GUIDE_ASSET_CANDIDATES,
  )
  await applyServerPackageTemplate(targetRoot, tokens)
  await writeTextFile(
    path.join(serverRoot, 'README.md'),
    renderSupabaseServerReadme(tokens, {
      accessTokenGuideImagePaths,
    }),
  )
  await removeToolingFiles(serverRoot, options.packageManager)
  await removeWorkspaceArtifacts(serverRoot, options.packageManager)
  await applyWorkspaceProjectTemplate(targetRoot, 'server', tokens)
}

export async function patchCloudflareServerWorkspace(
  targetRoot: string,
  tokens: TemplateTokens,
  options: Pick<WorkspacePatchOptions, 'packageManager'> & {
    tokenGuideImageSourcePath?: string | null
    trpc?: boolean
  },
) {
  const serverRoot = path.join(targetRoot, 'server')
  const packageJsonPath = path.join(serverRoot, 'package.json')
  const packageJson = await readPackageJson(packageJsonPath)
  const tokenGuideImagePath = await copyCloudflareTokenGuideAsset(
    serverRoot,
    options.tokenGuideImageSourcePath,
  )

  await patchPackageJsonFile(packageJsonPath, {
    upsertTopLevel: [
      {
        key: 'name',
        value: 'server',
      },
    ],
    upsertSections: {
      scripts: {
        ...(options.trpc
          ? {
              dev: prefixTrpcWorkspaceBuild(
                packageJson.scripts?.dev ?? 'wrangler dev',
                options.packageManager,
              ),
              deploy: prefixTrpcWorkspaceBuild(
                'node ./scripts/cloudflare-deploy.mjs',
                options.packageManager,
              ),
              build: prefixTrpcWorkspaceBuild('wrangler deploy --dry-run', options.packageManager),
              typecheck: prefixTrpcWorkspaceBuild(
                'wrangler types && tsc --noEmit',
                options.packageManager,
              ),
            }
          : {
              deploy: 'node ./scripts/cloudflare-deploy.mjs',
              build: 'wrangler deploy --dry-run',
              typecheck: 'wrangler types && tsc --noEmit',
            }),
        ...(packageJson.scripts?.test === 'vitest'
          ? {
              test: normalizeVitestTestScript(packageJson.scripts.test),
            }
          : {}),
      },
      ...(options.trpc
        ? {
            dependencies: {
              '@trpc/server': TRPC_SERVER_VERSION,
              '@workspace/app-router': APP_ROUTER_WORKSPACE_DEPENDENCY,
              '@workspace/contracts': CONTRACTS_WORKSPACE_DEPENDENCY,
            },
          }
        : {}),
    },
    removeFromSections: {
      scripts: ['deploy:remote', ...(options.trpc ? ['trpc:sync'] : [])],
    },
  })
  await patchWranglerConfigSchema(serverRoot, packageJson)
  await writeCloudflareVitestConfigFiles(serverRoot)
  await writeTextFile(
    path.join(serverRoot, 'README.md'),
    renderCloudflareServerReadme(tokens, {
      tokenGuideImagePath,
      trpc: options.trpc,
    }),
  )
  await writeTextFile(
    path.join(serverRoot, 'scripts', 'cloudflare-deploy.mjs'),
    renderCloudflareDeployScript(tokens),
  )
  if (options.trpc) {
    await writeCloudflareTrpcServerBootstrap(serverRoot)
    await removePathIfExists(path.join(serverRoot, 'scripts', 'trpc-sync.mjs'))
  }
  if (options.packageManager === 'npm') {
    await writeWorkspaceNpmrc(serverRoot)
  }
  await ensureRootGitignoreEntry(targetRoot, CLOUDFLARE_ROOT_GITIGNORE_ENTRY)
  await ensureRootBiomeIgnoreEntry(targetRoot, CLOUDFLARE_ROOT_BIOME_IGNORE_ENTRY)

  await Promise.all(
    CLOUDFLARE_SERVER_LOCAL_FILES.map((fileName) =>
      removePathIfExists(path.join(serverRoot, fileName)),
    ),
  )
  await removeToolingFiles(serverRoot, options.packageManager)
  await removeWorkspaceArtifacts(serverRoot, options.packageManager)
  await applyWorkspaceProjectTemplate(targetRoot, 'server', tokens)
}

export async function patchFirebaseServerWorkspace(
  targetRoot: string,
  tokens: TemplateTokens,
  options: Pick<WorkspacePatchOptions, 'packageManager'> & {
    loginCiGuideImageSourcePath?: string | null
    serviceAccountGuideImageSourcePaths?: string[] | null
  },
) {
  const serverRoot = path.join(targetRoot, 'server')
  const loginCiGuideImagePath =
    (
      await copyGuideAssets(
        serverRoot,
        [options.loginCiGuideImageSourcePath],
        FIREBASE_LOGIN_CI_GUIDE_ASSET_CANDIDATES,
      )
    )[0] ?? null
  const serviceAccountGuideImagePaths = await copyGuideAssets(
    serverRoot,
    options.serviceAccountGuideImageSourcePaths ?? [],
    FIREBASE_SERVICE_ACCOUNT_GUIDE_ASSET_CANDIDATES,
  )

  await writeTextFile(
    path.join(serverRoot, 'README.md'),
    renderFirebaseServerReadme(tokens, {
      loginCiGuideImagePath,
      serviceAccountGuideImagePaths,
    }),
  )
  await ensureRootGitignoreEntry(targetRoot, FIREBASE_ROOT_GITIGNORE_ENTRY)
  await ensureRootBiomeIgnoreEntry(targetRoot, FIREBASE_ROOT_BIOME_IGNORE_ENTRY)
  if (options.packageManager === 'yarn') {
    await ensureRootYarnPackageExtension(targetRoot)
  }
  await removeToolingFiles(serverRoot, options.packageManager)
  await removeWorkspaceArtifacts(serverRoot, options.packageManager)
  await removePathIfExists(path.join(serverRoot, '.eslintrc.js'))
  await applyWorkspaceProjectTemplate(targetRoot, 'server', tokens)
}

export function createRootPackageName(appName: string) {
  return `${appName}-workspace`
}
