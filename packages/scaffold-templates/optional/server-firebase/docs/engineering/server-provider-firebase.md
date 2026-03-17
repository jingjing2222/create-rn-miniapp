# server provider guide: Firebase

이 문서는 server가 Firebase Functions workspace일 때 먼저 보는 운영 가이드예요.
이 경우 server는 Firebase project와 Functions 배포를 담당하는 workspace예요.

## server가 맡는 역할
- Firebase project 선택 또는 생성
- Blaze 요금제와 build IAM 확인
- Firestore API와 `(default)` database 준비
- Functions build와 deploy
- Firestore rules / indexes / seed 관리
- frontend, backoffice가 붙을 Firebase Web SDK 설정 연결

## 가장 먼저 볼 파일
- `server/firebase.json`
- `server/firestore.rules`
- `server/firestore.indexes.json`
- `server/firestore.seed.json`
- `server/.firebaserc`
- `server/functions/src/index.ts`
- `server/scripts/firebase-firestore-seed.mjs`
- `server/package.json`
- `server/.env.local`
- `server/README.md`

## 가장 먼저 쓸 명령
- `cd server && {{packageManagerRunCommand}} build`
- `cd server && {{packageManagerRunCommand}} typecheck`
- `cd server && {{packageManagerRunCommand}} deploy`
- `cd server && {{packageManagerRunCommand}} firestore:seed`
- `cd server && {{packageManagerRunCommand}} logs`

## frontend와 backoffice는 어떻게 연결되나요
- `frontend/src/lib/firebase.ts`
- `frontend/src/lib/firestore.ts`
- `frontend/src/lib/storage.ts`
- `backoffice/src/lib/firebase.ts`
- `backoffice/src/lib/firestore.ts`
- `backoffice/src/lib/storage.ts`
- 각 workspace의 `.env.local`

클라이언트는 Firebase Web SDK를 통해 같은 프로젝트에 붙어요.
Functions는 server에서 배포하고, 앱은 project 설정과 SDK config를 받아서 사용해요.

## 작업할 때 먼저 확인할 것
- project가 Blaze 요금제인지
- build service account IAM이 맞는지
- Firestore API와 `(default)` database가 준비됐는지
- `server/functions` build가 먼저 통과하는지
- `server/firestore.rules`, `server/firestore.indexes.json`, `server/firestore.seed.json`을 바꿨다면 `deploy` 또는 `firestore:seed`까지 이어서 실행해야 하는지
- region과 deploy target이 현재 프로젝트와 맞는지
- 비대화형 deploy가 필요하면 `server/.env.local`의 `FIREBASE_TOKEN` 또는 `GOOGLE_APPLICATION_CREDENTIALS`가 준비됐는지

자세한 구조와 스크립트는 `server/README.md`를 같이 봐요.
