---
name: supabase-project
description: >-
  Diagnose a Supabase-backed server workspace: separate DB, RLS, Edge
  Function, env, and project-ref drift; check frontend and backoffice
  alignment; and decide when the issue is remote state versus local linkage.
  Do not use for remote db apply/deploy or generic route/UI work.
metadata:
  create-rn-miniapp.agentsLabel: "Supabase project 작업"
  create-rn-miniapp.category: "optional"
  create-rn-miniapp.order: "6"
---

# Supabase Project Skill

Supabase provider를 진단할 때 쓰는 decision skill이다.
목표는 DB/RLS/Edge Function/env/project-ref 문제를 같은 증상으로 뭉개지 않고, local 링크 문제와 remote project 문제를 분리하는 것이다.

## Use when

- Supabase DB, RLS, Edge Function, env, project ref drift를 나눠 볼 때
- frontend/backoffice가 같은 Supabase project를 보는지 확인할 때
- local stack 문제와 remote project 문제를 분리할 때

## Do not use for

- remote `db:apply`, `functions:deploy`, seed 절차 실행
- MiniApp route/page/navigation 설계: `granite-routing`
- TDS UI 선택: `tds-ui`

## Read in order

1. `server/.create-rn-miniapp/state.json`
2. `server/README.md`
3. `references/server-common.md`
4. `references/provider-overlay.md`
5. workspace ownership이 헷갈리면 `docs/engineering/workspace-topology.md`

## Default checks

1. DB schema, RLS, Edge Function, env, project ref 중 어느 축인지 먼저 적는다.
2. `server/.env.local`의 `SUPABASE_PROJECT_REF`와 client URL host를 맞춘다.
3. `supabase/migrations/`와 `supabase/functions/` 중 어느 쪽이 증상과 직접 연결되는지 분리한다.
4. `remoteInitialization`이 `skipped` 또는 `not-run`이면 remote parity를 가정하지 않는다.

## Failure signatures

- Edge Function 호출이 404거나 다른 프로젝트 응답을 받는다.
- local DB에는 있는데 remote DB에는 없는 migration을 기대한다.
- browser에서만 auth/RLS 오류가 난다.
- frontend와 backoffice가 서로 다른 Supabase host를 쓴다.

## Smoke tests

- `node ./scripts/check-env.mjs`
- `node ./scripts/check-client-links.mjs`
- `server` `dev`
- `server` `functions:serve`
- `server` `typecheck`
- `server` `db:apply:local`
- `server` `db:reset`

## Handoff boundary

- remote `db:apply`, `functions:deploy`, seed는 `server/README.md` `Remote Ops`
- 화면 구조는 `backoffice-react`, MiniApp route는 `granite-routing`

## Report evidence

- `state.json` 요약
- project ref와 client host 비교 결과
- DB/RLS/Edge Function/env 중 어느 축인지
- local stack만 깨지는지, remote project만 깨지는지
