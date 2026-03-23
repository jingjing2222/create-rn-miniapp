import { APPS_IN_TOSS_SKILLS_SOURCE_REPO, SKILLS_SOURCE_REPO } from './skills/contract.js'
import {
  SKILL_CATALOG as LOCAL_SKILL_CATALOG,
  type SkillDefinition as LocalSkillDefinition,
  type SkillId as LocalSkillId,
} from './templates/skill-catalog.js'

type OfficialSkillMetadata = {
  agentsLabel: string
}

const OFFICIAL_SKILL_METADATA_BY_ID = {
  'docs-search': {
    agentsLabel: 'Apps-in-Toss / TDS 공식 문서 검색',
  },
  'project-validator': {
    agentsLabel: 'AppInToss 프로젝트 구조 검증',
  },
} as const satisfies Record<string, OfficialSkillMetadata>

export type OfficialSkillId = keyof typeof OFFICIAL_SKILL_METADATA_BY_ID
export type InstallableSkillId = LocalSkillId | OfficialSkillId

export type InstallableSkillDefinition = {
  id: InstallableSkillId
  agentsLabel: string
  sourceRepo: string
}

function createOfficialSkillDefinition<TId extends OfficialSkillId>(
  id: TId,
): InstallableSkillDefinition {
  return {
    id,
    agentsLabel: OFFICIAL_SKILL_METADATA_BY_ID[id].agentsLabel,
    sourceRepo: APPS_IN_TOSS_SKILLS_SOURCE_REPO,
  }
}

function createLocalSkillDefinition(skill: LocalSkillDefinition): InstallableSkillDefinition {
  return {
    id: skill.id,
    agentsLabel: skill.agentsLabel,
    sourceRepo: SKILLS_SOURCE_REPO,
  }
}

export const OFFICIAL_SKILL_DEFINITIONS = (
  Object.keys(OFFICIAL_SKILL_METADATA_BY_ID) as OfficialSkillId[]
).map(createOfficialSkillDefinition)

export const INSTALLABLE_SKILL_CATALOG: InstallableSkillDefinition[] = [
  ...OFFICIAL_SKILL_DEFINITIONS,
  ...LOCAL_SKILL_CATALOG.map(createLocalSkillDefinition),
]

const INSTALLABLE_SKILL_DEFINITION_BY_ID = new Map(
  INSTALLABLE_SKILL_CATALOG.map((skill) => [skill.id, skill] as const),
)

export function getInstallableSkillDefinition(id: InstallableSkillId | string) {
  const definition = INSTALLABLE_SKILL_DEFINITION_BY_ID.get(id as InstallableSkillId)

  if (!definition) {
    throw new Error(`알 수 없는 skill id입니다: ${id}`)
  }

  return definition
}

export function resolveAlwaysRecommendedSkillDefinitions() {
  return OFFICIAL_SKILL_DEFINITIONS
}
