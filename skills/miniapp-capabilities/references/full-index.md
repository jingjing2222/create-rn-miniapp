# Apps-in-Toss + Granite Full API Index (Maintainable Edition)

이 문서는 MiniApp 구현 시 참조하는 전체 API 카탈로그입니다.

- 마지막 업데이트: 2026-03-19
- 원칙:
  - 로컬 경로(`node_modules`, 임시 생성 JSON, 내부 스캔 결과)에 의존하지 않는다.
  - 공식 공개 문서만 source of truth로 사용한다.
  - 구현자는 본 문서에서 후보 API를 찾고, 링크된 원문에서 시그니처와 제약을 최종 확인한다.
- 네이티브 모듈, 라우팅, UI import 강제 규칙은 `../../shared/references/frontend-policy.md`를 따른다.

## 1) 이 문서를 언제 보나

1. 먼저 `feature-map.md`에서 기능 축과 존재 여부를 빠르게 파악한다.
2. 정확한 URL, 세부 타입, 에러, 보조 문서가 필요하면 이 문서를 본다.
3. 구현 직전에는 반드시 공식 원문 링크를 다시 열어 시그니처, 권한, 플랫폼 제약, 에러 타입을 확인한다.
4. import source가 `@apps-in-toss/framework`인지 `@granite-js/*`인지 헷갈리면 이 문서의 Framework/Granite 구분을 먼저 확인한다.

## 2) Stable Official Sources

### Granite (React Native)
- Granite Docs (KR): https://www.granite.run/ko/
- Granite Docs (EN): https://www.granite.run/
- Granite GitHub: https://github.com/toss/granite
- Granite `defineConfig`: https://www.granite.run/reference/react-native/config/defineConfig.html
- Granite `useVisibilityChange`: https://www.granite.run/ko/reference/react-native/screen-control/useVisibilityChange.html
- Granite `Video`: https://www.granite.run/ko/reference/react-native/ui/Video.html
- Granite `ScrollViewInertialBackground`: https://www.granite.run/ko/reference/react-native/ui/ScrollViewInertialBackground.html

### Apps-in-Toss Framework
- React Native tutorial: https://developers-apps-in-toss.toss.im/tutorials/react-native.html
- 시작하기 소개: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%EC%8B%9C%EC%9E%91%ED%95%98%EA%B8%B0/intro.html
- Framework overview: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%EC%8B%9C%EC%9E%91%ED%95%98%EA%B8%B0/overview.html
- SDK 2.x migration: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%EC%8B%9C%EC%9E%91%ED%95%98%EA%B8%B0/SDK2.0.1.html
- Config: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/UI/Config.html
- NavigationBar: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/UI/NavigationBar.html
- Permissions: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%EA%B6%8C%ED%95%9C/permission.html
- Environment variables: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%ED%99%98%EA%B2%BD%20%EB%B3%80%EC%88%98/env.html
- Bedrock core: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%EC%BD%94%EC%96%B4/Bedrock.html
- ColorPreference (core alias): https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%EC%BD%94%EC%96%B4/ColorPreference.html
- InitialProps: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%EC%BD%94%EC%96%B4/InitialProps.html
- Event control guide: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%EC%9D%B4%EB%B2%A4%ED%8A%B8%20%EC%A0%9C%EC%96%B4/back-event.html
- Full LLM export: https://developers-apps-in-toss.toss.im/llms-full.txt

## 3) API Discovery Flow

1. 기능 요구사항을 아래 축으로 분류한다.
   - 시작/설정/코어
   - 화면 이동/화면 제어
   - 이벤트 제어
   - 환경 확인/디바이스/로케일/네트워크
   - 저장소/데이터/클립보드
   - 위치
   - 카메라/사진/연락처
   - 로그인/공유/성장
   - UI/overlay/style-utils/인터랙션
   - 분석/광고/결제/게임
   - 인증(TossCert)
2. 이 문서의 해당 카테고리에서 후보 API를 고른다.
3. 반드시 원문 링크에서 아래를 재확인한다.
   - 함수 시그니처
   - 플랫폼 제약(iOS, Android, WebView, RN)
   - 권한 요구사항
   - 에러 타입과 예외 처리 방식
4. 구현 후 테스트 케이스에 권한 거부, 미지원 환경, 구버전 앱, 네트워크 오류 시나리오를 포함한다.

