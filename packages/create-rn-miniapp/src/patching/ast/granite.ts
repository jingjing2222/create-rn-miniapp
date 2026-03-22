import type { ServerProvider } from '../../providers/index.js'
import type { TemplateTokens } from '../../templates/types.js'
import {
  ensureImport,
  escapeRegExp,
  extractTopLevelStatementKey,
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
import dedent, { dedentWithTrailingNewline } from '../../dedent.js'

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
    return isIdentifier(element?.expression, 'workspaceRepoRoot')
  })

  if (hasRepoRoot) {
    return
  }

  watchFoldersArray.elements.push({
    spread: null,
    expression: parseExpression('workspaceRepoRoot'),
  })
}

const FRONTEND_REPO_ROOT_PREAMBLE = dedentWithTrailingNewline`
  export const workspaceRepoRoot = path.resolve(process.cwd(), '../')
`

const FIREBASE_CRYPTO_SHIM_PREAMBLE = dedentWithTrailingNewline`
  const cryptoShimPath = path.join(process.cwd(), 'src/shims/crypto.ts')
  const cryptoModuleAliases = [
    {
      from: 'crypto',
      to: cryptoShimPath,
      exact: true,
    },
    {
      from: 'node:crypto',
      to: cryptoShimPath,
      exact: true,
    },
  ]
`

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

  return dedentWithTrailingNewline`
    dotenv.config({ path: path.join(process.cwd(), '.env') })
    dotenv.config({ path: path.join(process.cwd(), '.env.local'), override: true })
    
    function resolveMiniappEnv(name: ${envNameUnion}) {
      const value = process.env[name]
    
      if (!value || value.trim().length === 0) {
        throw new Error('[frontend] ' + name + ' is required. Set frontend/.env.local before running dev/build.')
      }
    
      return value.trim()
    }
    
    ${
      hasOptionalBindings
        ? dedentWithTrailingNewline`
            function resolveOptionalMiniappEnv(name: ${envNameUnion}) {
              return process.env[name]?.trim() ?? ""
            }
          `
        : ''
    }
    ${(envStatements).join('\n')}
  `
}

