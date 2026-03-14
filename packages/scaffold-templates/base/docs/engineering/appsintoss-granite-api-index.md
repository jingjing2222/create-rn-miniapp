# Apps-in-Toss / Granite API Index (Quick)

빠르게 API 후보를 찾기 위한 첫 인덱스입니다.

- 마지막 업데이트: 2026-03-14
- 참조 원칙: 공식 문서만 사용한다. (`granite.run`, `developers-apps-in-toss.toss.im`)
- 역할: "어디서 무엇을 찾아야 하는지"를 빠르게 안내한다.
- 비역할: 라우팅 규칙이나 페이지 구조 규칙을 정의하지 않는다. 그런 기준은 `granite-ssot.md`가 담당한다.

## Quick Start

1. 먼저 이 문서에서 기능 카테고리와 후보 API를 찾는다.
2. 더 넓은 탐색이 필요하면 `appsintoss-granite-full-api-index.md`를 본다.
3. 최종 구현 전에는 링크된 공식 문서에서 시그니처, 권한, 플랫폼 제약을 다시 확인한다.
4. 라우팅이나 페이지 구조를 바꾸면 `granite-ssot.md`를 함께 확인한다.

## Essential Links

- AppInToss React Native tutorial: https://developers-apps-in-toss.toss.im/tutorials/react-native.html
- Granite RN Reference (KR): https://www.granite.run/ko/reference/react-native/
- Granite `defineConfig`: https://www.granite.run/reference/react-native/config/defineConfig.html
- Apps-in-Toss Framework Overview: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/시작하기/overview
- Apps-in-Toss Full LLM export: https://developers-apps-in-toss.toss.im/llms-full.txt
- Full index: `./appsintoss-granite-full-api-index.md`
- Routing and page rules: `./granite-ssot.md`

## Granite 우선 API

- `defineConfig`: https://www.granite.run/reference/react-native/config/defineConfig.html
- `useVisibilityChange`: https://www.granite.run/ko/reference/react-native/screen-control/useVisibilityChange.html
- `Video`: https://www.granite.run/ko/reference/react-native/ui/Video.html
- `ScrollViewInertialBackground`: https://www.granite.run/ko/reference/react-native/ui/ScrollViewInertialBackground.html

## Category → APIs

### 화면 이동/제어
- `routing`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/화면%20이동/routing
- `openURL`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/화면%20이동/openURL
- `closeView`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/화면%20제어/closeView
- `useBackEvent`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/화면%20제어/useBackEvent

### 환경 확인
- `getPlatformOS`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/환경%20확인/getPlatformOS
- `getTossAppVersion`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/환경%20확인/getTossAppVersion
- `isMinVersionSupported`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/환경%20확인/isMinVersionSupported
- `getSchemeUri`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/환경%20확인/getSchemeUri

### 권한/보안
- `permission`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/권한/permission
- `setSecureScreen`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/화면%20제어/setSecureScreen

### 위치/저장소/네트워크
- `getCurrentLocation`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/위치%20정보/getCurrentLocation
- `startUpdateLocation`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/위치%20정보/startUpdateLocation
- `useGeolocation`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/위치%20정보/useGeolocation
- `http`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/네트워크/http
- `Storage`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/저장소/Storage

### 공유/성장
- `share`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/공유/share
- `getTossShareLink`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/공유/getTossShareLink
- `contactsViral`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/친구초대/contactsViral

### 분석/광고/결제
- `Analytics`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/분석/Analytics
- `IntegratedAd`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/광고/IntegratedAd
- `IAP`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/인앱%20결제/IAP
- `TossPay`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/토스페이/TossPay

## Notes

- 이 문서는 구현 결정을 위한 첫 인덱스다.
- 더 자세한 카탈로그와 실무 메모는 `appsintoss-granite-full-api-index.md`가 담당한다.
- 최종 계약은 공식 원문이 기준이다.
- 로컬 생성 파일이나 패키지 내부 경로를 근거로 문서화하지 않는다.
