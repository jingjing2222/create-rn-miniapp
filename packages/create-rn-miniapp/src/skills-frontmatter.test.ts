import assert from 'node:assert/strict'
import test from 'node:test'
import { parseSkillFrontmatter } from './skills/frontmatter.js'

function createSkillSource(lines: string[]) {
  return [...lines, '', '# Skill', ''].join('\n')
}

test('parseSkillFrontmatter reads namespaced metadata fields and description', () => {
  const source = createSkillSource([
    '---',
    'name: fancy-skill',
    'description: "Use when you need a quoted: description."',
    'metadata:',
    '  create-rn-miniapp.agentsLabel: "TDS UI: form pattern guide"',
    '  create-rn-miniapp.category: optional',
    '  create-rn-miniapp.order: "42"',
    '  create-rn-miniapp.version: 2.0.0',
    '---',
  ])

  assert.deepEqual(parseSkillFrontmatter(source, 'fancy-skill'), {
    id: 'fancy-skill',
    description: 'Use when you need a quoted: description.',
    agentsLabel: 'TDS UI: form pattern guide',
    category: 'optional',
    order: 42,
    version: '2.0.0',
  })
})

test('parseSkillFrontmatter rejects missing namespaced metadata keys', () => {
  const source = createSkillSource([
    '---',
    'name: fancy-skill',
    'description: Skill description',
    'metadata:',
    '  create-rn-miniapp.agentsLabel: Fancy skill',
    '  create-rn-miniapp.category: optional',
    '---',
  ])

  assert.throws(() => parseSkillFrontmatter(source, 'fancy-skill'), {
    message:
      'frontmatter metadata field를 찾지 못했어요: metadata.create-rn-miniapp.order (skill: fancy-skill)',
  })
})

test('parseSkillFrontmatter rejects non-numeric metadata order strings', () => {
  const source = createSkillSource([
    '---',
    'name: fancy-skill',
    'description: Skill description',
    'metadata:',
    '  create-rn-miniapp.agentsLabel: Fancy skill',
    '  create-rn-miniapp.category: optional',
    '  create-rn-miniapp.order: later',
    '---',
  ])

  assert.throws(() => parseSkillFrontmatter(source, 'fancy-skill'), {
    message:
      'skill order metadata가 숫자 문자열이 아니에요: fancy-skill -> create-rn-miniapp.order=later',
  })
})

test('parseSkillFrontmatter rejects directory name mismatch', () => {
  const source = createSkillSource([
    '---',
    'name: another-skill',
    'description: Skill description',
    'metadata:',
    '  create-rn-miniapp.agentsLabel: Fancy skill',
    '  create-rn-miniapp.category: optional',
    '  create-rn-miniapp.order: "42"',
    '---',
  ])

  assert.throws(() => parseSkillFrontmatter(source, 'fancy-skill'), {
    message: 'skill id가 디렉터리명과 다릅니다: fancy-skill != another-skill',
  })
})

test('parseSkillFrontmatter rejects empty description', () => {
  const source = createSkillSource([
    '---',
    'name: fancy-skill',
    'description: "   "',
    'metadata:',
    '  create-rn-miniapp.agentsLabel: Fancy skill',
    '  create-rn-miniapp.category: optional',
    '  create-rn-miniapp.order: "42"',
    '---',
  ])

  assert.throws(() => parseSkillFrontmatter(source, 'fancy-skill'), {
    message: 'frontmatter field를 찾지 못했어요: description (skill: fancy-skill)',
  })
})