const FRONTEND_PROVIDER_ENV_CONFIG = {
  supabase: {
    bindingsSource:
      '{ MINIAPP_SUPABASE_URL: miniappSupabaseUrl, MINIAPP_SUPABASE_PUBLISHABLE_KEY: miniappSupabasePublishableKey }',
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
    bindingsSource: '{ MINIAPP_API_BASE_URL: miniappApiBaseUrl }',
    preamble: createFrontendEnvPreamble([
      {
        envName: 'MINIAPP_API_BASE_URL',
        identifierName: 'miniappApiBaseUrl',
      },
    ]),
  },
  firebase: {
    bindingsSource:
      '{ MINIAPP_FIREBASE_API_KEY: miniappFirebaseApiKey, MINIAPP_FIREBASE_AUTH_DOMAIN: miniappFirebaseAuthDomain, MINIAPP_FIREBASE_PROJECT_ID: miniappFirebaseProjectId, MINIAPP_FIREBASE_STORAGE_BUCKET: miniappFirebaseStorageBucket, MINIAPP_FIREBASE_MESSAGING_SENDER_ID: miniappFirebaseMessagingSenderId, MINIAPP_FIREBASE_APP_ID: miniappFirebaseAppId, MINIAPP_FIREBASE_MEASUREMENT_ID: miniappFirebaseMeasurementId, MINIAPP_FIREBASE_FUNCTION_REGION: miniappFirebaseFunctionRegion }',
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
      bindingsSource: string
      preamble: string
    }
  >
>

const GRANITE_CONFIG_REMOVABLE_IMPORT_SOURCES = new Set([
  'node:path',
  'dotenv',
  '@granite-js/plugin-env',
  './scaffold.preset',
])

const GRANITE_CONFIG_REMOVABLE_STATEMENT_KEYS = new Set([
  'var:appRoot',
  'var:repoRoot',
  'var:cryptoShimPath',
  'var:cryptoModuleAliases',
  'fn:resolveMiniappEnv',
  'fn:resolveOptionalMiniappEnv',
  'call:dotenv-config:.env',
  'call:dotenv-config:.env.local',
])

function ensureBlankLineBefore(source: string, marker: string) {
  const pattern = new RegExp(`([^\\n])\\n(${escapeRegExp(marker)})`, 'g')
  return source.replace(pattern, '$1\n\n$2')
}

function formatGraniteConfigSource(source: string) {
  let next = source

  for (const marker of [
    'const repoRoot =',
    'const workspaceRepoRoot =',
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

function syncGranitePresetImport(module: SwcModule, serverProvider: ServerProvider | null) {
  const importSpecifiers =
    serverProvider === 'firebase'
      ? [
          'firebaseBuildResolver',
          'firebaseMetroResolver',
          'scaffoldEnvBindings',
          'workspaceRepoRoot',
        ]
      : serverProvider
        ? ['scaffoldEnvBindings', 'workspaceRepoRoot']
        : ['workspaceRepoRoot']

  module.body = module.body.filter((statement) => {
    if (statement.type !== 'ImportDeclaration') {
      return true
    }

    const source = (statement.source as { value?: string } | undefined)?.value
    return source ? !GRANITE_CONFIG_REMOVABLE_IMPORT_SOURCES.has(source) : true
  })

  ensureImport(
    module,
    './scaffold.preset',
    `import { ${importSpecifiers.join(', ')} } from './scaffold.preset'`,
  )

  if (serverProvider) {
    ensureImport(module, '@granite-js/plugin-env', `import { env } from '@granite-js/plugin-env'`)
  }
}

function removeLegacyGraniteInlineStatements(module: SwcModule) {
  module.body = module.body.filter((statement) => {
    const key = extractTopLevelStatementKey(statement)

    if (!key) {
      return true
    }

    if (GRANITE_CONFIG_REMOVABLE_STATEMENT_KEYS.has(key)) {
      return false
    }

    return !key.startsWith('var:miniapp')
  })
}

function syncProviderPlugin(
  configObject: SwcObjectExpression,
  serverProvider: ServerProvider | null,
) {
  const pluginsArray = ensurePluginsArrayExpression(configObject)

  pluginsArray.elements = pluginsArray.elements.filter((element) => {
    const expression = element?.expression

    if (!expression) {
      return false
    }

    if (
      isIdentifier(expression, 'providerEnvPlugin') ||
      (isCallExpression(expression) && isIdentifier(expression.callee, 'env'))
    ) {
      return false
    }

    return true
  })

  if (!serverProvider) {
    return
  }

  pluginsArray.elements.unshift({
    spread: null,
    expression: parseExpression('env(scaffoldEnvBindings, { dts: false })'),
  })
}

function removeObjectProperty(objectExpression: SwcObjectExpression, propertyName: string) {
  objectExpression.properties = objectExpression.properties.filter((property) => {
    if (property.type !== 'KeyValueProperty') {
      return true
    }

    const key = property.key as unknown
    return !isIdentifier(key, propertyName) && !isStringLiteral(key, propertyName)
  })
}

function removeFirebaseCryptoShimResolvers(configObject: SwcObjectExpression) {
  const buildObject = getObjectPropertyValue(configObject, 'build')

  if (buildObject?.type === 'ObjectExpression') {
    const buildResolver = getObjectPropertyValue(buildObject as SwcObjectExpression, 'resolver')

    if (isIdentifier(buildResolver, 'firebaseBuildResolver')) {
      removeObjectProperty(buildObject as SwcObjectExpression, 'resolver')
    }
  }

  const metroObject = getObjectPropertyValue(configObject, 'metro')

  if (metroObject?.type !== 'ObjectExpression') {
    return
  }

  const metroResolver = getObjectPropertyValue(metroObject as SwcObjectExpression, 'resolver')
  if (isIdentifier(metroResolver, 'firebaseMetroResolver')) {
    removeObjectProperty(metroObject as SwcObjectExpression, 'resolver')
  }
}

export function renderGranitePresetSource(serverProvider: ServerProvider | null) {
  if (!serverProvider) {
    return `${dedent`
      import path from 'node:path'
      
      ${FRONTEND_REPO_ROOT_PREAMBLE}
    `.trimEnd()}\n`
  }

  const frontendEnvConfig = FRONTEND_PROVIDER_ENV_CONFIG[serverProvider]

  if (!frontendEnvConfig) {
    throw new Error(`지원하지 않는 frontend provider preset입니다: ${serverProvider}`)
  }

  const firebaseResolverSource =
    serverProvider === 'firebase'
      ? dedent`
          ${FIREBASE_CRYPTO_SHIM_PREAMBLE.trimEnd()}

          export const firebaseBuildResolver = { alias: cryptoModuleAliases }

          export const firebaseMetroResolver = {
            conditionNames: ['react-native', 'browser', 'require', 'default'],
            extraNodeModules: { crypto: cryptoShimPath, 'node:crypto': cryptoShimPath },
          }
        `
      : ''

  return `${dedent`
    import path from 'node:path'
    import dotenv from 'dotenv'

    ${FRONTEND_REPO_ROOT_PREAMBLE.trimEnd()}

    ${frontendEnvConfig.preamble.trimEnd()}

    export const scaffoldEnvBindings = ${frontendEnvConfig.bindingsSource}
  `.trimEnd()}${firebaseResolverSource ? `\n\n${firebaseResolverSource}` : ''}\n`
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
  syncGranitePresetImport(module, serverProvider)
  removeLegacyGraniteInlineStatements(module)
  ensureRepoRootWatchFolder(configObject)
  syncProviderPlugin(configObject, serverProvider)

  if (serverProvider === 'firebase') {
    const buildObject = ensureNestedObjectProperty(configObject, 'build')
    upsertObjectProperty(buildObject, 'resolver', '{ ...firebaseBuildResolver }')

    const metroObject = ensureNestedObjectProperty(configObject, 'metro')
    upsertObjectProperty(metroObject, 'resolver', '{ ...firebaseMetroResolver }')
  } else {
    removeFirebaseCryptoShimResolvers(configObject)
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
