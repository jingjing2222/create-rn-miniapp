# screen archetypes

## 먼저 archetype을 고른다

- list: 검색, 필터, 정렬, 페이지네이션, row action이 중심일 때
- detail: 단일 레코드 요약, 상태 확인, 이력 확인이 중심일 때
- form: 생성/수정 draft와 validation이 중심일 때
- dashboard: 여러 card/widget을 한 화면에서 같이 비교할 때
- bulk-action: 목록 선택, 일괄 실행, confirm/report가 핵심일 때

## default 구조

- list: `Screen -> QueryBar -> ResultTable -> RowAction`
- detail: `Screen -> SummarySection -> RelatedPanels -> ActionBar`
- form: `Screen -> FormSections -> SubmitBar`
- dashboard: `Screen -> SharedFilters -> IndependentCards`
- bulk-action: `Screen -> QueryBar -> ResultTable -> BulkToolbar -> ConfirmFlow`

## archetype 선택 기준

- "행을 찾고 일부만 처리"가 먼저면 `list` 또는 `bulk-action`
- "한 건을 읽고 판단"이 먼저면 `detail`
- "draft를 만들고 제출"이 먼저면 `form`
- "여러 지표를 같이 본다"가 먼저면 `dashboard`
- list 안에 bulk action이 들어가면 `bulk-action`을 주 archetype으로 잡고 row action은 보조로 둔다

## 대안이 아닌 경우

- list를 form처럼 쓰지 않는다. draft field가 늘어나면 form으로 분리한다.
- detail에서 edit state를 오래 들고 있지 않는다. edit가 핵심이면 form route 또는 modal boundary로 분리한다.
- dashboard에서 table 수준 상호작용이 커지면 list 화면으로 쪼갠다.
