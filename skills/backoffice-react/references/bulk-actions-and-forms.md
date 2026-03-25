# bulk actions and forms

## bulk action default

- bulk selection은 list state에 두고 table row component로 퍼뜨리지 않는다.
- filter/search/pagination/sort가 바뀌면 selection reset 규칙을 먼저 선언한다.
- bulk action은 `선택 -> confirm -> execute -> result` 단계를 분리한다.
- CSV export는 현재 query 결과를 기준으로 하고, 임의 local array를 다시 만들지 않는다.

## form default

- create/edit form draft는 form state가 소유한다.
- submit 중 disabled 상태와 validation error는 분리한다.
- server error와 client validation error를 같은 문자열 하나로 뭉개지 않는다.
- optimistic UI는 remote reconciliation 전략이 없으면 기본값으로 쓰지 않는다.

## confirm flow

- destructive action은 selected count, 대상 scope, rollback 불가 여부를 confirm에서 다시 보여준다.
- confirm 전에 필요한 permission check를 끝낸다.
- 실행 후 result 상태를 table refresh와 섞지 않는다.
