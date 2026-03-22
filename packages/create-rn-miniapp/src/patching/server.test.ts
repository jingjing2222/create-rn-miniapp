import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveWranglerSchemaUrl } from './server.js'

test('resolveWranglerSchemaUrl derives a concrete wrangler version from semver ranges', () => {
  assert.equal(
    resolveWranglerSchemaUrl({
      devDependencies: {
        wrangler: '>=4.73.0 <5.0.0',
      },
    }),
    'https://unpkg.com/wrangler@4.73.0/config-schema.json',
  )

  assert.equal(
    resolveWranglerSchemaUrl({
      devDependencies: {
        wrangler: '4.73.x',
      },
    }),
    'https://unpkg.com/wrangler@4.73.0/config-schema.json',
  )
})
