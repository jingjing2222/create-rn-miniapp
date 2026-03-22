---
"create-rn-miniapp": patch
---

생성기가 실행 시점의 최신 외부 CLI 동작에 덜 흔들리도록 외부 CLI 명세를 저장소가 직접 소유하는 매니페스트로 고정했어요.

`wrangler`, `firebase-tools`, `supabase`, `create-cloudflare` 같은 외부 CLI 호출을 정확한 버전 명세로 렌더하고,
루트 workspace topology도 하드코딩된 디렉터리 순회 대신 실제 매니페스트 순서를 기준으로 읽도록 바꿨어요.
