---
"create-rn-miniapp": patch
"@create-rn-miniapp/scaffold-templates": patch
---

Apps-in-Toss 공식 skill 연동을 기본 흐름으로 정리하고, 로컬 skill 구성을 중복 없이 단순화했습니다.

- 스캐폴딩 시 `docs-search`, `project-validator`를 항상 추천하고 source repo별로 함께 설치할 수 있게 정리했습니다.
- 로컬 capability mirror skill인 `miniapp-capabilities`를 제거하고, `tds-ui`를 문서 snapshot 대신 anomaly/rule overlay 중심으로 재구성했습니다.
- README와 generated onboarding 문서를 새 skill 설치 계약에 맞게 맞추고, 관련 renderer와 테스트의 source of truth를 정리했습니다.
