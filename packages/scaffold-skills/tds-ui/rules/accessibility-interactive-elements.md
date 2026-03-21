---
impact: medium
tags:
  - tds-ui
  - accessibility
incorrect:
  - "interactive element 추천에서 disabled/focus/label을 빼먹는다."
correct:
  - "touch target, disabled semantics, label, focus order를 같이 적는다."
reference:
  - references/feedback-and-loading.md
  - references/policy-summary.md
---

# Accessibility Interactive Elements

## Incorrect

```md
추천 컴포넌트: icon-button
```

## Correct

```md
추천 컴포넌트: icon-button
loading / error / empty / disabled / a11y 체크: accessible label, 충분한 touch target, disabled state 노출, icon-only affordance 보완
```
