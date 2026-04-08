# Layout And Navigation

이 파일은 list / layout / boundary 계열 canonical leaf를 고르는 routing note다.

## Canonical leaf docs

- `list`: `generated/llms-full.txt`에서 `# List` section
- `list-row`: `generated/llms-full.txt`에서 `# ListRow` section
- `list-header`: `generated/llms-full.txt`에서 `# ListHeader` section
- `list-footer`: `generated/llms-full.txt`에서 `# ListFooter` section
- `table-row`: `generated/llms-full.txt`에서 `# TableRow` section
- `grid-list`: `generated/llms-full.txt`에서 `# GridList` section
- `board-row`: `generated/llms-full.txt`에서 `# Board Row` section
- `stepper-row`: canonical docs section은 `generated/llms-full.txt`의 `# Stepper`
- `navbar`: docs section은 `generated/llms-full.txt`의 `# Navbar`, import path gap은 anomaly overlay를 추가로 읽는다.
- `amount-top`: `generated/llms-full.txt`에서 `# AmountTop` section
- `bottom-info`: `generated/llms-full.txt`에서 `# Bottom Info` section
- `post`: `generated/llms-full.txt`에서 `# Post` section

## accordion, grid, steps

- FAQ 펼침 목록은 `board-row` leaf를 읽는다.
- 카드나 아이콘 메뉴 grid는 `grid-list` leaf를 읽는다.
- 단계 흐름과 절차 요약은 `Stepper` leaf를 읽고 docs slug alias note를 붙인다.

## top and bottom boundaries

- 상단 네비게이션은 `navbar` leaf를 읽고 import gap anomaly를 같이 적는다.
- 큰 금액 요약은 `amount-top` leaf를 먼저 읽는다.
- 하단 안내/법적 문구는 `bottom-info`, 긴 공지/본문은 `post` leaf를 각각 읽는다.

## comparisons

- `list-row` vs `table-row`: 탐색/설정 행인지 2열 요약인지 docs examples를 기준으로 구분한다.
- `bottom-info` vs `post`: 하단 주의/법적 고지인지 장문 설명인지 docs examples를 기준으로 구분한다.
