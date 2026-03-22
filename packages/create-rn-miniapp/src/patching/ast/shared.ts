import { parseSync, printSync } from '@swc/core'

export type SwcModule = {
  body: SwcModuleItem[]
}

export type SwcModuleItem = Record<string, unknown> & {
  type: string
}

export type SwcExpression = Record<string, unknown> & {
  type: string
}

export type SwcObjectExpression = SwcExpression & {
  type: 'ObjectExpression'
  properties: SwcModuleItem[]
}

export type SwcArrayExpression = SwcExpression & {
  type: 'ArrayExpression'
  elements: Array<{ spread: unknown; expression: SwcExpression } | null>
}

export function cloneAstNode<T>(value: T) {
  return structuredClone(value)
}

export function parseTypeScriptModule(source: string, tsx = false) {
  return parseSync(source, {
    syntax: 'typescript',
    tsx,
  }) as unknown as SwcModule
}

export function printTypeScriptModule(module: SwcModule) {
  return `${printSync(module as unknown as Parameters<typeof printSync>[0]).code.trimEnd()}\n`
}

export function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function parseExpression(source: string, tsx = false) {
  const module = parseTypeScriptModule(`${source};`, tsx)
  const [statement] = module.body

  if (statement?.type !== 'ExpressionStatement') {
    throw new Error('표현식을 파싱하지 못했습니다.')
  }

  return statement.expression as SwcExpression
}

export function parseObjectProperty(source: string) {
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

export function parseStatements(source: string, tsx = false) {
  return parseTypeScriptModule(source, tsx).body
}

export function isIdentifier(node: unknown, value?: string): node is { value: string } {
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

export function isStringLiteral(node: unknown, value?: string): node is { value: string } {
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

export function isMemberExpression(
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

export function isCallExpression(node: unknown): node is {
  callee: unknown
  arguments: Array<{ spread: unknown; expression: SwcExpression } | null>
} {
  return (
    typeof node === 'object' &&
    node !== null &&
    (node as { type?: string }).type === 'CallExpression'
  )
}

export function getObjectProperty(objectExpression: SwcObjectExpression, propertyName: string) {
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

export function getObjectPropertyValue(
  objectExpression: SwcObjectExpression,
  propertyName: string,
) {
  return getObjectProperty(objectExpression, propertyName)?.value
}

export function upsertObjectProperty(
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

export function ensureImport(module: SwcModule, importSource: string, statementSource: string) {
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

export function extractTopLevelStatementKey(statement: SwcModuleItem) {
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

export function ensureTopLevelStatementBlock(module: SwcModule, blockSource: string) {
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
