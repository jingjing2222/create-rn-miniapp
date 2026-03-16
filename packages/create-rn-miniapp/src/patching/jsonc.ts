import { parse } from 'jsonc-parser'

const JSONC_PARSE_OPTIONS = {
  allowTrailingComma: true,
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
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

  if (options?.allowImportingTsExtensions) {
    compilerOptions.allowImportingTsExtensions = true
    compilerOptions.moduleResolution = 'bundler'
    compilerOptions.noEmit = true
  }

  next.compilerOptions = compilerOptions

  return `${JSON.stringify(next, null, 2)}\n`
}

export function createCloudflareVitestWranglerConfigSource(source: string) {
  const parsed = parse(source, [], JSONC_PARSE_OPTIONS)

  if (!isRecord(parsed)) {
    return source
  }

  const next = { ...parsed }

  if (Array.isArray(next.d1_databases)) {
    next.d1_databases = next.d1_databases
      .filter((entry): entry is Record<string, unknown> => isRecord(entry))
      .map((entry) => ({
        ...entry,
        remote: false,
      }))
  }

  if (Array.isArray(next.r2_buckets)) {
    next.r2_buckets = next.r2_buckets
      .filter((entry): entry is Record<string, unknown> => isRecord(entry))
      .map((entry) => ({
        ...entry,
        remote: false,
      }))
  }

  return `${JSON.stringify(next, null, 2)}\n`
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

  if (patch.accountId) {
    next.account_id = patch.accountId
  }

  if (patch.d1Database) {
    next.d1_databases = upsertBindingEntry(next.d1_databases, patch.d1Database.binding, {
      binding: patch.d1Database.binding,
      database_id: patch.d1Database.databaseId,
      database_name: patch.d1Database.databaseName,
      ...(patch.d1Database.remote !== undefined ? { remote: patch.d1Database.remote } : {}),
    })
  }

  if (patch.r2Bucket) {
    next.r2_buckets = upsertBindingEntry(next.r2_buckets, patch.r2Bucket.binding, {
      binding: patch.r2Bucket.binding,
      bucket_name: patch.r2Bucket.bucketName,
      ...(patch.r2Bucket.remote !== undefined ? { remote: patch.r2Bucket.remote } : {}),
    })
  }

  return `${JSON.stringify(next, null, 2)}\n`
}
