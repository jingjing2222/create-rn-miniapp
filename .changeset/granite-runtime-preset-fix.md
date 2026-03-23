---
'create-rn-miniapp': patch
'@create-rn-miniapp/scaffold-templates': patch
---

AppInToss runtime build가 Granite 설정 파일을 `.granite/.ait-runtime-*.config.ts`로 복사해 실행할 때도 frontend scaffold preset을 안정적으로 읽도록 수정했습니다. generated `granite.config.ts`가 상대 import 대신 `process.cwd()` 기준 preset loader를 사용하도록 바꾸고, 관련 회귀 테스트를 추가했습니다.
