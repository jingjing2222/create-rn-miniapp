---
"create-rn-miniapp": patch
---

런타임에서 사람이 직접 작성한 여러 줄 문자열 렌더링을 `dedent` helper 기준으로 정리했어요.

`patching/*`, `templates/*`, `providers/*` 전반의 사람이 직접 작성한 여러 줄 블록을
`dedent`/`dedentWithTrailingNewline`으로 통일하고,
정적 배열 리터럴 `join('\n')`를 막는 회귀 테스트도 추가해서 같은 패턴이 다시 들어오지 않게 했어요.
