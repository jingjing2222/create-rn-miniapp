## 진행 예정: control root 제거 + `--worktree`는 정책 플래그로 유지

### 결정
- `git worktree` 자체는 유지한다.
- create 시 `control root + .bare + main/` 특수 레이아웃은 제거한다.
- 생성 결과물은 항상 일반 single-root repo로 통일한다.
- `--worktree` 플래그는 유지하되, repo 구조를 바꾸는 옵션이 아니라 worktree discipline을 켜는 정책 플래그로 재정의한다.

### 문제
- 현재 `--worktree`는 생성 결과를 clone 구조와 다른 특수 레이아웃으로 바꾼다.
- commit되는 하네스 문서에 control root, `main/`, `../<branch>` 같은 로컬 레이아웃 전제가 섞여 clone 사용자 기준이 깨진다.
- `workspace-inspector`, CLI help, scaffold note, optional docs가 모두 control root 개념을 알고 있어 구조적 복잡도가 커졌다.

### 목표
- 생성 결과, clone 결과, 하네스 문서가 모두 같은 repo root 관점을 사용한다.
- worktree를 쓰는 사람도 일반 Git repo 기준 명령만 보면 되게 만든다.
- `--worktree`를 고른 팀은 하네스 문서와 에이전트 규칙이 worktree 사용을 일관되게 유도하게 만든다.
- `--worktree`를 고른 repo에서는 새 작업 시작 규칙을 하나로 고정한다.
- 기존 control-root 레이아웃은 새로 생성하지 않되, 기존 레포를 읽는 최소 호환은 유지할지 구현 시점에 판단한다.

### 구현 방향
1. 생성 경로 단순화
   - `packages/create-rn-miniapp/src/scaffold/worktree.ts`의 bare repo / control root 초기화 로직 제거
   - `packages/create-rn-miniapp/src/scaffold/index.ts`에서 `main/` worktree 생성 분기 제거
   - provisioning note는 "repo는 일반 root로 생성됐고, 새 작업은 필요 시 worktree로 시작" 안내로 교체
2. CLI 계약 정리
   - `packages/create-rn-miniapp/src/cli.ts`에서 `--worktree` 옵션은 유지
   - help / prompt 문구를 "control root 레이아웃"이 아니라 "worktree workflow 권장" 의미로 변경
   - `--worktree` 선택 시 생성 직후 문서/가이드/에이전트 규칙이 worktree 사용을 유도하도록 연결
3. 하네스 문서 정리
   - `packages/scaffold-templates/optional/worktree/docs/engineering/worktree-workflow.md`를 일반 repo 기준 가이드로 다시 작성
   - `packages/create-rn-miniapp/src/templates/index.ts`에서 worktree golden rule은 유지하되, control root 전제가 없는 강제 규칙으로 변경
   - `하네스-실행가이드.md`의 공통 "브랜치 생성, 커밋, 브랜치 푸시, PR 생성" 마무리 라인은 항상 유지
   - docs index에서는 worktree 문서를 이 repo의 권장 브랜치 시작 방식으로 설명하되 clone-safe하게 유지
4. 기존 control-root 레이아웃 호환성 판단
   - `packages/create-rn-miniapp/src/workspace-inspector.ts`의 `main/` fallback은 유지할지 검토
   - 최소 방침: 새 생성은 단순화하되, 기존 control-root 레이아웃을 `--add`에서 읽는 기능은 당장 깨지지 않게 유지
   - 필요하면 deprecated 주석/테스트만 남기고 후속 제거로 분리

### 파일별 작업 계획
1. `packages/create-rn-miniapp/src/scaffold/worktree.ts`
   - 더 이상 쓰지 않는 control root helper, hook, note API 정리
   - 남길 코드가 없다면 파일 삭제까지 검토
2. `packages/create-rn-miniapp/src/scaffold/index.ts`
   - `useWorktree` 분기 제거
   - 생성 루트를 항상 `controlRoot` 자체로 사용하도록 단순화
3. `packages/create-rn-miniapp/src/cli.ts`
   - parse/help/resolve 흐름은 유지하되, 옵션 의미와 질문 문구를 새 정책에 맞게 수정
4. `packages/create-rn-miniapp/src/templates/index.ts`
   - worktree optional docs 주입 방식 수정
   - AGENTS golden rule은 repo-root 기준 worktree discipline의 강제 규칙으로 수정
   - harness guide override는 공통 finalize line을 유지하는 방식으로 수정
5. `packages/scaffold-templates/optional/worktree/docs/engineering/worktree-workflow.md`
   - 일반 repo 기준 예시 명령으로 전면 수정
6. 테스트
   - `packages/create-rn-miniapp/src/scaffold/worktree.test.ts`: control root 생성 테스트 제거, 일반 repo 기준 안내 테스트로 대체
   - `packages/create-rn-miniapp/src/cli.test.ts`: `--worktree` 파싱은 유지하고 프롬프트 문구/의미만 수정
   - `packages/create-rn-miniapp/src/templates/index.test.ts`: 공통 finalize line 유지 + clone-safe worktree rule 검증으로 수정
   - `packages/create-rn-miniapp/src/workspace-inspector.test.ts`: 호환 유지 여부에 따라 유지 또는 deprecated 케이스로 명시

### TDD 순서
1. CLI 테스트부터 깨기
   - `--worktree` 의미 변경에 맞춰 parse/help/prompt 테스트 수정
2. scaffold/worktree 테스트 깨기
   - control root 생성 기대를 제거
3. template 테스트 깨기
   - worktree 문서가 clone-safe하고 공통 finalize line이 유지되는지 고정
4. 그다음 implementation 정리

### 오픈 포인트
- 기존 control-root 레이아웃을 읽는 `workspace-inspector` fallback은 이번 PR에서 유지하는 쪽이 안전하다.
- optional/worktree 템플릿 자체를 완전히 없앨지, 일반 Git worktree 가이드 문서로 재사용할지는 구현 전에 한 번 더 확인한다.
  - 현재 추천: 문서는 유지하되 내용만 일반화

### 고정 규칙 초안
- `--worktree` repo의 Golden Rule:
  - `새 작업은 반드시 repo root에서 git worktree add -b <branch> ../<branch> main 으로 시작한다.`
- `하네스-실행가이드` 추가 단계:
  - `새 브랜치 작업은 repo root에서 git worktree add -b <branch> ../<branch> main 으로 worktree를 만든 뒤 그 worktree 안에서 구현, 커밋, 푸시, PR 생성까지 진행한다.`
- `worktree-workflow.md` 역할:
  - 예외 없는 표준 시작/조회/정리 절차를 제공한다.
  - control root 설명 없이 repo root만 기준으로 쓴다.

### 검증 계획
- 우선: 관련 단위 테스트만 집중 실행
  - `pnpm test -- packages/create-rn-miniapp/src/cli.test.ts`
  - `pnpm test -- packages/create-rn-miniapp/src/scaffold/worktree.test.ts`
  - `pnpm test -- packages/create-rn-miniapp/src/templates/index.test.ts`
  - `pnpm test -- packages/create-rn-miniapp/src/workspace-inspector.test.ts`
- 마무리: `pnpm verify`
