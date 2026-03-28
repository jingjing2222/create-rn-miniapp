import {
  INSTALLABLE_SKILL_CATALOG,
  resolveAlwaysRecommendedSkillDefinitions,
  getInstallableSkillDefinition,
} from '../installable-skill-catalog.js'
import { SERVER_PROVIDER_METADATA, SERVER_PROVIDERS } from '../providers/catalog.js'
import { renderSkillsAddCommand } from '../skills/add-command.js'
import {
  PROJECT_SKILLS_CANONICAL_DIR,
  PROJECT_SKILLS_MIRROR_DIR,
  SKILLS_LIST_COMMAND,
  SKILLS_PROJECT_SYNC_DIFF_COMMAND,
} from '../skills/contract.js'
import { CORE_SKILL_DEFINITIONS } from '../templates/skill-catalog.js'
import dedent from '../runtime/dedent.js'

export const ROOT_README_SKILLS_SECTION_START_MARKER = '<!-- generated:skills-strategy:start -->'
export const ROOT_README_SKILLS_SECTION_END_MARKER = '<!-- generated:skills-strategy:end -->'
export const ROOT_README_PROVIDER_SECTION_START_MARKER = '<!-- generated:server-provider:start -->'
export const ROOT_README_PROVIDER_SECTION_END_MARKER = '<!-- generated:server-provider:end -->'

export const GENERATOR_REPO_SKILLS_STRATEGY_README_LINES = [
  '## skills 전략',
  '- `create-rn-miniapp`는 skill을 직접 관리하지 않고, 추천 skill과 설치 방법만 알려줘요.',
  `- 아래 예시는 \`${PROJECT_SKILLS_CANONICAL_DIR}\`와 \`${PROJECT_SKILLS_MIRROR_DIR}\`를 같이 맞추는 기준이에요.`,
  '- 설치와 업데이트는 [`@vercel-labs/skills`](https://github.com/vercel-labs/skills) 표준 CLI의 `npx skills add ...` 명령으로 맞춰요.',
  '- 추천 목록에는 공식 `docs-search`, `project-validator`와 workspace overlay skill이 같이 들어가요.',
  '- `npx skills check`, `npx skills update`는 여기서 쓰는 skill을 업데이트할 때는 맞지 않아요.',
  '- 이 저장소의 `skills/`는 scaffold/workspace 특화 overlay skill만 관리하고, 생성된 repo `README.md`가 추천 목록을 자동으로 보여줘요.',
]

export const GENERATED_REPO_SKILLS_STRATEGY_README_LINES = [
  '## skills 전략',
  '- 이 workspace는 skill을 기본 포함하지 않고, 추천 overlay skill과 설치 방법만 README에 적어 둬요.',
  `- 아래 예시는 \`${PROJECT_SKILLS_CANONICAL_DIR}\`와 \`${PROJECT_SKILLS_MIRROR_DIR}\`를 같이 맞추는 기준이에요.`,
  '- 설치와 업데이트는 [`@vercel-labs/skills`](https://github.com/vercel-labs/skills) 표준 CLI의 `npx skills add ...` 명령으로 맞춰요.',
  '- 추천 목록에는 공식 `docs-search`, `project-validator`와 workspace overlay skill이 같이 들어가요.',
  '- `npx skills check`, `npx skills update`는 여기서 쓰는 skill을 업데이트할 때는 맞지 않아요.',
  '- 추천 목록은 현재 workspace topology를 기준으로 자동으로 정해져요.',
]

function formatSkillCatalogLine(skill: {
  id: string
  agentsLabel: string
  readmeDescription: string
}) {
  return `- \`${skill.id}\`: ${skill.agentsLabel}. ${skill.readmeDescription}`
}

export function resolveRootReadmeInstallExampleSkillIds() {
  return [
    ...resolveAlwaysRecommendedSkillDefinitions().map((skill) => skill.id),
    ...CORE_SKILL_DEFINITIONS.map((skill) => skill.id),
  ]
}

