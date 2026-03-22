# tRPC Boundary Change Flow

이 문서는 tRPC를 같이 만든 경우에만 봐요.

## 결론
- server API 경계의 source of truth는 `packages/contracts`예요.
- route shape와 `AppRouter` 타입의 source of truth는 `packages/app-router`예요.
- frontend, backoffice, server는 서로를 직접 참조하지 않고 위 두 shared package를 기준으로 맞춰요.

## 가장 먼저 볼 파일
- `packages/contracts/src/index.ts`
- `packages/app-router/src/index.ts`
- `packages/app-router/src/root.ts`

## 변경 순서
1. boundary input/output을 바꿀 때는 먼저 `packages/contracts`의 Zod schema를 수정한다.
2. client-server 경계 타입은 schema에서 `z.infer`로만 파생하고, 같은 DTO를 별도 type alias로 중복 선언하지 않는다.
3. route 구조나 procedure shape가 바뀌면 `packages/app-router`의 `index.ts`, `root.ts`, router file을 수정한다.
4. client 진입점(`frontend/src/lib/trpc.ts`, `backoffice/src/lib/trpc.ts`)과 server runtime adapter가 새 `AppRouter` shape를 따라오는지 확인한다.
5. consumer는 `packages/contracts`, `packages/app-router`의 package root import만 쓰고 `src` 상대 경로로 내려가지 않는다.
6. build / typecheck / runtime verify까지 같이 본다.

## provider별 메모
- Cloudflare는 Worker runtime이 `@workspace/app-router`를 직접 import하고, router는 내부에서 `@workspace/contracts`를 사용해요.
- Cloudflare runtime verify는 `GET /`, 실제 router entry는 `/trpc`예요.
