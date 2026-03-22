# Firebase Functions Client Connection

- frontend clients: `frontend/src/lib/firebase.ts`, `frontend/src/lib/firestore.ts`, `frontend/src/lib/storage.ts`
- backoffice clients: `backoffice/src/lib/firebase.ts`, `backoffice/src/lib/firestore.ts`, `backoffice/src/lib/storage.ts`
- frontend env는 `MINIAPP_FIREBASE_*`, backoffice env는 `VITE_FIREBASE_*`를 사용한다.
- callable/http entry alignment는 `server/functions/src/index.ts`와 `server/README.md` 기준으로 확인한다.
