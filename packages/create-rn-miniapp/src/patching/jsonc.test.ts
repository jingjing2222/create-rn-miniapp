import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createCloudflareVitestWranglerConfigSource,
  patchTsconfigModuleSource,
  patchWranglerConfigSource,
} from './jsonc.js'

test('patchTsconfigModuleSource can enable allowImportingTsExtensions for source-export packages', () => {
  const source = ['{', '  "compilerOptions": {', '    "module": "commonjs"', '  }', '}', ''].join(
    '\n',
  )

  const next = patchTsconfigModuleSource(source, {
    allowImportingTsExtensions: true,
  })

  const parsed = JSON.parse(next) as {
    compilerOptions?: {
      module?: string
      allowImportingTsExtensions?: boolean
      moduleResolution?: string
      noEmit?: boolean
    }
  }

  assert.equal(parsed.compilerOptions?.module, 'esnext')
  assert.equal(parsed.compilerOptions?.allowImportingTsExtensions, true)
  assert.equal(parsed.compilerOptions?.moduleResolution, 'bundler')
  assert.equal(parsed.compilerOptions?.noEmit, true)
})

test('patchTsconfigModuleSource preserves JSONC comments while updating compilerOptions', () => {
  const source = [
    '{',
    '  // keep this comment',
    '  "compilerOptions": {',
    '    // existing option',
    '    "module": "commonjs"',
    '  }',
    '}',
    '',
  ].join('\n')

  const next = patchTsconfigModuleSource(source, {
    includeNodeTypes: true,
  })

  assert.match(next, /\/\/ keep this comment/)
  assert.match(next, /\/\/ existing option/)
  assert.match(next, /"module": "esnext"/)
  assert.match(next, /"types": \[/)
})

test('patchWranglerConfigSource can upsert Cloudflare account, D1, and R2 bindings', () => {
  const source = [
    '{',
    '  "$schema": "https://unpkg.com/wrangler@4.73.0/config-schema.json",',
    '  "name": "ebook-worker",',
    '  "main": "src/index.ts"',
    '}',
    '',
  ].join('\n')

  const next = patchWranglerConfigSource(source, {
    accountId: 'account-123',
    d1Database: {
      binding: 'DB',
      databaseId: 'database-123',
      databaseName: 'ebook-db',
      remote: true,
    },
    r2Bucket: {
      binding: 'STORAGE',
      bucketName: 'ebook-storage',
      remote: true,
    },
  })

  const parsed = JSON.parse(next) as {
    account_id?: string
    d1_databases?: Array<Record<string, unknown>>
    r2_buckets?: Array<Record<string, unknown>>
  }

  assert.equal(parsed.account_id, 'account-123')
  assert.deepEqual(parsed.d1_databases, [
    {
      binding: 'DB',
      database_id: 'database-123',
      database_name: 'ebook-db',
      remote: true,
    },
  ])
  assert.deepEqual(parsed.r2_buckets, [
    {
      binding: 'STORAGE',
      bucket_name: 'ebook-storage',
      remote: true,
    },
  ])
})

test('patchWranglerConfigSource preserves JSONC comments and unrelated field order', () => {
  const source = [
    '{',
    '  // schema comment',
    '  "$schema": "https://unpkg.com/wrangler@4.73.0/config-schema.json",',
    '  "name": "ebook-worker",',
    '  // account comment',
    '  "main": "src/index.ts"',
    '}',
    '',
  ].join('\n')

  const next = patchWranglerConfigSource(source, {
    accountId: 'account-123',
  })

  assert.match(next, /\/\/ schema comment/)
  assert.match(next, /\/\/ account comment/)
  assert.match(next, /"account_id": "account-123"/)
  assert.equal(next.indexOf('"name"') < next.indexOf('"main"'), true)
})

test('patchWranglerConfigSource updates existing Cloudflare bindings in place', () => {
  const source = [
    '{',
    '  "$schema": "https://unpkg.com/wrangler@4.73.0/config-schema.json",',
    '  "name": "ebook-worker",',
    '  "account_id": "old-account",',
    '  "d1_databases": [',
    '    {',
    '      "binding": "DB",',
    '      "database_id": "old-db-id",',
    '      "database_name": "old-db"',
    '    },',
    '    {',
    '      "binding": "ANALYTICS_DB",',
    '      "database_id": "analytics-db-id",',
    '      "database_name": "analytics-db"',
    '    }',
    '  ],',
    '  "r2_buckets": [',
    '    {',
    '      "binding": "STORAGE",',
    '      "bucket_name": "old-storage"',
    '    }',
    '  ]',
    '}',
    '',
  ].join('\n')

  const next = patchWranglerConfigSource(source, {
    accountId: 'next-account',
    d1Database: {
      binding: 'DB',
      databaseId: 'next-db-id',
      databaseName: 'next-db',
      remote: true,
    },
    r2Bucket: {
      binding: 'STORAGE',
      bucketName: 'next-storage',
      remote: true,
    },
  })

  const parsed = JSON.parse(next) as {
    account_id?: string
    d1_databases?: Array<Record<string, unknown>>
    r2_buckets?: Array<Record<string, unknown>>
  }

  assert.equal(parsed.account_id, 'next-account')
  assert.deepEqual(parsed.d1_databases, [
    {
      binding: 'DB',
      database_id: 'next-db-id',
      database_name: 'next-db',
      remote: true,
    },
    {
      binding: 'ANALYTICS_DB',
      database_id: 'analytics-db-id',
      database_name: 'analytics-db',
    },
  ])
  assert.deepEqual(parsed.r2_buckets, [
    {
      binding: 'STORAGE',
      bucket_name: 'next-storage',
      remote: true,
    },
  ])
})

test('createCloudflareVitestWranglerConfigSource keeps D1 and R2 bindings local for tests', () => {
  const source = [
    '{',
    '  "name": "ebook-worker",',
    '  "account_id": "account-123",',
    '  "d1_databases": [',
    '    {',
    '      "binding": "DB",',
    '      "database_id": "database-123",',
    '      "database_name": "ebook-db",',
    '      "remote": true',
    '    }',
    '  ],',
    '  "r2_buckets": [',
    '    {',
    '      "binding": "STORAGE",',
    '      "bucket_name": "ebook-storage",',
    '      "remote": true',
    '    }',
    '  ]',
    '}',
    '',
  ].join('\n')

  const next = createCloudflareVitestWranglerConfigSource(source)

  const parsed = JSON.parse(next) as {
    d1_databases?: Array<Record<string, unknown>>
    r2_buckets?: Array<Record<string, unknown>>
  }

  assert.deepEqual(parsed.d1_databases, [
    {
      binding: 'DB',
      database_id: 'database-123',
      database_name: 'ebook-db',
      remote: false,
    },
  ])
  assert.deepEqual(parsed.r2_buckets, [
    {
      binding: 'STORAGE',
      bucket_name: 'ebook-storage',
      remote: false,
    },
  ])
})
