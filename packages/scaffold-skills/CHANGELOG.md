# @create-rn-miniapp/scaffold-skills

## 0.1.0

### Minor Changes

- 04c5d45: `create-rn-miniapp` 스캐폴드 기본 구조를 skill 중심 계약/문서 체계로 재편했습니다.

  `@create-rn-miniapp/scaffold-templates`는 `AGENTS.md`, `CLAUDE.md`, `.github/copilot-instructions.md`, dynamic docs, root verify/scripts 구성을 새 scaffold 구조에 맞게 갱신했습니다.

  `@create-rn-miniapp/scaffold-skills`를 새 canonical skill source로 추가하고, 생성 시 `.agents/skills`와 `.claude/skills` mirror를 함께 만들도록 정리했습니다.

  `--add` 이후에도 실제 workspace 상태를 기준으로 문서와 optional skill이 다시 렌더되도록 generator 구조를 리팩토링했습니다.
