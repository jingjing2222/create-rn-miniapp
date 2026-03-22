import {
  applyEdits,
  findNodeAtLocation,
  getNodeValue,
  modify,
  parseTree,
  type JSONPath,
  type ModificationOptions,
} from 'jsonc-parser'

const JSONC_PARSE_OPTIONS = {
  allowTrailingComma: true,
}

const JSONC_FORMATTING_OPTIONS = {
  insertSpaces: true,
  tabSize: 2,
  eol: '\n',
  insertFinalNewline: true,
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

type PackageJsonSectionName = 'scripts' | 'dependencies' | 'devDependencies'

function assertRootObject(source: string) {
  const root = parseTree(source, [], JSONC_PARSE_OPTIONS)

  if (!root || root.type !== 'object') {
    throw new Error('루트 package.json을 JSON 객체로 파싱하지 못했습니다.')
  }

  return root
}

function readObjectValue(source: string, path: JSONPath) {
  const node = findNodeAtLocation(assertRootObject(source), path)
  return node ? getNodeValue(node) : undefined
}

function hasObjectProperty(source: string, key: string) {
  const root = assertRootObject(source)
  return root.children?.some((child) => child.children?.[0]?.value === key) ?? false
}

function applyPackageJsonEdit(
  source: string,
  path: JSONPath,
  value: unknown,
  options?: Omit<ModificationOptions, 'formattingOptions'>,
) {
  return applyEdits(
    source,
    modify(source, path, value, {
      formattingOptions: JSONC_FORMATTING_OPTIONS,
      ...options,
    }),
  )
}

function readStringMapSection(source: string, key: PackageJsonSectionName) {
  const value = readObjectValue(source, [key])

  if (!isRecord(value)) {
    return {}
  }

  return Object.fromEntries(
    Object.entries(value).filter(([, candidate]) => typeof candidate === 'string'),
  ) as Record<string, string>
}

function createInsertionIndexResolver(options?: { afterKey?: string; beforeKeys?: string[] }) {
  return (properties: string[]) => {
    if (options?.afterKey) {
      const afterIndex = properties.indexOf(options.afterKey)

      if (afterIndex !== -1) {
        return afterIndex + 1
      }
    }

    for (const beforeKey of options?.beforeKeys ?? []) {
      const beforeIndex = properties.indexOf(beforeKey)

      if (beforeIndex !== -1) {
        return beforeIndex
      }
    }

    return properties.length
  }
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
  let nextSource = source

  assertRootObject(nextSource)

  for (const key of patch.removeTopLevel ?? []) {
    nextSource = applyPackageJsonEdit(nextSource, [key], undefined)
  }

  for (const sectionName of ['scripts', 'dependencies', 'devDependencies'] as const) {
    const removeKeys = patch.removeFromSections?.[sectionName] ?? []
    const upsertEntries = Object.entries(patch.upsertSections?.[sectionName] ?? {})
    const existingSection = readStringMapSection(nextSource, sectionName)
    const nextSection = { ...existingSection }

    for (const key of removeKeys) {
      delete nextSection[key]
    }

    Object.assign(nextSection, Object.fromEntries(upsertEntries))

    const hadSection = hasObjectProperty(nextSource, sectionName)
    if (!hadSection && Object.keys(nextSection).length === 0) {
      continue
    }

    if (!hadSection && Object.keys(nextSection).length > 0) {
      nextSource = applyPackageJsonEdit(nextSource, [sectionName], {})
    }

    for (const key of removeKeys) {
      nextSource = applyPackageJsonEdit(nextSource, [sectionName, key], undefined)
    }

    for (const [key, value] of upsertEntries) {
      nextSource = applyPackageJsonEdit(nextSource, [sectionName, key], value)
    }

    if (hadSection && Object.keys(nextSection).length === 0) {
      nextSource = applyPackageJsonEdit(nextSource, [sectionName], {})
    }
  }

  for (const entry of patch.upsertTopLevel ?? []) {
    nextSource = applyPackageJsonEdit(nextSource, [entry.key], entry.value, {
      getInsertionIndex: createInsertionIndexResolver({
        afterKey: entry.afterKey,
      }),
    })
  }

  return nextSource
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
        afterKey: 'private',
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
