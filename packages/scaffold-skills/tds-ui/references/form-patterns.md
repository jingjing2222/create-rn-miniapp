# Form Patterns

## text-field vs search-field

- 검색이 목적이면 `search-field`를 고른다.
- 자유 입력, 포맷팅, helper/error, suffix/prefix가 필요하면 `text-field`를 고른다.
- "검색어 입력 후 목록 필터링"은 `search-field` 단독이 아니라 `search-field + list + list-row` 조합을 우선 추천한다.

## checkbox vs switch

- 여러 독립 yes/no 선택 또는 약관 목록이면 `checkbox`를 고른다.
- 즉시 반영되는 설정 on/off면 `switch`를 고른다.
- 알림 설정 on/off는 `switch`가 기본이다. `checkbox`는 아니다.

## radio vs segmented-control vs tab

- 목록형 단일 선택이면 `radio`를 고른다.
- 2~4개 정도의 짧은 필터/압축된 단일 선택이면 `segmented-control`을 먼저 본다.
- 콘텐츠 섹션 자체를 바꾸는 경우는 `tab`이다.
- 탭이 5개 이상이거나 라벨이 길면 `tab + fluid`를 기본 검토한다.

## numeric-spinner vs keypad vs slider

- 정수 수량 증감이면 `numeric-spinner`가 기본이다.
- 금액/PIN/전화번호처럼 숫자 패드 입력이면 `keypad`를 고른다.
- 연속 값 조절이면 `slider`를 쓴다.
- 송금 금액 입력은 `amount-top + keypad` 조합을 우선 추천한다.

## controlled / uncontrolled

- `value` / `onChange`, `checked` / `onCheckedChange`, `onValueChange`가 보이면 controlled 패턴이다.
- `defaultValue`, `defaultChecked`가 보이면 uncontrolled 패턴이다.
- 상태가 외부 폼/validation/store와 연결되면 controlled를 우선한다.
- 초기값만 필요하고 local interaction으로 충분하면 uncontrolled를 허용한다.
