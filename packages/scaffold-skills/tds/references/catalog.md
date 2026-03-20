# TDS React Native Index (MiniApp Precheck)

- 마지막 업데이트: 2026-03-19
- 목적: MiniApp UI 구현 전 TDS 컴포넌트 사용 기준을 빠르게 확인하기 위한 인덱스
- 문서 경로 패턴: `/tds-react-native/components/{slug}/`
- 패키지 베이스: `@toss/tds-react-native@2.0.2`
- 확인 근거:
  - npm tarball: `@toss/tds-react-native@2.0.2`
  - package root export: `dist/cjs/index.d.ts`
  - package component dirs: `dist/cjs/components/*`
  - 공개 문서 루트: `https://tossmini-docs.toss.im/tds-react-native/`
  - Apps-in-Toss SDK 2.0.1 업그레이드 가이드(공식):
    - `https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%EC%8B%9C%EC%9E%91%ED%95%98%EA%B8%B0/SDK2.0.1.html`

## 현재 스냅샷
- package component dir 기준: `51개`
- package root export component module 기준: `49개`
- 공개 문서 leaf page 기준: `42개`

## 이 문서를 어떻게 읽나
- 구현 우선 기준은 `package root export 49개`다.
- 문서에 안 보이는 컴포넌트가 있으면 `dist/cjs/index.d.ts`와 해당 component module의 `index.d.ts`를 먼저 본다.
- `chart`, `stepper-row`처럼 문서 slug가 다른 항목이 있다.
- `navbar`처럼 문서에는 보이지만 package root export 경로가 다른 항목이 있다.

## 구현 전 확인 규칙
1. UI 구현 시작 전에 이 문서 + 원문 링크를 먼저 확인한다.
2. frontend 작업이면 `Plan`에 `MiniApp 참고 문서` 섹션을 직접 추가하고, 참고한 TDS 문서를 적는다.
3. 컴포넌트 상태 관리는 문서 권장 방식(`value`+`onChange` 또는 `defaultValue`)을 따른다.
4. 컴포넌트 제약(스크롤/사이즈/접근성/폼 검증)을 코드와 테스트에 반영한다.
5. 문서 leaf page가 없으면 package export와 실제 타입 선언을 먼저 확인한다.
6. 네이티브 관련 import와 UI boundary는 `docs/engineering/frontend-policy.md`를 따른다.

## 차이 요약
- 문서와 package가 완전히 1:1은 아니다.
- docs path 차이
  - package `chart` -> docs `Chart/bar-chart`
  - package `stepper-row` -> docs `stepper`
- docs visible but package root export path differs
  - `navbar`
    - docs page는 있지만 package root `export * from './components/navbar'`는 없다.
    - 실제 root export는 `extensions/page-navbar`를 함께 봐야 한다.
- package component dir만 있고 docs/page root export 둘 다 약한 항목
  - `paragraph`
- root export에는 있지만 공개 문서가 없는 항목
  - `agreement`, `bottom-cta`, `bottom-sheet`, `fixed-bottom-cta`, `icon`, `tooltip`, `top`, `txt`

## Tab 컴포넌트 핵심 요약 (원문 기반)
출처: https://tossmini-docs.toss.im/tds-react-native/components/tab/

- `Tab`은 다중 콘텐츠 전환 UI
- 주요 props
  - `fluid: boolean` (아이템 많을 때 가로 스크롤)
  - `size: 'large' | 'small'`
  - `defaultValue: string` (내부 상태)
  - `value: string` + `onChange: (value: string) => void` (외부 상태)
- `Tab.Item` 주요 props
  - `value: string`
  - `children: React.ReactNode`
  - `redBean: boolean`
  - `onPress`, `style`

## Package Root Export Component Modules (49)
아래 목록이 실제 root import 기준 컴포넌트 module 목록이다.

- agreement
- amount-top
- asset
- badge
- board-row
- border
- bottom-cta
- bottom-info
- bottom-sheet
- button
- carousel
- chart
- checkbox
- dialog
- dropdown
- error-page
- fixed-bottom-cta
- gradient
- grid-list
- highlight
- icon
- icon-button
- keypad
- list
- list-footer
- list-header
- list-row
- loader
- numeric-spinner
- post
- progress-bar
- radio
- rating
- result
- search-field
- segmented-control
- shadow
- skeleton
- slider
- stepper-row
- switch
- tab
- table-row
- text-button
- text-field
- toast
- tooltip
- top
- txt

