import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import ts from 'typescript'
import { fileURLToPath } from 'node:url'

const SRC_ROOT = fileURLToPath(new URL('../src/', import.meta.url))
const FORBIDDEN_RUNTIME_MODULES = ['templates/runtime.ts', 'patching/runtime.ts'] as const
const FORBIDDEN_INTERNAL_BARRELS = new Set(['templates/index.ts', 'patching/index.ts'])
const DEDENT_REGRESSION_PATTERNS = [
  {
    relativePath: 'patching/server.ts',
    description: 'renderServerScaffoldStateSection manual line-array assembly',
    pattern: /function renderServerScaffoldStateSection\(\)\s*{\s*return \[/,
  },
  {
    relativePath: 'patching/ast/granite.ts',
    description: 'renderGranitePresetSource manual parts assembly',
    pattern: /const parts = \[/,
  },
  {
    relativePath: 'templates/server.ts',
    description: 'renderFirebaseFunctionsGitignore manual line-array assembly',
    pattern:
      /function renderFirebaseFunctionsGitignore\(packageManager: string\)\s*{\s*const lines = \['lib\/', 'node_modules\/'\]/,
  },
  {
    relativePath: 'providers/cloudflare/provision.ts',
    description: 'formatCloudflareManualSetupNote manual line-array assembly',
    pattern: /export function formatCloudflareManualSetupNote[\s\S]*?const lines = \[/,
  },
  {
    relativePath: 'providers/supabase/provision.ts',
    description: 'formatSupabaseManualSetupNote manual line-array assembly',
    pattern: /export function formatSupabaseManualSetupNote[\s\S]*?const lines = \[/,
  },
  {
    relativePath: 'providers/firebase/provision.ts',
    description: 'firebase fallback message inline newline assembly',
    pattern: /return `\$\{options\.rawMessage\}\\n상세 로그: \$\{debugLogPath\}`/,
  },
  {
    relativePath: 'providers/firebase/provision.ts',
    description: 'formatFirebaseManualSetupNote manual line-array assembly',
    pattern: /export function formatFirebaseManualSetupNote[\s\S]*?const lines = \[/,
  },
] as const

async function listSourceFiles(currentDir: string): Promise<string[]> {
  const { readdir } = await import('node:fs/promises')
  const entries = await readdir(currentDir, { withFileTypes: true })
  const files: string[] = []

  for (const entry of entries) {
    const nextPath = path.join(currentDir, entry.name)

    if (entry.isDirectory()) {
      files.push(...(await listSourceFiles(nextPath)))
      continue
    }

    if (entry.name.endsWith('.ts') || entry.name.endsWith('.mts')) {
      files.push(nextPath)
    }
  }

  return files
}

function collectRelativeImportBindings(sourceFile: ts.SourceFile) {
  const importedBindings = new Set<string>()

  for (const statement of sourceFile.statements) {
    if (
      !ts.isImportDeclaration(statement) ||
      !ts.isStringLiteral(statement.moduleSpecifier) ||
      !statement.moduleSpecifier.text.startsWith('.')
    ) {
      continue
    }

    const importClause = statement.importClause

    if (!importClause) {
      continue
    }

    if (importClause.name) {
      importedBindings.add(importClause.name.text)
    }

    const namedBindings = importClause.namedBindings

    if (!namedBindings) {
      continue
    }

    if (ts.isNamespaceImport(namedBindings)) {
      importedBindings.add(namedBindings.name.text)
      continue
    }

    for (const element of namedBindings.elements) {
      importedBindings.add(element.name.text)
    }
  }

  return importedBindings
}

function collectRelativeModuleSpecifiers(sourceFile: ts.SourceFile) {
  const moduleSpecifiers: string[] = []

  for (const statement of sourceFile.statements) {
    if (
      (ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)) &&
      statement.moduleSpecifier &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      statement.moduleSpecifier.text.startsWith('.')
    ) {
      moduleSpecifiers.push(statement.moduleSpecifier.text)
    }
  }

  return moduleSpecifiers
}

function collectReExportSites(sourceFile: ts.SourceFile) {
  const sites: string[] = []

  for (const statement of sourceFile.statements) {
    if (!ts.isExportDeclaration(statement) || !statement.moduleSpecifier) {
      continue
    }

    const { line, character } = sourceFile.getLineAndCharacterOfPosition(statement.getStart())
    sites.push(`${line + 1}:${character + 1}`)
  }

  return sites
}

function isNewlineJoinCall(node: ts.Node): node is ts.CallExpression & {
  expression: ts.PropertyAccessExpression & { expression: ts.ArrayLiteralExpression }
} {
  return (
    ts.isCallExpression(node) &&
    ts.isPropertyAccessExpression(node.expression) &&
    node.expression.name.text === 'join' &&
    node.arguments.length === 1 &&
    ts.isStringLiteral(node.arguments[0]) &&
    node.arguments[0].text === '\n' &&
    ts.isArrayLiteralExpression(node.expression.expression)
  )
}

function isPureStaticMultilineArray(arrayLiteral: ts.ArrayLiteralExpression) {
  return arrayLiteral.elements.every((element) => {
    return (
      ts.isStringLiteral(element) ||
      ts.isNoSubstitutionTemplateLiteral(element) ||
      ts.isTemplateExpression(element)
    )
  })
}

function collectStaticMultilineArrayJoinSites(sourceFile: ts.SourceFile) {
  const sites: string[] = []

  function visit(node: ts.Node) {
    if (!isNewlineJoinCall(node)) {
      ts.forEachChild(node, visit)
      return
    }

    const arrayLiteral = node.expression.expression

    if (isPureStaticMultilineArray(arrayLiteral)) {
      const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart())
      sites.push(`${line + 1}:${character + 1}`)
    }

    ts.forEachChild(node, visit)
  }

  visit(sourceFile)

  return sites
}

function collectForwardedRelativeBindings(sourceFile: ts.SourceFile) {
  const importedBindings = collectRelativeImportBindings(sourceFile)
  const forwardedBindings: string[] = []

  for (const statement of sourceFile.statements) {
    if (ts.isExportDeclaration(statement)) {
      if (!statement.exportClause || !ts.isNamedExports(statement.exportClause)) {
        continue
      }

      for (const element of statement.exportClause.elements) {
        const localName = element.propertyName?.text ?? element.name.text

        if (importedBindings.has(localName)) {
          forwardedBindings.push(element.name.text)
        }
      }

      continue
    }

    if (!isExported(statement)) {
      continue
    }

    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (
          ts.isIdentifier(declaration.name) &&
          declaration.initializer &&
          ts.isIdentifier(declaration.initializer) &&
          importedBindings.has(declaration.initializer.text)
        ) {
          forwardedBindings.push(declaration.name.text)
        }
      }

      continue
    }

    if (
      ts.isTypeAliasDeclaration(statement) &&
      ts.isTypeReferenceNode(statement.type) &&
      ts.isIdentifier(statement.type.typeName) &&
      importedBindings.has(statement.type.typeName.text)
    ) {
      forwardedBindings.push(statement.name.text)
    }
  }

  return forwardedBindings
}

function isExported(statement: ts.Statement) {
  return (
    ts.canHaveModifiers(statement) &&
    ts.getModifiers(statement)?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)
  )
}

function isPureForwardingModule(source: string) {
  const sourceFile = ts.createSourceFile('module.ts', source, ts.ScriptTarget.Latest, true)
  const importedBindings = collectRelativeImportBindings(sourceFile)
  let sawRelativeImport = importedBindings.size > 0
  let sawForwardingExport = false
  let sawLocalImplementation = false

  for (const statement of sourceFile.statements) {
    if (ts.isImportDeclaration(statement)) {
      if (
        ts.isStringLiteral(statement.moduleSpecifier) &&
        statement.moduleSpecifier.text.startsWith('.')
      ) {
        sawRelativeImport = true
      }

      continue
    }

    if (ts.isExportDeclaration(statement)) {
      sawForwardingExport = true
      continue
    }

    if (!isExported(statement)) {
      sawLocalImplementation = true
      continue
    }

    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (
          declaration.initializer &&
          ts.isIdentifier(declaration.initializer) &&
          importedBindings.has(declaration.initializer.text)
        ) {
          sawForwardingExport = true
          continue
        }

        sawLocalImplementation = true
      }

      continue
    }

    if (ts.isTypeAliasDeclaration(statement)) {
      if (
        ts.isTypeReferenceNode(statement.type) &&
        ts.isIdentifier(statement.type.typeName) &&
        importedBindings.has(statement.type.typeName.text)
      ) {
        sawForwardingExport = true
        continue
      }

      sawLocalImplementation = true
      continue
    }

    sawLocalImplementation = true
  }

  return sawRelativeImport && sawForwardingExport && !sawLocalImplementation
}

