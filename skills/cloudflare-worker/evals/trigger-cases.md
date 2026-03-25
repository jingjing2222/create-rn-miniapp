# trigger cases

## should-trigger

- frontend는 localhost를 보는데 backoffice는 다른 `workers.dev` URL을 봐서 어디부터 봐야 할지 정리해줘
- `wrangler.vitest.jsonc`에서는 D1이 잡히는데 실제 dev request에서는 binding이 없다고 나와
- Worker local dev는 뜨는데 client가 HTML을 받아서 base URL drift인지 보고 싶어
- `worker-configuration.d.ts`와 실제 binding 설정이 어긋난 것 같은데 분류해줘
- Cloudflare 쪽 문제인지 `trpc-boundary`로 넘길 문제인지 먼저 잘라줘
- `state.json`이 `skipped`인데 deployed Worker 동작을 가정해도 되는지 판단해줘
- frontend/backoffice가 같은 Worker를 보는지 read-only 체크 순서를 알려줘
- request surface 문제인지 D1/R2 binding 문제인지 evidence 기준으로 구분해줘

## should-not-trigger

- AppRouter import order를 바꿔줘
- Cloudflare deploy를 지금 실행해줘
- MiniApp route/page 구조를 정해줘
- backoffice bulk action 구조를 잡아줘
- TDS component를 골라줘
- Supabase Edge Function 404를 봐줘
- Firebase callable function region mismatch를 봐줘
- Cloudflare 소개나 Workers 기본 개념을 설명해줘

## output quality bar

- issue classification
- default checks
- provider-specific failure signatures
- local smoke path
- remote ops 또는 `trpc-boundary` handoff
