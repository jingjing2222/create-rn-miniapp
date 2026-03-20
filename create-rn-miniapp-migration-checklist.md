# create-rn-miniapp 하네스 → Skills 중심 구조 마이그레이션 체크리스트

> Audit note (2026-03-20): 현재 저장소 상태와 테스트 기준으로 line-by-line 확인했다. 체크된 항목은 코드/문서/테스트로 확인된 상태만 반영했고, historical/process 성격이거나 구현 형태가 체크리스트 문구와 아직 다르면 비워 뒀다.

## 목표

현재 `AGENTS.md + docs/engineering + optional engineering docs` 중심 구조를 다음 형태로 재편한다.

- 루트 계약: `AGENTS.md`
- 에이전트 어댑터: `CLAUDE.md`, `.github/copilot-instructions.md`
- 로컬 정책/상태 문서: `docs/`
- 작업 플레이북/외부 플랫폼 지식: `.agents/skills/`
- Claude 호환용 실제 미러: `.claude/skills/`

핵심 원칙은 아래 2개다.

1. **항상 강제되어야 하는 규칙은 문서와 검증 스크립트에 남긴다.**
2. **반복 작업법, 외부 플랫폼 인덱스, 참조 카탈로그는 Skill로 뺀다.**

---

## 최종 생성물 구조

```text
<workspace-root>/
  AGENTS.md
  CLAUDE.md

  .github/
    copilot-instructions.md

  .agents/
    skills/
      miniapp/
        SKILL.md
        references/
        assets/
      granite/
        SKILL.md
        references/
        assets/
      tds/
        SKILL.md
        references/
        assets/
      backoffice-react/
        SKILL.md
        references/
        assets/
      server-cloudflare/
        SKILL.md
        references/
        assets/
      server-supabase/
        SKILL.md
        references/
        assets/
      server-firebase/
        SKILL.md
        references/
        assets/
      trpc-boundary/
        SKILL.md
        references/
        assets/

  .claude/
    skills/

  docs/
    index.md
    ai/
      Prompt.md
      Plan.md
      Status.md
      Decisions.md
    product/
      기능명세서.md
    engineering/
      repo-contract.md
      frontend-policy.md
      workspace-topology.md

  scripts/
    sync-skills.mjs
    check-skills.mjs
```

---

## 문서/Skill 경계

### 문서에 남길 것

- `docs/engineering/repo-contract.md`
  - 루트 툴체인
  - verify 정의
  - 문서/skill precedence
  - no-secrets
  - 작업 완료 기준
- `docs/engineering/frontend-policy.md`
  - Granite 라우팅 강제 규칙
  - native import 금지/허용
  - TDS/RN UI 경계 규칙
  - 정책 검사 스크립트 기준
- `docs/engineering/workspace-topology.md`
  - `frontend`, `server`, `backoffice` 역할
  - env/API/import 경계
  - `packages/contracts`, `packages/app-router` 책임

### Skill로 옮길 것

- MiniApp/Granite API feature map, 전체 API index
- Granite 구현 패턴, navigation/route 설계 가이드
- TDS 컴포넌트 선택 기준, slug/reference 카탈로그
- backoffice React best practices
- provider별 server 운영 가이드
- tRPC 변경 순서, schema/router/client-server 반영 순서

---

## 기존 문서 → 새 위치 매핑

- [x] `base/docs/engineering/appsintoss-granite-api-index.md` → `.agents/skills/miniapp/references/feature-map.md`
- [x] `base/docs/engineering/appsintoss-granite-full-api-index.md` → `.agents/skills/miniapp/references/full-index.md`
- [x] `base/docs/engineering/granite-ssot.md`
  - [x] 강제 규칙 → `docs/engineering/frontend-policy.md`
  - [x] 사용 패턴/예시 → `.agents/skills/granite/references/patterns.md`
