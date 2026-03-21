# Feedback And Loading

## actions

- 기본 액션은 `button`이다.
- 약한 링크성 액션은 `text-button`이다.
- icon-only compact action은 `icon-button`이다.

## blocking vs non-blocking feedback

- 짧은 완료/복사/저장 안내는 `toast`를 고른다.
- 결정을 멈춰 세우는 확인/경고는 `dialog`를 고른다.
- 성공/실패 전체 화면은 `result`를 고른다.
- 404/500 같은 상태 코드는 `error-page`를 고른다.

## loading

- 순수 대기 상태는 `loader`를 쓴다.
- 곧 같은 레이아웃이 나타날 placeholder는 `skeleton`을 쓴다.
- 퍼센트나 진행량이 있으면 `progress-bar`를 쓴다.

## answer reminders

- loading, error, empty, disabled, a11y를 항상 같이 적는다.
- 버튼류는 loading과 disabled 동작을 같이 설계한다.