## 4) SDK 2.x 정합성 체크

공식 가이드:
- https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%EC%8B%9C%EC%9E%91%ED%95%98%EA%B8%B0/SDK2.0.1.html

실무 체크포인트:
- `@apps-in-toss/framework`가 2.x 기준인지 확인한다.
- 빌드 명령이 `granite build`가 아니라 `ait build`인지 확인한다.
- 자동 마이그레이션(`ait migrate react-native-0-84-0`)이 필요한 프로젝트인지 먼저 구분한다.
- React Native/React 타입 변화와 샌드박스 앱 테스트 조건을 함께 확인한다.

## 5) Full Category Map

### 5.1 시작 / 코어 / 설정 / 속성 제어
- React Native tutorial: https://developers-apps-in-toss.toss.im/tutorials/react-native.html
- `intro`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%EC%8B%9C%EC%9E%91%ED%95%98%EA%B8%B0/intro.html
- `overview`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%EC%8B%9C%EC%9E%91%ED%95%98%EA%B8%B0/overview.html
- `SDK2.0.1`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%EC%8B%9C%EC%9E%91%ED%95%98%EA%B8%B0/SDK2.0.1.html
- `Config`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/UI/Config.html
- `NavigationBar`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/UI/NavigationBar.html
- `env`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%ED%99%98%EA%B2%BD%20%EB%B3%80%EC%88%98/env.html
- `Bedrock`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%EC%BD%94%EC%96%B4/Bedrock.html
- `ColorPreference` (core alias): https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%EC%BD%94%EC%96%B4/ColorPreference.html
- `InitialProps`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%EC%BD%94%EC%96%B4/InitialProps.html
- `webview-props`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%EC%86%8D%EC%84%B1%20%EC%A0%9C%EC%96%B4/webview-props.html

실전 예시:
- scaffold 직후 `registerApp` 흐름, permission 선언, navigation bar, env 주입 여부를 먼저 확인한다.

### 5.2 화면 이동 / 화면 제어
- `routing`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%ED%99%94%EB%A9%B4%20%EC%9D%B4%EB%8F%99/routing.html
- `openURL`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%ED%99%94%EB%A9%B4%20%EC%9D%B4%EB%8F%99/openURL.html
- `closeView`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%ED%99%94%EB%A9%B4%20%EC%A0%9C%EC%96%B4/closeView.html
- `useBackEvent`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%ED%99%94%EB%A9%B4%20%EC%A0%9C%EC%96%B4/useBackEvent.html
- `useParams`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%ED%99%94%EB%A9%B4%20%EC%A0%9C%EC%96%B4/useParams.html
- `useVisibility`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%ED%99%94%EB%A9%B4%20%EC%A0%9C%EC%96%B4/useVisibility.html
- `useVisibilityChange`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%ED%99%94%EB%A9%B4%20%EC%A0%9C%EC%96%B4/useVisibilityChange.html
- `useWaitForReturnNavigator`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%ED%99%94%EB%A9%B4%20%EC%A0%9C%EC%96%B4/useWaitForReturnNavigator.html
- `safe-area`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%ED%99%94%EB%A9%B4%20%EC%A0%9C%EC%96%B4/safe-area.html
- `setDeviceOrientation`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%ED%99%94%EB%A9%B4%20%EC%A0%9C%EC%96%B4/setDeviceOrientation.html
- `setIosSwipeGestureEnabled`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%ED%99%94%EB%A9%B4%20%EC%A0%9C%EC%96%B4/setIosSwipeGestureEnabled.html
- `setScreenAwakeMode`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%ED%99%94%EB%A9%B4%20%EC%A0%9C%EC%96%B4/setScreenAwakeMode.html
- `setSecureScreen`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%ED%99%94%EB%A9%B4%20%EC%A0%9C%EC%96%B4/setSecureScreen.html
- `IOFlatList`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%ED%99%94%EB%A9%B4%20%EC%A0%9C%EC%96%B4/IOFlatList.html
- `IOScrollView`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%ED%99%94%EB%A9%B4%20%EC%A0%9C%EC%96%B4/IOScrollView.html
- `ImpressionArea`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%ED%99%94%EB%A9%B4%20%EC%A0%9C%EC%96%B4/ImpressionArea.html
- `InView`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%ED%99%94%EB%A9%B4%20%EC%A0%9C%EC%96%B4/InView.html
- `intersection-observer`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%ED%99%94%EB%A9%B4%20%EC%A0%9C%EC%96%B4/intersection-observer.html

