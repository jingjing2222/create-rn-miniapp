import assert from 'node:assert/strict'
import test from 'node:test'
import {
  assertValidAppName,
  generatedWorkspaceLayout,
  isValidAppName,
  toDefaultDisplayName,
} from './layout.js'

test('generated workspace layout stays flat', () => {
  assert.deepEqual(generatedWorkspaceLayout, ['frontend', 'backoffice', 'server'])
})

test('appName validation only accepts kebab-case', () => {
  assert.equal(isValidAppName('ebook'), true)
  assert.equal(isValidAppName('ebook-reader'), true)
  assert.equal(isValidAppName('ebook_reader'), false)
  assert.equal(isValidAppName('Ebook'), false)
  assert.throws(() => assertValidAppName('ebook_reader'))
})

test('default display name derives from kebab-case appName', () => {
  assert.equal(toDefaultDisplayName('ebook-reader'), 'Ebook Reader')
})
