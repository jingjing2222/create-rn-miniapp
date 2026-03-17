import type { ServerProvider } from '../../providers/index.js'
import type { TemplateTokens } from '../../templates/index.js'
import {
  cloneAstNode,
  ensureImport,
  ensureTopLevelStatementBlock,
  escapeRegExp,
  getObjectProperty,
  getObjectPropertyValue,
  isCallExpression,
  isIdentifier,
  isStringLiteral,
  parseExpression,
  parseTypeScriptModule,
  printTypeScriptModule,
  type SwcArrayExpression,
  type SwcExpression,
  type SwcModule,
  type SwcObjectExpression,
  upsertObjectProperty,
} from './shared.js'

function getDefineConfigObject(module: SwcModule) {
  const exportStatement = module.body.find(
    (statement) => statement.type === 'ExportDefaultExpression',
  )

  if (!exportStatement) {
    return null
  }

  const expression = exportStatement.expression as unknown
  if (!isCallExpression(expression) || !isIdentifier(expression.callee, 'defineConfig')) {
    return null
  }

  const firstArgument = expression.arguments[0]?.expression
  if (!firstArgument || firstArgument.type !== 'ObjectExpression') {
    return null
  }

  return firstArgument as SwcObjectExpression
}

function ensurePluginsArrayExpression(configObject: SwcObjectExpression) {
  const pluginsProperty = getObjectProperty(configObject, 'plugins')

  if (pluginsProperty?.value.type === 'ArrayExpression') {
    return pluginsProperty.value as SwcArrayExpression
  }

  const nextPluginsExpression = parseExpression('[]') as SwcArrayExpression
  upsertObjectProperty(configObject, 'plugins', '[]')

  const nextPluginsProperty = getObjectProperty(configObject, 'plugins')
  if (!nextPluginsProperty || nextPluginsProperty.value.type !== 'ArrayExpression') {
    throw new Error('plugins 배열을 만들지 못했습니다.')
  }

  nextPluginsProperty.value = nextPluginsExpression
  return nextPluginsProperty.value as SwcArrayExpression
}

function ensureNestedObjectProperty(objectExpression: SwcObjectExpression, propertyName: string) {
  const existingValue = getObjectPropertyValue(objectExpression, propertyName)

  if (existingValue?.type === 'ObjectExpression') {
    return existingValue as SwcObjectExpression
  }

  upsertObjectProperty(objectExpression, propertyName, '{}')
  const nextValue = getObjectPropertyValue(objectExpression, propertyName)

  if (!nextValue || nextValue.type !== 'ObjectExpression') {
    throw new Error(`${propertyName} 객체를 만들지 못했습니다.`)
  }

  return nextValue as SwcObjectExpression
}

function ensureArrayProperty(objectExpression: SwcObjectExpression, propertyName: string) {
  const existingValue = getObjectPropertyValue(objectExpression, propertyName)

  if (existingValue?.type === 'ArrayExpression') {
    return existingValue as SwcArrayExpression
  }

  upsertObjectProperty(objectExpression, propertyName, '[]')
  const nextValue = getObjectPropertyValue(objectExpression, propertyName)

  if (!nextValue || nextValue.type !== 'ArrayExpression') {
    throw new Error(`${propertyName} 배열을 만들지 못했습니다.`)
  }

  return nextValue as SwcArrayExpression
}

function findPluginCall(arrayExpression: SwcArrayExpression, pluginName: string) {
  return arrayExpression.elements.find((element) => {
    const expression = element?.expression
    return expression && isCallExpression(expression) && isIdentifier(expression.callee, pluginName)
  })?.expression as
    | ({
        arguments: Array<{ expression: SwcExpression } | null>
      } & SwcExpression)
    | undefined
}

function ensureEnvPlugin(arrayExpression: SwcArrayExpression, pluginSource: string) {
  const nextPluginExpression = parseExpression(pluginSource)
  const existingPluginCall = findPluginCall(arrayExpression, 'env')

  if (existingPluginCall && nextPluginExpression.type === 'CallExpression') {
    Object.assign(existingPluginCall, cloneAstNode(nextPluginExpression))
    return
  }

  arrayExpression.elements.unshift({
    spread: null,
    expression: nextPluginExpression,
  })
}

