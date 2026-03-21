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

## Contract Enforcement

- 위 7항 중 하나라도 빠지면 incomplete answer로 간주한다.
- export-only 추천 시에는 반드시 doc-backed fallback도 같이 적는다.

## Acceptance Prompts

- "검색어 입력 후 목록 필터링 화면" -> `search-field + list + list-row`; `text-field` 단독 추천으로 끝내지 않는다.
- "약관 여러 개 동의" -> `checkbox`; `agreement`는 export-only 검증 없이는 기본 추천하지 않는다.
- "알림 설정 on/off" -> `switch`; `checkbox`를 추천하지 않는다.
- "월간 / 연간 전환" -> `segmented-control`을 우선 검토한다.
- "콘텐츠 탭 5개 이상 전환" -> `tab + fluid`를 추천한다.
- "송금 금액 입력" -> `amount-top + keypad`를 우선 추천한다.
- "수량 조절" -> `numeric-spinner`를 우선 추천한다. `slider`는 기본값이 아니다.
- "작업 완료 알림" -> `toast`를 우선 추천한다.
- "성공/실패 전체 화면" -> `result`를 추천한다.
- "404/500 오류 화면" -> `error-page`를 추천한다.
- "FAQ 펼침 목록" -> `board-row`를 추천한다.
- "상단 네비게이션" -> `navbar`를 추천하되 export-gap note를 반드시 붙인다.
- "막대 차트" -> `chart`를 추천하되 docs slug alias note를 반드시 붙인다. (`Chart/bar-chart`)
- "단계형 진행 UI" -> `stepper-row`를 추천하되 docs slug alias note를 반드시 붙인다. (`stepper`)
