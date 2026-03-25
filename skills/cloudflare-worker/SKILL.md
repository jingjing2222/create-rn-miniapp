---
name: cloudflare-worker
description: >-
  Diagnose a Cloudflare Worker-backed server workspace: classify runtime,
  binding, env, local dev, and client-linkage drift; check D1/R2 and base URL
  alignment; and decide when the issue belongs to `trpc-boundary` or
  `server/README.md` Remote Ops. Do not use for deploy-only repair or generic
  UI work.
metadata:
  create-rn-miniapp.agentsLabel: "Cloudflare Worker 작업"
  create-rn-miniapp.category: "optional"
  create-rn-miniapp.order: "5"
---

# Cloudflare Worker Skill

Cloudflare Worker provider를 진단할 때 쓰는 decision skill이다.
목표는 runtime/binding/env/client-linkage 문제를 먼저 분류하고, remote deploy나 tRPC boundary와 섞이지 않게 자르는 것이다.

## Use when

- Worker runtime layout, binding, request surface를 점검할 때
- D1/R2/env/client base URL drift를 분류할 때
- local dev smoke path와 deployed Worker 문제를 분리할 때

## Do not use for

- contract, AppRouter, client import order 변경: `trpc-boundary`
- MiniApp route/page/navigation: `granite-routing`
- remote deploy, binding repair, `workers.dev` repair 같은 원격 mutate 실행

## Read in order

1. `server/.create-rn-miniapp/state.json`
2. `server/README.md`
3. `references/server-common.md`
4. `references/provider-overlay.md`
5. workspace ownership이 헷갈리면 `docs/engineering/workspace-topology.md`

## Default checks

1. shared guide 기준으로 runtime/layout, env/linkage, boundary, remote state 중 어디인지 먼저 적는다.
2. `state.json`의 `trpc`를 보고 client linkage 기대 파일을 고른다.
3. `server/.env.local`, `frontend/.env.local`, `backoffice/.env.local`이 같은 Worker를 가리키는지 본다.
4. binding 문제가 의심되면 `wrangler.jsonc`, `wrangler.vitest.jsonc`, `worker-configuration.d.ts`를 같이 본다.

## Failure signatures

- D1/R2 binding 오류가 타입, test, runtime 중 한쪽에서만 보인다.
- client가 wrong host, HTML, 404를 받고 Worker local dev는 멀쩡하다.
- frontend와 backoffice가 서로 다른 base URL을 쓴다.
- tRPC import/type 오류가 request layer 문제처럼 보인다.

## Smoke tests

- `node ./scripts/check-env.mjs`
- `node ./scripts/check-client-links.mjs`
- `server` `dev`
- `server` `typecheck`
- `server` `build`
- `server` `test`

## Handoff boundary

- contract/app-router/client import order면 `trpc-boundary`
- remote deploy, binding repair, `workers.dev` 재활성화는 `server/README.md` `Remote Ops`

## Report evidence

- `state.json` 요약
- client base URL 비교 결과
- binding 관련 파일에서 확인한 차이
- local dev, build, deployed Worker 중 어디에서만 재현되는지