- [x] `base/docs/engineering/native-modules-policy.md` → `docs/engineering/frontend-policy.md`
- [x] `base/docs/engineering/tds-react-native-index.md` → `.agents/skills/tds/references/catalog.md`
- [x] `base/docs/engineering/에이전트전략.md` → 삭제 후 `AGENTS.md` / `repo-contract.md`로 흡수
- [x] `base/docs/engineering/하네스-실행가이드.md` → 삭제 후 `AGENTS.md` / `repo-contract.md`로 흡수
- [x] `optional/backoffice/docs/engineering/backoffice-react-best-practices.md` → `.agents/skills/backoffice-react/references/best-practices.md`
- [x] `optional/server-cloudflare/docs/engineering/server-provider-cloudflare.md` → `.agents/skills/server-cloudflare/references/provider-guide.md`
- [x] `optional/server-supabase/docs/engineering/server-provider-supabase.md` → `.agents/skills/server-supabase/references/provider-guide.md`
- [x] `optional/server-firebase/docs/engineering/server-provider-firebase.md` → `.agents/skills/server-firebase/references/provider-guide.md`
- [x] `optional/trpc/docs/engineering/server-api-ssot-trpc.md`
  - [x] 구조 사실 → `docs/engineering/workspace-topology.md`
  - [x] 변경 절차 → `.agents/skills/trpc-boundary/references/change-flow.md`

---

## 단계별 마이그레이션 체크리스트

## Phase 0. 준비 및 작업 기준 고정

### 할 일

- [x] 마이그레이션 작업 브랜치 생성
- [x] 현재 생성 결과물 스냅샷 저장
- [x] 현재 `README.md`, `AGENTS.md`, `docs/index.md`, `docs/engineering/*` 목록을 인벤토리로 정리
- [x] 생성 옵션 조합 목록 정리
  - [x] base only
  - [x] backoffice 포함
  - [x] server-cloudflare
  - [x] server-supabase
  - [x] server-firebase
  - [x] trpc 포함
- [x] 현재 `pnpm verify` 동작 기록
- [x] 마이그레이션 완료 기준 확정

### 완료 기준

- [x] 어떤 파일을 유지/삭제/이관할지 목록이 확정됨
- [x] 테스트해야 할 scaffold 조합이 고정됨
- [x] 현재 결과물 스냅샷이 남아 있음

---

## Phase 1. 최종 정보 구조 정의

### 할 일

- [x] 생성물 기준 최종 디렉터리 구조 확정
- [x] `AGENTS.md` 역할을 "루트 계약서"로 확정
- [x] `CLAUDE.md` 역할을 "Claude 어댑터"로 확정
- [x] `.github/copilot-instructions.md` 역할을 "Copilot 어댑터"로 확정
- [x] `.agents/skills`를 정본으로 확정
- [x] `.claude/skills`를 generated mirror로 확정
- [x] `.github/skills`는 만들지 않는 것으로 확정
- [x] `docs/engineering` 잔존 파일을 아래 3개로 확정
  - [x] `repo-contract.md`
  - [x] `frontend-policy.md`
  - [x] `workspace-topology.md`
- [x] `docs/index.md`를 얇은 문서 인덱스로 축소하기로 확정

### 완료 기준

- [x] 최종 구조 트리가 팀 내 합의됨
- [x] 문서 vs Skill 책임 경계가 명확함
- [x] 어댑터/미러 정책이 확정됨

---

## Phase 2. 계약 문서 재작성

### 생성/교체할 파일

- [x] `packages/scaffold-templates/base/AGENTS.md`
- [x] `packages/scaffold-templates/base/CLAUDE.md`
- [x] `packages/scaffold-templates/base/.github/copilot-instructions.md`
- [x] `packages/scaffold-templates/base/docs/index.md`
- [x] `packages/scaffold-templates/base/docs/engineering/repo-contract.md`
- [x] `packages/scaffold-templates/base/docs/engineering/frontend-policy.md`
- [x] `packages/scaffold-templates/base/docs/engineering/workspace-topology.md`

### `AGENTS.md` 체크리스트

- [x] `Repository Contract` 섹션 작성
- [x] `Hard Rules` 섹션 작성
- [x] `Start Here` 섹션 작성
- [x] `Workspace Model` 섹션 작성
- [x] `Skill Routing` 섹션 작성
- [x] `Done` 섹션 작성
- [x] 긴 실행 설명/카탈로그 링크 제거

### `repo-contract.md` 체크리스트

- [x] 루트 툴체인 명시
- [x] `verify` 정의 명시
- [x] 문서/skill precedence 명시
- [x] no-secrets 명시
- [x] 작업 완료 조건 명시

