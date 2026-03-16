# server API SSOT: tRPC

이 문서는 tRPC를 같이 만든 경우에만 봐요.

## 결론
- server API의 source of truth는 `packages/trpc`예요.
- frontend, backoffice, server는 서로를 직접 참조하지 않고 `packages/trpc`를 기준으로 맞춰요.

## 가장 먼저 볼 파일
- `packages/trpc/src/index.ts`
- `packages/trpc/src/root.ts`
- `packages/trpc/src/routers/example.ts`

## 어떻게 이해하면 되나요
- router 구조를 바꾸고 싶으면 `packages/trpc`를 먼저 수정해요.
- client 타입은 `frontend/src/lib/trpc.ts`, `backoffice/src/lib/trpc.ts`에서 `AppRouter`로 따라와요.
- server runtime adapter는 provider별로 다르지만, API shape의 SSOT는 계속 `packages/trpc`예요.

## provider별 메모
- Cloudflare는 Worker runtime이 `@workspace/trpc`를 직접 import해요.
- Supabase는 `server/supabase/functions/api/deno.json`의 `imports`가 `@workspace/trpc`를 `packages/trpc/src/index.ts`로 직접 연결해요.
