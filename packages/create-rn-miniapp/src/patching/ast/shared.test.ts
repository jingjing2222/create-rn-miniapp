import assert from 'node:assert/strict'
import test from 'node:test'
import { cloneAstNode } from './shared.js'

test('cloneAstNode preserves undefined fields in swc-shaped nodes', () => {
  const sourceNode = {
    type: 'Identifier',
    value: 'token',
    optional: undefined,
  }

  const clonedNode = cloneAstNode(sourceNode)

  assert.notEqual(clonedNode, sourceNode)
  assert.ok('optional' in clonedNode)
  assert.equal(clonedNode.optional, undefined)
})
