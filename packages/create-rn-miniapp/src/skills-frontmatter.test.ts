import assert from 'node:assert/strict'
import test from 'node:test'
import { parseSkillFrontmatter } from './skills/frontmatter.js'

test('parseSkillFrontmatter reads quoted YAML values with colons', () => {
  const source = [
    '---',
    'name: fancy-skill',
    'label: "TDS UI: form pattern guide"',
    'category: optional',
    'order: 42',
    '---',
    '',
    '# Fancy skill',
    '',
  ].join('\n')

  assert.deepEqual(parseSkillFrontmatter(source, 'fancy-skill'), {
    id: 'fancy-skill',
    agentsLabel: 'TDS UI: form pattern guide',
    category: 'optional',
    order: 42,
  })
})
