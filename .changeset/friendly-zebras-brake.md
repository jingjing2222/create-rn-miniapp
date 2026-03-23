---
"create-rn-miniapp": patch
---

Supabase 초기 scaffold에서는 remote DB push를 자동으로 하지 않도록 정리했습니다.

- Supabase provisioning은 프로젝트 연결/생성과 Edge Functions 배포까지만 자동으로 수행합니다.
- remote `db push`는 create/existing 여부와 관계없이 scaffold 중에는 자동 실행하지 않습니다.
- server README와 finalize 안내 문구도 `db:apply`를 수동 실행하는 흐름으로 맞췄습니다.
