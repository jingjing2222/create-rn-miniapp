# Cloudflare Worker Client Connection

- frontend env: `frontend/.env.local`의 `MINIAPP_API_BASE_URL`
- backoffice env: `backoffice/.env.local`의 `VITE_API_BASE_URL`
- plain mode client: `frontend/src/lib/api.ts`, `backoffice/src/lib/api.ts`
- tRPC mode client: `frontend/src/lib/trpc.ts`, `backoffice/src/lib/trpc.ts`
- contracts/router 변경 순서는 `trpc-boundary`로 넘긴다.
