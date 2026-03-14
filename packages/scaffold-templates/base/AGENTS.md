# AGENTS.md

이 문서는 생성 직후 가장 먼저 보는 실행 안내서입니다.
배경 설명과 상세 규칙은 하위 문서에 있고, 여기서는 어디서 시작하고 무엇을 지켜야 하는지만 빠르게 정리합니다.

## Golden Rules
1. Plan first: 작업 전 `docs/ai/Plan.md`를 먼저 갱신한다.
2. TDD first: 로직 변경과 버그 수정은 실패 테스트나 재현 절차부터 남긴다.
3. Self-verify first: `{{verifyCommand}}`를 통과해야 완료로 본다.
4. Small diffs: 한 커밋과 한 PR은 하나의 목적만 가진다.
5. Docs first: 구조와 규칙이 바뀌면 코드보다 문서를 먼저 맞춘다.
6. No secrets: 키, 토큰, 내부 URL 같은 민감정보를 코드, 로그, PR에 남기지 않는다.
7. Official docs first: Granite, `@apps-in-toss/framework`, TDS는 공식 공개 문서를 먼저 확인한다.

## Start Here
1. `docs/ai/Plan.md`: 목표, 범위, DoD
2. `docs/ai/Status.md`: 최신 상태 1페이지
3. `docs/ai/Implement.md`: 구현 루프와 검증 규칙
4. `docs/ai/Decisions.md`: 중요한 판단과 트레이드오프
5. `docs/product/기능명세서.md`: 제품 요구사항

## 어떤 문서를 볼지
- `docs/engineering/appsintoss-granite-api-index.md`
  - MiniApp API 후보를 가장 먼저 찾을 때 보는 빠른 인덱스
- `docs/engineering/appsintoss-granite-full-api-index.md`
  - 빠른 인덱스로 부족할 때 보는 전체 카탈로그
- `docs/engineering/granite-ssot.md`
  - 라우팅, 페이지 구조, 검증 규칙처럼 반드시 지켜야 하는 기준
- `docs/engineering/tds-react-native-index.md`
  - TDS 컴포넌트와 UI 구현 참고
- `docs/engineering/native-modules-policy.md`
  - 네이티브 연동 제약과 허용 범위
- `docs/engineering/하네스-실행가이드.md`
  - 작업 순서와 PR 마무리 체크
- `docs/engineering/에이전트전략.md`
  - 이 문서보다 긴 배경 설명과 운영 전략

## Workspace Mental Model
- `frontend`: AppInToss + Granite 기반 MiniApp
- `backoffice`: optional Vite 기반 운영 도구
- `server`: optional Supabase workspace
- `docs`: 제품, 엔지니어링, AI 하네스 문서

현재 기준선:
- 루트 툴체인: `{{packageManagerCommand}} + nx + biome`
- MiniApp 기준: AppInToss React Native tutorial + `@apps-in-toss/framework` + TDS
- 내부 워크스페이스는 루트 검증 흐름을 따른다

## Working Loop
1. `Plan`에 목표, 범위, 검증 계획을 적는다.
2. MiniApp 작업이면 quick index에서 API 후보를 먼저 찾는다.
3. 라우팅이나 페이지 구조를 건드리면 `granite-ssot.md`를 먼저 확인한다.
4. UI 작업이면 TDS 문서를 먼저 확인한다.
5. 실패 테스트 또는 재현 절차를 만든다.
6. 구현한다.
7. `{{verifyCommand}}`를 실행한다.
8. `Status`와 필요하면 `Decisions`를 갱신한다.
9. 브랜치, 커밋, 푸시, PR 순으로 마무리한다.

## Verify Gate
- `{{packageManagerCommand}} format:check`
- `{{packageManagerCommand}} lint`
- `{{packageManagerCommand}} typecheck`
- `{{packageManagerCommand}} test`
- 문서 링크와 실제 구조 정합성 확인

## Commit And Branch Policy
- 기본 접두사: `feat:`, `fix:`, `docs:`, `chore:`
- 한 커밋은 한 의도만 담는다.
- 기능 브랜치에서 작업하고 PR로 병합한다.
- `main` 직접 푸시는 금지한다.

## Notes
- 장기 작업은 채팅보다 `Prompt`, `Plan`, `Status`, `Decisions` 파일에 남긴다.
- 상태 문서는 append보다 최신 상태 재작성 우선이다.
- 품질 문제가 반복되면 코드만 고치지 말고 하네스 문서도 같이 강화한다.
