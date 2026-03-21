---
"create-rn-miniapp": patch
"@create-rn-miniapp/scaffold-templates": patch
"@create-rn-miniapp/scaffold-skills": patch
---

`tds-ui`를 self-contained decision skill 구조로 다시 정리하고, generated catalog/anomaly/reference/rules를 패키지 안에서 닫아 공개 문서와 실제 export 차이를 일관되게 다루도록 맞췄습니다.

`create-rn-miniapp`은 새 `tds-ui` truth source를 따라 생성물과 회귀 테스트를 갱신했고, 루트 README도 MiniApp에 필요한 Skill, `--help` 중심 옵션 안내, `nx`/`biome` 기반 verify 흐름이 먼저 읽히도록 다시 썼습니다.

이번 변경 묶음은 생성물 안내 계약과 배포 버전을 같이 맞추기 위해 `@create-rn-miniapp/scaffold-templates`도 함께 patch로 올립니다.
