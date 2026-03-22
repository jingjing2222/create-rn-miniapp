# Layout And Navigation

## list baseline

- 기본 리스트 화면은 `list + list-row`를 baseline으로 둔다.
- 섹션 제목/보조설명은 `list-header`, 확장/더보기는 `list-footer`를 붙인다.
- key/value summary는 `table-row`를 우선한다.

## accordion, grid, steps

- FAQ 펼침 목록은 `board-row`를 고른다.
- 카드나 아이콘 메뉴 grid는 `grid-list`를 고른다.
- 단계 흐름과 절차 요약은 `stepper-row`를 우선하되 docs slug alias note를 붙인다.

## top and bottom boundaries

- 상단 네비게이션은 `navbar`를 추천하되 import gap anomaly를 같이 적는다.
- 큰 금액 요약은 `amount-top`을 먼저 검토한다.
- 하단 안내/법적 문구는 `bottom-info`를 먼저 검토하고, 긴 공지/본문은 `post`로 보낸다.

## comparisons

- `list-row`는 탐색/설정/메뉴성 행에 맞다.
- `table-row`는 2열 정보 요약에 맞다.
- `bottom-info`는 하단 주의/법적 고지에 맞고, `post`는 장문 설명에 맞다.
