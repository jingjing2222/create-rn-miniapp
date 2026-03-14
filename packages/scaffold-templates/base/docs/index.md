# docs index

문서 루트는 `index.md`만 유지하고, 상세 내용은 하위 디렉터리에 둡니다.

## 구조
- `product/`: 제품 요구사항과 기능 명세
- `engineering/`: Granite, `@apps-in-toss/framework`, TDS, 에이전트 전략, 구현 규칙
- `ai/`: Prompt, Plan, Implement, Status, Decisions

## 현재 기준선
- 루트는 `{{packageManagerCommand}} + nx + biome`
- `frontend`: AppInToss + Granite + `@apps-in-toss/framework` + TDS 기반 MiniApp
- `backoffice`: optional Vite 기반 workspace
- `server`: optional Supabase workspace

## 주요 문서
- 제품 명세: `product/기능명세서.md`
- 에이전트 전략: `engineering/에이전트전략.md`
- 하네스 실행: `engineering/하네스-실행가이드.md`
- AppsInToss + Granite quick index: `engineering/appsintoss-granite-api-index.md`
- AppsInToss + Granite full index: `engineering/appsintoss-granite-full-api-index.md`
- Granite SSoT: `engineering/granite-ssot.md`
- TDS RN index: `engineering/tds-react-native-index.md`
- Native modules policy: `engineering/native-modules-policy.md`
- AI harness stack
  1. `ai/Plan.md`
  2. `ai/Status.md`
  3. `ai/Implement.md`
  4. `ai/Decisions.md`
  5. `ai/Prompt.md`

문서 역할:
- quick index는 API 후보를 가장 먼저 찾는 문서다.
- full index는 빠른 인덱스로 부족할 때 보는 전체 카탈로그다.
- `granite-ssot.md`는 라우팅, 페이지 구조, 검증 규칙의 단일 기준 문서다.

## format and lint
- Biome는 루트 단일 진입점만 사용한다.
- 아래 명령은 반드시 저장소 루트에서 실행한다.
  - `{{packageManagerCommand}} format`
  - `{{packageManagerCommand}} format:check`
  - `{{packageManagerCommand}} lint`
  - `{{verifyCommand}}`

## Nx 실행 가이드
- 그래프 생성: `{{packageManagerExecCommand}} nx graph --file=tmp/nx-graph.html`
- 전체 검증: `{{packageManagerExecCommand}} nx run-many -t typecheck,test --all`
- 프로젝트별 예시
  - `{{packageManagerExecCommand}} nx run frontend:typecheck`
  - `{{packageManagerExecCommand}} nx run backoffice:build`
  - `{{packageManagerExecCommand}} nx run server:test`

## 테스트 규칙
- 테스트는 가능한 한 인접 배치를 우선한다.
- 로직 변경은 TDD를 우선한다.
- 재현이 가능한 버그는 실패 테스트 또는 명시적 재현 절차부터 남긴다.

## 운영 규칙
1. 새 문서 생성 전 기존 문서에 섹션 추가가 가능한지 먼저 검토한다.
2. 루트 `docs/`에는 `index.md` 외 파일을 두지 않는다.
3. 문서 변경 시 `AGENTS.md`와 `docs/index.md` 링크를 같이 점검한다.
