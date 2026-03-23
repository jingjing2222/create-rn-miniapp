---
"create-rn-miniapp": patch
---

create flow에서 모노레포 루트 skeleton을 먼저 생성하도록 정리했습니다.

- `frontend`와 `server` scaffold 전에 루트 `package.json`과 workspace manifest를 먼저 씁니다.
- create 옵션에서 예상 workspace 목록을 직접 계산해 초기 root manifest와 이후 sync 기준을 맞췄습니다.
- root template가 중간에 다시 적용되지 않도록 scaffold 순서를 단순화했습니다.
