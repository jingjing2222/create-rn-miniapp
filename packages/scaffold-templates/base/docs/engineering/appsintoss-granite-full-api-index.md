# Apps-in-Toss + Granite Full API Index (Maintainable Edition)

이 문서는 MiniApp 구현 시 참조하는 전체 API 카탈로그입니다.

- 마지막 업데이트: 2026-03-14
- 원칙:
  - 로컬 경로(`node_modules`, 임시 생성 JSON, 내부 스캔 결과)에 의존하지 않는다.
  - 공식 공개 문서만 source of truth로 사용한다.
  - 구현자는 본 문서에서 후보 API를 찾고, 링크된 원문에서 시그니처와 제약을 최종 확인한다.
- 네이티브 모듈 사용 제약은 `./native-modules-policy.md`를 따른다.
- 라우팅과 페이지 구조 규칙은 `./granite-ssot.md`를 따른다.

## 1) 이 문서를 언제 보나

1. 먼저 `appsintoss-granite-api-index.md`에서 빠르게 후보 API를 찾는다.
2. 빠른 인덱스로 부족하거나 더 넓은 카테고리를 탐색해야 하면 이 문서를 본다.
3. 구현 직전에는 반드시 공식 원문 링크를 다시 열어 시그니처, 권한, 플랫폼 제약을 확인한다.

## 2) Stable Official Sources

### Granite (React Native)
- Granite RN Reference (KR): https://www.granite.run/ko/reference/react-native/
- Granite RN Reference (EN): https://www.granite.run/reference/react-native/
- Granite GitHub: https://github.com/toss/granite
- Granite `defineConfig`: https://www.granite.run/reference/react-native/config/defineConfig.html
- Granite `useVisibilityChange`: https://www.granite.run/ko/reference/react-native/screen-control/useVisibilityChange.html
- Granite `Video`: https://www.granite.run/ko/reference/react-native/ui/Video.html
- Granite `ScrollViewInertialBackground`: https://www.granite.run/ko/reference/react-native/ui/ScrollViewInertialBackground.html

### Apps-in-Toss Framework
- React Native tutorial: https://developers-apps-in-toss.toss.im/tutorials/react-native.html
- Framework overview: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/시작하기/overview
- SDK 2.0.1 upgrade: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/시작하기/SDK2.0.1.html
- Routing: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/화면%20이동/routing
- Permissions: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/권한/permission
- Full LLM export: https://developers-apps-in-toss.toss.im/llms-full.txt

## 3) API Discovery Flow

1. 기능 요구사항을 분류한다.
   - 화면 이동
   - 환경 확인
   - 권한
   - 네트워크
   - 저장소
   - 위치
   - 공유
   - 분석
   - 광고
   - 결제
2. 본 문서의 카테고리에서 후보 API를 고른다.
3. 반드시 원문 링크에서 아래를 재확인한다.
   - 함수 시그니처
   - 플랫폼 제약(iOS, Android, WebView)
   - 권한 요구사항
   - 에러 타입과 예외 처리 방식
4. 구현 후 테스트 케이스에 권한 거부와 미지원 환경 시나리오를 포함한다.

## 4) SDK 2.x 정합성 체크

공식 가이드:
- https://developers-apps-in-toss.toss.im/bedrock/reference/framework/시작하기/SDK2.0.1.html

### 4.1 확인된 변경
- 빌드 커맨드: `granite build` → `ait build`
- 최신 React Native 계열 버전에 맞는 런타임과 타입 기반으로 움직인다.
- 의존성 구조: Granite 패키지와 React 계열 버전군이 재정렬됐다.

### 4.2 API 관점 정리
- 공식 SDK 2.0.1 가이드에는 함수별 SDK API 시그니처의 명시적 breaking list가 제공되지 않는다.
- 따라서 실무에서는 다음을 API 변경 리스크로 본다.
  1. RN 0.84와 React 19 전환으로 인한 타입과 런타임 동작 차이
  2. 빌드 체인 전환(`ait build`)에 따른 실행 환경 차이
  3. 패키지 재배치로 인한 import/export 경로 영향

### 4.3 React Native 프로젝트 적용 절차
1. `@apps-in-toss/framework`를 먼저 설치한다.
2. `ait init`으로 AppInToss 설정을 반영한다.
3. `ait build`로 빌드 검증을 한다.
4. 타입 오류와 런타임 경고를 수동 보정한다.
5. 최신 샌드박스 앱으로 검증한다.

### 4.4 필수 체크포인트
- `build` 스크립트가 `ait build`인지
- `framework`가 설치돼 있는지
- `react-native`와 Granite 버전이 현재 scaffold 기준과 맞는지
- 전환 이후 typecheck, test, build가 모두 통과하는지

