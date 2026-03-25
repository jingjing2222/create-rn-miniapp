# trigger cases

## should-trigger

- frontend와 backoffice가 서로 다른 Supabase project를 보는 것 같아서 체크 순서를 정리해줘
- local stack에서는 migration이 보이는데 remote DB에는 없어서 어느 축 문제인지 분류해줘
- `supabase.functions.invoke('api')`가 404인데 project ref drift인지 보고 싶어
- browser에서만 RLS 에러가 나는데 client env와 server env 중 어디부터 확인할지 정해줘
- DB schema 문제인지 Edge Function 문제인지 먼저 잘라줘
- `remoteInitialization`이 `not-run`인데 remote parity를 가정해도 되는지 판단해줘
- frontend/backoffice가 같은 host를 봐야 하는데 URL/key evidence를 어떻게 모을지 알려줘
- `server/README.md`로 넘겨야 할 remote 작업인지 local diagnosis로 끝낼 수 있는지 구분해줘

## should-not-trigger

- `db:apply`를 지금 실행해줘
- Supabase Edge Function 코드를 새로 배포해줘
- Cloudflare Worker base URL drift를 봐줘
- Firebase emulator와 project drift를 진단해줘
- TDS form component를 골라줘
- MiniApp route tree를 재설계해줘
- backoffice list/detail/form 구조를 정해줘
- Supabase 기본 소개를 길게 설명해줘

## output quality bar

- issue classification
- project ref / client host evidence
- local smoke path
- remote ops handoff 여부
- DB / RLS / Edge Function / env 중 어느 축인지
