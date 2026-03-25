# Firebase provider overlay

## surface choice

- callable: Firebase client SDK에서 직접 부르고 auth context가 같이 필요한 request/response
- http: non-SDK caller, webhook, public endpoint, custom HTTP semantics
- Firestore trigger: 문서 변경에 반응하는 side effect

## provider-specific default checks

- `server/functions/src/index.ts`, `firebase.json`, `firestore.rules`, `firestore.indexes.json`, `server/.env.local`을 같이 본다.
- `FIREBASE_PROJECT_ID`, `FIREBASE_FUNCTION_REGION`이 frontend/backoffice env와 같은지 확인한다.
- 문제가 emulator에서만 나는지, deployed function에서만 나는지, direct Firestore read에서만 나는지 분리한다.
- Blaze, IAM, Firestore 준비 여부는 code bug가 아니라 remote readiness인지 먼저 본다.

## failure signatures

- emulator에서는 되는데 deployed callable/http가 404거나 region mismatch로 깨진다.
- direct Firestore read는 permission denied인데 callable fallback은 된다.
- deploy 전 단계에서 Blaze, IAM, Cloud Build, Firestore 준비 부족이 걸린다.
- frontend와 backoffice가 서로 다른 Firebase project id를 본다.

## smoke tests

- `node ./scripts/check-env.mjs`
- `node ./scripts/check-client-links.mjs`
- `server` `build`
- `server` `typecheck`
- `server` `dev`

## handoff cues

- deploy, Firestore ensure, seed, repair는 `server/README.md` `Remote Ops`
- 화면 구조나 route 문제는 `backoffice-react`, `granite-routing`

## report evidence

- callable / http / trigger 중 어떤 surface인지
- project id, region, emulator 여부
- permission, Blaze, IAM, Firestore readiness 신호
