# AGENTS.md

## Golden Rules
1. Plan first: 작업 전 `docs/ai/Plan.md`를 갱신한다.
2. TDD first: 로직 변경과 버그 수정은 실패 테스트나 재현 절차부터 만든다.
3. Self-verify first: `pnpm verify`를 통과해야 완료로 본다.
4. Small diffs: 한 커밋은 하나의 목적만 가진다.
5. Templates first: generic 규칙은 `packages/scaffold-templates`에서 관리한다.
6. Official scaffold first: Granite, `@apps-in-toss/framework`, Vite, Supabase 공식 CLI를 먼저 쓰고 overlay로 덧입힌다.
7. Root owns tooling: 생성 결과물의 lint/format orchestration은 루트 `pnpm + nx + biome`가 담당하고, 내부 워크스페이스는 formatter/linter를 별도로 들지 않는다.

## Quick Links
- Planner: `docs/ai/Plan.md`
- Status: `docs/ai/Status.md`
- CLI package: `packages/create-rn-miniapp`
- Template package: `packages/scaffold-templates`
- Template AGENTS: `packages/scaffold-templates/base/AGENTS.md`

## Workspace Mental Model
- `packages/create-rn-miniapp`: generator CLI
- `packages/scaffold-templates`: generated repo에 복사할 하네스/문서 템플릿

## Generator Principle
1. Granite, Vite, Supabase scaffold는 공식 CLI로 생성한다.
2. 이 저장소는 scaffold 결과물을 template으로 들고 있지 않는다.
3. template으로 유지하는 것은 AGENTS, docs/ai, docs/product 같은 하네스 문서다.
4. MiniApp frontend 스캐폴딩 기준은 AppInToss React Native 튜토리얼과 `@apps-in-toss/framework` 초기화 절차를 source of truth로 둔다.

## Verify Gate
- `pnpm format:check`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
