---
"create-rn-miniapp": patch
"@create-rn-miniapp/scaffold-templates": patch
---

기존 원격 리소스에 연결할 때 초기화 여부를 provider별로 먼저 고르게 바꿨습니다.

- Supabase, Firebase, Cloudflare에서 기존 원격 리소스를 고르면 `원격에 있는 내용을 초기화할까요?`를 먼저 물어봅니다.
- 초기화를 건너뛰면 기존 리소스와 메타데이터만 연결하고, DB 반영이나 Functions/Worker 배포 같은 원격 변경은 자동으로 하지 않습니다.
- 마지막 안내, 생성되는 `server/README.md`, provider 운영 문서도 같은 분기 기준으로 다시 정리했습니다.