function updateAppsInTossBrand(configObject: SwcObjectExpression, tokens: TemplateTokens) {
  const pluginsArray = ensurePluginsArrayExpression(configObject)
  const appsInTossCall = findPluginCall(pluginsArray, 'appsInToss')

  if (!appsInTossCall) {
    return
  }

  const appsInTossConfig = appsInTossCall.arguments[0]?.expression
  if (!appsInTossConfig || appsInTossConfig.type !== 'ObjectExpression') {
    return
  }

  const brandExpression = getObjectPropertyValue(appsInTossConfig as SwcObjectExpression, 'brand')
  if (!brandExpression || brandExpression.type !== 'ObjectExpression') {
    return
  }

  upsertObjectProperty(
    brandExpression as SwcObjectExpression,
    'displayName',
    JSON.stringify(tokens.displayName),
  )
  upsertObjectProperty(brandExpression as SwcObjectExpression, 'icon', JSON.stringify(''))
}

function ensureRepoRootWatchFolder(configObject: SwcObjectExpression) {
  const metroObject = ensureNestedObjectProperty(configObject, 'metro')
  const watchFoldersArray = ensureArrayProperty(metroObject, 'watchFolders')
  const hasRepoRoot = watchFoldersArray.elements.some((element) => {
    return isIdentifier(element?.expression, 'repoRoot')
  })

  if (hasRepoRoot) {
    return
  }

  watchFoldersArray.elements.push({
    spread: null,
    expression: parseExpression('repoRoot'),
  })
}

function ensureFirebaseCryptoShimResolvers(configObject: SwcObjectExpression) {
  const buildObject = ensureNestedObjectProperty(configObject, 'build')
  const buildResolverObject = ensureNestedObjectProperty(buildObject, 'resolver')
  upsertObjectProperty(buildResolverObject, 'alias', 'cryptoModuleAliases')

  const metroObject = ensureNestedObjectProperty(configObject, 'metro')
  const metroResolverObject = ensureNestedObjectProperty(metroObject, 'resolver')
  upsertObjectProperty(
    metroResolverObject,
    'conditionNames',
    "['react-native', 'browser', 'require', 'default']",
  )
  upsertObjectProperty(
    metroResolverObject,
    'extraNodeModules',
    "{ crypto: cryptoShimPath, 'node:crypto': cryptoShimPath }",
  )
}

const FRONTEND_REPO_ROOT_PREAMBLE = [
  'const appRoot = process.cwd()',
  "const repoRoot = path.resolve(appRoot, '../')",
  '',
].join('\n')

const FIREBASE_CRYPTO_SHIM_PREAMBLE = [
  "const cryptoShimPath = path.join(appRoot, 'src/shims/crypto.ts')",
  'const cryptoModuleAliases = [',
  '  {',
  "    from: 'crypto',",
  '    to: cryptoShimPath,',
  '    exact: true,',
  '  },',
  '  {',
  "    from: 'node:crypto',",
  '    to: cryptoShimPath,',
  '    exact: true,',
  '  },',
  ']',
  '',
].join('\n')

