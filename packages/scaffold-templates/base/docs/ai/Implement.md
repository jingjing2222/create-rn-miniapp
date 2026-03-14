# Implement

## 현재 구현 기준선
- 루트 기준 `{{packageManagerCommand}}` workspace + `nx` + `biome`
- `frontend`: AppInToss + Granite + `@apps-in-toss/framework` + TDS
- `backoffice`: optional Vite workspace
- `server`: optional Supabase workspace

## 구현 규칙
- 구현 전에 문서를 먼저 갱신한다.
- MiniApp 작업이면 `docs/engineering/appsintoss-granite-api-index.md`를 먼저 확인한다.
- 빠른 인덱스로 부족하면 `docs/engineering/appsintoss-granite-full-api-index.md`를 추가로 확인한다.
- `@apps-in-toss/framework` 초기화와 화면 제어는 공식 문서와 튜토리얼 절차를 먼저 확인한다.
- UI 구현이 포함되면 `docs/engineering/tds-react-native-index.md`와 TDS 원문 문서를 먼저 확인한다.
- 라우팅과 페이지 구조는 `docs/engineering/granite-ssot.md`를 따른다.
- 네이티브 연동은 `docs/engineering/native-modules-policy.md`를 따른다.

## TDD 규칙
- 버그 수정이나 로직 변경은 가능한 한 실패 테스트부터 작성한다.
- 테스트를 바로 만들기 어렵다면 최소한 재현 절차와 기대 결과를 `docs/ai/Plan.md` 또는 `docs/ai/Status.md`에 남긴다.
- 구현은 red → green → refactor 순서를 기본으로 한다.

## 검증 명령
- `{{verifyCommand}}`

## PR 제출 체크
- PR 본문에 실행한 검증 명령과 결과를 남긴다.
- 문서 링크와 실제 구조가 맞는지 확인한다.

## 관련 문서
- [Plan](./Plan.md)
- [Status](./Status.md)
- [Decisions](./Decisions.md)
