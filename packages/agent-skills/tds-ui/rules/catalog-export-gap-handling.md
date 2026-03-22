---
impact: high
tags:
  - tds-ui
  - anomaly
  - docs
incorrect:
  - "docs slug alias나 import gap을 숨기고 일반 component처럼만 적는다."
correct:
  - "docs slug alias와 import gap을 answer output의 anomaly note에 적는다."
reference:
  - generated/anomalies.json
  - references/export-gaps.md
---

# Catalog Export Gap Handling

## Incorrect

```md
추천 컴포넌트: chart
docs URL: /components/chart/
```

## Correct

```md
추천 컴포넌트: chart
docs URL: /components/Chart/bar-chart/
anomaly note: docs slug alias (`chart` -> `Chart/bar-chart`)
```