test('non-index source modules do not use re-export syntax', async () => {
  const sourceFiles = await listSourceFiles(SRC_ROOT)
  const nonIndexFiles = sourceFiles.filter((filePath) => path.basename(filePath) !== 'index.ts')

  for (const filePath of nonIndexFiles) {
    const source = await readFile(filePath, 'utf8')
    const sourceFile = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true)
    const reExportSites = collectReExportSites(sourceFile)

    assert.deepEqual(
      reExportSites,
      [],
      `re-export found in ${path.relative(SRC_ROOT, filePath)}: ${reExportSites.join(', ')}`,
    )
  }
})

test('non-index source modules are not pure forwarding facades', async () => {
  const sourceFiles = await listSourceFiles(SRC_ROOT)
  const nonIndexFiles = sourceFiles.filter((filePath) => path.basename(filePath) !== 'index.ts')

  for (const filePath of nonIndexFiles) {
    const source = await readFile(filePath, 'utf8')

    assert.equal(
      isPureForwardingModule(source),
      false,
      `forwarding facade found in ${path.relative(SRC_ROOT, filePath)}`,
    )
  }
})

test('non-index source modules do not alias imported bindings into exports', async () => {
  const sourceFiles = await listSourceFiles(SRC_ROOT)
  const nonIndexFiles = sourceFiles.filter((filePath) => path.basename(filePath) !== 'index.ts')

  for (const filePath of nonIndexFiles) {
    const source = await readFile(filePath, 'utf8')
    const sourceFile = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true)
    const forwardedBindings = collectForwardedRelativeBindings(sourceFile)

    assert.deepEqual(
      forwardedBindings,
      [],
      `alias forwarding export found in ${path.relative(SRC_ROOT, filePath)}: ${forwardedBindings.join(', ')}`,
    )
  }
})

