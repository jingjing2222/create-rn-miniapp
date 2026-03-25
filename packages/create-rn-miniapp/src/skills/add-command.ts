import {
  getInstallableSkillDefinition,
  type InstallableSkillId,
} from '../installable-skill-catalog.js'
import { createSkillsAddArgs } from './contract.js'

type SkillSourceGroup = {
  sourceRepo: string
  skillIds: InstallableSkillId[]
}

export function groupSkillIdsBySource(skillIds: readonly InstallableSkillId[]) {
  const groups = new Map<string, InstallableSkillId[]>()
  const seen = new Set<string>()

  for (const skillId of skillIds) {
    const definition = getInstallableSkillDefinition(skillId)

    if (seen.has(definition.id)) {
      continue
    }

    const nextGroup = groups.get(definition.sourceRepo) ?? []
    nextGroup.push(definition.id)
    groups.set(definition.sourceRepo, nextGroup)
    seen.add(definition.id)
  }

  return [...groups.entries()].map(
    ([sourceRepo, groupedSkillIds]) =>
      ({
        sourceRepo,
        skillIds: groupedSkillIds,
      }) satisfies SkillSourceGroup,
  )
}

export function renderSkillsAddCommand(skillIds: string[]) {
  return groupSkillIdsBySource(skillIds as InstallableSkillId[])
    .map((group) =>
      [
        'npx',
        'skills',
        ...createSkillsAddArgs({
          source: group.sourceRepo,
          skillIds: group.skillIds,
        }),
      ].join(' '),
    )
    .join('\n')
}
