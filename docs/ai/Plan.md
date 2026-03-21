## 진행 예정: Scaffold SSoT contract 정리

### 목표
- skill taxonomy, provider client contract, generated server state ownership을 각각 한 군데서만 소유하도록 정리한다.
- `--add` 경로에서 manifest가 이미 가진 사실을 중간에서 다시 추론하지 않게 만든다.
- 진단 스크립트와 루트 문서가 실제 generator source에서 파생되도록 맞춘다.

### 작업 순서
1. skill metadata를 shared catalog로 모아 docs/rendering/test가 같은 source를 보게 만든다.
2. provider별 env key와 client link expectation을 shared contract로 모아 README/script가 같은 source를 보게 만든다.
3. workspace inspection과 add scaffold flow에서 `state.json`이 소유하는 server topology를 재추론하지 않도록 정리한다.
4. 관련 회귀 테스트를 추가하고 `pnpm verify`로 최종 확인한다.

## 진행 예정: Patch changeset 추가

### 목표
- 이미 머지 준비가 끝난 skill taxonomy migration 브랜치에 patch changeset을 추가한다.
- 공개 배포 대상 패키지 중 실제 변경이 있는 패키지만 포함한다.
- changeset 설명은 한국어로 작성하고, 커밋 후 원격 브랜치와 PR에 반영한다.

### 후속 수정
- patch changeset 범위를 `create-rn-miniapp`, `@create-rn-miniapp/scaffold-skills`, `@create-rn-miniapp/scaffold-templates` 세 패키지로 바로잡는다.
- changeset 수정 후 `pnpm verify`를 다시 통과시킨다.

### 작업 순서
1. 현재 diff 기준으로 배포 대상 패키지를 확정한다.
2. `.changeset/*.md` 파일을 추가해 patch bump와 한국어 릴리스 요약을 기록한다.
3. `pnpm verify`를 다시 실행해 최종 상태를 확인한다.
4. changeset 커밋을 만들고 현재 PR 브랜치에 푸시한다.

## 진행 예정: Skill taxonomy SSoT audit

### 목표
- 새 skill taxonomy migration에서 rename, mirror, generated output, provider state ownership이 서로 일관되게 따라가는지 점검한다.
- 한 곳을 바꾸면 같이 바뀌어야 하는 파생 산출물 중 누락된 항목이 있는지 찾는다.
- 테스트는 통과하지만 실제 계약이나 문서 의미상 미완성인 구현이 있는지 확인한다.

### 점검 순서
1. old skill name / old 경로 / old 문서명이 남아 있는지 repo 전체 grep으로 확인한다.
2. canonical source(`packages/scaffold-skills`)와 generator metadata(`templates/*`, `scaffold/*`, `patching/*`)가 같은 이름/구조를 소유하는지 대조한다.
3. generated repo 계약인 `AGENTS.md`, `README.md`, `.agents/skills`, `.claude/skills`, `server/.create-rn-miniapp/state.json`, `server/README.md`가 서로 일치하는지 테스트와 렌더링 로직을 함께 읽어 검수한다.
4. 구현 누락이나 잘못된 ownership이 보이면 severity와 재현 근거를 정리한다.

## 진행 예정: Skill taxonomy migration

### 목표
- canonical skill taxonomy를 `backoffice-react`, `miniapp-capabilities`, `granite-routing`, `tds-ui`, `cloudflare-worker`, `supabase-project`, `firebase-functions`, `trpc-boundary` 기준으로 재정렬한다.
- 생성물의 entrypoint 문서(`AGENTS.md`, `CLAUDE.md`, `.github/copilot-instructions.md`, `docs/index.md`, README)가 새 이름만 가리키게 만든다.
- provider skill에서 instance state와 remote mutate 절차를 제거하고, 생성된 repo의 `server/.create-rn-miniapp/state.json` + `server/README.md`가 scaffold state를 소유하게 만든다.
- provider reference를 `overview/local-dev/client-connection/troubleshooting` 구조로 분해하고, 긴 원격 운영 절차는 canonical skill 밖으로 밀어낸다.
- `.agents/skills`를 canonical source로 유지하고 `.claude/skills` mirror가 동일 taxonomy를 따르도록 보장한다.

### 고정 기준
- plan first: 구현 전 이 문서를 최신화한다.
- TDD first: rename/state split/ref 분해는 실패 테스트를 먼저 추가하고 확인한 뒤 구현한다.
- self-verify first: 마무리 전에 `pnpm verify`를 통과시킨다.
- templates first: 생성물 규칙은 `packages/scaffold-templates`와 `packages/scaffold-skills`를 정본으로 두고, generator는 그 소스를 렌더링만 한다.
- old alias는 두지 않는다. rename 이후 생성물과 entrypoint 문서에는 old name이 남지 않아야 한다.

### 확인된 현재 상태
- canonical skill source는 `packages/scaffold-skills/*`이다.
- generated repo 문서/skill 렌더링은 `packages/create-rn-miniapp/src/templates/{skills,feature-catalog,docs,frontend-policy}.ts`가 소유한다.
- `server/README.md` 생성은 `packages/create-rn-miniapp/src/patching/server.ts`가 소유한다.
- 현재 core skill 이름은 `miniapp-capabilities`, `granite-routing`, `tds-ui`이고 optional skill 이름은 `cloudflare-worker`, `supabase-project`, `firebase-functions`, `backoffice-react`, `trpc-boundary`이다.
- generated `AGENTS.md`, `docs/index.md`, `docs/engineering/*`는 `packages/create-rn-miniapp/src/templates/docs.ts`가 code-owned로 렌더링한다.
- README와 테스트는 이미 `.agents/skills`, `.claude/skills`, `.github/copilot-instructions.md`를 생성물 계약으로 다루고 있다.

