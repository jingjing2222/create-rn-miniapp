import assert from 'node:assert/strict'
import test from 'node:test'
import { renderSkillCatalogSource } from './skills/catalog-generator.js'

test('renderSkillCatalogSource escapes labels with JSON-safe string serialization', () => {
  const source = renderSkillCatalogSource([
    {
      id: 'test-skill',
      agentsLabel: "한 줄\n둘째 줄 'quoted'",
      category: 'core',
      order: 1,
    },
  ])

  assert.match(source, /"한 줄\\n둘째 줄 'quoted'"/)
})