## Package Component Dirs But Not Root Re-exported (2)
- navbar
- paragraph

## Public Docs Leaf Pages (42)
아래 목록은 공개 문서 루트에서 실제 링크로 노출되는 leaf page다.

- Chart/bar-chart (`chart`) — https://tossmini-docs.toss.im/tds-react-native/components/Chart/bar-chart/
- amount-top — https://tossmini-docs.toss.im/tds-react-native/components/amount-top/
- asset — https://tossmini-docs.toss.im/tds-react-native/components/asset/
- badge — https://tossmini-docs.toss.im/tds-react-native/components/badge/
- board-row — https://tossmini-docs.toss.im/tds-react-native/components/board-row/
- border — https://tossmini-docs.toss.im/tds-react-native/components/border/
- bottom-info — https://tossmini-docs.toss.im/tds-react-native/components/bottom-info/
- button — https://tossmini-docs.toss.im/tds-react-native/components/button/
- carousel — https://tossmini-docs.toss.im/tds-react-native/components/carousel/
- checkbox — https://tossmini-docs.toss.im/tds-react-native/components/checkbox/
- dialog — https://tossmini-docs.toss.im/tds-react-native/components/dialog/
- dropdown — https://tossmini-docs.toss.im/tds-react-native/components/dropdown/
- error-page — https://tossmini-docs.toss.im/tds-react-native/components/error-page/
- gradient — https://tossmini-docs.toss.im/tds-react-native/components/gradient/
- grid-list — https://tossmini-docs.toss.im/tds-react-native/components/grid-list/
- highlight — https://tossmini-docs.toss.im/tds-react-native/components/highlight/
- icon-button — https://tossmini-docs.toss.im/tds-react-native/components/icon-button/
- keypad — https://tossmini-docs.toss.im/tds-react-native/components/keypad/
- list — https://tossmini-docs.toss.im/tds-react-native/components/list/
- list-footer — https://tossmini-docs.toss.im/tds-react-native/components/list-footer/
- list-header — https://tossmini-docs.toss.im/tds-react-native/components/list-header/
- list-row — https://tossmini-docs.toss.im/tds-react-native/components/list-row/
- loader — https://tossmini-docs.toss.im/tds-react-native/components/loader/
- navbar — https://tossmini-docs.toss.im/tds-react-native/components/navbar/
- numeric-spinner — https://tossmini-docs.toss.im/tds-react-native/components/numeric-spinner/
- post — https://tossmini-docs.toss.im/tds-react-native/components/post/
- progress-bar — https://tossmini-docs.toss.im/tds-react-native/components/progress-bar/
- radio — https://tossmini-docs.toss.im/tds-react-native/components/radio/
- rating — https://tossmini-docs.toss.im/tds-react-native/components/rating/
- result — https://tossmini-docs.toss.im/tds-react-native/components/result/
- search-field — https://tossmini-docs.toss.im/tds-react-native/components/search-field/
- segmented-control — https://tossmini-docs.toss.im/tds-react-native/components/segmented-control/
- shadow — https://tossmini-docs.toss.im/tds-react-native/components/shadow/
- skeleton — https://tossmini-docs.toss.im/tds-react-native/components/skeleton/
- slider — https://tossmini-docs.toss.im/tds-react-native/components/slider/
- stepper (`stepper-row`) — https://tossmini-docs.toss.im/tds-react-native/components/stepper/
- switch — https://tossmini-docs.toss.im/tds-react-native/components/switch/
- tab — https://tossmini-docs.toss.im/tds-react-native/components/tab/
- table-row — https://tossmini-docs.toss.im/tds-react-native/components/table-row/
- text-button — https://tossmini-docs.toss.im/tds-react-native/components/text-button/
- text-field — https://tossmini-docs.toss.im/tds-react-native/components/text-field/
- toast — https://tossmini-docs.toss.im/tds-react-native/components/toast/

## Root Export Components Missing Public Docs (8)
- agreement
- bottom-cta
- bottom-sheet
- fixed-bottom-cta
- icon
- tooltip
- top
- txt

## Package Component Dirs Missing Public Docs (9)
- agreement
- bottom-cta
- bottom-sheet
- fixed-bottom-cta
- icon
- paragraph
- tooltip
- top
- txt
