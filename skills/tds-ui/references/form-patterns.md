# Form Patterns

이 파일은 입력/선택 계열 canonical leaf를 고르는 routing note다.

## Canonical leaf docs

- `text-field`: `generated/llms-full.txt`에서 `# TextField` section
- `search-field`: `generated/llms-full.txt`에서 `# SearchField` section
- `checkbox`: `generated/llms-full.txt`에서 `# Checkbox` section
- `radio`: `generated/llms-full.txt`에서 `# Radio` section
- `segmented-control`: `generated/llms-full.txt`에서 `# SegmentedControl` section
- `switch`: `generated/llms-full.txt`에서 `# Switch` section
- `tab`: `generated/llms-full.txt`에서 `# Tab` section
- `dropdown`: `generated/llms-full.txt`에서 `# Dropdown` section
- `numeric-spinner`: `generated/llms-full.txt`에서 `# Numeric Spinner` section
- `keypad`: `generated/llms-full.txt`에서 `# NumberKeypad` section
- `slider`: `generated/llms-full.txt`에서 `# Slider` section
- `rating`: `generated/llms-full.txt`에서 `# Rating` section

## text-field vs search-field

- 둘 다 leaf docs를 읽고 목적이 검색인지 일반 입력인지 먼저 분리한다.
- "검색어 입력 후 목록 필터링"은 `search-field` 단독이 아니라 `search-field + list + list-row` 조합을 우선 검토한다.

## checkbox vs switch

- 둘 다 leaf docs를 읽고 다중 선택인지 즉시 반영 토글인지 먼저 분리한다.
- 알림 설정 on/off는 `switch`를 우선 검토한다.

## radio vs segmented-control vs tab

- 세 leaf docs를 읽고 목록형 단일 선택 / 압축된 짧은 필터 / 콘텐츠 섹션 전환을 구분한다.
- 탭이 5개 이상이거나 라벨이 길면 `tab + fluid` examples를 우선 확인한다.

## numeric-spinner vs keypad vs slider

- 세 leaf docs를 읽고 정수 증감 / 숫자 패드 입력 / 연속 값 조절을 구분한다.
- 송금 금액 입력은 `amount-top + keypad` 조합을 우선 검토한다.

## controlled / uncontrolled

- prop shape는 `generated/llms-full.txt` interface section으로 확인한다.
- `value` / `onChange`, `checked` / `onCheckedChange`, `onValueChange`가 보이면 controlled 패턴이다.
- `defaultValue`, `defaultChecked`가 보이면 uncontrolled 패턴이다.
- 상태가 외부 폼/validation/store와 연결되면 controlled를 우선하고, 초기값만 필요하면 uncontrolled를 허용한다.