function createFrontendEnvPreamble(
  bindings: Array<{
    envName: string
    identifierName: string
    required?: boolean
    defaultValue?: string
  }>,
) {
  const envNameUnion = bindings.map((binding) => `'${binding.envName}'`).join(' | ')
  const hasOptionalBindings = bindings.some((binding) => binding.required === false)
  const envStatements = bindings.map((binding) => {
    const resolver = binding.required === false ? 'resolveOptionalMiniappEnv' : 'resolveMiniappEnv'
    const defaultSuffix =
      binding.defaultValue !== undefined ? ` || ${JSON.stringify(binding.defaultValue)}` : ''

    return `const ${binding.identifierName} = ${resolver}('${binding.envName}')${defaultSuffix}`
  })

  return [
    "dotenv.config({ path: path.join(appRoot, '.env') })",
    "dotenv.config({ path: path.join(appRoot, '.env.local'), override: true })",
    '',
    `function resolveMiniappEnv(name: ${envNameUnion}) {`,
    '  const value = process.env[name]',
    '',
    '  if (!value || value.trim().length === 0) {',
    "    throw new Error('[frontend] ' + name + ' is required. Set frontend/.env.local before running dev/build.')",
    '  }',
    '',
    '  return value.trim()',
    '}',
    '',
    ...(hasOptionalBindings
      ? [
          `function resolveOptionalMiniappEnv(name: ${envNameUnion}) {`,
          '  return process.env[name]?.trim() ?? ""',
          '}',
          '',
        ]
      : []),
    ...envStatements,
    '',
  ].join('\n')
}

const FRONTEND_PROVIDER_ENV_CONFIG = {
  supabase: {
    pluginSource:
      'env({ MINIAPP_SUPABASE_URL: miniappSupabaseUrl, MINIAPP_SUPABASE_PUBLISHABLE_KEY: miniappSupabasePublishableKey }, { dts: false })',
    preamble: createFrontendEnvPreamble([
      {
        envName: 'MINIAPP_SUPABASE_URL',
        identifierName: 'miniappSupabaseUrl',
      },
      {
        envName: 'MINIAPP_SUPABASE_PUBLISHABLE_KEY',
        identifierName: 'miniappSupabasePublishableKey',
      },
    ]),
  },
  cloudflare: {
    pluginSource: 'env({ MINIAPP_API_BASE_URL: miniappApiBaseUrl }, { dts: false })',
    preamble: createFrontendEnvPreamble([
      {
        envName: 'MINIAPP_API_BASE_URL',
        identifierName: 'miniappApiBaseUrl',
      },
    ]),
  },
  firebase: {
    pluginSource:
      'env({ MINIAPP_FIREBASE_API_KEY: miniappFirebaseApiKey, MINIAPP_FIREBASE_AUTH_DOMAIN: miniappFirebaseAuthDomain, MINIAPP_FIREBASE_PROJECT_ID: miniappFirebaseProjectId, MINIAPP_FIREBASE_STORAGE_BUCKET: miniappFirebaseStorageBucket, MINIAPP_FIREBASE_MESSAGING_SENDER_ID: miniappFirebaseMessagingSenderId, MINIAPP_FIREBASE_APP_ID: miniappFirebaseAppId, MINIAPP_FIREBASE_MEASUREMENT_ID: miniappFirebaseMeasurementId, MINIAPP_FIREBASE_FUNCTION_REGION: miniappFirebaseFunctionRegion }, { dts: false })',
    preamble: createFrontendEnvPreamble([
      {
        envName: 'MINIAPP_FIREBASE_API_KEY',
        identifierName: 'miniappFirebaseApiKey',
      },
      {
        envName: 'MINIAPP_FIREBASE_AUTH_DOMAIN',
        identifierName: 'miniappFirebaseAuthDomain',
      },
      {
        envName: 'MINIAPP_FIREBASE_PROJECT_ID',
        identifierName: 'miniappFirebaseProjectId',
      },
      {
        envName: 'MINIAPP_FIREBASE_STORAGE_BUCKET',
        identifierName: 'miniappFirebaseStorageBucket',
      },
      {
        envName: 'MINIAPP_FIREBASE_MESSAGING_SENDER_ID',
        identifierName: 'miniappFirebaseMessagingSenderId',
      },
      {
        envName: 'MINIAPP_FIREBASE_APP_ID',
        identifierName: 'miniappFirebaseAppId',
      },
      {
        envName: 'MINIAPP_FIREBASE_MEASUREMENT_ID',
        identifierName: 'miniappFirebaseMeasurementId',
        required: false,
      },
      {
        envName: 'MINIAPP_FIREBASE_FUNCTION_REGION',
        identifierName: 'miniappFirebaseFunctionRegion',
        required: false,
        defaultValue: 'asia-northeast3',
      },
    ]),
  },
} as const satisfies Partial<
  Record<
    ServerProvider,
    {
      pluginSource: string
      preamble: string
    }
  >
