import { parseSync, printSync } from '@swc/core'
import { parse } from 'jsonc-parser'
import type { ServerProvider } from './server-provider.js'
import type { TemplateTokens } from './templates.js'

type SwcModule = {
  body: SwcModuleItem[]
}

type SwcModuleItem = Record<string, unknown> & {
  type: string
}

type SwcExpression = Record<string, unknown> & {
  type: string
}

type SwcObjectExpression = SwcExpression & {
  type: 'ObjectExpression'
  properties: SwcModuleItem[]
}

type SwcArrayExpression = SwcExpression & {
  type: 'ArrayExpression'
  elements: Array<{ spread: unknown; expression: SwcExpression } | null>
}

function cloneAstNode<T>(value: T) {
  return JSON.parse(JSON.stringify(value)) as T
}

const JSONC_PARSE_OPTIONS = {
  allowTrailingComma: true,
}

function parseTypeScriptModule(source: string, tsx = false) {
  return parseSync(source, {
    syntax: 'typescript',
    tsx,
  }) as unknown as SwcModule
}

function printTypeScriptModule(module: SwcModule) {
  return `${printSync(module as unknown as Parameters<typeof printSync>[0]).code.trimEnd()}\n`
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function parseExpression(source: string, tsx = false) {
  const module = parseTypeScriptModule(`${source};`, tsx)
  const [statement] = module.body

  if (statement?.type !== 'ExpressionStatement') {
    throw new Error('표현식을 파싱하지 못했습니다.')
  }

  return statement.expression as SwcExpression
}

function parseObjectProperty(source: string) {
  const expression = parseExpression(`({ ${source} })`) as SwcExpression & {
    expression?: SwcExpression
  }
  const objectExpression =
    expression.type === 'ParenthesisExpression' ? expression.expression : expression

  if (!objectExpression || objectExpression.type !== 'ObjectExpression') {
    throw new Error('객체 속성을 파싱하지 못했습니다.')
  }

  const [property] = (objectExpression as SwcObjectExpression).properties

  if (!property) {
    throw new Error('객체 속성을 파싱하지 못했습니다.')
  }

  return property as SwcModuleItem & { value: SwcExpression }
}

function parseStatements(source: string, tsx = false) {
  return parseTypeScriptModule(source, tsx).body
}

function isIdentifier(node: unknown, value?: string): node is { value: string } {
  if (
    typeof node !== 'object' ||
    node === null ||
    (node as { type?: string }).type !== 'Identifier'
  ) {
    return false
  }

  if (value === undefined) {
    return true
  }

  return (node as { value: string }).value === value
}

function isStringLiteral(node: unknown, value?: string): node is { value: string } {
  if (
    typeof node !== 'object' ||
    node === null ||
    (node as { type?: string }).type !== 'StringLiteral'
  ) {
    return false
  }

  if (value === undefined) {
    return true
  }

  return (node as { value: string }).value === value
}

function isMemberExpression(
  node: unknown,
  objectName?: string,
  propertyName?: string,
): node is {
  object: SwcExpression
  property: unknown
} {
  if (
    typeof node !== 'object' ||
    node === null ||
    (node as { type?: string }).type !== 'MemberExpression'
  ) {
    return false
  }

  const candidate = node as {
    object: SwcExpression
    property: unknown
  }

  if (objectName && !isIdentifier(candidate.object, objectName)) {
    return false
  }

  if (propertyName && !isIdentifier(candidate.property, propertyName)) {
    return false
  }

  return true
}

function isCallExpression(node: unknown): node is {
  callee: unknown
  arguments: Array<{ spread: unknown; expression: SwcExpression } | null>
} {
  return (
    typeof node === 'object' &&
    node !== null &&
    (node as { type?: string }).type === 'CallExpression'
  )
}

function getObjectProperty(objectExpression: SwcObjectExpression, propertyName: string) {
  return objectExpression.properties.find((property) => {
    if (property.type !== 'KeyValueProperty') {
      return false
    }

    const key = property.key as unknown
    return isIdentifier(key, propertyName) || isStringLiteral(key, propertyName)
  }) as
    | (SwcModuleItem & {
        type: 'KeyValueProperty'
        value: SwcExpression
      })
    | undefined
}

function getObjectPropertyValue(objectExpression: SwcObjectExpression, propertyName: string) {
  return getObjectProperty(objectExpression, propertyName)?.value
}

function upsertObjectProperty(
  objectExpression: SwcObjectExpression,
  propertyName: string,
  expressionSource: string,
) {
  const nextProperty = parseObjectProperty(`${propertyName}: ${expressionSource}`)
  const nextExpression = nextProperty.value
  const existingProperty = getObjectProperty(objectExpression, propertyName)

  if (existingProperty) {
    existingProperty.value = nextExpression
    return
  }

  objectExpression.properties.push(parseObjectProperty(`${propertyName}: ${expressionSource}`))
}

function findLastImportIndex(module: SwcModule) {
  for (let index = module.body.length - 1; index >= 0; index -= 1) {
    if (module.body[index]?.type === 'ImportDeclaration') {
      return index
    }
  }

  return -1
}

function ensureImport(module: SwcModule, importSource: string, statementSource: string) {
  const alreadyImported = module.body.some((item) => {
    return (
      item.type === 'ImportDeclaration' &&
      (item.source as { value?: string } | undefined)?.value === importSource
    )
  })

  if (alreadyImported) {
    return
  }

  const [importDeclaration] = parseStatements(statementSource)

  if (!importDeclaration) {
    throw new Error(`import 문을 만들지 못했습니다: ${statementSource}`)
  }

  const insertIndex = findLastImportIndex(module) + 1
  module.body.splice(insertIndex, 0, importDeclaration)
}

function extractTopLevelStatementKey(statement: SwcModuleItem) {
  if (statement.type === 'VariableDeclaration') {
    const identifier = (statement.declarations as Array<{ id?: unknown }> | undefined)?.[0]?.id
    return isIdentifier(identifier) ? `var:${identifier.value}` : undefined
  }

  if (statement.type === 'FunctionDeclaration') {
    const identifier = (statement.identifier ?? undefined) as unknown
    return isIdentifier(identifier) ? `fn:${identifier.value}` : undefined
  }

  if (statement.type !== 'ExpressionStatement') {
    return undefined
  }

  const expression = statement.expression as unknown
  if (!isCallExpression(expression) || !isMemberExpression(expression.callee, 'dotenv', 'config')) {
    return undefined
  }

  const objectArgument = expression.arguments[0]?.expression
  if (!objectArgument || objectArgument.type !== 'ObjectExpression') {
    return undefined
  }

  const pathExpression = getObjectPropertyValue(objectArgument as SwcObjectExpression, 'path')
  if (
    !isCallExpression(pathExpression) ||
    !isMemberExpression(pathExpression.callee, 'path', 'join')
  ) {
    return undefined
  }

  const pathSuffix = pathExpression.arguments[1]?.expression
  if (!isStringLiteral(pathSuffix)) {
    return undefined
  }

  return `call:dotenv-config:${pathSuffix.value}`
}

function ensureTopLevelStatementBlock(module: SwcModule, blockSource: string) {
  const keys = new Set(
    module.body.map((statement) => extractTopLevelStatementKey(statement)).filter(Boolean),
  )

  const exportIndex = module.body.findIndex(
    (statement) => statement.type === 'ExportDefaultExpression',
  )
  const insertIndex = exportIndex === -1 ? module.body.length : exportIndex
  const statements = parseStatements(blockSource)
  const nextStatements = statements.filter((statement) => {
    const key = extractTopLevelStatementKey(statement)
    return key ? !keys.has(key) : true
  })

  if (nextStatements.length === 0) {
    return
  }

  module.body.splice(insertIndex, 0, ...nextStatements)
}

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

const FRONTEND_REPO_ROOT_PREAMBLE = ["const repoRoot = path.resolve(__dirname, '../..')", ''].join(
  '\n',
)

function createFrontendEnvPreamble(bindings: Array<{ envName: string; identifierName: string }>) {
  const envNameUnion = bindings.map((binding) => `'${binding.envName}'`).join(' | ')
  const envStatements = bindings.map(
    (binding) => `const ${binding.identifierName} = resolveMiniappEnv('${binding.envName}')`,
  )

  return [
    'const appRoot = __dirname',
    '',
    "dotenv.config({ path: path.join(appRoot, '.env') })",
    "dotenv.config({ path: path.join(appRoot, '.env.local'), override: true })",
    '',
    `function resolveMiniappEnv(name: ${envNameUnion}) {`,
    '  const value = process.env[name]',
    '',
    '  if (!value || value.trim().length === 0) {',
    '    throw new Error(`[frontend] ${name} is required. Set frontend/.env.local before running dev/build.`)',
    '  }',
    '',
    '  return value.trim()',
    '}',
    '',
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

function isDocumentGetElementByIdRoot(expression: SwcExpression | undefined) {
  const candidate =
    expression?.type === 'TsNonNullExpression'
      ? (expression.expression as SwcExpression | undefined)
      : expression

  if (!candidate || !isCallExpression(candidate)) {
    return false
  }

  if (!isMemberExpression(candidate.callee, 'document', 'getElementById')) {
    return false
  }

  return isStringLiteral(candidate.arguments[0]?.expression, 'root')
}

function createRootGuardStatements(renderArgument: SwcExpression) {
  const statements = parseStatements(
    [
      "const rootElement = document.getElementById('root')",
      '',
      'if (!rootElement) {',
      "  throw new Error('Root element not found')",
      '}',
      '',
      'createRoot(rootElement).render(null)',
    ].join('\n'),
    true,
  )

  const renderStatement = statements[2]
  if (!renderStatement || renderStatement.type !== 'ExpressionStatement') {
    throw new Error('root render statement를 만들지 못했습니다.')
  }

  const renderExpression = renderStatement.expression as {
    arguments: Array<{ spread: unknown; expression: SwcExpression } | null>
  }

  renderExpression.arguments[0] = {
    spread: null,
    expression: cloneAstNode(renderArgument),
  }

  return statements
}

export function patchBackofficeMainSource(source: string) {
  const module = parseTypeScriptModule(source, true)
  const statementIndex = module.body.findIndex((statement) => {
    if (statement.type !== 'ExpressionStatement') {
      return false
    }

    const expression = statement.expression as SwcExpression
    if (
      !isCallExpression(expression) ||
      !isMemberExpression(expression.callee, undefined, 'render')
    ) {
      return false
    }

    const createRootCall = expression.callee.object as SwcExpression | undefined
    if (!isCallExpression(createRootCall) || !isIdentifier(createRootCall.callee, 'createRoot')) {
      return false
    }

    return isDocumentGetElementByIdRoot(createRootCall.arguments[0]?.expression)
  })

  if (statementIndex === -1) {
    return source
  }

  const statement = module.body[statementIndex]
  if (statement?.type !== 'ExpressionStatement') {
    return source
  }

  const renderExpression = statement.expression as {
    arguments: Array<{ expression: SwcExpression } | null>
  }
  const renderArgument = renderExpression.arguments[0]?.expression

  if (!renderArgument) {
    return source
  }

  module.body.splice(statementIndex, 1, ...createRootGuardStatements(renderArgument))
  return printTypeScriptModule(module)
}

function hasCounterClassName(openingElement: { attributes: unknown[] }) {
  return openingElement.attributes.some((attribute) => {
    if (
      typeof attribute !== 'object' ||
      attribute === null ||
      (attribute as { type?: string }).type !== 'JSXAttribute'
    ) {
      return false
    }

    const candidate = attribute as {
      name: unknown
      value: unknown
    }

    return isIdentifier(candidate.name, 'className') && isStringLiteral(candidate.value, 'counter')
  })
}

function createButtonTypeAttribute() {
  const jsxElement = parseExpression(`<button type="button" />`, true) as {
    opening: {
      attributes: unknown[]
    }
  } & SwcExpression
  const [attribute] = jsxElement.opening.attributes

  if (!attribute) {
    throw new Error('button type 속성을 만들지 못했습니다.')
  }

  return attribute
}

function patchCounterButtonAttributes(node: unknown): boolean {
  if (typeof node !== 'object' || node === null) {
    return false
  }

  if ((node as { type?: string }).type === 'JSXOpeningElement') {
    const openingElement = node as {
      name: unknown
      attributes: unknown[]
    }

    if (isIdentifier(openingElement.name, 'button') && hasCounterClassName(openingElement)) {
      const existingTypeAttribute = openingElement.attributes.find((attribute) => {
        if (
          typeof attribute !== 'object' ||
          attribute === null ||
          (attribute as { type?: string }).type !== 'JSXAttribute'
        ) {
          return false
        }

        return isIdentifier((attribute as { name: unknown }).name, 'type')
      }) as { value?: unknown } | undefined

      if (existingTypeAttribute) {
        existingTypeAttribute.value = cloneAstNode(parseExpression(`"button"`))
      } else {
        openingElement.attributes.push(createButtonTypeAttribute())
      }

      return true
    }
  }

  for (const value of Object.values(node)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        if (patchCounterButtonAttributes(item)) {
          return true
        }
      }
      continue
    }

    if (patchCounterButtonAttributes(value)) {
      return true
    }
  }

  return false
}

export function patchBackofficeAppSource(source: string) {
  const module = parseTypeScriptModule(source, true)
  patchCounterButtonAttributes(module)
  return printTypeScriptModule(module)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function patchTsconfigModuleSource(
  source: string,
  options?: {
    includeNodeTypes?: boolean
  },
) {
  const parsed = parse(source, [], JSONC_PARSE_OPTIONS)

  if (!isRecord(parsed)) {
    return source
  }

  const next = { ...parsed }
  const compilerOptions = isRecord(next.compilerOptions) ? { ...next.compilerOptions } : {}

  compilerOptions.module = 'esnext'

  if (options?.includeNodeTypes) {
    const existingTypes = Array.isArray(compilerOptions.types)
      ? compilerOptions.types.filter((value): value is string => typeof value === 'string')
      : []

    if (!existingTypes.includes('node')) {
      existingTypes.push('node')
    }

    compilerOptions.types = existingTypes
  }

  next.compilerOptions = compilerOptions

  return `${JSON.stringify(next, null, 2)}\n`
}

export function patchWranglerConfigSource(
  source: string,
  patch: {
    schemaUrl?: string
    name?: string
  },
) {
  const parsed = parse(source, [], JSONC_PARSE_OPTIONS)

  if (!isRecord(parsed)) {
    return source
  }

  const next = { ...parsed }

  if (patch.schemaUrl) {
    next.$schema = patch.schemaUrl
  }

  if (patch.name) {
    next.name = patch.name
  }

  return `${JSON.stringify(next, null, 2)}\n`
}

type OrderedJsonEntry = {
  key: string
  value: unknown
}

type PackageJsonSectionName = 'scripts' | 'dependencies' | 'devDependencies'

function parseOrderedJsonObjectEntries(source: string) {
  const parsed = parse(source, [], JSONC_PARSE_OPTIONS)

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('루트 package.json을 JSON 객체로 파싱하지 못했습니다.')
  }

  return Object.entries(parsed).map(([key, value]) => ({ key, value }))
}

function upsertOrderedJsonEntry(
  entries: OrderedJsonEntry[],
  key: string,
  value: unknown,
  options?: {
    afterKey?: string
  },
) {
  const existingIndex = entries.findIndex((entry) => entry.key === key)
  const nextEntry = { key, value }

  if (existingIndex !== -1) {
    entries.splice(existingIndex, 1)
  }

  if (options?.afterKey) {
    const anchorIndex = entries.findIndex((entry) => entry.key === options.afterKey)

    if (anchorIndex !== -1) {
      entries.splice(anchorIndex + 1, 0, nextEntry)
      return
    }
  }

  if (existingIndex !== -1 && existingIndex <= entries.length) {
    entries.splice(existingIndex, 0, nextEntry)
    return
  }

  entries.push(nextEntry)
}

function removeOrderedJsonEntry(entries: OrderedJsonEntry[], key: string) {
  const existingIndex = entries.findIndex((entry) => entry.key === key)

  if (existingIndex !== -1) {
    entries.splice(existingIndex, 1)
  }
}

function stringifyOrderedJsonEntries(entries: OrderedJsonEntry[]) {
  const object: Record<string, unknown> = {}

  for (const entry of entries) {
    object[entry.key] = entry.value
  }

  return `${JSON.stringify(object, null, 2)}\n`
}

function readStringMapSection(entries: OrderedJsonEntry[], key: PackageJsonSectionName) {
  const value = entries.find((entry) => entry.key === key)?.value

  if (!isRecord(value)) {
    return {}
  }

  return Object.fromEntries(
    Object.entries(value).filter(([, candidate]) => typeof candidate === 'string'),
  ) as Record<string, string>
}

export function patchPackageJsonSource(
  source: string,
  patch: {
    upsertTopLevel?: Array<{
      key: string
      value: unknown
      afterKey?: string
    }>
    removeTopLevel?: string[]
    upsertSections?: Partial<Record<PackageJsonSectionName, Record<string, string>>>
    removeFromSections?: Partial<Record<PackageJsonSectionName, string[]>>
  },
) {
  const entries = parseOrderedJsonObjectEntries(source)

  for (const key of patch.removeTopLevel ?? []) {
    removeOrderedJsonEntry(entries, key)
  }

  for (const sectionName of ['scripts', 'dependencies', 'devDependencies'] as const) {
    const existingSection = readStringMapSection(entries, sectionName)
    const nextSection = { ...existingSection }

    for (const key of patch.removeFromSections?.[sectionName] ?? []) {
      delete nextSection[key]
    }

    Object.assign(nextSection, patch.upsertSections?.[sectionName] ?? {})

    const hadSection = entries.some((entry) => entry.key === sectionName)
    if (hadSection || Object.keys(nextSection).length > 0) {
      upsertOrderedJsonEntry(entries, sectionName, nextSection)
    }
  }

  for (const entry of patch.upsertTopLevel ?? []) {
    upsertOrderedJsonEntry(entries, entry.key, entry.value, {
      afterKey: entry.afterKey,
    })
  }

  return stringifyOrderedJsonEntries(entries)
}

export function patchRootPackageJsonSource(
  source: string,
  patch: {
    packageManagerField: string
    scripts: Record<string, string>
    workspaces: string[] | null
  },
) {
  return patchPackageJsonSource(source, {
    upsertTopLevel: [
      {
        key: 'packageManager',
        value: patch.packageManagerField,
      },
      ...(patch.workspaces
        ? [
            {
              key: 'workspaces',
              value: patch.workspaces,
              afterKey: 'packageManager',
            },
          ]
        : []),
    ],
    removeTopLevel: patch.workspaces ? [] : ['workspaces'],
    upsertSections: {
      scripts: patch.scripts,
    },
  })
}
