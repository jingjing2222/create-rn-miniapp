import {
  CREATE_CLOUDFLARE_CLI,
  FIREBASE_TOOLS_CLI,
  SUPABASE_CLI,
  WRANGLER_CLI,
  type ExternalCliTool,
} from './external-tooling.js'
import type { ServerProvider } from './providers/index.js'
import dedent from './dedent.js'

const SERVER_README_CLI_TOOLS = {
  cloudflare: [CREATE_CLOUDFLARE_CLI, WRANGLER_CLI],
  firebase: [FIREBASE_TOOLS_CLI],
  supabase: [SUPABASE_CLI],
} satisfies Record<ServerProvider, readonly ExternalCliTool[]>

export function getServerReadmeCliTools(provider: ServerProvider) {
  return SERVER_README_CLI_TOOLS[provider]
}

export function renderServerReadmeCliVersionsSection(provider: ServerProvider) {
  return dedent`
    ## 생성 기준 CLI 버전

    - 이 server workspace는 아래 pinned CLI 버전 기준으로 스캐폴딩/프로비저닝 흐름을 맞췄어요.
    - README의 명령 예시와 운영 메모도 이 버전 contract를 기준으로 설명해요.
    ${getServerReadmeCliTools(provider)
      .map((tool) => `- \`${tool.packageSpec}\``)
      .join('\n')}
  `
}
