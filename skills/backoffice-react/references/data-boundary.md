# data boundary

## state ownership

- query params: search, filter, sort, pagination, tab처럼 새로고침/공유/뒤로가기와 같이 살아야 하는 값
- component state: modal open, row hover, panel toggle, local selection처럼 화면 내부에서만 의미가 있는 값
- form state: draft field, dirty, touched, client validation처럼 submit 전 편집 상태
- server state: fetch result, revalidation, mutation status

## source of truth rules

- 같은 의미를 query params와 component state에 동시에 들고 있지 않는다.
- table 결과 개수, empty 여부, selected count는 가능하면 derive한다.
- form default value는 loader/hook에서 한 번 정하고, render 중 다시 덮어쓰지 않는다.
- selection state는 현재 query key나 data source가 바뀌면 reset 규칙을 먼저 정한다.

## view model adapter

- API response -> view model adapter는 data hook 또는 loader 근처에 둔다.
- JSX 안에서 날짜 포맷, badge label, permission label을 매번 조합하지 않는다.
- server shape를 바꿔야 하면 `trpc-boundary` 또는 provider skill로 넘긴다.

## route-level 과 workspace-level 구분

- backoffice 화면 구조, state ownership, browser 상호작용은 이 skill이다.
- MiniApp route/page/navigation은 `granite-routing`이다.
- env, client linkage, backend drift는 provider skill이다.