실전 예시:
- 화면 노출 로깅과 이탈 방지는 `useVisibilityChange`, `ImpressionArea`, `useBackEvent` 조합을 먼저 검토한다.

### 5.3 이벤트 제어
- `이벤트 제어하기(back-event)`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%EC%9D%B4%EB%B2%A4%ED%8A%B8%20%EC%A0%9C%EC%96%B4/back-event.html
- 문서 내 RN 뒤로가기 훅: `useBackEvent`
- 문서 내 RN 홈 버튼 이벤트: `homeEvent.subscribe()`
- 문서 내 앱 진입 완료 이벤트: `appsInTossEvent.addEventListener('entryMessageExited', ...)`

실전 예시:
- 폼 이탈 방지, 홈 버튼 구독, 앱 ready 시점 감지는 이 섹션의 이벤트 가이드를 먼저 보고, 각 화면 제어 API 문서로 내려간다.

### 5.4 환경 확인 / 디바이스 / 로케일 / 네트워크
- `getPlatformOS`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%ED%99%98%EA%B2%BD%20%ED%99%95%EC%9D%B8/getPlatformOS.html
- `getTossAppVersion`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%ED%99%98%EA%B2%BD%20%ED%99%95%EC%9D%B8/getTossAppVersion.html
- `isMinVersionSupported`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%ED%99%98%EA%B2%BD%20%ED%99%95%EC%9D%B8/isMinVersionSupported.html
- `getSchemeUri`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%ED%99%98%EA%B2%BD%20%ED%99%95%EC%9D%B8/getSchemeUri.html
- `getServerTime`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%ED%99%98%EA%B2%BD%20%ED%99%95%EC%9D%B8/getServerTime.html
- `getOperationalEnvironment`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%ED%99%98%EA%B2%BD%20%ED%99%95%EC%9D%B8/getOperationalEnvironment.html
- `getDeviceId`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%ED%99%98%EA%B2%BD%20%ED%99%95%EC%9D%B8/getDeviceId.html
- `getLocale`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%EC%96%B8%EC%96%B4/getLocale.html
- `http`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%EB%84%A4%ED%8A%B8%EC%9B%8C%ED%81%AC/http.html
- `getNetworkStatus`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%EB%84%A4%ED%8A%B8%EC%9B%8C%ED%81%AC/getNetworkStatus.html

실전 예시:
- 최소 버전 게이트, 서버 시간 기준 만료 계산, 운영 환경 분기, 로케일별 카피 분기를 이 축에서 결정한다.

### 5.5 저장소 / 데이터 / 클립보드
- `Storage`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%EC%A0%80%EC%9E%A5%EC%86%8C/Storage.html
- `getItem`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%EC%A0%80%EC%9E%A5%EC%86%8C/getItem.html
- `setItem`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%EC%A0%80%EC%9E%A5%EC%86%8C/setItem.html
- `removeItem`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%EC%A0%80%EC%9E%A5%EC%86%8C/removeItem.html
- `clearItems`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%EC%A0%80%EC%9E%A5%EC%86%8C/clearItems.html
- `saveBase64Data`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%EB%8D%B0%EC%9D%B4%ED%84%B0/saveBase64Data.html
- `getClipboardText`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%ED%81%B4%EB%A6%BD%EB%B3%B4%EB%93%9C/getClipboardText.html
- `setClipboardText`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%ED%81%B4%EB%A6%BD%EB%B3%B4%EB%93%9C/setClipboardText.html
- `GetClipboardTextPermissionError`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%ED%81%B4%EB%A6%BD%EB%B3%B4%EB%93%9C/GetClipboardTextPermissionError.html
- `SetClipboardTextPermissionError`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%ED%81%B4%EB%A6%BD%EB%B3%B4%EB%93%9C/SetClipboardTextPermissionError.html

