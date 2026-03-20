## 진행 예정: worktree cleanup hook 관리 포인트 단일화

### 목표
- PR 리뷰에서 잡힌 문서/온보딩 회귀를 모두 제거한다.
- `--worktree` 경로에서 실제 repo root인 `main/` 기준 문서와 에이전트 진입 파일을 다시 맞춘다.
- 임시 planning/spec 문서인 `docs/superpowers`는 Git 추적에서 빼고 로컬 전용으로 돌린다.
- 생성 직후 worktree note도 README bootstrap과 같은 실제 절차를 가리키게 맞춘다.
- worktree 브랜치/경로 규칙을 `/` 없는 1-depth 브랜치명 기준으로 단순화한다.
- committed README의 bootstrap 섹션은 항상 맨 위에 오게 고정한다.
- generated README bootstrap 첫 문장을 사람이 읽기 쉬운 강한 안내 문장으로 다듬는다.
- generated README bootstrap 섹션에서 과한 설명 문장을 걷어내고, 실제 시작 명령만 남긴다.
- generated README와 공개 README bootstrap 예시에 `mkdir <appName>`/`cd <appName>` 단계까지 포함한다.
- cleanup hook 본문이 생성기와 bootstrap script에 중복되지 않도록 관리 포인트를 하나로 줄인다.

### 확인된 문제
- worktree scaffold 시 committed repo root(`main/`)에 `.claude/CLAUDE.md`가 빠져 plain clone과 `main/` 직접 진입 동선이 깨져 있다.
- 공개 README가 `--worktree`에서도 `cd my-miniapp && pnpm verify`만 안내해서 control root에서 verify를 치게 만든다.
- worktree note가 control root에서 상대경로로 잘못된 `docs/engineering/worktree-workflow.md`를 가리킨다.
- worktree note가 plain clone bootstrap을 `bootstrap-control-root.mjs` 단독 실행으로 오해하게 쓴다.
- worktree 문서가 브랜치명에 `/`를 허용하는 예시를 계속 남겨 두고 있다.
- bootstrap 섹션은 현재 prepend되지만, marker가 아래에 있으면 그 위치를 유지해서 “항상 맨 위”를 보장하지 못한다.
- README에 제거된 `Implement.md`가 아직 남아 있다.
- `docs/superpowers/**`가 PR에 같이 올라가면서 폐기된 `.bare` 설계를 계속 노출하고 있다.

### 수정 계획
1. `packages/create-rn-miniapp/src/scaffold/worktree.test.ts`
   - committed repo root용 `.claude/CLAUDE.md` helper 테스트를 추가한다.
   - worktree policy note가 `main/docs/engineering/worktree-workflow.md`를 가리키는지 실패 테스트를 추가한다.
2. `packages/create-rn-miniapp/src/release.test.ts`
   - README가 single-root와 worktree verify 경로를 분리해 안내하는지 확인한다.
   - README에서 `Implement.md`가 사라졌는지 확인한다.
3. `packages/create-rn-miniapp/src/scaffold/worktree.ts`
   - repo root용 `.claude/CLAUDE.md` 생성 helper를 추가한다.
   - worktree note 문구를 control-root 기준 상대경로로 수정한다.
   - worktree note가 README bootstrap의 전체 2단계 절차를 가리키게 고친다.
   - bootstrap 섹션이 기존 marker 위치와 무관하게 README 맨 위로 올라가게 고친다.
   - worktree 기본 명령과 stub 문구를 `/` 없는 브랜치명 기준으로 바꾼다.
   - bootstrap 첫 문장을 `운영해야해요` 톤으로 조정한다.
   - bootstrap 섹션에 app 이름 기반 `mkdir`/`cd` 예시를 넣고, 코드 블록 뒤 군더더기 설명은 제거한다.
4. `packages/create-rn-miniapp/src/scaffold/index.ts`
   - single-root/worktree 여부와 무관하게 실제 repo root에 `.claude/CLAUDE.md`를 생성한다.
5. `README.md`
   - quick start에서 single-root와 `--worktree` verify 경로를 분리한다.
   - `Implement.md` 언급을 제거하고 `Plan/Status/Decisions/Prompt` 기준으로 정리한다.
   - worktree 시작 명령과 예시를 `/` 없는 1-depth 브랜치명 기준으로 갱신한다.
   - 공개 bootstrap 예시도 빈 디렉토리 생성부터 시작하도록 맞춘다.
6. `.gitignore`
   - `docs/superpowers/`를 ignore에 추가한다.
   - tracked 상태인 `docs/superpowers/**`는 index에서 제거한다.
7. `packages/create-rn-miniapp/src/templates/index.ts`와 optional worktree docs/script
   - golden rule, harness guide, workflow doc, bootstrap stub를 `/` 없는 브랜치명 기준으로 같이 갱신한다.
8. `packages/scaffold-templates/optional/worktree/scripts/worktree/post-merge-cleanup.sh`
   - cleanup hook 본문을 공통 템플릿 파일 하나로 분리한다.
9. `packages/create-rn-miniapp/src/scaffold/worktree.ts`
   - 생성기 hook 설치는 공통 템플릿 파일을 읽어서 쓰게 바꾼다.
10. `packages/scaffold-templates/optional/worktree/scripts/worktree/bootstrap-control-root.mjs`
    - bootstrap script도 공통 템플릿 파일을 읽어서 hook을 설치하게 바꾼다.
11. `packages/create-rn-miniapp/src/scaffold/worktree.test.ts`와 `packages/create-rn-miniapp/src/templates/index.test.ts`
    - 생성기 hook source가 공통 템플릿과 동일한지, generated repo에 공통 hook 템플릿이 같이 복사되는지 실패 테스트를 추가한다.

### 검증 계획
- 우선: `pnpm --filter create-rn-miniapp test -- src/scaffold/worktree.test.ts src/templates/index.test.ts`
- 마무리: `pnpm verify`