### `frontend-policy.md` 체크리스트

- [x] `$param` 라우트 금지
- [x] `:param` / `validateParams` 허용 규칙 정리
- [x] `frontend/pages` vs `frontend/src/pages` 역할 정리
- [x] `router.gen.ts` 동기화 규칙 정리
- [x] native import 금지/허용 규칙 정리
- [x] AsyncStorage 금지 여부 정리
- [x] UI import boundary 정리
- [x] 정책 검사 스크립트와 연결

### `workspace-topology.md` 체크리스트

- [x] `frontend`, `server`, `backoffice` 책임 정의
- [x] env ownership 정리
- [x] API/base URL ownership 정리
- [x] shared package import boundary 정리
- [x] `packages/contracts` / `packages/app-router` 역할 정리

### 완료 기준

- [x] 생성물의 계약 문서가 더 이상 engineering 카탈로그를 포함하지 않음
- [x] `docs/engineering`에 남는 문서가 3개로 줄어듦
- [x] `AGENTS.md`가 플레이북이 아니라 계약서 역할만 함

---

## Phase 3. Skill 정본 구조 생성

### 새 디렉터리 생성

- [x] `packages/scaffold-skills/miniapp/`
- [x] `packages/scaffold-skills/granite/`
- [x] `packages/scaffold-skills/tds/`
- [x] `packages/scaffold-skills/backoffice-react/`
- [x] `packages/scaffold-skills/server-cloudflare/`
- [x] `packages/scaffold-skills/server-supabase/`
- [x] `packages/scaffold-skills/server-firebase/`
- [x] `packages/scaffold-skills/trpc-boundary/`

### 각 Skill 디렉터리 공통 구조

- [x] `SKILL.md`
- [x] `references/`
- [x] `assets/`

### core Skills 체크리스트

#### miniapp
- [x] `SKILL.md` 작성
- [x] feature map 분리
- [x] full API index 분리
- [x] 공식 문서 진입 방식 정리
- [x] permission/loading/error/analytics 체크리스트 정리

#### granite
- [x] `SKILL.md` 작성
- [x] route 설계 패턴 정리
- [x] `validateParams` 패턴 정리
- [x] navigation 패턴 정리
- [x] page entry/impl 예시 정리
- [x] 강제 규칙은 넣지 않고 policy 문서로 링크

#### tds
- [x] `SKILL.md` 작성
- [x] component 선택 기준 정리
- [x] 폼/입력 컴포넌트 체크리스트 정리
- [x] slug/reference 정리
- [x] controlled/uncontrolled 패턴 정리

### optional Skills 체크리스트

#### backoffice-react
- [x] `SKILL.md` 작성
- [x] React best practices reference 이관

#### server-cloudflare
- [x] `SKILL.md` 작성
- [x] provider guide reference 이관

#### server-supabase
- [x] `SKILL.md` 작성
- [x] provider guide reference 이관

#### server-firebase
- [x] `SKILL.md` 작성
- [x] provider guide reference 이관

#### trpc-boundary
- [x] `SKILL.md` 작성
- [x] schema/router/client-server 변경 순서 정리
- [x] 구조 사실은 docs 쪽으로 분리했는지 확인

### 완료 기준

- [x] 기존 engineering 카탈로그 문서가 Skill corpus로 모두 분해됨
- [x] `SKILL.md`는 짧고, 긴 본문은 `references/`로 분리됨
- [x] core 3개와 optional 5개 taxonomy가 고정됨

---

## Phase 4. 생성기 입력 구조 재편

### 할 일

- [x] `packages/scaffold-templates`에서 docs와 workspace assets만 담당하도록 정리
- [x] `packages/scaffold-skills`를 생성기 입력 소스로 추가
- [x] optional assets와 optional skills 책임 분리
- [x] base template에서 old engineering 문서 제거
- [x] optional template에서 old engineering 문서 제거

### 소스 구조 체크리스트

- [x] `scaffold-templates/root/` 정리
- [x] `scaffold-templates/base/` 정리
- [x] `scaffold-templates/optional/*/assets` 정리
- [x] `scaffold-skills/*` flat 구조 추가

### 완료 기준

- [x] templates에는 계약 문서와 실제 코드 자산만 남음
- [x] skills는 별도 source tree로 분리됨
- [x] old docs가 template source에 더 이상 섞여 있지 않음

