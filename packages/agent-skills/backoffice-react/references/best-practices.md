# backoffice React best practices

이 문서는 backoffice를 수정할 때 가장 먼저 보는 React 작업 기준이에요.
기준 스택은 `Vite + React + TypeScript`이고, Vercel의 `react-best-practices`를 참고해 우리 backoffice에 필요한 내용만 다시 정리했어요.

원문 참고:
- Vercel Labs agent skills `react-best-practices`
  - <https://github.com/vercel-labs/agent-skills/tree/main/skills/react-best-practices>

## 이 문서를 언제 보면 좋은가요
- backoffice 화면을 새로 만들거나 크게 고칠 때
- 상태가 늘어나면서 `useEffect`가 많아지기 시작할 때
- 테이블, 검색, 필터, 폼 때문에 렌더링 비용이 커질 때
- 번들 크기나 초기 로딩이 무거워졌다고 느껴질 때

## 현재 스택 기준선
- `backoffice`는 `Vite + React + TypeScript` workspace예요.
- 데이터 호출, 폼, 테이블, 운영 도구 UI처럼 브라우저 중심 화면을 다룬다고 가정해요.
- 서버 전용 React 규칙보다, 클라이언트 상태와 렌더링 비용 관리가 더 중요해요.

## 1. 상태는 가능한 한 가까운 곳에 둬요
- 화면 전체가 아니라 실제로 쓰는 컴포넌트 근처에 상태를 둬요.
- 한 번만 계산하면 되는 값은 state로 복제하지 말고 render 중에 derive해요.
- event handler에서 처리할 수 있는 동작을 `useEffect`로 옮기지 말아요.
- 임시 값이나 렌더링과 무관한 값은 `useRef`를 먼저 고려해요.

예시:
- 검색어, 페이지 번호, 정렬은 목록 화면 근처 state로 둬요.
- `filteredItems`, `isEmpty`, `selectedCount` 같은 값은 파생 계산으로 처리해요.

## 2. `useEffect`는 동기화에만 써요
- 외부 시스템과 동기화할 때만 `useEffect`를 써요.
- props를 받아 다른 state를 다시 세팅하는 패턴은 먼저 구조를 의심해요.
- fetch 시작, interval 등록, DOM API 연동처럼 side effect가 분명할 때만 써요.
- effect 안에서 state를 연쇄적으로 바꾸면 waterfall이 생기기 쉬워요.

## 3. 비동기 흐름은 waterfall을 줄여요
- 서로 독립적인 요청은 병렬로 보내요.
- 화면 전환을 막지 않아도 되는 갱신은 `startTransition`을 고려해요.
- 입력값이 빠르게 바뀌는 검색/필터 UI는 `useDeferredValue`를 고려해요.
- 한 컴포넌트에서 모든 요청을 직렬로 처리하지 말고, boundary를 나눠요.

예시:
- 대시보드 카드 4개를 순차 fetch하지 말고 같이 시작해요.
- 검색 input의 즉시 반응과 결과 리스트 갱신 우선순위를 분리해요.

## 4. 렌더링 비용이 큰 화면은 경계를 분리해요
- 무거운 테이블, 차트, 폼 섹션은 별도 컴포넌트로 나눠요.
- 행(row) 하나가 무겁다면 row 컴포넌트를 따로 빼고 props를 단순하게 유지해요.
- 큰 리스트는 virtualization이나 점진 렌더링을 고려해요.
- render마다 새 함수/객체를 무조건 막을 필요는 없지만, 실제 병목이 보이면 경계를 분리해요.

체크 포인트:
- 정렬/필터를 바꿀 때 페이지 전체가 다시 느려지지 않는가
- 모달 하나 열었는데 테이블 전체가 다시 그려지지 않는가
- 차트와 테이블이 서로의 state 변경에 같이 흔들리지 않는가

## 5. 번들은 필요한 만큼만 실어요
- backoffice에서만 쓰는 무거운 라이브러리는 lazy import를 고려해요.
- 대형 차트, 에디터, 파일 처리 라이브러리는 화면 진입 시점까지 미뤄요.
- barrel import보다 실제 쓰는 경로 import가 더 명확하면 직접 가져와요.
- 공통 유틸이라고 해서 초기 진입 번들에 다 넣지 말고, 사용 화면 기준으로 나눠요.

## 6. 폼은 입력과 검증 흐름을 단순하게 유지해요
- 입력값, 검증 결과, submit 상태를 서로 다른 책임으로 나눠요.
- blur/change/submit 검증 타이밍을 섞지 말고 화면 기준으로 명확히 정해요.
- 서버 검증 오류와 클라이언트 검증 오류를 같은 state에 뒤섞지 말아요.
- optimistic update가 필요 없으면 먼저 명시적 submit 흐름을 유지해요.

## 7. 데이터 모델과 화면 모델을 섞지 말아요
- API 응답 원본을 그대로 JSX에서 조합하지 말고, 화면용 모델로 한 번 정리해요.
- 날짜 포맷, 상태 라벨, 배지 색상 같은 표현 로직은 render 안에 흩뿌리지 말아요.
- 화면에서 반복되는 매핑은 selector나 adapter 함수로 올려요.

## 8. 테이블과 검색 화면은 특히 보수적으로 봐요
- 필터 state, query params, 서버 요청 파라미터를 같은 이름으로 맞춰요.
- 페이지네이션과 검색 조건이 엇갈리지 않게 source of truth를 하나만 둬요.
- 선택 상태와 데이터 새로고침이 충돌하면 선택 초기화 규칙을 먼저 정해요.
- CSV 다운로드, 대량 작업, 일괄 선택은 별도 경계로 분리해요.

## 9. PR 올리기 전 최소 체크리스트
- state로 들고 있는 값 중 render에서 계산 가능한 값이 없는가
- `useEffect`가 이벤트 처리나 파생 상태 계산을 대신하고 있지 않은가
- 독립 요청을 괜히 직렬로 보내고 있지 않은가
- 큰 화면에서 무거운 컴포넌트 경계가 없는가
- 불필요하게 큰 의존성을 초기 번들에 실고 있지 않은가
- 폼 오류 상태와 submit 상태가 뒤섞여 있지 않은가

## 이 문서에서 일부러 다루지 않는 것
- Next.js Server Components 전용 규칙
- Server Actions 전용 규칙
- SSR/streaming 최적화
- React Native 전용 규칙

이 항목들은 backoffice 현재 기준과 거리가 있어서 제외했어요.
필요하면 별도 문서로 추가해요.
