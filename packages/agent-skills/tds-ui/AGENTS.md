# tds-ui AGENTS (Generated)

이 파일은 `metadata.json`, `generated/catalog.json`, `generated/anomalies.json`에서 파생된 generated output이다.
수정은 truth source를 바꾼 뒤 재생성된 결과만 반영한다.

## Truth Sources
- `metadata.json`
- `generated/catalog.json`
- `generated/anomalies.json`

## Human References
- `references/decision-matrix.md`
- `references/form-patterns.md`
- `references/layout-and-navigation.md`
- `references/feedback-and-loading.md`
- `references/display-patterns.md`
- `references/export-gaps.md`
- `references/policy-summary.md`

## Review Rules
- `rules/catalog-doc-backed-first.md`
- `rules/catalog-export-gap-handling.md`
- `rules/state-controlled-uncontrolled.md`
- `rules/screen-states-loading-error-empty.md`
- `rules/no-rn-primitive-when-tds-exists.md`
- `rules/export-only-gated.md`
- `rules/navbar-import-gap.md`
- `rules/accessibility-interactive-elements.md`

## Answer Contract
1. 추천 컴포넌트
2. 선택 이유
3. 가장 가까운 대안과 왜 아닌지
4. controlled / uncontrolled 패턴
5. loading / error / empty / disabled / a11y 체크
6. docs URL + root export module
7. anomaly note 또는 export-only / docs-missing note

## Contract Enforcement
- 위 7항 중 하나라도 빠지면 incomplete answer로 간주한다.
- export-only 추천 시에는 반드시 doc-backed fallback도 같이 적는다.