---

## Phase 5. 렌더러/생성기 리팩토링

### 할 일

- [ ] `packages/create-rn-miniapp/src/templates/index.ts` 책임 분리
- [ ] 아래 단위로 모듈 분리
  - [ ] `renderContracts`
  - [ ] `renderDocs`
  - [ ] `renderCanonicalSkills`
  - [ ] `renderClaudeSkillMirror`
  - [ ] `renderWorkspaceAssets`
- [x] marker 기반 optional doc 삽입 제거
- [ ] manifest 기반 skill 복사 로직 추가
- [x] 선택 옵션에 따라 optional skills를 조건부 생성하도록 변경

### 세부 체크리스트

- [x] core skills는 항상 생성
- [x] backoffice 선택 시 `backoffice-react` skill 생성
- [x] server provider 선택 시 해당 provider skill만 생성
- [x] trpc 선택 시 `trpc-boundary` skill 생성
- [x] `.claude/skills` mirror 생성 로직 추가
- [x] generated `CLAUDE.md`와 `.github/copilot-instructions.md` 추가

### 완료 기준

- [x] 생성기에서 old engineering docs 링크 삽입 로직이 제거됨
- [x] 생성기 출력이 새 구조를 그대로 반영함
- [x] optional 조합별 skill 생성이 정확함

---

## Phase 6. Skill 미러 및 검증 파이프라인 추가

### 생성할 스크립트

- [x] `scripts/sync-skills.mjs`
- [x] `scripts/check-skills.mjs`

### `sync-skills.mjs` 체크리스트

- [x] `.agents/skills`를 source로 사용
- [x] `.claude/skills`를 target으로 사용
- [x] 파일/디렉터리 전체 복제
- [x] 불필요 파일 정리 규칙 포함

### `check-skills.mjs` 체크리스트

- [x] `.agents/skills`와 `.claude/skills` diff 검사
- [x] 누락/추가/내용 차이 감지
- [x] 실패 시 명확한 에러 메시지 출력

### package script 체크리스트

- [x] `skills:sync` 추가
- [x] `skills:check` 추가
- [x] `verify`에 `skills:check` 연결

### 완료 기준

- [x] Claude용 skill mirror가 실제로 생성됨
- [x] mirror drift가 verify에서 검출됨
- [x] 문서에만 경로를 적고 실파일은 없는 상태가 사라짐

---

## Phase 7. README 및 안내 문서 정리

### 할 일

- [x] 루트 `README.md`의 scaffold 결과 구조 설명 업데이트
- [x] `docs/ai/Implement.md`처럼 실제 없는 파일 설명 제거
- [x] `docs/engineering` 설명을 3개 문서 기준으로 수정
- [x] Skill 구조 설명 추가
- [x] `AGENTS.md`, `CLAUDE.md`, `.github/copilot-instructions.md` 역할 구분 추가

### 완료 기준

- [x] README 설명과 실제 scaffold 결과가 일치함
- [x] 더 이상 삭제된 engineering 문서를 설명하지 않음
- [x] skill mirror 정책이 README에 반영됨

---

## Phase 8. 기존 문서 제거 및 컷오버

### 삭제 대상

- [x] `base/docs/engineering/appsintoss-granite-api-index.md`
- [x] `base/docs/engineering/appsintoss-granite-full-api-index.md`
- [x] `base/docs/engineering/granite-ssot.md`
- [x] `base/docs/engineering/native-modules-policy.md`
- [x] `base/docs/engineering/tds-react-native-index.md`
- [x] `base/docs/engineering/에이전트전략.md`
- [x] `base/docs/engineering/하네스-실행가이드.md`
- [x] `optional/backoffice/docs/engineering/backoffice-react-best-practices.md`
- [x] `optional/server-cloudflare/docs/engineering/server-provider-cloudflare.md`
- [x] `optional/server-supabase/docs/engineering/server-provider-supabase.md`
- [x] `optional/server-firebase/docs/engineering/server-provider-firebase.md`
- [x] `optional/trpc/docs/engineering/server-api-ssot-trpc.md`

### 컷오버 체크리스트