### 5.6 위치
- `getCurrentLocation`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%EC%9C%84%EC%B9%98%20%EC%A0%95%EB%B3%B4/getCurrentLocation.html
- `startUpdateLocation`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%EC%9C%84%EC%B9%98%20%EC%A0%95%EB%B3%B4/startUpdateLocation.html
- `useGeolocation`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%EC%9C%84%EC%B9%98%20%EC%A0%95%EB%B3%B4/useGeolocation.html
- `Accuracy`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%EC%9C%84%EC%B9%98%20%EC%A0%95%EB%B3%B4/Accuracy.html
- `Location`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%EC%9C%84%EC%B9%98%20%EC%A0%95%EB%B3%B4/Location.html
- `LocationCoords`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%EC%9C%84%EC%B9%98%20%EC%A0%95%EB%B3%B4/LocationCoords.html
- `GetCurrentLocationPermissionError`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%EC%9C%84%EC%B9%98%20%EC%A0%95%EB%B3%B4/GetCurrentLocationPermissionError.html
- `StartUpdateLocationPermissionError`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%EC%9C%84%EC%B9%98%20%EC%A0%95%EB%B3%B4/StartUpdateLocationPermissionError.html

### 5.7 카메라 / 사진 / 연락처
- `openCamera`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%EC%B9%B4%EB%A9%94%EB%9D%BC/openCamera.html
- `OpenCameraPermissionError`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%EC%B9%B4%EB%A9%94%EB%9D%BC/OpenCameraPermissionError.html
- `fetchAlbumPhotos`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%EC%82%AC%EC%A7%84/fetchAlbumPhotos.html
- `FetchAlbumPhotosPermissionError`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%EC%82%AC%EC%A7%84/FetchAlbumPhotosPermissionError.html
- `fetchContacts`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%EC%97%B0%EB%9D%BD%EC%B2%98/fetchContacts.html
- `FetchContactsPermissionError`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%EC%97%B0%EB%9D%BD%EC%B2%98/FetchContactsPermissionError.html

### 5.8 로그인 / 공유 / 성장
- `appLogin`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%EB%A1%9C%EA%B7%B8%EC%9D%B8/appLogin.html
- `getIsTossLoginIntegratedService`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%EB%A1%9C%EA%B7%B8%EC%9D%B8/getIsTossLoginIntegratedService.html
- `share`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%EA%B3%B5%EC%9C%A0/share.html
- `getTossShareLink`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%EA%B3%B5%EC%9C%A0/getTossShareLink.html
- Reward intro: https://developers-apps-in-toss.toss.im/reward/intro.html
- `contactsViral`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%EC%B9%9C%EA%B5%AC%EC%B4%88%EB%8C%80/contactsViral.html
- `ContactsViralOption`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%EC%B9%9C%EA%B5%AC%EC%B4%88%EB%8C%80/ContactsViralOption.html
- `ContactsViralParams`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%EC%B9%9C%EA%B5%AC%EC%B4%88%EB%8C%80/ContactsViralParams.html
- `ContactsViralSuccessEvent`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%EC%B9%9C%EA%B5%AC%EC%B4%88%EB%8C%80/ContactsViralSuccessEvent.html
- `RewardFromContactsViralEvent`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%EC%B9%9C%EA%B5%AC%EC%B4%88%EB%8C%80/RewardFromContactsViralEvent.html

### 5.9 분석 / 인터랙션 / UI / Overlay / Style Utils
- `init`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%EB%B6%84%EC%84%9D/init.html
- `Analytics`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%EB%B6%84%EC%84%9D/Analytics.html
- `LoggingArea`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%EB%B6%84%EC%84%9D/LoggingArea.html
- `LoggingImpression`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%EB%B6%84%EC%84%9D/LoggingImpression.html
- `LoggingPress`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%EB%B6%84%EC%84%9D/LoggingPress.html
- `interaction`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%EC%9D%B8%ED%84%B0%EB%A0%89%EC%85%98/interaction.html
- `generateHapticFeedback`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%EC%9D%B8%ED%84%B0%EB%A0%89%EC%85%98/generateHapticFeedback.html
- `HapticFeedbackOptions`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%EC%9D%B8%ED%84%B0%EB%A0%89%EC%85%98/HapticFeedbackOptions.html
- `BlurView`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/UI/BlurView.html
- `ColorPreference`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/UI/ColorPreference.html
- `Image`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/UI/Image.html
- `KeyboardAboveView`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/UI/KeyboardAboveView.html
- `Layout`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/UI/Layout.html
- `Lottie`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/UI/Lottie.html
- `NavigationBar`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/UI/NavigationBar.html
- `OnAudioFocusChanged`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/UI/OnAudioFocusChanged.html
- `RNVideoRef`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/UI/RNVideoRef.html
- `ScrollViewInertialBackground`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/UI/ScrollViewInertialBackground.html
- `Text`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/UI/Text.html
- `Video`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/UI/Video.html
- `View`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/UI/View.html
- `useOverlay`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/overlay/useOverlay.html
- `useOverlayBase`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/overlay/useOverlayBase.html
- `Flex`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/style-utils/Flex.html
- `Spacing`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/style-utils/Spacing.html
- `Stack`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/style-utils/Stack.html
- `margin`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/style-utils/margin.html
- `padding`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/style-utils/padding.html

