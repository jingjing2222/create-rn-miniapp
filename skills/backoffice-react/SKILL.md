---
name: backoffice-react
description: >-
  Decide how to structure an optional backoffice React screen: pick list,
  detail, form, dashboard, or bulk-action archetypes; place query, component,
  and form state; split search, table, confirm, and export boundaries; and
  validate loading, error, empty, disabled, and permission states. Do not use
  for MiniApp route design, provider runtime drift, or tRPC contract changes.
metadata:
  create-rn-miniapp.agentsLabel: "backoffice React 작업"
  create-rn-miniapp.category: "optional"
  create-rn-miniapp.order: "4"
---

# Backoffice React Skill

backoffice 운영 화면을 설계할 때 쓰는 decision skill이다.
목표는 generic React 팁이 아니라 화면 archetype, state ownership, bulk-action/form 경계, lazy boundary를 결정하는 것이다.

## Use when

- list/detail/form/dashboard/bulk-action 중 어떤 화면인지 먼저 정해야 할 때
- query params, component state, form state의 ownership을 나눠야 할 때
- table/search/filter/pagination/bulk action/confirm/export 경계를 정해야 할 때
- 무거운 화면에서 lazy import boundary를 어디에 둘지 결정할 때

## Do not use for

- MiniApp/AppInToss capability 탐색: `docs-search` 또는 공식 문서
- Granite route/page/navigation 설계: `granite-routing`
- TDS UI 선택: `tds-ui`
- provider runtime layout, 원격 상태, client 연결 점검: provider skill
- tRPC contract, router, import order 변경: `trpc-boundary`

## Read in order

1. `references/screen-archetypes.md`
2. `references/data-boundary.md`
3. `references/bulk-actions-and-forms.md`
4. `references/verification.md`
5. `references/gotchas.md`
6. workspace ownership이 헷갈리면 `docs/engineering/workspace-topology.md`

## Decision algorithm

1. 이 화면을 list, detail, form, dashboard, bulk-action 중 하나로 먼저 분류한다.
2. query params, component state, form state, server state의 source of truth를 각각 한 곳에만 둔다.
3. `QueryBar`, `ResultTable`, `DetailPanel`, `FormSections`, `BulkToolbar`, `ConfirmFlow` 중 어떤 경계가 필요한지 고른다.
4. chart, editor, CSV, 대형 table dependency처럼 첫 paint에 필요 없는 것은 lazy boundary 후보로 적는다.
5. empty/loading/error/disabled/permission denied와 selection reset까지 검증 루프를 돈다.

## Validation loop

- query params round-trip
- form default/reset/submit
- bulk selection reset
- confirm flow scope
- lazy boundary 첫 진입과 재진입

## Handoff boundary

- backend shape, router, contract 변경이면 `trpc-boundary`
- env, project drift, client linkage면 provider skill
- MiniApp route/page/navigation이면 `granite-routing`
- TDS component 선택이면 `tds-ui`

## Output contract

- 추천 구조
- 왜 그 구조인지
- 가장 가까운 대안이 왜 아닌지
- state ownership
- 검증 방법
- handoff 필요 여부