- [x] old docs를 참조하는 생성기 코드 제거
- [x] old docs를 참조하는 README 링크 제거
- [x] old docs를 참조하는 AGENTS 링크 제거
- [x] old docs를 참조하는 tests/snapshots 갱신

### 완료 기준

- [ ] 생성기/문서/README 어느 곳에서도 old docs를 참조하지 않음
- [x] scaffold 결과물에 old docs가 생성되지 않음

---

## Phase 9. 테스트 및 검증

### scaffold 조합 테스트

- [x] base only
- [x] base + backoffice
- [x] base + server-cloudflare
- [x] base + server-supabase
- [x] base + server-firebase
- [x] base + trpc

### 각 조합 공통 검증

- [x] `AGENTS.md` 생성 확인
- [x] `CLAUDE.md` 생성 확인
- [x] `.github/copilot-instructions.md` 생성 확인
- [x] `docs/engineering`에 3개만 있는지 확인
- [x] `.agents/skills`에 core skill 3개가 flat하게 생성되는지 확인
- [x] `.claude/skills` mirror 생성 확인
- [x] optional 선택에 맞는 skill만 생성되는지 확인
- [x] old engineering docs 미생성 확인
- [ ] `pnpm verify` 통과 확인

### snapshot/assert 체크리스트

- [x] docs tree snapshot 추가/갱신
- [x] skills tree snapshot 추가/갱신
- [x] optional skill presence/absence assert 추가
- [x] `.claude/skills` mirror equality assert 추가

### 완료 기준

- [x] 모든 scaffold 조합 테스트 통과
- [x] verify 체인 통과
- [x] snapshot이 새 구조를 고정함

---

## Phase 10. 출시 전 최종 점검

### 최종 점검 체크리스트

- [x] `AGENTS.md`가 계약서 역할만 수행하는지 확인
- [x] `docs/index.md`가 얇은 인덱스인지 확인
- [x] `docs/engineering` 3개 문서 외 잔존 문서가 없는지 확인
- [x] `.agents/skills`가 정본인지 확인
- [x] `.claude/skills`가 generated mirror인지 확인
- [x] `CLAUDE.md`의 경로 설명이 실제 구조와 일치하는지 확인
- [x] Copilot instructions가 실제 생성되는지 확인
- [x] README 설명이 실제 구조와 일치하는지 확인
- [x] 기존 문서 기반 작업 흐름이 skill 기반 흐름으로 대체됐는지 확인

### 릴리스 기준

- [x] 생성물 루트에 계약/어댑터/skills/docs 구조가 모두 갖춰짐
- [x] old engineering 문서 체계가 완전히 제거됨
- [x] agent별 경로 설명과 실파일이 불일치하지 않음
- [ ] verify + skills check까지 통과

---

## 마이그레이션 완료 정의

아래를 모두 만족하면 마이그레이션 완료로 본다.

- [x] `AGENTS.md`는 계약서로만 남고, 긴 구현 가이드는 없다.
- [x] `CLAUDE.md`는 `.claude/skills`를 실제로 가리킨다.
- [x] `.github/copilot-instructions.md`가 생성된다.
- [x] `docs/engineering`에는 `repo-contract.md`, `frontend-policy.md`, `workspace-topology.md`만 남는다.
- [x] 기존 engineering 문서들은 생성물에서 사라진다.
- [x] `.agents/skills`에는 core skills가 항상 존재한다.
- [x] optional skills는 선택한 스캐폴딩 옵션에 맞게만 생성된다.
- [x] `.claude/skills`는 `.agents/skills`와 동기화된다.
- [ ] `verify`가 기존 검사 + skills check까지 통과한다.
- [x] README와 실제 scaffold 결과가 일치한다.

---

## 빠른 실행 순서 요약

1. [x] 계약면 재작성: `AGENTS.md`, `CLAUDE.md`, `copilot-instructions`, `docs/engineering/*`
2. [x] Skill source tree 생성: `packages/scaffold-skills/*`
3. [x] 기존 engineering 문서 내용 분해/이관
4. [x] 생성기에서 canonical skills + Claude mirror 생성 로직 추가
5. [x] verify에 `skills:check` 추가
6. [x] README 갱신
7. [x] old engineering docs 삭제
8. [x] 조합별 scaffold test / snapshot 갱신
9. [x] 컷오버
