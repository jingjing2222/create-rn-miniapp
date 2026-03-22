import matter from 'gray-matter'

export type SkillFrontmatter = {
  id: string
  agentsLabel: string
  category: 'core' | 'optional'
  order: number
}

function readStringField(data: Record<string, unknown>, fieldName: string) {
  const value = data[fieldName]

  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`frontmatter field를 찾지 못했어요: ${fieldName}`)
  }

  return value.trim()
}

export function parseSkillFrontmatter(source: string, expectedId: string): SkillFrontmatter {
  const parsed = matter(source)
  const data =
    parsed.data && typeof parsed.data === 'object' && !Array.isArray(parsed.data)
      ? (parsed.data as Record<string, unknown>)
      : null

  if (!data) {
    throw new Error(`frontmatter를 찾지 못했어요: ${expectedId}`)
  }

  const id = readStringField(data, 'name')
  const agentsLabel = readStringField(data, 'label')
  const category = readStringField(data, 'category')
  const rawOrder = data.order
  const order =
    typeof rawOrder === 'number'
      ? rawOrder
      : typeof rawOrder === 'string'
        ? Number.parseInt(rawOrder, 10)
        : Number.NaN

  if (id !== expectedId) {
    throw new Error(`skill id가 디렉터리명과 다릅니다: ${expectedId} != ${id}`)
  }

  if (category !== 'core' && category !== 'optional') {
    throw new Error(`skill category가 잘못됐어요: ${expectedId} -> ${category}`)
  }

  if (!Number.isFinite(order)) {
    throw new Error(`skill order가 숫자가 아니에요: ${expectedId} -> ${String(rawOrder)}`)
  }

  return {
    id,
    agentsLabel,
    category,
    order,
  }
}
