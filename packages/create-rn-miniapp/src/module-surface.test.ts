import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import ts from 'typescript'
import { fileURLToPath } from 'node:url'

const SRC_ROOT = fileURLToPath(new URL('../src/', import.meta.url))
const FORBIDDEN_RUNTIME_MODULES = ['templates/runtime.ts', 'patching/runtime.ts'] as const

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

    assert.doesNotMatch(
      source,
      /^\s*export\s+(?:type\s+)?(?:\{[\s\S]*?\}|\*)\s+from\s+['"][^'"]+['"]/m,
      `re-export found in ${path.relative(SRC_ROOT, filePath)}`,
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
