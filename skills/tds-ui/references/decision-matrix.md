# tds-ui Decision Matrix

이 문서는 bundled `generated/llms.txt` / `generated/llms-full.txt`로 진입하기 위한 routing overlay다.
컴포넌트 설명의 canonical source는 local `llms` snapshot이며, 이 파일은 "어느 section을 찾아야 하는지"와 "어떤 비교를 해야 하는지"만 빠르게 상기시키는 용도다.

## Canonical entry

- bundled index: `generated/llms.txt`
- bundled full dump: `generated/llms-full.txt`
- upstream refresh source는 `metadata.json`의 `upstreamSources`를 본다.
- `generated/llms-full.txt`에서 heading search로 section을 찾는다.
- canonical section heading pattern:
  - component: `# <Name> (/tds-react-native/components/<slug>/)`
  - foundation: `# Colors (/tds-react-native/foundation/colors/)`, `# Typography (/tds-react-native/foundation/typography/)`
  - start / migration: `# Start (/tds-react-native/start/)`, `# @toss-design-system에서 마이그레이션 (/tds-react-native/migration/from-toss-design-system/)`

## Input choice

- `TextField`, `SearchField`, `Checkbox`, `Radio`, `SegmentedControl`, `Switch`, `Tab`, `Dropdown`, `NumericSpinner`, `NumberKeypad`, `Slider`, `Rating` section heading을 먼저 찾는다.
- 후보가 둘 이상이면 `generated/llms-full.txt`에서 examples + interface를 같이 읽고 비교한다.
- foundation token 질문이 붙으면 Colors / Typography leaf를 같이 읽는다.

## Actions and feedback

- `Button`, `TextButton`, `IconButton`, `Dialog`, `Toast`, `Loader`, `Skeleton`, `ProgressBar`, `Result`, `ErrorPage` section heading을 먼저 찾는다.
- blocking / non-blocking / page-level result 구분은 official docs examples를 기준으로 한다.
- loading surface는 `Loader`와 `Skeleton` 중 무엇이 실제 레이아웃 placeholder인지 구분해서 읽는다.

## List, layout, and navigation

- `List`, `ListRow`, `ListHeader`, `ListFooter`, `TableRow`, `GridList`, `BoardRow`, `Stepper`, `Navbar`, `AmountTop`, `BottomInfo`, `Post` section heading을 먼저 찾는다.
- `Stepper`는 skill id가 `stepper-row`여도 canonical docs leaf는 `stepper`다.
- `Navbar`는 docs leaf는 canonical이지만 import path는 anomaly overlay를 추가로 읽는다.

## Content and display

- `Asset`, `Badge`, `Carousel`, `BarChart`, `Highlight`, `Border`, `Gradient`, `Shadow` section heading을 먼저 찾는다.
- `BarChart`는 skill id가 `chart`여도 canonical docs leaf는 `Chart/bar-chart`다.
- visual utility를 고를 때 색상/타이포 토큰이 섞이면 foundation leaf를 같이 읽는다.

## Local-only overlay

- public docs에서 설명하지 않는 export-only surface는 `generated/anomalies.json`으로만 다룬다.
- `agreement`, `bottom-cta`, `bottom-sheet`, `fixed-bottom-cta`, `icon`, `tooltip`, `top`, `txt`는 docs-missing gate를 유지한다.
- `paragraph`는 weak evidence라 기본 추천에서 제외한다.
