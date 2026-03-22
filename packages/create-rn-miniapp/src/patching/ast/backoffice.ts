import {
  type SwcExpression,
  cloneAstNode,
  isCallExpression,
  isIdentifier,
  isMemberExpression,
  isStringLiteral,
  parseExpression,
  parseStatements,
  parseTypeScriptModule,
  printTypeScriptModule,
} from './shared.js'
import dedent from '../../dedent.js'

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
    dedent`
  const rootElement = document.getElementById('root')

  if (!rootElement) {
    throw new Error('Root element not found')
  }

  createRoot(rootElement).render(null)
`,
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
