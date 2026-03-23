# tds-ui Decision Matrix

이 문서는 TDS React Native 공식 문서와 `docs-search`로 찾은 public surface를 사람이 읽는 선택 기준으로 풀어쓴 overlay다.

## input-choice

입력/선택 군은 공식 문서상 각각 일반 텍스트 입력(`TextField`), 검색 입력(`SearchField`), 다중 선택(`Checkbox`), 단일 선택(`Radio`, `SegmentedControl`), 이진 토글(`Switch`), 콘텐츠 전환(`Tab`), 메뉴(`Dropdown`), 정수 증감(`NumericSpinner`), 연속 값 선택(`Slider`), 숫자 키패드(`NumberKeypad`), 평점 표시/입력(`Rating`)으로 정의된다.

- `TextField`: 자유 텍스트, 포맷팅, label/help/error, prefix/suffix, picker-like field가 필요할 때 쓴다.
- `SearchField`: 검색어 입력이 목적일 때만 쓴다. 검색 아이콘, clear button, autoFocus가 기본 니즈다.
- `Checkbox`: 서로 독립적인 여러 yes/no 선택이나 다중 동의 목록에 쓴다.
- `Radio`: 여러 옵션 중 정확히 하나를 고르는 목록형 선택에 쓴다.
- `SegmentedControl`: 2~4개 정도의 압축된 단일 선택, 짧은 필터, mini tab nav에 쓴다.
- `Switch`: 설정 화면의 즉시 반영 on/off에 쓴다. 다중 선택 용도로 쓰지 않는다.
- `Tab`: 콘텐츠 섹션을 전환할 때 쓴다. 4개 초과 또는 긴 라벨이면 `fluid`를 기본 검토한다.
- `Dropdown`: overflow menu, context action, 접힌 옵션 목록에 쓴다.
- `NumericSpinner`: 키보드 없이 정수를 올리고 내리는 입력에 쓴다.
- `Slider`: 볼륨/밝기/점수/범위처럼 연속 값을 조정할 때 쓴다.
- `NumberKeypad`: 금액/PIN/전화번호 같은 숫자 패드 입력에 쓴다.
- `Rating`: 읽기 전용 점수 표시 또는 사용자 평점 입력에 쓴다.

## actions-feedback

액션/피드백 군은 공식 문서상 액션 버튼(`Button`, `TextButton`, `IconButton`)과 블로킹 안내(`Dialog`), 비차단 짧은 안내(`Toast`), 스피너 로딩(`Loader`), 레이아웃형 로딩 placeholder(`Skeleton`), 수치형 진행률(`ProgressBar`), 전체 결과 화면(`Result`), 상태코드 중심 오류 화면(`ErrorPage`)로 나뉜다.

- `Button`: 주 액션, 보조 액션, destructive action에 쓴다. loading과 disabled를 같이 설계한다.
- `TextButton`: 낮은 강조도의 링크성 액션에 쓴다.
- `IconButton`: compact한 icon-only action에 쓴다.
- `Dialog`: 확인/취소, 치명적 안내, 사용자 결정을 멈춰 세워야 하는 경우에 쓴다.
- `Toast`: 저장 완료, 복사 완료 같은 짧은 상태 변화 안내에 쓴다.
- `Loader`: 실제 콘텐츠를 대신하지 않는 순수 대기 상태에 쓴다.
- `Skeleton`: 실제 레이아웃이 곧 나타날 때 placeholder로 쓴다.
- `ProgressBar`: 퍼센트/진행량이 있는 작업에 쓴다.
- `Result`: 성공/실패/완료 상태를 페이지 단위로 보여줄 때 쓴다.
- `ErrorPage`: HTTP status-like error page가 필요할 때 쓴다.

## list-navigation-layout

리스트/레이아웃/콘텐츠 군은 공식 문서상 세로 목록(`List`, `ListRow`, `ListHeader`, `ListFooter`), key/value 요약(`TableRow`), grid 배치(`GridList`), FAQ/accordion(`BoardRow`), step flow(`Stepper`, skill id `stepper-row`), top navigation(`Navbar`, skill id `navbar`), large amount hero(`AmountTop`), disclaimer(`BottomInfo`), long-form content(`Post`), framed media/icon/lottie(`Asset`), status chip(`Badge`), horizontal swipe surface(`Carousel`), bar chart(`BarChart`, skill id `chart`), onboarding highlight(`Highlight`), separator(`Border`), gradient/shadow visual utility(`Gradient`, `Shadow`)로 나뉜다. `BottomInfo`는 특히 법적 고지/면책 문구에 적합하고 `Post`와 함께 쓰도록 안내한다. `Navbar`는 docs-backed지만 export-gap이 있다.

- `List` + `ListRow`: 설정/메뉴/계정/내역 리스트의 기본 조합으로 고정한다.
- `ListHeader`: 섹션 제목 + 보조설명 + 우측 액세서리가 있는 헤더에 쓴다.
- `ListFooter`: “더 보기”, 목록 확장, 이어보기 액션에 쓴다.
- `TableRow`: key/value summary, 송금 정보, 상품 정보 같은 2열 요약에 쓴다.
- `GridList`: 1/2/3열 카드나 아이콘 메뉴에 쓴다.
- `BoardRow`: FAQ, 아코디언, 접힘/펼침 설명 셀에 쓴다.
- `stepper-row`: docs component는 `Stepper`다. 단계 흐름, 진행 단계, 절차 요약에 쓴다.
- `navbar`: docs component는 `Navbar`다. 상단 navigation bar에 쓰고 import path는 `@toss/tds-react-native/extensions/page-navbar`를 사용한다.

## content-display

- `AmountTop`: 금액 hero, 송금/결제/잔액 상단 요약에 쓴다.
- `BottomInfo`: 하단 안내, 법적 고지, 주의사항에 쓴다.
- `Post`: 공지/이벤트/긴 본문/서술형 설명에 쓴다.
- `Asset`: 이미지/아이콘/Lottie를 정해진 frame shape 안에 넣어야 할 때 쓴다.
- `Badge`: 상태 인식용 강조 chip에 쓴다.
- `Carousel`: 배너/카드/이미지의 가로 스와이프 surface에 쓴다.
- `chart`: docs component는 `BarChart`다. 막대형 데이터 시각화에 쓴다.
- `Highlight`: 온보딩/튜토리얼의 특정 UI 강조에 쓴다.
- `Border`: 섹션/리스트 구분선에 쓴다.
- `Gradient`, `Shadow`: TDS visual utility가 필요할 때만 쓴다.

## guarded-export-only

- `agreement`, `bottom-cta`, `bottom-sheet`, `fixed-bottom-cta`, `icon`, `tooltip`, `top`, `txt`는 public docs가 없는 export-only 항목이다.
- 이 항목은 명시적 요구나 기존 코드베이스 근거가 있을 때만 추천한다.
- 추천 시 반드시 `export-only / docs-missing`과 doc-backed fallback을 같이 적는다.

## blocked-by-default

- `paragraph`는 component dir만 있고 root export와 public docs 둘 다 약하다.
- 새 화면 추천에서 기본 선택지로 쓰지 않는다.