test('source tree does not keep runtime monolith modules', async () => {
  const sourceFiles = await listSourceFiles(SRC_ROOT)
  const relativePaths = new Set(sourceFiles.map((filePath) => path.relative(SRC_ROOT, filePath)))

  for (const relativePath of FORBIDDEN_RUNTIME_MODULES) {
    assert.equal(
      relativePaths.has(relativePath),
      false,
      `runtime monolith found in ${relativePath}`,
    )
  }
})

test('non-test implementation modules do not import templates or patching barrels', async () => {
  const sourceFiles = await listSourceFiles(SRC_ROOT)
  const productionFiles = sourceFiles.filter((filePath) => !filePath.endsWith('.test.ts'))

  for (const filePath of productionFiles) {
    if (path.basename(filePath) === 'index.ts') {
      continue
    }

    const source = await readFile(filePath, 'utf8')
    const sourceFile = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true)

    for (const moduleSpecifier of collectRelativeModuleSpecifiers(sourceFile)) {
      const resolvedImportPath = path.resolve(path.dirname(filePath), moduleSpecifier)
      const resolvedRelativePath = path
        .relative(SRC_ROOT, resolvedImportPath)
        .replace(/\.m?js$/, '.ts')

      assert.equal(
        FORBIDDEN_INTERNAL_BARRELS.has(resolvedRelativePath),
        false,
        `internal barrel import found in ${path.relative(SRC_ROOT, filePath)} -> ${moduleSpecifier}`,
      )
    }
  }
})

test('non-test implementation modules do not build authored multiline strings with static array join', async () => {
  const sourceFiles = await listSourceFiles(SRC_ROOT)
  const productionFiles = sourceFiles.filter((filePath) => !filePath.endsWith('.test.ts'))

  for (const filePath of productionFiles) {
    const source = await readFile(filePath, 'utf8')
    const sourceFile = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true)
    const staticJoinSites = collectStaticMultilineArrayJoinSites(sourceFile)

    assert.deepEqual(
      staticJoinSites,
      [],
      `static multiline array join found in ${path.relative(SRC_ROOT, filePath)}: ${staticJoinSites.join(', ')}`,
    )
  }
})

test('runtime authored multiline helpers do not regress to manual string assembly', async () => {
  for (const rule of DEDENT_REGRESSION_PATTERNS) {
    const filePath = path.join(SRC_ROOT, rule.relativePath)
    const source = await readFile(filePath, 'utf8')

    assert.equal(
      rule.pattern.test(source),
      false,
      `manual multiline assembly found in ${rule.relativePath}: ${rule.description}`,
    )
  }
})

test('firebase provisioning does not import shared CLI JSON parsing from the supabase provider module', async () => {
  const firebaseProvisionSource = await readFile(
    path.join(SRC_ROOT, 'providers', 'firebase', 'provision.ts'),
    'utf8',
  )

  assert.doesNotMatch(
    firebaseProvisionSource,
    /from '\.\.\/\.\.\/providers\/supabase\/provision\.js'/,
  )
})

test('provider registry does not rebuild supabase bootstrap CLI specs inline', async () => {
  const providersIndexSource = await readFile(path.join(SRC_ROOT, 'providers', 'index.ts'), 'utf8')

  assert.doesNotMatch(providersIndexSource, /SUPABASE_CLI/)
  assert.doesNotMatch(providersIndexSource, /function buildSupabasePlan/)
})

test('docs renderer does not special-case code-owned docs by relative path', async () => {
  const docsSource = await readFile(path.join(SRC_ROOT, 'templates', 'docs.ts'), 'utf8')

  assert.doesNotMatch(docsSource, /definition\.relativePath === 'AGENTS\.md'/)
  assert.doesNotMatch(docsSource, /definition\.relativePath === 'README\.md'/)
  assert.doesNotMatch(
    docsSource,
    /definition\.relativePath === 'docs\/engineering\/frontend-policy\.md'/,
  )
})
