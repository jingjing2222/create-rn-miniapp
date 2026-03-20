---
"create-rn-miniapp": patch
"@create-rn-miniapp/scaffold-templates": patch
---

worktree opt-in 결정을 스캐폴드 전으로 이동하여, 파일 이동 로직(convertSingleRootToWorktreeLayout)을 제거하고 처음부터 올바른 디렉터리에 파일을 생성하도록 리팩토링했어요. 선택적 worktree 하네스 문서도 추가했어요.