실전 예시:
- import source가 `@apps-in-toss/framework`라면 같은 이름의 Granite 컴포넌트보다 이 축의 문서를 먼저 확인한다.

### 5.10 광고 / 결제 / 게임
- `GoogleAdMob`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%EA%B4%91%EA%B3%A0/GoogleAdMob.html
- `loadAppsInTossAdMob`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%EA%B4%91%EA%B3%A0/loadAppsInTossAdMob.html
- `showAppsInTossAdMob`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%EA%B4%91%EA%B3%A0/showAppsInTossAdMob.html
- `IntegratedAd`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%EA%B4%91%EA%B3%A0/IntegratedAd.html
- `BannerAd`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%EA%B4%91%EA%B3%A0/BannerAd.html
- `RN-BannerAd`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%EA%B4%91%EA%B3%A0/RN-BannerAd.html
- `InterstitialAd`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%EA%B4%91%EA%B3%A0/InterstitialAd.html
- `RewardedAd`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%EA%B4%91%EA%B3%A0/RewardedAd.html
- `loadAdMobInterstitialAd`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%EA%B4%91%EA%B3%A0/loadAdMobInterstitialAd.html
- `showAdMobInterstitialAd`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%EA%B4%91%EA%B3%A0/showAdMobInterstitialAd.html
- `loadAdMobRewardedAd`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%EA%B4%91%EA%B3%A0/loadAdMobRewardedAd.html
- `showAdMobRewardedAd`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%EA%B4%91%EA%B3%A0/showAdMobRewardedAd.html
- `AdMobFullScreenEvent`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%EA%B4%91%EA%B3%A0/AdMobFullScreenEvent.html
- `AdNetworkResponseInfo`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%EA%B4%91%EA%B3%A0/AdNetworkResponseInfo.html
- `LoadAdMobEvent`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%EA%B4%91%EA%B3%A0/LoadAdMobEvent.html
- `LoadAdMobInterstitialAdEvent`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%EA%B4%91%EA%B3%A0/LoadAdMobInterstitialAdEvent.html
- `LoadAdMobInterstitialAdParams`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%EA%B4%91%EA%B3%A0/LoadAdMobInterstitialAdParams.html
- `LoadAdMobOptions`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%EA%B4%91%EA%B3%A0/LoadAdMobOptions.html
- `LoadAdMobRewardedAdEvent`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%EA%B4%91%EA%B3%A0/LoadAdMobRewardedAdEvent.html
- `LoadAdMobRewardedAdParams`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%EA%B4%91%EA%B3%A0/LoadAdMobRewardedAdParams.html
- `ResponseInfo`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%EA%B4%91%EA%B3%A0/ResponseInfo.html
- `ShowAdMobEvent`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%EA%B4%91%EA%B3%A0/ShowAdMobEvent.html
- `ShowAdMobInterstitialAdEvent`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%EA%B4%91%EA%B3%A0/ShowAdMobInterstitialAdEvent.html
- `ShowAdMobInterstitialAdParams`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%EA%B4%91%EA%B3%A0/ShowAdMobInterstitialAdParams.html
- `ShowAdMobParams`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%EA%B4%91%EA%B3%A0/ShowAdMobParams.html
- `ShowAdMobRewardedAdEvent`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%EA%B4%91%EA%B3%A0/ShowAdMobRewardedAdEvent.html
- `ShowAdMobRewardedAdParams`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%EA%B4%91%EA%B3%A0/ShowAdMobRewardedAdParams.html
- `IAP`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%EC%9D%B8%EC%95%B1%20%EA%B2%B0%EC%A0%9C/IAP.html
- `createOneTimePurchaseOrder`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%EC%9D%B8%EC%95%B1%20%EA%B2%B0%EC%A0%9C/createOneTimePurchaseOrder.html
- `getPendingOrders`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%EC%9D%B8%EC%95%B1%20%EA%B2%B0%EC%A0%9C/getPendingOrders.html
- `getCompletedOrRefundedOrders`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%EC%9D%B8%EC%95%B1%20%EA%B2%B0%EC%A0%9C/getCompletedOrRefundedOrders.html
- `getProductItemList`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%EC%9D%B8%EC%95%B1%20%EA%B2%B0%EC%A0%9C/getProductItemList.html
- `completeProductGrant`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%EC%9D%B8%EC%95%B1%20%EA%B2%B0%EC%A0%9C/completeProductGrant.html
- `subscription`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%EC%9D%B8%EC%95%B1%20%EA%B2%B0%EC%A0%9C/subscription.html
- `TossPay`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%ED%86%A0%EC%8A%A4%ED%8E%98%EC%9D%B4/TossPay.html
- `checkoutPayment`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%ED%86%A0%EC%8A%A4%ED%8E%98%EC%9D%B4/checkoutPayment.html
- `CheckoutPaymentOptions`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%ED%86%A0%EC%8A%A4%ED%8E%98%EC%9D%B4/CheckoutPaymentOptions.html
- `CheckoutPaymentResult`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%ED%86%A0%EC%8A%A4%ED%8E%98%EC%9D%B4/CheckoutPaymentResult.html
- `getUserKeyForGame`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%EA%B2%8C%EC%9E%84/getUserKeyForGame.html
- `submitGameCenterLeaderBoardScore`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%EA%B2%8C%EC%9E%84/submitGameCenterLeaderBoardScore.html
- `grantPromotionRewardForGame`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%EA%B2%8C%EC%9E%84/grantPromotionRewardForGame.html

