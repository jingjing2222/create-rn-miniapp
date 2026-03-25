import matter from 'gray-matter'

const REPO_METADATA_PREFIX = 'create-rn-miniapp.'
const AGENTS_LABEL_METADATA_KEY = `${REPO_METADATA_PREFIX}agentsLabel`
const CATEGORY_METADATA_KEY = `${REPO_METADATA_PREFIX}category`
const ORDER_METADATA_KEY = `${REPO_METADATA_PREFIX}order`
const VERSION_METADATA_KEY = `${REPO_METADATA_PREFIX}version`

export type SkillFrontmatter = {
  id: string
  description: string
  agentsLabel: string
  category: 'core' | 'optional'
  order: number
  version?: string
}

function readStringField(data: Record<string, unknown>, fieldName: string, expectedId: string) {
  const value = data[fieldName]

  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`frontmatter field를 찾지 못했어요: ${fieldName} (skill: ${expectedId})`)
  }

  return value.trim()
}

function readMetadataObject(data: Record<string, unknown>, expectedId: string) {
  const metadata = data.metadata

  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    throw new Error(`frontmatter metadata object를 찾지 못했어요: metadata (skill: ${expectedId})`)
  }

  return metadata as Record<string, unknown>
}

function readMetadataStringField(
  metadata: Record<string, unknown>,
  fieldName: string,
  expectedId: string,
) {
  const value = metadata[fieldName]

  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(
      `frontmatter metadata field를 찾지 못했어요: metadata.${fieldName} (skill: ${expectedId})`,
    )
  }

  return value.trim()
}

function readOptionalMetadataStringField(
  metadata: Record<string, unknown>,
  fieldName: string,
  expectedId: string,
) {
  const value = metadata[fieldName]

  if (value === undefined) {
    return undefined
  }

  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(
      `frontmatter metadata field 형식이 잘못됐어요: metadata.${fieldName} (skill: ${expectedId})`,
    )
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

  const id = readStringField(data, 'name', expectedId)
  const description = readStringField(data, 'description', expectedId)
  const metadata = readMetadataObject(data, expectedId)
  const agentsLabel = readMetadataStringField(metadata, AGENTS_LABEL_METADATA_KEY, expectedId)
  const category = readMetadataStringField(metadata, CATEGORY_METADATA_KEY, expectedId)
  const rawOrder = readMetadataStringField(metadata, ORDER_METADATA_KEY, expectedId)
  const version = readOptionalMetadataStringField(metadata, VERSION_METADATA_KEY, expectedId)
  const order = /^\d+$/.test(rawOrder) ? Number.parseInt(rawOrder, 10) : Number.NaN

  if (id !== expectedId) {
    throw new Error(`skill id가 디렉터리명과 다릅니다: ${expectedId} != ${id}`)
  }

  if (category !== 'core' && category !== 'optional') {
    throw new Error(
      `skill category metadata가 잘못됐어요: ${expectedId} -> ${CATEGORY_METADATA_KEY}=${category}`,
    )
  }

  if (!Number.isFinite(order)) {
    throw new Error(
      `skill order metadata가 숫자 문자열이 아니에요: ${expectedId} -> ${ORDER_METADATA_KEY}=${String(rawOrder)}`,
    )
  }

  return {
    id,
    description,
    agentsLabel,
    category,
    order,
    version,
  }
}
