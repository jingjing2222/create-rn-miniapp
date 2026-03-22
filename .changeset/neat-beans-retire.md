---
'create-rn-miniapp': patch
---

skill 관련 source of truth를 다시 정리했어요.

이제 skill 이름/라벨은 root `skills/*/SKILL.md` frontmatter에서 파생되고, frontend policy shared reference도 code-owned renderer 기준으로 재생성돼요. README, 설치 명령, 테스트 기대값도 같은 source를 보도록 맞춰서 skill 목록이나 repo slug를 바꿔도 여러 파일을 수동으로 같이 고칠 필요를 줄였어요.
