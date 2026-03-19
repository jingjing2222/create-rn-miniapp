---
"create-rn-miniapp": patch
"@create-rn-miniapp/scaffold-templates": patch
---

기존 Supabase 프로젝트에 연결할 때 원격 DB와 기본 Edge Function을 자동으로 반영하지 않도록 조정했습니다.

- 기존 프로젝트 선택 시 `link`만 자동으로 수행하고 `db push`, 기본 Edge Function deploy는 건너뜁니다.
- 마지막 안내와 README, Supabase 운영 문서에 `db:apply`, `functions:deploy`를 직접 실행해야 하는 경우를 명확히 적었습니다.
