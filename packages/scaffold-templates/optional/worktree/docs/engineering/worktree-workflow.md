# Worktree 워크플로우

## 기준

이 repo는 control root 기반 worktree 운영을 기준으로 해요.
plain clone 상태라면 README bootstrap을 먼저 실행해서 local control root를 만든 뒤 시작해요.
scaffold 결과는 `main/`의 baseline commit으로 먼저 고정돼 있어서, 아래 표준 명령을 바로 실행할 수 있어요.

표준 시작 명령:

```bash
git -C main worktree add -b <branch-name> ../<branch-name> main
```

- 이 명령은 control root에서 실행해요.
- 브랜치명에는 `/`를 쓰지 않고 1-depth kebab-case만 써요. 예: `feat-login`.
- 새 브랜치용 worktree는 control root 바로 아래 sibling으로 만들어요.
- 구현, 커밋, 푸시, PR 생성은 새로 만든 worktree 안에서만 진행해요.

## 상태 확인

```bash
git -C main worktree list
```

현재 연결된 worktree 경로와 브랜치를 확인해요.

## 동기화

control root에서 기본 checkout `main/`을 최신 상태로 맞출 때는 아래 경로를 표준으로 써요:

```bash
git -C main pull --ff-only
```

- 다른 갱신 방식도 쓸 수 있지만, 자동 정리는 이 표준 경로를 기준으로 설명해요.

## 자동 정리

원격 PR이 merge되었거나 squash merge되었더라도, control root에서 아래처럼 `main/`을 최신 상태로 받으면:

```bash
git -C main pull --ff-only
```

main에 이미 반영된 clean worktree는 post-merge hook이 자동으로 정리해요.

- 변경사항이 남아있는 worktree는 자동 정리하지 않아요.
- 아직 merge되지 않은 브랜치도 자동 정리하지 않아요.

## 예외적 수동 정리

자동 정리 대상이 아니지만 직접 닫아야 할 때만 아래 명령을 써요.

```bash
git -C main worktree remove ../<branch-name>
git -C main branch -d <branch-name>
```

## 금지 규칙

- plain clone 상태에서 바로 브랜치를 파서 작업하지 않아요.
- control root `main/` checkout에서 기능 구현을 시작하지 않아요.
- worktree를 만들지 않고 바로 브랜치를 파서 작업하지 않아요.
- 구현, 커밋, 푸시, PR 생성을 `main/` checkout에서 진행하지 않아요.
