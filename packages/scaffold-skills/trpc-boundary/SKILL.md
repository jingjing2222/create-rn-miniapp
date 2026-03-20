---
name: trpc-boundary
description: tRPC boundary change order across packages/contracts, packages/app-router, server, and clients
---

# tRPC Boundary Skill

Cloudflare + tRPC 조합에서 client-server 경계를 수정할 때 사용하는 Skill입니다.

## 읽는 순서

1. `references/change-flow.md`를 먼저 읽는다.
2. package 책임과 import boundary는 `docs/engineering/workspace-topology.md`를 같이 확인한다.

## 핵심 원칙

- boundary shape는 `packages/contracts`
- router shape와 `AppRouter`는 `packages/app-router`
- consumer는 shared package root import만 사용하고 서로를 직접 참조하지 않는다.
