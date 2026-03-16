# Granite Native Modules Policy

## 결론
- MiniApp의 네이티브 연동은 `@granite-js/native`가 re-export한 모듈만 사용한다.
- 개별 native 패키지를 직접 설치하거나 직접 import하지 않는다.
- Biome lint가 direct native import와 금지된 `react-native` 기본 UI import를 바로 막는다.
- AsyncStorage는 예외 없이 금지하고, `@apps-in-toss/framework` storage API를 사용한다.
- 지금 lint가 막는 범위는 TDS 전체가 아니라, 대체제가 명확한 RN 기본 primitive와 네이티브 모듈 import다.
- 허용 범위를 벗어나는 네이티브 연동은 검토, 문서화, 테스트를 거친 뒤 추가한다.

## 사용 규칙
1. 네이티브 API는 먼저 Granite 공식 문서와 `@granite-js/native` 공개 경로에서 지원 여부를 확인한다.
2. direct import 금지
   - 금지: `react-native-webview`, `react-native-video` 같은 패키지를 직접 설치, 직접 import
   - 허용: `@granite-js/native/*` 경로를 통한 import
3. AsyncStorage 금지
   - 금지: `@react-native-async-storage/async-storage`
   - 금지: `@granite-js/native/@react-native-async-storage/async-storage`
   - 허용: `@apps-in-toss/framework` storage API
4. `react-native` 기본 UI 직접 import도 금지
   - 금지: `Button`, `Modal`, `Switch`, `TextInput`, `ActivityIndicator`, `Alert`, `TouchableOpacity`, `TouchableHighlight`, `TouchableWithoutFeedback`
   - `Pressable`도 기본은 금지하고, 정말 필요한 경우에만 `biome-ignore`에 이유를 함께 남긴다.
   - 허용: TDS나 Granite가 제공하는 컴포넌트
   - 예:
     - `Button` 대신 TDS `button`, `text-button`, `bottom-cta`
     - `Modal`, `Alert` 대신 TDS `dialog`, `bottom-sheet`, `toast`
     - `TextInput` 대신 TDS `text-field`, `search-field`
     - `ActivityIndicator` 대신 TDS `loader`
5. 사용 예시
   - `import { Video } from '@granite-js/native/react-native-video'`
   - `import * as Navigation from '@granite-js/native/@react-navigation/native'`
6. 새 네이티브 의존성이 필요하면 아래를 먼저 남긴다.
   - 왜 필요한지
   - 공식 지원 여부
   - 플랫폼 제약
   - 번들, 권한, 테스트 영향

## 체크리스트
- Granite 공식 문서에서 확인했는가
- `@granite-js/native` 경로로 import 가능한가
- AsyncStorage 대신 `@apps-in-toss/framework` storage API를 썼는가
- `react-native` 기본 UI primitive를 직접 import하지 않았는가
- 미지원 플랫폼 처리와 권한 거부 처리를 테스트에 포함했는가
