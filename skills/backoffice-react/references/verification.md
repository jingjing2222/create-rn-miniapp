# verification

## validation loop

- loading, empty, error, disabled, permission denied 상태를 각각 본다.
- query params가 새로고침과 뒤로가기를 버티는지 본다.
- filter/search/sort/pagination 변경 뒤 selection reset이 기대대로 되는지 본다.
- form default, reset, submit success, submit failure를 각각 본다.
- CSV export, bulk action, confirm flow가 현재 query scope와 맞는지 본다.
- heavy dependency가 있다면 lazy boundary 전후 첫 진입과 재진입을 둘 다 본다.

## report

- 추천 archetype과 component boundary
- state ownership 표
- 가장 가까운 대안이 왜 아닌지
- 확인한 상태 전이와 재현 절차
- 다른 skill handoff 필요 여부
