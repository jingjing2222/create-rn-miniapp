---
impact: high
tags:
  - tds-ui
  - decision
  - docs
incorrect:
  - "문서가 없는 export-only 항목을 기본 추천한다."
correct:
  - "먼저 doc-backed 후보를 고르고 anomaly는 note로 분리한다."
reference:
  - docs-search
  - generated/anomalies.json
  - references/decision-matrix.md
---

# Doc Backed First

## Incorrect

```md
추천 컴포넌트: agreement
선택 이유: 동의가 필요하니 agreement를 기본으로 쓴다.
```

## Correct

```md
추천 컴포넌트: checkbox
선택 이유: docs-backed 다중 동의 패턴이다.
anomaly note: agreement는 export-only / docs-missing이므로 명시 요구가 없으면 기본 추천하지 않는다.
```
