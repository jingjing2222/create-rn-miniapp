---
"create-rn-miniapp": patch
"@create-rn-miniapp/scaffold-templates": patch
---

기존 원격 프로젝트 연결 경로의 후속 보정을 반영합니다.

- Firebase 기존 프로젝트에서 원격 초기화를 건너뛰어도 Blaze 확인과 build IAM 권한 준비는 계속 진행합니다.
- Supabase 기존 프로젝트에서 원격 초기화를 건너뛴 뒤에도 generated root Biome과 server 스크립트가 깨지지 않도록 보정합니다.
