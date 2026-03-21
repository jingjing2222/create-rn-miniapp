# Policy Summary

- truth source는 `generated/catalog.json`과 `generated/anomalies.json`이다.
- 선택 순서는 cluster 분류 -> doc-backed 후보 -> anomaly note 순서다.
- RN primitive를 직접 추천하지 않는다.
- export-only 추천 시에는 반드시 doc-backed fallback을 같이 쓴다.
- `paragraph`는 blocked-by-default다.

## Output Contract

1. 추천 컴포넌트
2. 선택 이유
3. 가장 가까운 대안과 왜 아닌지
4. controlled / uncontrolled 패턴
5. loading / error / empty / disabled / a11y 체크
6. docs URL + root export module
7. anomaly note 또는 export-only / docs-missing note
