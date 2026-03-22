---
'create-rn-miniapp': patch
---

Wrangler, Supabase, Firebase provisioning parser와 generated server env loader를 더 안정적으로 정리했습니다.

- Supabase JSON output은 mixed stdout을 더 이상 추측 파싱하지 않고 structured stdout만 읽습니다.
- Firebase add-firebase 재시도 안내는 package manager에 맞는 명령으로 파생되고, Cloud Build 기본 service account는 stdout 전용 형식으로 더 엄격하게 해석합니다.
- Cloudflare auth는 `wrangler auth token --json` structured output을 우선 사용하고, generated server script의 env loader는 shared renderer 한 곳에서만 관리합니다.
