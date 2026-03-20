import { copyFile, readFile } from 'node:fs/promises'
import path from 'node:path'
import type { ServerProvider } from '../providers/index.js'
import {
  pathExists,
  removePathIfExists,
  resolveTemplatesPackageRoot,
  writeWorkspaceNpmrc,
} from '../templates/filesystem.js'
import { applyWorkspaceProjectTemplate } from '../templates/server.js'
import type { TemplateTokens } from '../templates/types.js'
import {
  APP_ROUTER_WORKSPACE_DEPENDENCY,
  renderCloudflareTrpcClientSource,
  TRPC_CLIENT_VERSION,
} from './trpc.js'
import {
  DOTENV_VERSION,
  FIREBASE_JS_VERSION,
  NODE_TYPES_VERSION,
  SUPABASE_JS_VERSION,
  patchGraniteConfig,
  patchPackageJsonFile,
  patchWorkspaceTsconfigModules,
  prefixTrpcWorkspaceBuild,
  readPackageJson,
  removeToolingFiles,
  removeWorkspaceArtifacts,
  resolveGranitePluginVersion,
  stripToolingFromPackageJson,
  toolingDependencyNames,
  type PackageJson,
  type WorkspacePatchOptions,
  writeFrontendGranitePreset,
  writeTextFile,
} from './shared.js'

const FRONTEND_STARTER_HERO_ASSET_RELATIVE_PATH =
  'root/assets/frontend/miniapp-starter-hero.lottie.json'
const FRONTEND_STARTER_HERO_ASSET_FILE_NAME = 'miniapp-starter-hero.lottie.json'
const FRONTEND_FIREBASE_CRYPTO_SHIM_RELATIVE_PATH = 'root/assets/frontend/firebase-crypto-shim.ts'
const FRONTEND_FIREBASE_CRYPTO_SHIM_FILE_NAME = 'crypto.ts'

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
  '          먼저 여기부터 보면 돼요',
  '        </Txt>',
  '        <Txt typography="t7" color="#4A5568" style={styles.guideItem}>',
  '          생성물 루트 `AGENTS.md`의 `Start Here`를 먼저 따라가요.',
  '        </Txt>',
  '        <Txt typography="t7" color="#4A5568" style={styles.guideItem}>',
  '          필요한 화면과 데이터 흐름이 정리되면 `frontend/src/pages`부터 바꿔요.',
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
  '          먼저 `AGENTS.md`의 `Start Here`를 보고 필요한 화면과 데이터 흐름으로 바꿔 주세요.',
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
  "    throw new Error('Firebase 상태 문서의 ' + fieldName + ' 값이 올바르지 않아요.')",
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
  "      throw new Error('Firebase 상태 문서의 items[' + index + '] 값이 올바르지 않아요.')",
  '    }',
  '',
  '    const record = item as Record<string, unknown>',
  '',
  '    return {',
  "      label: readRequiredString(record.label, 'items[' + index + '].label'),",
  "      value: readRequiredString(record.value, 'items[' + index + '].value'),",
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

  await writeTextFile(targetPath, '')
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

  await writeTextFile(targetPath, '')
  await copyFile(sourcePath, targetPath)
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

async function ensureFrontendPackageJsonForWorkspace(
  frontendRoot: string,
  packageJson: PackageJson,
  packageManager: TemplateTokens['packageManager'],
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
    scripts.test = 'vitest run'
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
      dependencies: toolingDependencyNames(),
      devDependencies: toolingDependencyNames(),
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
  await writeFrontendGranitePreset(frontendRoot, options.serverProvider)
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
