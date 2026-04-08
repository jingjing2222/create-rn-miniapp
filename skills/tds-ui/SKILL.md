---
name: tds-ui
description: Decision skill for choosing TDS React Native components and UI boundaries in MiniApp screens. Use when translating product requirements into TDS components, reconciling public docs with actual exports, or deciding controlled/uncontrolled state patterns. Do not use for route design, capability lookup, provider/runtime work, or non-TDS native module decisions.
compatibility: Intended for create-rn-miniapp repositories. Assumes bundled TDS React Native `generated/llms.txt` / `generated/llms-full.txt` snapshots plus `metadata.json` and `generated/anomalies.json`.
metadata:
  create-rn-miniapp.agentsLabel: "TDS UI 선택과 form 패턴"
  create-rn-miniapp.category: "core"
  create-rn-miniapp.order: "3"
  create-rn-miniapp.version: "2.1.0"
---

# TDS UI Decision Skill

이 Skill은 MiniApp 화면 요구사항을 TDS React Native 컴포넌트로 정확히 매핑할 때 사용한다.
이 Skill은 TDS를 다시 설명하는 문서가 아니다. bundled `generated/llms.txt` / `generated/llms-full.txt` snapshot을 local canonical source로 삼고, 이 Skill은 그 snapshot으로 라우팅하고 repo-specific anomaly와 답변 계약만 덧입히는 overlay다.

## Use when

- 입력/선택 UI를 결정해야 할 때
- 리스트, 요약, 스텝, 카드, 배너, 차트 같은 화면 구성 요소를 정해야 할 때
- 로딩/에러/완료/토스트/다이얼로그 같은 상태 UI를 정해야 할 때
- 상단/하단 UI boundary를 정해야 할 때
- 공개 문서 slug와 실제 export가 일치하는지 확인해야 할 때

## Do not use for

- MiniApp capability / API 탐색
- route path, navigation tree, page entry 설계
- provider/runtime bootstrap
- TDS 밖 native module 선택

## Canonical truth sources

- `generated/llms.txt`
- `generated/llms-full.txt`
- `generated/anomalies.json`

이 snapshot들은 공식 `https://tossmini-docs.toss.im/tds-react-native/llms.txt`, `llms-full.txt`에서 내려받은 copy다.
snapshot과 로컬 overlay가 충돌하면, 컴포넌트 의미와 prop contract는 bundled `llms` snapshot을 우선하고 로컬 파일은 slug/import/docs-missing 같은 anomaly와 output contract만 보강한다.

## Read in order

1. `generated/llms.txt`
   - index 역할이다. 어떤 component/foundation/start/migration 문서가 있는지 먼저 확인한다.
   - 보통 여기서 canonical section 이름과 docs path를 찾는다.
2. `generated/llms-full.txt`
   - 후보 section heading을 검색해서 examples, interface, foundation 내용을 확인한다.
   - 여러 후보를 한 번에 비교해야 할 때도 이 파일 하나에서 해결한다.
3. `generated/anomalies.json`
   - docs slug alias, root import gap, export-only / docs-missing gate를 로컬 overlay로 적용한다.
4. `AGENTS.md`
   - output contract와 review rule index를 확인한다.
5. `references/*.md`
   - 공식 문서를 대체하지 않는다.
   - 필요한 category의 docs path와 repo-specific comparison 질문만 빠르게 확인한다.

## Decision algorithm

1. 요구사항을 먼저 분류한다.
   - text-input / search / multi-select / single-select / boolean-toggle / content-tabs / menu
   - numeric-stepper / keypad / range-slider / rating
   - list / list-summary / grid / accordion / step-flow / hero-amount / article / disclaimer / chart
   - primary-action / text-action / icon-action / dialog / toast / loading / result / error-page
   - top-nav / bottom-action / sheet
2. `generated/llms.txt`에서 canonical section 이름과 docs path를 먼저 찾는다.
   - component 선택이면 component section을 찾는다.
   - color / typography / visual token 질문이면 foundation section을 먼저 찾는다.
   - 설치/마이그레이션 질문이면 `start` / `migration` section을 찾되, 이 Skill의 본업은 UI 선택이라는 점을 명시한다.
3. `generated/llms-full.txt`에서 해당 section heading을 검색해 docs-backed 후보를 고른다.
4. docs slug mismatch는 anomaly alias를 따른다.
   - `chart` -> docs `Chart/bar-chart`
   - `stepper-row` -> docs `stepper`
5. export mismatch는 anomaly 규칙을 따른다.
   - `navbar`는 docs는 있지만 root export path가 다르므로 `@toss/tds-react-native/extensions/page-navbar`를 먼저 확인한다.
6. public docs 없는 export는 기본 추천 대상이 아니다.
   - `agreement`, `bottom-cta`, `bottom-sheet`, `fixed-bottom-cta`, `icon`, `tooltip`, `top`, `txt`
   - 이 항목은 사용자가 명시적으로 요구하거나 기존 코드베이스에서 이미 쓰고 있을 때만 추천한다.
   - 추천 시 반드시 `export-only / docs-missing`이라고 표시한다.
7. `paragraph`는 기본 추천 금지다.
   - component dir는 있지만 root export와 public docs가 약하다.
8. 상태 관리는 공식 문서와 `references/form-patterns.md` 기준을 그대로 따른다.
   - controlled: `value`/`onChange`, `checked`/`onCheckedChange`, `onValueChange`
   - uncontrolled: `defaultValue`, `defaultChecked`
9. 로컬 references는 공식 문서 요약본이 아니라 비교 관점 checklist로만 쓴다.
10. 최종 답변에는 반드시 아래를 포함한다.
   - 추천 컴포넌트
   - 왜 이 컴포넌트인지
   - 왜 가장 가까운 대안이 아닌지
   - controlled/uncontrolled 패턴
   - loading / error / empty / disabled / a11y 고려사항
   - docs URL
   - root export module
   - anomaly note 여부
   - 위 7항 중 하나라도 빠지면 `incomplete answer`로 간주한다.
   - export-only를 추천할 때는 반드시 doc-backed fallback도 같이 적는다.
11. TDS로 대체 가능한 RN primitive를 직접 추천하지 않는다.

## Canonical lookup shortcuts

- input / selection surfaces: `references/form-patterns.md`
- action / feedback / loading surfaces: `references/feedback-and-loading.md`
- list / navigation / boundary surfaces: `references/layout-and-navigation.md`
- display / visual utility surfaces: `references/display-patterns.md`
- category shortlist와 foundation/start/migration 진입: `references/decision-matrix.md`
- export gap, docs-missing gate, output contract: `references/export-gaps.md`, `references/policy-summary.md`
- upstream refresh source: `metadata.json`

## Required comparisons

- `text-field` vs `search-field`
- `checkbox` vs `switch`
- `radio` vs `segmented-control` vs `tab`
- `numeric-spinner` vs `keypad` vs `slider`
- `button` vs `text-button` vs `icon-button`
- `toast` vs `dialog` vs `result` vs `error-page`
- `list-row` vs `table-row`
- `bottom-info` vs `post`
- `doc-backed` vs `export-only / docs-missing`

## Refusal / fallback rules

- 문서도 없고 기존 코드베이스 근거도 없으면 export-only 컴포넌트는 추천하지 않는다.
- 대신 doc-backed 조합으로 대체안을 제시한다.
- unknown bottom action surface는 우선 `button` 중심 조합으로 답하고 anomaly note를 남긴다.
