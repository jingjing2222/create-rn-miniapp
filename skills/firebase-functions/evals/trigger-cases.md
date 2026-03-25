# trigger cases

## should-trigger

- 이 endpoint를 callable로 둘지 http로 둘지 먼저 결정해줘
- emulator에서는 되는데 deployed function이 404라서 region drift인지 보고 싶어
- direct Firestore read는 permission denied인데 callable fallback은 돼서 어디가 문제인지 분류해줘
- frontend와 backoffice가 같은 Firebase project id를 보는지 점검 순서를 알려줘
- Blaze, IAM, Firestore 준비 부족인지 local 코드 문제인지 먼저 잘라줘
- project id와 function region이 client env와 안 맞는 것 같아서 evidence를 모아줘
- trigger성 작업인데 http 함수로 붙여도 되는지 surface 선택 기준을 줘
- remote repair로 넘길지 local diagnosis로 끝낼지 handoff 기준을 정리해줘

## should-not-trigger

- Firebase deploy를 지금 실행해줘
- Firestore seed를 지금 넣어줘
- Supabase project ref mismatch를 진단해줘
- Cloudflare D1 binding drift를 봐줘
- tRPC contract order를 바꿔줘
- backoffice CSV export 구조를 정해줘
- MiniApp route/page 구조를 설계해줘
- Firebase 기초 개념을 교과서처럼 설명해줘

## output quality bar

- chosen surface: callable / http / trigger
- project id / region / emulator evidence
- local smoke path
- remote readiness 여부
- `server/README.md` handoff 여부
