---
impact: high
tags:
  - tds-ui
  - navbar
  - import
incorrect:
  - "navbar를 일반 root export처럼 적고 import path를 생략한다."
correct:
  - "catalog의 rootImportPath를 적고 export gap note를 남긴다."
reference:
  - generated/catalog.json
  - references/export-gaps.md
---

# Navbar Import Gap

## Incorrect

```md
추천 컴포넌트: navbar
root export module: @toss/tds-react-native
```

## Correct

```md
추천 컴포넌트: navbar
root export module: @toss/tds-react-native/extensions/page-navbar
anomaly note: docs-backed but import path differs from the package root export
```
