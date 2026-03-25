# gotchas

- query params를 바꿨는데 old selection이 남아 bulk action 대상이 꼬인다.
- API 응답을 그대로 JSX에서 조합해서 label/date/permission 로직이 흩어진다.
- `useEffect`로 form default를 계속 덮어써서 user draft가 사라진다.
- empty/loading/error를 하나의 boolean으로 뭉개서 disabled 이유를 설명하지 못한다.
- confirm modal이 실제 selected scope를 다시 계산하지 않아 stale action이 된다.
- optimistic UI를 넣었는데 실패 시 rollback source가 없다.
- chart, editor, CSV library를 첫 paint에 실어 놓고 lazy boundary를 안 둔다.
