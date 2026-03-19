# docs index

문서 루트는 `index.md`만 유지하고, 상세 내용은 하위 디렉터리에 둡니다.

## 구조
- `product/`: 제품 요구사항과 기능 명세
- `engineering/`: Granite, `@apps-in-toss/framework`, TDS, 에이전트 전략, 구현 규칙
- `ai/`: Prompt, Plan, Status, Decisions

## 현재 기준선
- 루트는 `{{packageManagerCommand}} + nx + biome`
- `frontend`: AppInToss + Granite + `@apps-in-toss/framework` + TDS 기반 MiniApp
- `backoffice`: optional Vite 기반 workspace
- `server`: optional server workspace

## 주요 문서
- 제품 명세: `product/기능명세서.md`
- 에이전트 전략: `engineering/에이전트전략.md`
- 하네스 실행: `engineering/하네스-실행가이드.md`
- AppsInToss + Granite feature map: `engineering/appsintoss-granite-api-index.md`
- AppsInToss + Granite full index: `engineering/appsintoss-granite-full-api-index.md`
- Granite SSoT: `engineering/granite-ssot.md`
- TDS RN index: `engineering/tds-react-native-index.md`
<!-- optional-engineering-links:start -->
<!-- optional-engineering-links:end -->
- Native modules policy: `engineering/native-modules-policy.md`
- AI harness stack
  1. `ai/Plan.md`
  2. `ai/Status.md`
  3. `ai/Decisions.md`
  4. `ai/Prompt.md`

문서 역할:
- feature map은 어떤 기능 축이 존재하는지 가장 먼저 파악하는 문서다.
- full index는 정확한 URL, 세부 타입, 에러 문서를 찾는 전체 카탈로그다.
- `Plan.md`는 목표, 범위, 구현 순서, 검증 계획까지 담는 실행 계획 문서다.
- `granite-ssot.md`는 라우팅, 페이지 구조, 검증 규칙의 단일 기준 문서다.

## format and lint
- Biome는 루트 단일 진입점만 사용한다.
- 아래 명령은 반드시 저장소 루트에서 실행한다.
  - `{{packageManagerRunCommand}} format`
  - `{{packageManagerRunCommand}} format:check`
  - `{{packageManagerRunCommand}} lint`
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