## 5) Core API Map

### 5.1 Navigation / Screen
- `routing` (화면 전환 기본): https://developers-apps-in-toss.toss.im/bedrock/reference/framework/화면%20이동/routing
- `openURL` (외부 URL 열기): https://developers-apps-in-toss.toss.im/bedrock/reference/framework/화면%20이동/openURL
- `closeView` (현재 뷰 닫기): https://developers-apps-in-toss.toss.im/bedrock/reference/framework/화면%20제어/closeView
- `useBackEvent` (뒤로가기 제어): https://developers-apps-in-toss.toss.im/bedrock/reference/framework/화면%20제어/useBackEvent

실전 예시:
- 결제 완료 후 외부 영수증 페이지 열기 → `openURL`
- 온보딩이나 약관 닫기 버튼 → `closeView`
- 작성 중 이탈 방지 모달 → `useBackEvent`

### 5.2 Environment / Device
- `getPlatformOS`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/환경%20확인/getPlatformOS
- `getTossAppVersion`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/환경%20확인/getTossAppVersion
- `isMinVersionSupported`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/환경%20확인/isMinVersionSupported
- `getSchemeUri`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/환경%20확인/getSchemeUri

실전 예시:
- 특정 기능 최소 버전 게이트 → `isMinVersionSupported`
- 딥링크 유입 파라미터 처리 → `getSchemeUri`

### 5.3 Permission / Privacy
- 권한 설정 가이드: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/권한/permission
- `setSecureScreen`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/화면%20제어/setSecureScreen

실전 예시:
- 민감정보 페이지 캡처 차단 → `setSecureScreen`

### 5.4 Location
- `getCurrentLocation`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/위치%20정보/getCurrentLocation
- `startUpdateLocation`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/위치%20정보/startUpdateLocation
- `useGeolocation`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/위치%20정보/useGeolocation

실전 예시:
- 주변 매장 1회 조회 → `getCurrentLocation`
- 러닝이나 배달 추적 화면 → `startUpdateLocation` 또는 `useGeolocation`

### 5.5 Network / Storage / Clipboard
- `http`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/네트워크/http
- `Storage`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/저장소/Storage
- `getClipboardText`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/클립보드/getClipboardText
- `setClipboardText`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/클립보드/setClipboardText

### 5.6 Share / Growth
- `share`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/공유/share
- `getTossShareLink`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/공유/getTossShareLink
- Reward intro: https://developers-apps-in-toss.toss.im/reward/intro
- `contactsViral`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/친구초대/contactsViral

### 5.7 Analytics / Ads / Payments
- `Analytics`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/분석/Analytics
- `init` (analytics): https://developers-apps-in-toss.toss.im/bedrock/reference/framework/분석/init
- `IntegratedAd`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/광고/IntegratedAd
- `IAP`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/인앱%20결제/IAP
- `TossPay`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/토스페이/TossPay

## 6) Granite-Side Implementation Notes

- Granite API는 항상 공식 React Native 레퍼런스 기준으로 적용한다.
- 플랫폼별 API 차이는 분기 처리하고, 에러 타입을 명시적으로 핸들링한다.
- 라우팅 경로와 페이지 구조 규칙은 이 문서가 아니라 `granite-ssot.md`가 기준이다.

Granite 실무 포인트:
- `defineConfig`: 스킴, 앱 이름, 플러그인, 번들러 설정의 단일 진입점
  - https://www.granite.run/reference/react-native/config/defineConfig.html
- `useVisibilityChange`: 화면 visible/hidden 전환 타이밍에서 로깅과 정리 로직 처리
  - https://www.granite.run/ko/reference/react-native/screen-control/useVisibilityChange.html
- `Video`: 오디오 포커스 변경 대응이 필요한 영상 재생 화면에서 사용
  - https://www.granite.run/ko/reference/react-native/ui/Video.html
- `ScrollViewInertialBackground`: iOS 스크롤 바운스 영역의 시각적 일관성 개선
  - https://www.granite.run/ko/reference/react-native/ui/ScrollViewInertialBackground.html

참고:
- Quick index: `./appsintoss-granite-api-index.md`
- Granite RN reference: https://www.granite.run/ko/reference/react-native/

## 7) Maintenance Rule

이 문서를 업데이트할 때는 아래만 허용한다.

1. 공식 공개 URL 추가 또는 수정
2. 카테고리 재배치
3. 실전 예시 개선

금지:
- 로컬 파일 스캔 결과를 소스로 직접 인용
- `node_modules` 내부 경로를 문서의 근거로 사용
- 생성 산출물이나 임시 파일에 의존하는 설명
