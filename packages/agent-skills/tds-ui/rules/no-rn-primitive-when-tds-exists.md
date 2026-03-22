---
impact: high
tags:
  - tds-ui
  - react-native
incorrect:
  - "TDS 대체제가 있는데 RN primitive를 직접 추천한다."
correct:
  - "동일 목적의 TDS component를 먼저 고르고 primitive를 피한다."
reference:
  - references/policy-summary.md
  - references/decision-matrix.md
---

# No RN Primitive When TDS Exists

## Incorrect

```md
추천 컴포넌트: TextInput
```

## Correct

```md
추천 컴포넌트: text-field
가장 가까운 대안과 왜 아닌지: RN TextInput보다 TDS text-field가 docs-backed form surface다.
```
