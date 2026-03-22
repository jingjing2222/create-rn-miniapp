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

function hasRootObject(source: string) {
  return parseTree(source, [], JSONC_PARSE_OPTIONS)?.type === 'object'
}

function readJsoncValue(source: string, path: JSONPath) {
  const root = parseTree(source, [], JSONC_PARSE_OPTIONS)

  if (!root || root.type !== 'object') {
    return undefined
  }

  const node = findNodeAtLocation(root, path)
  return node ? getNodeValue(node) : undefined
}

function applyJsoncModification(
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

function upsertBindingEntry(entries: unknown, binding: string, value: Record<string, unknown>) {
  const normalizedEntries = Array.isArray(entries)
    ? entries.filter((entry): entry is Record<string, unknown> => isRecord(entry))
    : []
  const nextEntries = [...normalizedEntries]
  const existingIndex = nextEntries.findIndex((entry) => entry.binding === binding)

  if (existingIndex >= 0) {
    nextEntries[existingIndex] = {
      ...nextEntries[existingIndex],
      ...value,
    }
    return nextEntries
  }

  nextEntries.push(value)
  return nextEntries
}

export function patchTsconfigModuleSource(
  source: string,
  options?: {
    includeNodeTypes?: boolean
    allowImportingTsExtensions?: boolean
  },
) {
  if (!hasRootObject(source)) {
    return source
  }

  let next = applyJsoncModification(source, ['compilerOptions', 'module'], 'esnext')

  if (options?.includeNodeTypes) {
    const existingTypes = Array.isArray(readJsoncValue(next, ['compilerOptions', 'types']))
      ? (readJsoncValue(next, ['compilerOptions', 'types']) as unknown[]).filter(
          (value): value is string => typeof value === 'string',
        )
      : []

    if (!existingTypes.includes('node')) {
      existingTypes.push('node')
    }

    next = applyJsoncModification(next, ['compilerOptions', 'types'], existingTypes)
  }

  if (options?.allowImportingTsExtensions) {
    next = applyJsoncModification(next, ['compilerOptions', 'allowImportingTsExtensions'], true)
    next = applyJsoncModification(next, ['compilerOptions', 'moduleResolution'], 'bundler')
    next = applyJsoncModification(next, ['compilerOptions', 'noEmit'], true)
  }

  return next
}

export function createCloudflareVitestWranglerConfigSource(source: string) {
  if (!hasRootObject(source)) {
    return source
  }

  let next = source

  if (Array.isArray(readJsoncValue(next, ['d1_databases']))) {
    const d1Databases = (readJsoncValue(next, ['d1_databases']) as unknown[])
      .filter((entry): entry is Record<string, unknown> => isRecord(entry))
      .map((entry) => ({
        ...entry,
        remote: false,
      }))

    next = applyJsoncModification(next, ['d1_databases'], d1Databases)
  }

  if (Array.isArray(readJsoncValue(next, ['r2_buckets']))) {
    const r2Buckets = (readJsoncValue(next, ['r2_buckets']) as unknown[])
      .filter((entry): entry is Record<string, unknown> => isRecord(entry))
      .map((entry) => ({
        ...entry,
        remote: false,
      }))

    next = applyJsoncModification(next, ['r2_buckets'], r2Buckets)
  }

  return next
}

export function patchWranglerConfigSource(
  source: string,
  patch: {
    schemaUrl?: string
    name?: string
    accountId?: string
    d1Database?: {
      binding: string
      databaseId: string
      databaseName: string
      remote?: boolean
    }
    r2Bucket?: {
      binding: string
      bucketName: string
      remote?: boolean
    }
  },
) {
  if (!hasRootObject(source)) {
    return source
  }

  let next = source

  if (patch.schemaUrl) {
    next = applyJsoncModification(next, ['$schema'], patch.schemaUrl)
  }

  if (patch.name) {
    next = applyJsoncModification(next, ['name'], patch.name)
  }

  if (patch.accountId) {
    next = applyJsoncModification(next, ['account_id'], patch.accountId)
  }

  if (patch.d1Database) {
    const nextD1Databases = upsertBindingEntry(
      readJsoncValue(next, ['d1_databases']),
      patch.d1Database.binding,
      {
        binding: patch.d1Database.binding,
        database_id: patch.d1Database.databaseId,
        database_name: patch.d1Database.databaseName,
        ...(patch.d1Database.remote !== undefined ? { remote: patch.d1Database.remote } : {}),
      },
    )

    next = applyJsoncModification(next, ['d1_databases'], nextD1Databases)
  }

  if (patch.r2Bucket) {
    const nextR2Buckets = upsertBindingEntry(
      readJsoncValue(next, ['r2_buckets']),
      patch.r2Bucket.binding,
      {
        binding: patch.r2Bucket.binding,
        bucket_name: patch.r2Bucket.bucketName,
        ...(patch.r2Bucket.remote !== undefined ? { remote: patch.r2Bucket.remote } : {}),
      },
    )

    next = applyJsoncModification(next, ['r2_buckets'], nextR2Buckets)
  }

  return next
}
