---
impact: high
tags:
  - tds-ui
  - states
incorrect:
  - "컴포넌트 추천만 쓰고 loading/error/empty를 빼먹는다."
correct:
  - "answer에 loading, error, empty, disabled, a11y를 항상 붙인다."
reference:
  - references/feedback-and-loading.md
  - references/policy-summary.md
---

# Screen States Loading Error Empty

## Incorrect

```md
추천 컴포넌트: search-field + list + list-row
```

## Correct

```md
추천 컴포넌트: search-field + list + list-row
loading / error / empty / disabled / a11y 체크: 검색 중 skeleton, 실패 시 error-page 또는 inline 안내, 결과 없음 empty copy, disabled action, clear/search affordance 라벨
```
