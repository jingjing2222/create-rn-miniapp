# Export Gaps

- `chart`의 docs slug는 `Chart/bar-chart`다.
- `stepper-row`의 docs slug는 `stepper`다.
- `navbar`는 docs leaf page가 있지만 package root export 경로가 다르다.
- public docs 없는 root export는 `agreement`, `bottom-cta`, `bottom-sheet`, `fixed-bottom-cta`, `icon`, `tooltip`, `top`, `txt`다.
- `paragraph`는 component dir만 있고 root export와 public docs 둘 다 약하다.

## Required handling

- alias는 component 이름을 유지하고 docs slug만 바꿔 적는다.
- `navbar`는 docs-backed지만 import path anomaly note를 남긴다.
- export-only 항목은 gate하고 doc-backed fallback을 같이 적는다.
- `paragraph`는 기본 추천에서 제외한다.
