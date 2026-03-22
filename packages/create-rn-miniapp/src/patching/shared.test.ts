import assert from 'node:assert/strict'
import test from 'node:test'
import { applyExistingVersionPrefix } from './shared.js'

test('applyExistingVersionPrefix preserves protocol and range prefixes around the new version', () => {
  assert.equal(applyExistingVersionPrefix('^19.0.0', '19.1.0'), '^19.1.0')
  assert.equal(applyExistingVersionPrefix('workspace:^19.0.0', '^19.1.0'), 'workspace:^19.1.0')
  assert.equal(applyExistingVersionPrefix('npm:^19.0.0', '19.1.0'), 'npm:^19.1.0')
})