export function renderSkillsInstallExample(skillIds: readonly string[]) {
  const exampleSkillIds =
    skillIds.length > 0 ? [...skillIds] : resolveRootReadmeInstallExampleSkillIds()

  if (exampleSkillIds.length === 0) {
    throw new Error('skills install example을 만들 기본 skill id를 찾지 못했어요.')
  }

  return renderSkillsAddCommand(exampleSkillIds)
}

export function renderSkillsProjectSyncGuide(skillIds: readonly string[]) {
  return dedent`
    설치 뒤에는 이렇게 관리해요.

    - 설치 상태 확인: \`${SKILLS_LIST_COMMAND}\`
    - 업데이트할 때는 설치에 쓴 \`npx skills add ...\` 명령을 다시 실행해 주세요.
    - 바뀐 내용 확인: \`${SKILLS_PROJECT_SYNC_DIFF_COMMAND}\`
    - \`npx skills check\`, \`npx skills update\`는 여기서 쓰는 skill을 업데이트할 때는 맞지 않아요.

    \`\`\`bash
    ${renderSkillsInstallExample(skillIds)}
    \`\`\`
  `
}

export function renderRootReadmeSkillCatalogLines() {
  return INSTALLABLE_SKILL_CATALOG.map(formatSkillCatalogLine)
}

export function renderSkillRecommendationLines(skillIds: readonly string[]) {
  return skillIds.map((skillId) => formatSkillCatalogLine(getInstallableSkillDefinition(skillId)))
}

export function renderRootReadmeSkillsSection() {
  return dedent`
    ${(GENERATOR_REPO_SKILLS_STRATEGY_README_LINES).join('\n')}

    바로 설치할 수 있는 skill id와 용도는 이래요.

    ${(renderRootReadmeSkillCatalogLines()).join('\n')}
    
    예를 들어 필요한 skill 하나를 바로 넣고 싶다면 이렇게 하면 돼요.
    
    \`\`\`bash
    ${renderSkillsInstallExample(resolveRootReadmeInstallExampleSkillIds())}
    \`\`\`

    ${renderSkillsProjectSyncGuide(resolveRootReadmeInstallExampleSkillIds())}
  `
}

export function renderRootReadmeProviderSection() {
  return dedent`
    ## server provider 고르기
    
    ${(
      SERVER_PROVIDERS.map(
        (provider) => `- \`${provider}\`: ${SERVER_PROVIDER_METADATA[provider].readmeDescription}`,
      )
    ).join('\n')}
    
    상세 연결 순서와 운영 방식은 생성된 repo의 \`server/README.md\`와 루트 문서를 보면 돼요.
  `
}

function replaceManagedBlock(
  source: string,
  startMarker: string,
  endMarker: string,
  content: string,
) {
  const startIndex = source.indexOf(startMarker)

  if (startIndex < 0) {
    throw new Error(`README managed block을 찾지 못했어요: ${startMarker}`)
  }

  const endIndex = source.indexOf(endMarker, startIndex + startMarker.length)

  if (endIndex < 0) {
    throw new Error(`README managed block을 찾지 못했어요: ${endMarker}`)
  }

  return [
    source.slice(0, startIndex),
    startMarker,
    '\n',
    content,
    '\n',
    endMarker,
    source.slice(endIndex + endMarker.length),
  ].join('')
}

export function syncRootReadmeManagedSections(source: string) {
  return [
    {
      startMarker: ROOT_README_SKILLS_SECTION_START_MARKER,
      endMarker: ROOT_README_SKILLS_SECTION_END_MARKER,
      content: renderRootReadmeSkillsSection(),
    },
    {
      startMarker: ROOT_README_PROVIDER_SECTION_START_MARKER,
      endMarker: ROOT_README_PROVIDER_SECTION_END_MARKER,
      content: renderRootReadmeProviderSection(),
    },
  ].reduce(
    (nextSource, block) =>
      replaceManagedBlock(nextSource, block.startMarker, block.endMarker, block.content),
    source,
  )
}
