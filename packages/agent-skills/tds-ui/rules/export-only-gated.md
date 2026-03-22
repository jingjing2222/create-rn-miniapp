---
impact: high
tags:
  - tds-ui
  - export-only
incorrect:
  - "근거 없이 export-only component를 기본 추천한다."
correct:
  - "명시 요구나 기존 코드 근거가 있을 때만 추천하고 fallback을 함께 적는다."
reference:
  - generated/anomalies.json
  - references/export-gaps.md
---

# Export Only Gated

## Incorrect

```md
추천 컴포넌트: bottom-sheet
선택 이유: sheet가 필요해 보인다.
```

## Correct

```md
추천 컴포넌트: dialog
가장 가까운 대안과 왜 아닌지: bottom-sheet는 export-only / docs-missing이라 기본 추천하지 않는다.
anomaly note: 기존 코드베이스에서 이미 bottom-sheet를 쓰는 경우에만 gate 해제
```
