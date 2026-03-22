---
"create-rn-miniapp": patch
"@create-rn-miniapp/scaffold-templates": patch
---

스캐폴딩 런타임 계약과 생성 템플릿 계약이 서로 다른 source를 보지 않도록 정리했어요.

- package manager별 script 실행 문법을 adapter 기준으로 한 곳에서만 파생되게 맞췄어요.
- create/add flow의 server provider, tRPC 활성화, finalize 흐름 판단을 shared helper로 모았어요.
- provider 공용 JSON parser와 Supabase bootstrap command builder를 shared module로 분리해서 provider 간 구현 누수를 줄였어요.
- generated README, server README, root docs 렌더링이 같은 metadata와 script catalog를 기준으로 움직이게 정리했어요.
- 루트 Yarn 설정은 local cache 기준을 기본으로 두고, 워크스페이스별 `.yarnrc.yml`에 의존하지 않게 맞췄어요.
