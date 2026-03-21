---
"create-rn-miniapp": patch
"@create-rn-miniapp/scaffold-templates": patch
"@create-rn-miniapp/scaffold-skills": patch
---

skill taxonomy를 새 canonical 이름 체계로 정리하고 생성물의 skill mirror가 같은 구조를 따르도록 맞췄습니다.

server provider skill에서 instance state와 원격 변경 절차를 분리하고, generated repo의 scaffold 상태를 `server/.create-rn-miniapp/state.json`과 `server/README.md`가 소유하도록 정리했습니다.

또한 `--add` 실행 시 기존 server scaffold state를 보존하도록 보강했고, Remote Ops 및 다음 명령 안내가 shared script metadata를 기준으로 일관되게 파생되도록 중복을 제거했습니다.
