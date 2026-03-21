---
"create-rn-miniapp": patch
"@create-rn-miniapp/scaffold-templates": patch
"@create-rn-miniapp/scaffold-skills": patch
---

`tds-ui`를 self-contained decision skill로 다시 정리하고, generated catalog/anomaly/reference/rules를 패키지 안에서 닫아 공개 문서와 실제 export 차이를 일관되게 다루도록 맞췄습니다.

또한 generated repo의 `.agents/skills/tds-ui`가 오래된 snapshot이면 최신 package/docs를 다시 읽어 `catalog.json`, `anomalies.json`, `catalog.md`, `AGENTS.md`, `metadata.json`을 자동으로 갱신하는 self-refresh hook을 추가했습니다. refresh는 malformed output만 막고, 네트워크나 파싱 실패가 나면 warning만 남기고 기존 snapshot으로 계속 진행합니다.

`create-rn-miniapp`은 이 refresh hook과 회귀 테스트를 생성물에 함께 복사하도록 갱신했고, 현재 npm dist-tag 상태에서는 `latest`가 아직 `1.x`일 때만 `@toss/tds-react-native@2.0.2`를 예외로 선택하고 `latest`가 `2.x` 이상이면 그대로 최신 버전을 따르도록 맞췄습니다.

이번 변경 묶음은 생성물 안내 계약과 skill scaffold 결과를 같이 맞추기 위해 `@create-rn-miniapp/scaffold-templates`도 함께 patch로 올립니다.
