# Apps-in-Toss / Granite Feature Map (Quick)

빠르게 "무슨 기능 축이 존재하는지" 파악하기 위한 첫 문서입니다.

- 마지막 업데이트: 2026-03-19
- 참조 원칙: 공식 문서만 사용한다. (`granite.run`, `developers-apps-in-toss.toss.im`)
- 역할: 기능 축과 존재 여부를 빠르게 확인한다.
- 비역할: 정확한 URL, 시그니처, 타입, 에러, 세부 제약을 전부 나열하지 않는다.

## Quick Start

1. 요구사항과 가장 가까운 기능 축을 이 문서에서 찾는다.
2. 정확한 URL과 세부 타입/에러 문서는 `full-index.md`에서 확인한다.
3. 라우팅과 페이지 구조 규칙은 `../../shared/references/frontend-policy.md`에서 확인한다.
4. UI 구현이 포함되면 `tds-ui` skill의 generated catalog와 원문 TDS 문서를 같이 본다.

## Start Here

- Full catalog: `./full-index.md`
- Routing and page rules: `../../shared/references/frontend-policy.md`
- TDS catalog: 설치되어 있다면 `tds-ui` skill의 generated catalog

## Feature Map

### 시작 / 코어 / 설정
- 시작하기 문서가 있다.
  - tutorial, intro, overview, SDK 2.x migration
- 앱 설정 문서가 있다.
  - Config, NavigationBar, permission, env
- 런타임/코어 문서가 있다.
  - Bedrock, InitialProps, webview props

### Granite 핵심
- Granite 설정과 런타임 진입점이 있다.
  - `defineConfig`
- visibility/lifecycle 관련 문서가 있다.
  - `useVisibilityChange`
- 미디어/UI 관련 문서가 있다.
  - `Video`, `ScrollViewInertialBackground`

### 화면 이동 / 화면 제어
- 화면 이동 API가 있다.
  - `routing`, `openURL`, `closeView`
- 화면 상태/파라미터 API가 있다.
  - `useParams`, `useVisibility`, `useVisibilityChange`, `useWaitForReturnNavigator`
- 레이아웃/보안/디바이스 제어 API가 있다.
  - `safe-area`, `setDeviceOrientation`, `setIosSwipeGestureEnabled`, `setScreenAwakeMode`, `setSecureScreen`
- 노출/스크롤 관찰 API가 있다.
  - `IOFlatList`, `IOScrollView`, `ImpressionArea`, `InView`, `intersection-observer`

### 이벤트 제어
- 이벤트 제어 가이드 문서가 있다.
  - `back-event`
- 뒤로가기/홈/앱 준비 완료 이벤트를 제어할 수 있다.
  - `backEvent`, `useBackEvent`, `homeEvent`, `appsInTossEvent`
- 이벤트 리스너 해제와 에러 핸들링 규칙이 함께 안내된다.

### 환경 / 디바이스 / 네트워크 / 로케일
- 실행 환경 확인 API가 있다.
  - `getPlatformOS`, `getTossAppVersion`, `isMinVersionSupported`, `getSchemeUri`
- 디바이스/운영 환경 확인 API가 있다.
  - `getServerTime`, `getOperationalEnvironment`, `getDeviceId`
- 네트워크/로케일 API가 있다.
  - `http`, `getNetworkStatus`, `getLocale`

### 저장소 / 데이터 / 클립보드
- 네이티브 저장소 API가 있다.
  - `Storage`, `getItem`, `setItem`, `removeItem`, `clearItems`
- 데이터 저장 보조 API가 있다.
  - `saveBase64Data`
- 클립보드 API와 permission error 문서가 있다.
  - `getClipboardText`, `setClipboardText`

### 위치
- 단건 위치 조회 API가 있다.
  - `getCurrentLocation`
- 연속 위치 추적 API가 있다.
  - `startUpdateLocation`, `useGeolocation`
- 위치 타입/권한 에러 문서가 있다.
  - `Accuracy`, `Location`, `LocationCoords`, permission errors

### 로그인 / 공유 / 성장
- 로그인 관련 API가 있다.
  - `appLogin`, `getIsTossLoginIntegratedService`
- 공유/바이럴 API가 있다.
  - `share`, `getTossShareLink`, `contactsViral`
- 리워드/게임 성장 API가 있다.
  - Reward intro, `getUserKeyForGame`, `grantPromotionRewardForGame`

### 카메라 / 사진 / 연락처
- 카메라 진입 API가 있다.
  - `openCamera`
- 사진/연락처 조회 API가 있다.
  - `fetchAlbumPhotos`, `fetchContacts`
- 각 기능의 permission error 문서가 있다.

### UI / Overlay / 인터랙션
- framework UI 컴포넌트 문서가 있다.
  - `BlurView`, `ColorPreference`, `Image`, `Text`, `View`, `Layout`, `Lottie`, `Video`, `NavigationBar`
- overlay 문서가 있다.
  - `useOverlay`, `useOverlayBase`
- style-utils 문서가 있다.
  - `Flex`, `Spacing`, `Stack`, `margin`, `padding`
- 인터랙션 문서가 있다.
  - `interaction`, `generateHapticFeedback`

### 분석 / 광고 / 결제 / 게임
- 분석 문서가 있다.
  - `init`, `Analytics`, logging helpers
- 광고 문서가 있다.
  - `IntegratedAd`, AdMob load/show 계열, banner/interstitial/rewarded, 관련 event/type
- 결제 문서가 있다.
  - `IAP`, order lifecycle API, `TossPay`, `checkoutPayment`
- 게임 문서가 있다.
  - `getUserKeyForGame`, leaderboard, promotion reward

### 인증
- TossCert 인증 문서가 있다.
  - `tosscert`, access token, encrypt, request/result, session key, status

## Notes

- 이 문서는 "무엇이 있는지"를 빠르게 파악하는 기능 맵이다.
- 실제 링크 카탈로그는 `full-index.md`가 담당한다.
- 최종 계약은 공식 원문이 기준이다.
