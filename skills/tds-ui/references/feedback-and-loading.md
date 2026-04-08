# Feedback And Loading

이 파일은 action / feedback 계열 canonical leaf를 고르는 routing note다.

## Canonical leaf docs

- `button`: `generated/llms-full.txt`에서 `# Button` section
- `text-button`: `generated/llms-full.txt`에서 `# Text Button` section
- `icon-button`: `generated/llms-full.txt`에서 `# Icon Button` section
- `dialog`: `generated/llms-full.txt`에서 `# Dialog` section
- `toast`: `generated/llms-full.txt`에서 `# Toast` section
- `loader`: `generated/llms-full.txt`에서 `# Loader` section
- `skeleton`: `generated/llms-full.txt`에서 `# Skeleton` section
- `progress-bar`: `generated/llms-full.txt`에서 `# ProgressBar` section
- `result`: `generated/llms-full.txt`에서 `# Result` section
- `error-page`: `generated/llms-full.txt`에서 `# ErrorPage` section

## Comparison prompts

- `button` vs `text-button` vs `icon-button`: emphasis, icon-only affordance, disabled/loading behavior를 비교한다.
- `dialog` vs `toast` vs `result` vs `error-page`: blocking 여부, page-level 결과 여부, status-code semantics 여부를 비교한다.
- `loader` vs `skeleton`: 실제 콘텐츠를 대체하는 placeholder인지 단순 대기 스피너인지 비교한다.
- `progress-bar`: 수치형 진행률이 있을 때만 leaf docs를 추가로 읽는다.

## answer reminders

- loading, error, empty, disabled, a11y를 항상 같이 적는다.
- 버튼류는 loading과 disabled 동작을 같이 설계한다.