### 5.11 인증 (TossCert)
- `tosscert`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%EC%9D%B8%EC%A6%9D/tosscert.html
- `tosscertAccessToken`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%EC%9D%B8%EC%A6%9D/tosscertAccessToken.html
- `tosscertEncrypt`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%EC%9D%B8%EC%A6%9D/tosscertEncrypt.html
- `tosscertRequest`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%EC%9D%B8%EC%A6%9D/tosscertRequest.html
- `tosscertResult`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%EC%9D%B8%EC%A6%9D/tosscertResult.html
- `tosscertSessionKey`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%EC%9D%B8%EC%A6%9D/tosscertSessionKey.html
- `tosscertStatus`: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%EC%9D%B8%EC%A6%9D/tosscertStatus.html

## 6) Granite-Side Implementation Notes

- Granite API는 항상 공식 React Native 레퍼런스 기준으로 적용한다.
- 플랫폼별 API 차이는 분기 처리하고, 에러 타입을 명시적으로 핸들링한다.
- 라우팅 경로와 페이지 구조 규칙은 이 문서가 아니라 `../../shared/references/frontend-policy.md`가 기준이다.
- 같은 이름의 UI/visibility API가 보여도 import source가 `@apps-in-toss/framework`면 framework 문서를, `@granite-js/*`면 Granite 문서를 우선한다.

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
- Quick index: `./feature-map.md`
- Granite docs (KR): https://www.granite.run/ko/

## 7) Maintenance Rule

이 문서를 업데이트할 때는 아래만 허용한다.

1. 공식 공개 URL 추가 또는 수정
2. 카테고리 재배치
3. 실전 예시 개선
4. 공식 문서 구조 변경에 맞춘 링크 포맷 보정

금지:
- 로컬 파일 스캔 결과를 소스로 직접 인용
- `node_modules` 내부 경로를 문서의 근거로 사용
- 생성 산출물이나 임시 파일에 의존하는 설명

링크 규칙:
- 사람용 공식 문서는 `.html` URL을 우선 사용한다.
- 링크를 바꿀 때는 실제로 열리는지 확인하고, 필요하면 `llms-full.txt`로도 교차검증한다.
