---
impact: high
tags:
  - tds-ui
  - state
incorrect:
  - "문서 상태 모델을 무시하고 value/defaultValue를 섞는다."
correct:
  - "controlled와 uncontrolled를 분리해서 적고 선택 이유를 남긴다."
reference:
  - generated/llms.txt
  - generated/llms-full.txt
  - references/form-patterns.md
---

# State Controlled Uncontrolled

## Incorrect

```md
추천 컴포넌트: tab
state pattern: 아무거나 써도 된다.
```

## Correct

```md
추천 컴포넌트: tab
controlled / uncontrolled 패턴: 외부 상태 동기화가 필요하면 value/onChange, 초기값만 필요하면 defaultValue
```
