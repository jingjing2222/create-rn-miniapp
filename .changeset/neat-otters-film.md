---
"create-rn-miniapp": patch
"@create-rn-miniapp/scaffold-templates": patch
---

generator 내부 구조를 `create`와 `add` 흐름 중심으로 다시 정리했습니다.

- CLI 진입점에서 `create`와 `add` coordinator로 바로 분기되도록 바꿨습니다.
- top-level에 흩어져 있던 runtime, workspace, server, skills 관련 모듈을 역할별 디렉토리로 재배치했습니다.
- 구조 회귀를 막기 위해 flow 가시성과 import surface를 검증하는 테스트를 강화했습니다.