>

function ensureBlankLineBefore(source: string, marker: string) {
  const pattern = new RegExp(`([^\\n])\\n(${escapeRegExp(marker)})`, 'g')
  return source.replace(pattern, '$1\n\n$2')
}

function formatGraniteConfigSource(source: string) {
  let next = source

  for (const marker of [
    'const repoRoot =',
    'dotenv.config({',
    'function resolveMiniappEnv(',
    'const miniappSupabaseUrl =',
    'const miniappSupabasePublishableKey =',
    'const miniappApiBaseUrl =',
    'const cryptoShimPath =',
    'const miniappFirebaseApiKey =',
    'const miniappFirebaseAuthDomain =',
    'const miniappFirebaseProjectId =',
    'const miniappFirebaseStorageBucket =',
    'const miniappFirebaseMessagingSenderId =',
    'const miniappFirebaseAppId =',
    'const miniappFirebaseMeasurementId =',
    'export default defineConfig(',
  ]) {
    next = ensureBlankLineBefore(next, marker)
  }

  return next
}

export function patchGraniteConfigSource(
  source: string,
  tokens: TemplateTokens,
  serverProvider: ServerProvider | null,
) {
  const module = parseTypeScriptModule(source)
  const configObject = getDefineConfigObject(module)

  if (!configObject) {
    return source
  }

  upsertObjectProperty(configObject, 'appName', JSON.stringify(tokens.appName))
  updateAppsInTossBrand(configObject, tokens)
  ensureImport(module, 'node:path', `import path from 'node:path'`)
  ensureTopLevelStatementBlock(module, FRONTEND_REPO_ROOT_PREAMBLE)
  ensureRepoRootWatchFolder(configObject)

  const frontendEnvConfig = serverProvider
    ? FRONTEND_PROVIDER_ENV_CONFIG[serverProvider]
    : undefined

  if (frontendEnvConfig) {
    ensureImport(module, '@granite-js/plugin-env', `import { env } from '@granite-js/plugin-env'`)
    ensureImport(module, 'dotenv', `import dotenv from 'dotenv'`)
    ensureTopLevelStatementBlock(module, frontendEnvConfig.preamble)
    ensureEnvPlugin(ensurePluginsArrayExpression(configObject), frontendEnvConfig.pluginSource)
  }

  if (serverProvider === 'firebase') {
    ensureTopLevelStatementBlock(module, FIREBASE_CRYPTO_SHIM_PREAMBLE)
    ensureFirebaseCryptoShimResolvers(configObject)
  }

  return formatGraniteConfigSource(printTypeScriptModule(module))
}

export function readGraniteConfigMetadata(source: string) {
  const module = parseTypeScriptModule(source)
  const configObject = getDefineConfigObject(module)

  if (!configObject) {
    return {
      appName: null,
      displayName: null,
    }
  }

  const appNameExpression = getObjectPropertyValue(configObject, 'appName')
  const appName = isStringLiteral(appNameExpression) ? appNameExpression.value : null

  const pluginsArray = ensurePluginsArrayExpression(configObject)
  const appsInTossCall = findPluginCall(pluginsArray, 'appsInToss')
  const appsInTossConfig = appsInTossCall?.arguments[0]?.expression
  const brandExpression =
    appsInTossConfig?.type === 'ObjectExpression'
      ? getObjectPropertyValue(appsInTossConfig as SwcObjectExpression, 'brand')
      : null
  const displayNameExpression =
    brandExpression?.type === 'ObjectExpression'
      ? getObjectPropertyValue(brandExpression as SwcObjectExpression, 'displayName')
      : null
  const displayName = isStringLiteral(displayNameExpression) ? displayNameExpression.value : null

  return {
    appName,
    displayName,
  }
}
