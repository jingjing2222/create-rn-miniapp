# Worktree 워크플로우

## 기준

이 repo는 일반 single-root git 저장소예요.
`--worktree`로 생성했다면 새 작업은 반드시 repo root에서 worktree로 시작해요.

표준 시작 명령:

```bash
git worktree add -b <branch-name> ../<branch-name> main
```

- 이 명령은 repo root에서 실행해요.
- 새 브랜치용 worktree는 repo root 옆 경로에 만들어요.
- 구현, 커밋, 푸시, PR 생성은 새로 만든 worktree 안에서만 진행해요.

## 상태 확인

```bash
git worktree list
```

현재 연결된 worktree 경로와 브랜치를 확인해요.

## 동기화

repo root로 돌아와 기본 브랜치를 최신 상태로 맞출 때:

```bash
git switch main
git pull --ff-only
```

## 정리

머지 후 worktree를 정리할 때:

```bash
git worktree remove ../<branch-name>
git branch -d <branch-name>
```

## 금지 규칙

- repo root `main` checkout에서 기능 구현을 시작하지 않아요.
- worktree를 만들지 않고 바로 브랜치를 파서 작업하지 않아요.
- 구현, 커밋, 푸시, PR 생성을 repo root `main` checkout에서 진행하지 않아요.