### 구현 순서
1. 엔트리포인트와 catalog baseline 정리
   - 대상: `README.md`, `AGENTS.md`, `packages/scaffold-templates/base/CLAUDE.md`, `packages/create-rn-miniapp/src/templates/docs.ts`, `packages/create-rn-miniapp/src/templates/frontend-policy.ts`
   - 작업:
     - 새 taxonomy 기준으로 quick start / generated structure / skill routing 문구를 재작성한다.
     - `docs/index.md` 렌더링과 frontend policy reference가 새 skill 이름을 가리키게 바꾼다.
     - old engineering 문서명이나 old skill 이름을 entrypoint에서 직접 언급하지 않게 정리한다.
   - TDD:
     - `packages/create-rn-miniapp/src/templates/index.test.ts`
     - `packages/create-rn-miniapp/src/scaffold/index.test.ts`
     - old name이 entrypoint에 남지 않는 assertion을 먼저 추가한다.

2. canonical rename과 mirror 경로 교체
   - 대상: `packages/scaffold-skills/package.json`, `packages/scaffold-skills/*`, `packages/create-rn-miniapp/src/templates/{skills,feature-catalog,docs,frontend-policy}.ts`, 관련 테스트
   - 작업:
     - 디렉터리 이름과 `SKILL.md` frontmatter `name`을 함께 rename한다.
     - core skill id와 optional skill metadata를 새 이름으로 교체한다.
     - `.agents/skills`와 `.claude/skills` mirror 생성 경로를 새 taxonomy로 맞춘다.
     - old alias 없이 generated repo grep이 0건이 되도록 만든다.
   - TDD:
     - rename snapshot/assertion, mirror equality assertion, old name absence assertion을 먼저 추가한다.

3. provider state 분리와 server README 재구성
   - 대상: `packages/scaffold-skills/{cloudflare-worker,supabase-project,firebase-functions}/**`, `packages/create-rn-miniapp/src/patching/server.ts`, 필요 시 provider finalize tests
   - 작업:
     - provider skill에서 existing/create 분기, remoteInitialization 상태, 실제 resource identifier 예시, deploy/init/apply/seed 절차를 제거한다.
     - generated repo에 `server/.create-rn-miniapp/state.json`을 추가하고 최소 필드(`serverProvider`, `serverProjectMode`, `remoteInitialization`, `trpc`, `backoffice`)를 고정한다.
     - `server/README.md`에 `Scaffold State`와 `Remote Ops` 섹션을 추가하고, provider skill은 state 확인만 안내하게 만든다.
     - provider 작업 전 확인용 read-only 스크립트(`check-env.mjs`, `check-client-links.mjs`, `print-next-commands.mjs`)를 생성한다.
   - TDD:
     - `packages/create-rn-miniapp/src/patching/index.test.ts`
     - provider별 README/state/script 생성 및 내용 assertion을 먼저 추가한다.

4. provider reference 분해와 overlap 제거
   - 대상: `packages/scaffold-skills/{cloudflare-worker,supabase-project,firebase-functions,miniapp-capabilities,granite-routing,tds-ui,trpc-boundary}/references/*`
   - 작업:
     - provider `references/provider-guide.md`를 `overview.md`, `local-dev.md`, `client-connection.md`, `troubleshooting.md`로 분해한다.
     - `miniapp-capabilities`, `granite-routing`, `tds-ui`, `trpc-boundary` description과 본문을 `Use when ... / Do not use for ...` 구조로 재작성한다.
     - skill 간 overlap을 제거하고 “이 경우는 다른 skill로 넘겨라” 문장을 명시한다.
   - TDD:
     - generated skill file assertions에서 reference file tree와 old guide 부재를 먼저 검증한다.

5. 스캐폴드 반영과 최종 검증
   - 대상: `packages/create-rn-miniapp/src/scaffold/index.ts`, `packages/create-rn-miniapp/src/templates/index.ts`, 관련 tests, 필요 시 README release tests
   - 작업:
     - create/add 경로 모두 새 taxonomy, 새 state manifest, 새 server README 구성을 다시 렌더링하도록 맞춘다.
     - `.github/skills`는 만들지 않고, `.github/copilot-instructions.md`는 새 canonical names만 가리키게 유지한다.
   - 검증:
     - targeted: `pnpm --filter create-rn-miniapp test -- src/templates/index.test.ts src/scaffold/index.test.ts src/patching/index.test.ts`
     - final: `pnpm verify`

### 완료 기준
- canonical skill 이름과 `SKILL.md` frontmatter name이 새 taxonomy만 사용한다.
- entrypoint 문서와 generated README가 새 이름만 가리킨다.
- provider skill에는 instance state와 deploy/apply/seed/init 절차가 없다.
- `server/.create-rn-miniapp/state.json`과 `server/README.md`가 scaffold 상태와 next step을 소유한다.
- `trpc-boundary`만 tRPC 변경 순서를 소유한다.
- `.agents/skills`와 `.claude/skills`가 동일 taxonomy와 동일 파일 구조를 가진다.
- targeted tests와 `pnpm verify`가 모두 통과한다.
