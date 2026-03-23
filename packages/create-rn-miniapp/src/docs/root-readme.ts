import { SERVER_PROVIDERS, getServerProviderAdapter } from '../providers/index.js'
import { renderSkillsAddCommand } from '../skills/install.js'
import {
  SKILLS_CHECK_COMMAND,
  SKILLS_LIST_COMMAND,
  SKILLS_UPDATE_COMMAND,
} from '../skills/contract.js'
import { CORE_SKILL_DEFINITIONS, SKILL_CATALOG } from '../templates/skill-catalog.js'
import dedent from '../runtime/dedent.js'

export const ROOT_README_SKILLS_SECTION_START_MARKER = '<!-- generated:skills-strategy:start -->'
export const ROOT_README_SKILLS_SECTION_END_MARKER = '<!-- generated:skills-strategy:end -->'
export const ROOT_README_PROVIDER_SECTION_START_MARKER = '<!-- generated:server-provider:start -->'
export const ROOT_README_PROVIDER_SECTION_END_MARKER = '<!-- generated:server-provider:end -->'

export const GENERATOR_REPO_SKILLS_STRATEGY_README_LINES = [
  '## skills 전략',
  '- `create-rn-miniapp`는 skill을 직접 관리하지 않고, 추천 skill과 설치 방법만 알려줘요.',
  '- 실제 설치, 확인, 업데이트는 [`@vercel-labs/skills`](https://github.com/vercel-labs/skills) 표준 CLI로 바로 하면 돼요.',
  '- 이 저장소의 `skills/`에는 MiniApp 작업에 맞춘 skill source가 들어 있고, 생성된 repo `README.md`가 추천 목록을 자동으로 보여줘요.',
]

export const GENERATED_REPO_SKILLS_STRATEGY_README_LINES = [
  '## skills 전략',
  '- 이 workspace는 skill을 기본 포함하지 않고, 추천 skill과 설치 방법만 README에 적어 둬요.',
  '- 실제 설치, 확인, 업데이트는 [`@vercel-labs/skills`](https://github.com/vercel-labs/skills) 표준 CLI로 바로 하면 돼요.',
  '- 추천 목록은 현재 workspace topology를 기준으로 자동으로 정해져요.',
]

export function renderSkillsInstallExample(skillIds: readonly string[]) {
  const exampleSkillId = skillIds[0] ?? CORE_SKILL_DEFINITIONS[0]?.id

  if (!exampleSkillId) {
    throw new Error('skills install example을 만들 기본 skill id를 찾지 못했어요.')
  }

  return renderSkillsAddCommand([exampleSkillId])
}

export function renderSkillsStandardCommandSummary() {
  return `설치 뒤에는 \`${SKILLS_LIST_COMMAND}\`, \`${SKILLS_CHECK_COMMAND}\`, \`${SKILLS_UPDATE_COMMAND}\`만 기억하면 돼요.`
}

export function renderRootReadmeSkillCatalogLines() {
  return SKILL_CATALOG.map((skill) => `- \`${skill.id}\`: ${skill.agentsLabel}`)
}

export function renderRootReadmeSkillsSection() {
  const exampleSkillIds = CORE_SKILL_DEFINITIONS.map((skill) => skill.id)

  return dedent`
    ${(GENERATOR_REPO_SKILLS_STRATEGY_README_LINES).join('\n')}

    바로 설치할 수 있는 skill id와 용도는 이래요.

    ${(renderRootReadmeSkillCatalogLines()).join('\n')}
    
    예를 들어 필요한 skill 하나를 바로 넣고 싶다면 이렇게 하면 돼요.
    
    \`\`\`bash
    ${renderSkillsInstallExample(exampleSkillIds)}
    \`\`\`
    
    ${renderSkillsStandardCommandSummary()}
  `
}

export function renderRootReadmeProviderSection() {
  return dedent`
    ## server provider 고르기
    
    ${(
      SERVER_PROVIDERS.map((provider) => {
        const adapter = getServerProviderAdapter(provider)
        return `- \`${provider}\`: ${adapter.readmeDescription}`
      })
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
