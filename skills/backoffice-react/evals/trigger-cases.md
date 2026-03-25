# trigger cases

## should-trigger

- 운영툴 주문 목록에서 search, filter, sort, pagination을 어떤 state로 나눌지 정해줘
- 관리자 테이블에 bulk deactivate와 confirm modal을 넣으려는데 구조를 제안해줘
- CSV export가 현재 필터 결과를 따라야 하는데 boundary를 어떻게 나누면 좋을지 봐줘
- detail 화면에서 read-only summary와 edit form을 같은 화면에 둘지 분리할지 판단해줘
- 무거운 chart + table + editor 화면이라 lazy import 경계를 어디에 둘지 정해줘
- API 응답을 badge label과 table row model로 바꾸는 adapter를 어디에 둘지 정해줘
- refetch가 오면 form default가 다시 덮여서 draft가 날아가는데 ownership을 다시 잡아줘
- permission denied, disabled, empty, error 상태를 어떤 경계에서 나눌지 정리해줘

## should-not-trigger

- MiniApp route param 구조를 다시 설계해줘
- Cloudflare Worker D1 binding missing 오류를 봐줘
- tRPC router type error를 고쳐줘
- TDS에서 button이 맞는지 text-button이 맞는지 정해줘
- Supabase project ref mismatch를 진단해줘
- Firebase Functions region drift를 봐줘
- React `useEffect`가 뭔지 설명해줘
- 원격 DB apply 명령을 실행해줘

## output quality bar

- 추천 archetype
- 가장 가까운 대안이 왜 아닌지
- state ownership
- verification loop
- handoff 필요 여부
