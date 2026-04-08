## 다음 작업: tds-ui install mirror 리뷰 코멘트 2건 수정

### 목표
- 로컬 repo source에서 `tds-ui`를 설치할 때 네트워크가 없어도 scaffold가 hard-fail 하지 않게 되돌린다.
- `.agents/skills`와 `.claude/skills`에 동시에 설치된 `tds-ui`가 있으면 llms mirror 파일을 양쪽 모두에 동기화한다.
- 두 회귀를 실패 테스트로 먼저 고정하고, `pnpm verify` 통과까지 다시 확인한 뒤 현재 브랜치에 커밋/푸시한다.

### 작업 순서
1. `skills-install.test.ts`에 오프라인 로컬 설치 fallback과 multi-root mirror sync 케이스를 먼저 추가해 실패를 재현한다.
2. `skills/install.ts`에서 설치 source가 로컬 repo인지 구분할 수 있는 신호를 유지하고, network fetch 실패를 local source install에서는 non-fatal로 처리한다.
3. installed skill 탐색이 duplicate skill id를 하나로 접지 않도록 별도 enumerator를 두고, `tds-ui` mirror sync가 모든 installed root를 순회하게 수정한다.
4. 관련 테스트와 `pnpm verify`를 실행한 뒤 현재 브랜치에 단일 목적 커밋으로 정리해 push한다.

## 다음 작업: tds-ui install mirror write scope escape 차단

### 목표
- `installMirrors` 경로가 `tds-ui` skill root 바깥으로 빠져나가지 못하게 막는다.
- 절대경로와 `..` traversal이 있으면 fetch 전에 즉시 실패하게 만들어 write scope escape를 제거한다.
- 관련 회귀 테스트를 추가하고 `pnpm verify`까지 다시 통과시킨다.

### 작업 순서
1. `syncInstalledSkillArtifacts` 테스트에 traversal/absolute path 거부 케이스를 먼저 추가한다.
2. mirror 상대경로를 정규화하고 skill root 내부 경로만 허용하는 validator를 `skills/install.ts`에 넣는다.
3. `pnpm verify`로 전체 회귀를 확인하고 PR 브랜치에 반영한다.

## 다음 작업: tds-ui llms 벤더링 제거와 install-time fetch 전환

### 목표
- source repo에는 `skills/tds-ui/generated/llms.txt`, `llms-full.txt`를 커밋하지 않는다.
- 대신 create scaffold가 `tds-ui` 설치 직후 공식 URL에서 llms snapshot을 내려받아 target workspace의 skill 디렉터리에 채워 넣는다.
- source skill 문서는 remote truth source와 install-time mirror 경로를 함께 설명하되, repo 자체는 대용량 snapshot을 들고 있지 않게 정리한다.

### 작업 순서
1. 템플릿/skills install 테스트를 먼저 바꿔 vendored llms 파일이 repo에 없어야 하고, install-time download hook이 있어야 한다는 계약을 고정한다.
2. `skills/tds-ui` source 문구와 metadata를 remote-first + optional local mirror 구조로 되돌린다.
3. create skill auto-install 흐름에 `tds-ui` llms mirror download helper를 추가한다.
4. `pnpm verify`로 최종 검증한 뒤 기존 PR 브랜치에 후속 커밋으로 반영한다.

## 다음 작업: TDS UI llms snapshot 변경의 changeset/PR 마감

### 목표
- `tds-ui` skill이 공식 TDS React Native `llms.txt`, `llms-full.txt` snapshot을 source repo에 동봉한 상태로 머지 준비를 마친다.
- release note는 실제 사용자 변화인 "스캐폴딩 시 project-local skill이 bundled llms snapshot을 함께 복사한다"는 점을 한국어 changeset으로 남긴다.
- 브랜치를 분리하고 `pnpm verify` 통과 상태에서 한국어 PR을 생성한다.

### 작업 순서
1. 이번 diff가 어떤 publish package 설명으로 귀결되는지 다시 확인하고, 최소 범위 changeset frontmatter를 정한다.
2. `.changeset/*.md`에 한국어 patch changeset을 추가한다.
3. `pnpm verify`를 다시 돌려 최종 상태를 확인한다.
4. 작업 브랜치를 만들고 단일 목적 커밋을 만든 뒤 원격에 push한다.
5. 한국어 제목과 섹션형 본문으로 PR을 연다.

## 다음 작업: TDS UI skill의 llms snapshot 동봉과 scaffold install 동기화

### 목표
- `tds-ui`가 공식 `llms.txt` / `llms-full.txt` URL만 참조하는 데서 끝나지 않고, source repo 안에 snapshot 파일을 같이 들고 있게 만든다.
- create scaffold의 project-local skill 설치가 `--copy` 기반이므로, 설치 시 target workspace에도 같은 snapshot 파일이 함께 들어가게 한다.
- `generated/anomalies.json`은 로컬 overlay로 유지하되, installed skill은 네트워크 없이도 local snapshot을 SSoT로 읽을 수 있게 정리한다.

### 작업 순서
1. `tds-ui` 관련 테스트를 먼저 바꿔 local generated snapshot 파일(`generated/llms.txt`, `generated/llms-full.txt`)이 포함되어야 한다는 계약을 실패로 고정한다.
2. 공식 URL에서 `llms.txt`, `llms-full.txt`를 내려받아 `skills/tds-ui/generated/` 아래에 저장한다.
3. `SKILL.md`, `metadata.json`, `AGENTS.md`, references가 원격 URL 대신 local snapshot 경로를 우선 truth source로 읽고, upstream refresh source만 note로 남기게 수정한다.
4. `pnpm verify`로 scaffold/install 계약이 깨지지 않는지 확인한다.

## 다음 작업: TDS UI skill의 llms.txt 기반 SSoT 재정렬

### 목표
- `skills/tds-ui`가 로컬 curated reference를 사실상 원본처럼 설명하는 구조에서 벗어나, Toss TDS React Native의 `llms.txt`와 `llms-full.txt`를 source of truth로 따르게 만든다.
- 현재 skill이 외부 문서와 어긋나는 부분을 coverage, 탐색 순서, 규칙 강도, anomaly overlay 관점에서 비교 정리한다.
- 수정 시 로컬 skill에는 decision router, export anomaly, repo-specific guardrail만 남기고 문서 본문 중복은 줄이는 방향으로 설계를 확정한다.

### 작업 순서
1. `skills/tds-ui`의 SKILL, metadata, references, rules가 현재 무엇을 직접 서술하고 무엇을 외부 문서에 위임하는지 분해한다.
2. `https://tossmini-docs.toss.im/tds-react-native/llms.txt`와 `llms-full.txt`를 읽고, 현재 skill과의 차이를 index coverage / component semantics / foundation 포함 여부 / 문서 탐색 방식 기준으로 비교한다.
3. `generated/anomalies.json`과 repo-specific rule이 외부 SSoT 위에 얹혀야 하는 최소 overlay인지 검토한다.
4. 최종적으로 `tds-ui`를 `llms.txt`/`llms-full.txt` 우선 참조 구조로 바꾸는 개편안을 정리하고, 필요한 파일 수정 범위를 확정한다.

## 다음 작업: skills 체계 PR의 두 publish 패키지 patch changeset 정리

### 목표
- 현재 skill 체계 정비 PR에 연결된 Changeset이 `create-rn-miniapp` 하나만 올리도록 되어 있는 상태를 바로잡는다.
- publish 패키지인 `create-rn-miniapp`, `@create-rn-miniapp/scaffold-templates` 두 개를 모두 patch 대상으로 맞춘다.
- 변경은 Plan과 existing changeset에만 국한하고, `pnpm verify` 후 현재 브랜치에 push한다.

### 작업 순서
1. 현재 changeset과 publish 패키지 구성을 다시 확인해 이번 수정 범위를 두 패키지 patch 반영으로 한정한다.
2. 기존 changeset frontmatter를 두 패키지 patch로 갱신하고, 설명이 실제 PR diff와 어긋나지 않는지 점검한다.
3. `pnpm verify`로 회귀가 없는지 확인한 뒤 단일 목적 커밋으로 정리해 원격 브랜치에 push한다.

## 다음 작업: Skill 표준 재검수와 잔여 비표준 찾기

### 목표
- 현재 skill source가 Agent Skills 문서와 `@vercel-labs` 계열 구현 기준에서 여전히 어긋나는 지점을 다시 찾는다.
- 이미 고친 항목을 제외하고, 남아 있는 비표준 요소만 findings로 분리한다.
- 즉시 수정이 필요한 구조 문제와 단순 관례 차이를 구분해 보고한다.

### 작업 순서
1. Agent Skills specification, description/eval 가이드, `@vercel-labs` 구현 기준을 다시 확인한다.
2. 현재 브랜치의 `skills/*`와 관련 tooling을 훑어 표준에서 벗어난 패턴을 찾는다.
3. 발견한 항목을 severity와 영향 범위 기준으로 정리한다.
4. 수정이 필요한 항목과 관찰만 필요한 항목을 분리해 보고한다.

## 다음 작업: Agent Skills 표준 재대조와 PR 변경 축 재분류

### 목표
- 현재 PR에 남아 있는 Agent Skills 비표준 요소를 공식 문서 기준으로 다시 점검한다.
- skill source 변경과 parser/catalog/README consumer 변경을 축별로 나눠 왜 파일 수가 늘었는지 설명 가능한 상태로 정리한다.
- low-risk로 바로 고칠 수 있는 비표준 요소가 있으면 후속 수정까지 이어간다.

### 작업 순서
1. Agent Skills 공식 specification, best practices, eval 가이드를 다시 확인해 구조적으로 의미가 있는 디렉토리와 관례를 정리한다.
2. 현재 브랜치 diff에서 skill 관련 변경 파일을 축별로 분류한다.
3. 남아 있는 비표준 요소를 findings로 정리하고, 즉시 수정 가능한 항목은 로컬에서 고친다.
4. 결과와 변경 이유를 리뷰어/사용자 관점으로 요약한다.

## 다음 작업: skill eval 자산을 JSON 표준 경로로 재정리

### 목표
- `skills/*/evals/trigger-cases.md`를 markdown 메모가 아니라 JSON 기반 eval 자산으로 바꾼다.
- `references/`와 eval 역할이 겹치지 않게 정리하고, trigger eval은 `evals/` 아래에만 남긴다.
- eval 파일 형식을 테스트로 고정하고, `pnpm verify` 후 현재 PR 브랜치에 push한다.

### 작업 순서
1. 현재 skill별 eval markdown 자산과 연결된 문구를 확인하고, 새 JSON shape을 정한다.
2. 기존 should-trigger / should-not-trigger 케이스를 JSON으로 옮기고 markdown 파일은 제거한다.
3. skill eval 자산이 parse 가능한 JSON 형식을 유지하는 테스트를 추가한다.
4. `pnpm verify`로 회귀를 확인한 뒤 새 커밋으로 push한다.

## 다음 작업: README skills 설명 한국어 정리와 PR #97 CI 복구

### 목표
- 루트 README와 generated README 경로에 새로 노출된 skill 설명을 한국어 기준의 사용자 문장으로 다시 정리한다.
- PR #97의 GitHub Actions `verify` 실패 원인을 로그로 확인하고, 같은 브랜치에서 바로 수정한다.
- 관련 테스트와 `pnpm verify`를 다시 통과시킨 뒤 브랜치를 재푸시한다.

### 작업 순서
1. README 렌더링 경로와 현재 노출 문구를 확인해 영어가 어디서 들어오는지 source of truth를 특정한다.
2. `gh`로 PR #97의 failing `verify` 로그를 확인하고 재현 가능한 원인을 로컬에서 좁힌다.
3. README 문구와 필요한 구현을 최소 수정으로 고치고, 로직 변경이면 테스트를 먼저 보강한다.
4. sync/verify를 다시 실행해 회귀와 CI 원인을 함께 확인한다.
5. 변경을 새 커밋으로 정리해 `feat/skill-system-overhaul`에 push한다.

## 다음 작업: skills 체계 단일 PR 정비

### 목표
- root `skills/*/SKILL.md` frontmatter를 Agent Skills spec 친화 구조로 정리하고, repo 전용 값은 `metadata.create-rn-miniapp.*`로 이동한다.
- parser, sync script, generated catalog, 관련 consumer가 새 metadata 구조를 읽도록 맞추고 generated artifact를 재생성한다.
- `cloudflare-worker`, `supabase-project`, `firebase-functions`를 shared server-common reference + provider overlay 구조로 재편한다.
- `backoffice-react`를 운영 화면 decision skill로 재작성하고, trigger 친화 description과 경량 eval 자산까지 한 PR에서 마무리한다.

### 작업 순서
1. `docs/ai/Plan.md`를 이번 PR 기준으로 갱신하고, git branch / current consumer surface / skill source를 다시 확인한다.
2. frontmatter parser 변경은 failing test부터 추가하고, `skills/frontmatter`, catalog generator, sync pipeline, template tests를 새 metadata 구조에 맞게 고친다.
3. 모든 root skill frontmatter를 `metadata.create-rn-miniapp.agentsLabel|category|order|version` 구조로 정리하고 generated catalog를 재생성한다.
4. `skills/shared/references/server-common.md`를 추가하고, server provider skill 3종을 공통 규칙 + provider-specific overlay 구조로 재작성한다.
5. `backoffice-react`를 decision skill로 재작성하고, `references/`를 archetype / data-boundary / bulk-action-and-forms / verification / gotchas 중심으로 분리한다.
6. 약한 skill들의 description을 trigger 중심으로 고치고, catalog/README consumer에서 실제로 쓰는 정보만 low-risk 범위로 노출한다.
7. skill별 should-trigger / should-not-trigger 경량 eval 자산을 추가하고, 경계와 expected output 품질을 같이 기록한다.
8. 관련 테스트, `pnpm sync:skill-catalog`, `pnpm verify`를 실행해 회귀를 확인하고, 남는 리스크만 별도로 기록한다.

## 다음 작업: Granite runtime preset import 회귀 fix changeset 추가와 한글 PR 생성

### 목표
- 이번 Granite runtime preset import 회귀 수정 내용을 `create-rn-miniapp`, `@create-rn-miniapp/scaffold-templates` 두 패키지 patch changeset으로 기록한다.
- 커밋 메시지와 PR 제목/본문을 한국어 `fix:` 형식으로 정리한다.
- `pnpm verify` 증거를 유지한 상태로 브랜치를 push하고 PR 생성까지 마무리한다.

### 작업 순서
1. `docs/ai/Plan.md`를 먼저 갱신하고, 현재 브랜치/원격 상태와 publish 대상 패키지를 다시 확인한다.
2. 한글 설명의 patch changeset 파일을 추가한다.
3. 검증 상태를 다시 확인한 뒤 작업 브랜치에서 커밋하고 원격에 push한다.
4. GitHub PR을 한글 `fix:` 제목/본문으로 생성하고 링크를 기록한다.

## 다음 작업: Granite runtime config의 scaffold preset 상대 import 회귀 수정

### 목표
- generated `frontend/granite.config.ts`가 AppInToss build에서 `.granite/.ait-runtime-*.config.ts`로 복사되어도 `scaffold.preset.ts`를 안정적으로 읽게 만든다.
- failing test로 먼저 `scaffold.preset.ts`를 `process.cwd()` 기준으로 로드해야 한다는 계약을 고정한다.
- 최소 수정으로 patcher AST를 정리하고, `pnpm verify`까지 통과시킨다.

### 작업 순서
1. `docs/ai/Plan.md`를 갱신하고, example scaffold와 AIT build 경로를 대조해 root cause를 확정한다.
2. `packages/create-rn-miniapp/src/patching/index.test.ts`에서 Granite config가 상대 import 대신 cwd 기반 preset loader를 사용해야 한다는 failing test를 먼저 만든다.
3. `packages/create-rn-miniapp/src/patching/ast/granite.ts`를 최소 수정해 새 계약을 만족시킨다.
4. 타깃 테스트와 `pnpm verify`로 회귀가 없는지 확인한다.

## 다음 작업: Supabase 초기 scaffold 자동 db push 제거

### 목표
- create scaffold에서 Supabase project를 새로 만들더라도 remote `db push`를 자동으로 실행하지 않게 한다.
- Supabase CLI의 migration history mismatch를 회피하기 위한 조건 분기를 더 늘리지 않고, 초기 provisioning contract를 단순하게 만든다.
- remote DB 반영은 생성 이후 사용자가 명시적으로 `server/package.json`의 `db:apply`를 실행하는 흐름만 남긴다.

### 작업 순서
1. 현재 Supabase provisioning 테스트 중 create mode에서 auto `db push`를 기대하는 지점을 failing test로 먼저 뒤집는다.
2. `provision.ts`에서 auto remote DB apply 판정을 제거하거나 항상 false가 되도록 최소 수정한다.
3. finalize note와 관련 문구를 새 contract에 맞게 정리한다.
4. `pnpm verify` 후 PR #94 브랜치를 업데이트한다.

## 다음 작업: PR #91 merge conflict 해소와 재푸시

### 목표
- `origin/main` 최신 변경을 현재 PR 브랜치에 반영해 GitHub merge conflict를 해소한다.
- 겹치는 파일은 실제 source of truth를 기준으로 최소 수정만 적용하고, 기존 skill 정리 의도를 유지한다.
- 충돌 해소 후 전체 검증을 다시 실행하고 브랜치를 재푸시한다.

### 작업 순서
1. `origin/main`과 현재 브랜치의 공통 조상 이후 변경 파일을 확인해 충돌 범위를 좁힌다.
2. `origin/main`을 현재 브랜치에 병합하고, 충돌 파일을 source of truth 기준으로 수동 정리한다.
3. 충돌 해소 커밋 전후로 `pnpm verify`를 다시 실행해 회귀가 없는지 확인한다.
4. 브랜치를 원격에 재푸시하고 PR merge 상태를 다시 확인한다.

## 다음 작업: CLI package publish manifest 경고 제거

### 목표
- `create-rn-miniapp` 패키지 publish 시 npm이 `bin`과 `repository.url`을 자동 보정하지 않게 manifest를 정규형으로 맞춘다.
- release 테스트에 publish manifest 계약을 추가해 같은 경고가 다시 생기지 않게 고정한다.
- `npm publish --dry-run --ignore-scripts`와 `pnpm verify`를 근거로 수정 결과를 확인한 뒤 단일 목적 커밋으로 정리한다.

### 작업 순서
1. release 테스트에 CLI publish manifest 계약을 먼저 추가해 red를 만든다.
2. `packages/create-rn-miniapp/package.json`을 npm 정규형에 맞게 최소 수정한다.
3. dry-run publish와 `pnpm verify`로 경고/회귀 여부를 확인한다.
4. 변경을 단일 목적 커밋으로 정리하고 원격 브랜치에 push한다.

## 다음 작업: SSOT 기준 create/add 상태 계산과 docs 흐름 중복 제거

### 목표
- add flow에서 `serverFlowState`와 `initialServerState`가 같은 입력을 중복 계산하지 않게 합친다.
- create/add finalize의 remote initialization 최종 판정을 공용 helper로 모은다.
- docs 렌더에서 `serverProvider`를 caller hint에 의존하지 않고 실제 workspace inspection 결과로 맞춘다.
- lifecycle order helper가 실제 coordinator 흐름과 같은 source를 보게 정리한다.

### 작업 순서
1. 관련 테스트를 먼저 추가하거나 보강해서 현재 중복 계산 지점을 실패로 고정한다.
2. `flow-state`, `server/project`, `workspace/inspect`, `scaffold/orders` 축으로 공용 계산 함수를 모은다.
3. create/add/docs 쪽 호출부를 새 공용 계산으로 교체한다.
4. 타깃 테스트와 `pnpm verify`를 통과시킨 뒤 단일 목적 커밋으로 정리한다.

## 다음 작업: create/add flow-first 리팩터링의 출력 순서와 진행 로그 회귀 복구

### 목표
- create flow에서 skill 설치 note가 provider provisioning note 뒤에 보이던 기존 출력 순서를 복구한다.
- create/add finalize 단계에서 root git/setup 및 finalize 명령 실행 전에 `log.step(command.label)`를 다시 출력해 기존 진행 로그를 복구한다.
- 회귀는 source-based test와 `pnpm verify`로 먼저 고정하고, 최소 수정만 적용한다.

### 작업 순서
1. `docs/ai/Plan.md`를 먼저 갱신하고, 회귀 범위를 note 순서와 finalize progress log로 한정한다.
2. 관련 흐름 파일에 대한 failing test를 추가해 기존 체감 동작 계약을 먼저 고정한다.
3. create/add phase 코드를 최소 수정해 테스트를 통과시킨다.
4. `pnpm verify` 후 단일 목적 커밋으로 정리한다.

## 다음 작업: create/add flow-first 브랜치 changeset 추가와 한글 PR 생성

### 목표
- 이번 브랜치 변경을 `create-rn-miniapp`, `@create-rn-miniapp/scaffold-templates` 두 패키지의 patch changeset으로 기록한다.
- changeset 설명, 커밋 메시지, PR 제목/본문을 모두 한국어로 정리한다.
- fresh `pnpm verify` 결과를 근거로 원격 브랜치 업데이트와 PR 생성까지 마무리한다.

### 작업 순서
1. `docs/ai/Plan.md`를 먼저 갱신하고, publish 대상 패키지와 브랜치/인증 상태를 다시 확인한다.
2. 두 패키지를 함께 올리는 patch changeset 파일을 한국어 설명으로 추가한다.
3. `pnpm verify`를 다시 실행해 증거를 확보한 뒤 changeset만 별도 커밋으로 정리하고 push한다.
4. GitHub PR을 한국어 제목/본문으로 생성하고 링크를 기록한다.

## 다음 작업: create/add flow-first 리팩터링 설계와 구현 계획 수립

### 목표
- `packages/create-rn-miniapp/src`를 create/add 흐름이 먼저 보이는 구조로 재정리한다.
- 디렉토리만 나누는 데서 끝내지 않고, `src/index.ts -> src/create/index.ts | src/add/index.ts -> phase -> domain facade -> implementation` 흐름이 코드에서 직접 읽히게 만든다.
- non-index re-export forwarding file 없이 경계를 정리하고, 설계 문서와 구현 계획을 먼저 확정한다.

### 작업 순서
1. worktree 브랜치에서 baseline `pnpm verify`를 확인하고 현재 구조를 다시 점검한다.
2. flow-first 리팩터링 설계를 `docs/superpowers/specs` 문서로 기록한다.
3. 설계 기준에 맞는 구현 계획을 `docs/superpowers/plans` 문서로 쪼개 작성한다.
4. 사용자가 설계/계획을 확인한 뒤 구현에 들어간다.

## 다음 작업: README 사용 사례 bullet을 목적 중심 카피로 정리

### 목표
- 루트 README `이런 경우에 잘 맞아요` 섹션이 DX 설명보다 사용자 목적 중심으로 읽히게 만든다.
- 어색한 장점 설명 bullet은 줄이고, MiniApp 개발에 필요한 skill을 생성과 동시에 넣고 싶을 때라는 직접적인 use case로 바꾼다.
- 관련 README 회귀 테스트와 `pnpm verify`를 확인한 뒤 `main`에 단일 목적 커밋으로 push한다.

### 작업 순서
1. 현재 README와 테스트가 어떤 use case 문구를 고정하는지 다시 확인한다.
2. README bullet을 목적 중심 문구로 정리하고, 중복되거나 약한 DX 설명은 제거한다.
3. 관련 테스트 기대값을 새 카피에 맞게 갱신하고 `pnpm verify`로 확인한다.
4. 변경을 단일 목적 커밋으로 정리하고 `origin/main`에 push한다.

## 다음 작업: README skills 섹션에 skill id와 용도 목록 노출

### 목표
- 루트 README `skills 전략` 섹션에서 설치 가능한 skill id와 용도를 불렛으로 바로 볼 수 있게 만든다.
- README managed block의 source of truth인 shared renderer와 회귀 테스트를 함께 바꿔 문서 sync drift를 막는다.
- `pnpm verify`를 확인한 뒤 `main`에 단일 목적 커밋으로 push한다.

### 작업 순서
1. root README skills managed block과 skill catalog가 현재 어떤 목록을 소유하는지 다시 확인한다.
2. shared README renderer가 skill id와 용도 불렛 목록을 렌더하게 바꾸고, 루트 README를 sync한다.
3. 관련 README 테스트 기대값을 새 계약에 맞게 갱신하고 `pnpm verify`로 확인한다.
4. 변경을 단일 목적 커밋으로 정리하고 `origin/main`에 push한다.

## 다음 작업: README 상단에 서버 인프라 SaaS 자동 설치/연동 가치 전면 배치

### 목표
- README 첫 화면에서 server provider SaaS 인프라를 생성 직후 연결까지 끝내고 바로 개발을 시작할 수 있다는 가치를 먼저 전달한다.
- 문서/skill 안내는 유지하되, 메인 value proposition 뒤로 배치해 첫 인상이 서버 준비 속도 중심으로 읽히게 만든다.
- 관련 README 회귀 테스트와 `pnpm verify`를 확인한 뒤 `main`에 단일 목적 커밋으로 push한다.

### 작업 순서
1. README 상단 카피와 관련 테스트가 현재 어떤 메시지를 고정하는지 다시 확인한다.
2. 실제 provisioning 동작 근거에 맞춰 소개 문단과 상단 섹션 문구를 서버 인프라 SaaS 자동 설치/연동 중심으로 재구성한다.
3. README 관련 테스트와 `pnpm verify`를 실행해 회귀가 없는지 확인한다.
4. 변경을 단일 목적 커밋으로 정리하고 `origin/main`에 push한다.

## 다음 작업: changeset 추가와 한글 PR 마무리

### 목표
- 이번 브랜치에 포함된 generator/runtime/template 변경을 publish 대상 두 패키지 기준 patch release note로 정리한다.
- `create-rn-miniapp`와 `@create-rn-miniapp/scaffold-templates` 둘 다 changeset에 포함해 후속 versioning이 바로 가능하게 만든다.
- 브랜치를 원격에 push하고, 변경 요약과 검증 결과를 한국어 PR 제목/본문으로 정리한다.

### 작업 순서
1. `docs/ai/Plan.md`를 먼저 갱신하고 현재 publish 대상 패키지를 다시 확인한다.
2. 두 패키지를 함께 올리는 patch changeset을 한국어 설명으로 추가한다.
3. changeset을 별도 커밋으로 정리하고 원격 브랜치에 push한다.
4. GitHub PR을 한국어 제목/본문으로 생성하고 링크를 기록한다.

## 다음 작업: SSOT/파생 상태 drift 전수 검수

### 목표
- 코드베이스에서 동일한 계약을 여러 곳이 따로 소유하거나, 한 source가 바뀌면 같이 바뀌어야 하는 파생 상태가 갈라져 있는 지점을 찾는다.
- 특히 package manager adapter, scaffold lifecycle, template/docs renderer, provider-specific server contract를 나눠서 본다.
- 이번 턴은 구현보다 검수와 분류가 목적이므로, 섹션별 findings와 후속 수정 shortlist를 만든다.

### 작업 순서
1. `docs/ai/Plan.md`를 갱신하고, 검수 축을 네 섹션으로 분리한다.
2. 네 섹션을 독립 범위로 나눠 agent 4개에 병렬 검수시킨다.
3. 각 agent 결과를 현재 코드와 대조해 중복 구현, drift risk, overwrite hazard, fake abstraction을 묶는다.
4. 최종 결과는 severity와 수정 우선순위 기준으로 정리한다.

## 다음 작업: SSOT drift 수정 구현

### 목표
- 검수에서 확인된 중복 실행 계약, lifecycle state 파생, provider utility 누수, docs renderer parallel ownership을 실제 코드에서 정리한다.
- package manager/script invocation, scaffold flow state, provider shared utility, generated README/doc renderer를 각자 한 source에서만 파생되게 만든다.
- 회귀는 구조 테스트와 출력 테스트 둘 다로 막고, 최종 `pnpm verify`까지 통과시킨다.

### 작업 순서
1. package manager/script invocation drift를 잡는 failing test를 먼저 추가한다.
2. scaffold create/add flow의 TRPC/provider state drift를 잡는 failing test를 추가한다.
3. provider shared utility 누수와 docs renderer special-case drift를 잡는 failing test를 추가한다.
4. 테스트를 통과시키는 최소 구현으로 helper/module/renderer를 정리한다.
5. `pnpm verify` 후 단일 목적 커밋으로 정리한다.

## 다음 작업: Yarn frontend Granite SHA 오류 재현과 root cause 확인

### 목표
- 생성 직후 Yarn workspace의 `frontend`에서 `yarn dev`가 SHA-1 오류로 깨지는 현상을 실제 scaffold 산출물에서 재현한다.
- `frontend` 단독 `yarn install` 전후에 어떤 lock/PnP/workspace 상태 차이가 생기는지 확인한다.
- 원인이 Granite/Metro의 Yarn PnP zip 경로 처리인지, root/workspace install 순서 문제인지 증거로 분리한다.

### 작업 순서
1. `/Users/kimhyeongjeong/Desktop/code/scaffold-test/test3`의 root와 `frontend` Yarn/PnP 관련 파일 상태를 먼저 읽는다.
2. 생성 직후 `frontend`에서 `yarn dev`를 재현하고, 오류 스택과 참조 경로를 수집한다.
3. `frontend`에서 `yarn install`을 실행한 뒤 바뀐 파일과 `yarn dev` 동작 변화를 다시 비교한다.
4. 결과를 현재 scaffold install 순서와 대조해 root cause를 정리한다.

## 다음 작업: npm/bun Cloudflare deploy contract 점검

### 목표
- Cloudflare deploy helper를 local `wrangler` 실행으로 바꾼 뒤 npm과 bun에서도 같은 contract가 유지되는지 점검한다.
- 각 package manager adapter의 `exec` 경로가 local dependency를 기준으로 동작하는지 코드와 실제 문서 기준으로 확인한다.
- 추가 수정이 필요한지, 아니면 Yarn 전용 이슈였는지 분리해서 정리한다.

### 작업 순서
1. npm/bun package manager adapter의 `exec`/`runScriptInDirectory` contract와 Cloudflare provisioning 순서를 다시 읽는다.
2. 공식 문서 기준으로 `npm exec`와 `bunx`가 local `wrangler` dependency를 어떻게 해석하는지 확인한다.
3. 필요하면 회귀 테스트나 후속 수정 포인트를 정리하고 결과를 보고한다.

## 다음 작업: Yarn Cloudflare deploy helper를 local wrangler contract로 정렬

### 목표
- Cloudflare generated `server/scripts/cloudflare-deploy.mjs`가 Yarn에서 `yarn dlx wrangler@... deploy`를 직접 치지 않게 만든다.
- generated `server/package.json`의 local `wrangler` dependency 계약과 deploy helper 실행 경로를 일치시킨다.
- Yarn PnP 환경에서도 `yarn wrangler deploy` 또는 동등한 local binary 실행 경로만 타게 고정한다.

### 작업 순서
1. Cloudflare patch test를 추가해 Yarn generated deploy helper가 `yarn dlx wrangler`가 아니라 local wrangler 실행 경로를 사용해야 한다는 red를 만든다.
2. `renderCloudflareDeployScript`를 package-manager별 local script/binary 실행 contract 기준으로 최소 수정한다.
3. targeted test와 `pnpm verify`로 Yarn Cloudflare deploy flow를 다시 고정한다.

## 다음 작업: 미커밋 변경을 목적별로 분리 커밋

### 목표
- 현재 워킹트리에 남아 있는 Firebase, Cloudflare, skills prompt, root biome preserve 수정들을 목적별로 나눠 커밋한다.
- 각 커밋은 하나의 계약 변경만 담고, 테스트와 코드가 서로 다른 주제로 섞이지 않게 정리한다.
- 이미 통과한 `pnpm verify` 상태를 유지하면서 커밋 히스토리를 읽기 쉽게 만든다.

### 작업 순서
1. 현재 변경 파일 diff를 묶음별로 분류한다.
2. 파일 단위로 stage해서 Cloudflare, Firebase env, skills prompt, root biome preserve 순으로 분리 커밋한다.
3. 마지막에 워킹트리가 clean인지 확인한다.

## 다음 작업: scaffold 순서에서 patch 결과가 overwrite되는 경로 전수 검수

### 목표
- create/add lifecycle 전체에서 provider patch가 넣은 root/workspace 설정이 이후 단계의 template sync나 overwrite로 사라지는 경로가 더 있는지 찾는다.
- 특히 root `biome.json`, root workspace manifest, root docs/policy sync, server README/state sync, provider finalize 흐름의 순서를 대조한다.
- 실제로 깨지는 회귀와 잠재 위험을 분리해서 정리하고, 필요하면 후속 수정 shortlist를 만든다.

### 작업 순서
1. scaffold create/add 순서에서 root overwrite 성격의 단계와 provider patch 단계를 먼저 표로 정리한다.
2. root template/policy/docs/workspace sync 함수가 기존 파일 내용을 보존하는지, 통째로 다시 쓰는지 분류한다.
3. provider patch가 root 파일에 side effect를 주는 지점과 이후 overwrite 단계가 충돌하는지 대조한다.
4. 실제 재현된 Firebase biome 케이스와 같은 패턴이 다른 파일에도 있는지 찾아 findings로 정리한다.

## 다음 작업: skills 설치 뒤 Firebase root biome ignore가 지워지는 회귀 수정

### 목표
- Firebase server patch가 추가한 `server/functions/lib` root biome ignore가 이후 `syncRootFrontendPolicyFiles()`에서 덮어써지지 않게 만든다.
- 특히 bun + Firebase + skills auto-install flow에서 root `biome check . --write --unsafe`가 transpiled functions output을 다시 검사하지 않게 고정한다.
- root policy sync가 provider-specific biome include 확장을 보존하도록 만든다.

### 작업 순서
1. bun Firebase patch 후 `syncRootFrontendPolicyFiles()`를 호출하면 root biome includes에 Firebase lib ignore가 남아 있어야 한다는 red test를 추가한다.
2. root biome renderer/sync가 기존 includes의 provider-specific extra entry를 보존하도록 최소 수정한다.
3. targeted test와 `pnpm verify`로 skills auto-install 이후에도 root biome 단계가 깨지지 않게 고정한다.

## 다음 작업: 추천 agent skills 설치 prompt 기본값을 yes로 변경

### 목표
- interactive create flow에서 `추천 agent skills를 지금 같이 설치할까요?` prompt의 기본 선택값이 `네, 같이 넣을게요`가 되게 만든다.
- `--yes`나 explicit `--skill` 동작은 그대로 유지하고, interactive 기본 선택만 바꾼다.
- CLI 테스트에서 skills install prompt의 `initialValue` 계약을 직접 고정한다.

### 작업 순서
1. CLI 테스트를 추가해 추천 skills prompt가 `initialValue: 'yes'`를 넘겨야 한다는 red를 만든다.
2. `resolveSelectedSkillsInput`의 select prompt 기본값을 `yes`로 최소 수정한다.
3. targeted CLI test와 `pnpm verify`로 회귀 없이 계약을 고정한다.

## 다음 작업: Firebase seed script의 parseEnv 타입 오류 수정

### 목표
- generated `server/functions/src/seed-public-status.ts`가 bun+tsc 환경에서도 `parseEnv` 반환 타입 때문에 깨지지 않게 만든다.
- typed env reader helper가 `Record<string, string>` 계약을 지키도록 `undefined` 값을 걸러낸다.
- shared helper를 고쳐 Firebase generated script와 관련 테스트가 같은 contract를 따르게 만든다.

### 작업 순서
1. env loader helper와 Firebase template 테스트를 `undefined` filtering 계약 기준으로 먼저 red로 바꾼다.
2. `renderTypedEnvReaderScriptLines`를 최소 수정해서 `parseEnv` 결과에서 string 값만 남기게 바꾼다.
3. targeted test와 `pnpm verify`로 bun predeploy build failure가 다시 안 나오게 고정한다.

## 다음 작업: Cloudflare tRPC 초기 deploy가 app-router build를 우회하지 않게 수정

### 목표
- Cloudflare+tRPC 생성물에서 초기 provisioning deploy가 `@workspace/app-router` build 산출물을 요구하면서도 direct `wrangler deploy`로 우회하는 문제를 막는다.
- provisioning 단계와 generated `server/package.json` deploy script가 같은 contract를 따르게 만든다.
- `packages/app-router/dist`가 아직 없는 fresh scaffold에서도 초기 deploy가 `server deploy` 스크립트 경유로 build를 선행하게 고정한다.

### 작업 순서
1. Cloudflare provisioning deploy helper가 direct `wrangler deploy` 대신 `server deploy` script contract를 사용해야 한다는 red test를 먼저 추가한다.
2. provider deploy helper를 package-manager adapter의 directory script 실행 기준으로 바꾸고, generated `server` deploy script와 같은 경로를 타게 만든다.
3. Cloudflare+tRPC 회귀 테스트와 `pnpm verify`로 fresh scaffold deploy contract를 다시 고정한다.

## 다음 작업: 생성 직후 repo에서 추가 `yarn install` drift 재현 확인

### 목표
- 실제 스캐폴딩 결과물에서 생성 직후 한 번 더 `yarn install`을 했을 때 lockfile이나 기타 산출물이 바뀌는지 확인한다.
- 특히 `backoffice` 추가가 포함된 Yarn + Supabase flow에서, 마지막 root install 이후에도 재설치 drift가 남는지 재현 산출물 기준으로 검증한다.
- 바뀌는 파일이 있다면 그것이 upstream CLI의 안내 문구 착시인지, root finalize 순서 문제인지, Yarn workspace/PnP contract 문제인지 구분한다.

### 작업 순서
1. 사용자가 방금 생성한 `scaffold-test/test` repo의 현재 상태를 기준선으로 커밋한다.
2. 커밋 직후 root에서 `yarn install`을 한 번 더 실행한다.
3. `git status`와 `git diff --stat`로 변경 파일을 확인하고, lockfile/manifest/tooling 산출물 변화를 분류한다.
4. 결과를 현재 generator flow와 대조해서 실제 bug인지, 안내 문구 문제인지 설명한다.

## 다음 작업: Supabase JSON parser가 Yarn stdout prelude를 무시하게 보강

### 목표
- `yarn dlx supabase ... --output json`가 Yarn 진행 로그를 `stdout`에 같이 써도 Supabase structured output parsing이 깨지지 않게 만든다.
- 임의의 mixed stdout까지 무분별하게 허용하지 않고, package manager prelude + trailing JSON이라는 현재 실출력 계약만 정확히 수용한다.
- `projects list`, `api-keys` 같은 Supabase JSON command가 Yarn 환경에서도 안정적으로 provisioning까지 이어지게 고정한다.

### 작업 순서
1. 실제 Yarn stdout prelude + trailing JSON output을 red test로 먼저 추가한다.
2. `extractJsonPayload`가 package manager prelude를 제거하거나 trailing JSON payload만 안전하게 골라내도록 최소 수정한다.
3. 기존 “임의 mixed stdout은 reject” 계약이 유지되는지 같이 확인한다.
4. targeted test와 `pnpm verify`를 통과시킨 뒤 단일 목적 커밋으로 정리한다.

## 다음 작업: Supabase token login 상호작용과 env 자동 반영

### 목표
- Supabase provisioning이 auth failure를 만났을 때 영어 에러로 끝나지 않고, 토스체 한국어 안내로 token 입력 흐름을 이어 간다.
- 토큰 발급 URL을 바로 보여 주고 CLI에서 access token을 입력받아 이번 provisioning 실행 env에 주입해서 이어서 진행한다.
- 이번 실행에서 입력받은 access token은 `server/.env.local`에도 적어 둬서 이후 `db:apply`/`functions:deploy` 자동화와 수동 재실행이 바로 이어지게 만든다.

### 작업 순서
1. Supabase provisioning 테스트를 token prompt + retry + `.env.local` access token 반영 기준으로 먼저 깨뜨린다.
2. `cli.ts` prompt abstraction에 secret input path를 추가하고, Supabase provider가 한국어 안내/URL과 함께 token을 입력받게 만든다.
3. auth failure 시 prompt로 받은 access token을 이번 실행 env에 주입해서 provisioning을 한 번 재시도하게 바꾼다.
4. finalize 단계에서 이번 실행에 쓴 access token을 `server/.env.local`에 채우도록 정리하고, targeted test와 `pnpm verify`로 고정한다.

## 다음 작업: dedent 잔여 authored multiline 전수조사

### 목표
- `packages/create-rn-miniapp/src` runtime 코드에서 아직 `dedent`로 올려야 하는 authored multiline string이 남았는지 다시 전수 조사한다.
- 계산형 line collection과 runtime data join은 예외로 두고, 사람이 직접 쓴 block/string assembly만 후보로 분류한다.
- 이번 턴은 구현보다 감사 범위를 먼저 닫고, 파일/패턴별로 바로 바꿔야 할 후보와 그대로 둬도 되는 예외를 구분해 기록한다.

### 작업 순서
1. `patching`, `templates/docs`, `providers`, `기타 runtime/helpers` 네 영역으로 나눠 병렬 감사한다.
2. `join('\n')`, multiline template literal, fragment concatenation, conditional block assembly를 다시 훑어서 authored block 후보를 모은다.
3. 후보마다 `dedent 필요`, `계산형 예외`, `애매하지만 유지 가능`으로 분류한다.
4. 결과를 합쳐 다음 구현 턴에서 바로 수정 가능한 shortlist로 정리한다.

## 다음 작업: server README에 pinned CLI 버전 기입

### 목표
- 생성되거나 patch되는 각 `server/README.md`에 이 workspace가 어떤 pinned CLI 버전 기준으로 스캐폴딩/프로비저닝됐는지 설명과 함께 남긴다.
- provider별로 실제 의존한 CLI만 노출한다.
- template 경로와 patch 경로가 같은 helper를 써서 버전 표기 contract가 한 곳에서만 관리되게 만든다.

### 작업 순서
1. Cloudflare/Firebase/Supabase server README 회귀 테스트를 먼저 깨뜨려서 버전 섹션과 설명 문구를 고정한다.
2. pinned CLI source of truth는 `external-tooling.ts`를 그대로 쓰고, README용 공통 renderer helper를 추가한다.
3. `templates/server.ts`와 `patching/server.ts`가 같은 helper로 provider별 CLI 버전 섹션을 렌더하게 바꾼다.
4. `pnpm verify`로 회귀를 확인한다.

## 다음 작업: runtime dedent 잔여 authored block 재감사

### 목표
- 1차 `dedent` 전환 뒤에도 남아 있는 runtime `join('\n')` 사용처를 다시 전수 조사한다.
- 계산형 line collection과 `dedent` 내부 interpolation join은 예외로 남기고, 사람이 직접 authoring한 multiline block이 남아 있으면 추가로 `dedent`로 올린다.
- audit 결과를 테스트와 `pnpm verify`로 다시 고정한다.

### 작업 순서
1. 남아 있는 runtime `join('\n')`를 파일별로 분류해서 계산형 예외와 authored multiline 후보를 나눈다.
2. 아직 array literal/fragment 조립으로 남아 있는 authored block은 `dedent` 또는 `dedentWithTrailingNewline`으로 전환한다.
3. targeted test와 `pnpm verify`로 회귀를 다시 확인한다.

## 다음 작업: runtime multiline string을 dedent 기준으로 정리

### 목표
- `packages/create-rn-miniapp/src` 런타임 코드에서 사람이 직접 authoring한 multiline 문자열을 `['...'].join('\n')` 대신 `dedent` 기준으로 정리한다.
- `dedent`는 `create-rn-miniapp` direct dependency로 추가하고, 얇은 로컬 helper 경유로만 import하게 통일한다.
- 테스트 문자열은 이번 1차 범위에서 제외하고, runtime source에 새 static array literal `join('\n')` 패턴이 남지 않게 meta-test로 막는다.

### 작업 순서
1. `docs/ai/Plan.md` 갱신 후, runtime source에 남아 있는 static array literal `join('\n')`를 감지하는 red test를 먼저 추가한다.
2. `packages/create-rn-miniapp`에 `dedent`를 direct dependency로 추가하고, `src/dedent.ts` 같은 얇은 helper를 만든다.
3. `patching/*`, `templates/*`, `providers/*` 순서로 사람이 작성한 multiline literal을 `dedent` tagged template로 전환한다. 줄바꿈 contract가 필요한 경우 trailing newline을 명시적으로 유지한다.
4. 계산형 line collection(`map/filter/slice` 결과 join 등)만 예외로 남기고, meta-test allowlist를 최소 범위로 고정한다.
5. targeted test와 `pnpm verify`를 통과시킨 뒤 단일 목적 커밋으로 정리한다.

## 다음 작업: root workspace topology를 manifest-driven으로 전환

### 목표
- `resolveRootWorkspaces`가 `frontend`, `server`, `backoffice` 같은 고정 디렉터리 목록을 직접 순회하지 않게 만든다.
- `packages/*` 집계 규칙은 유지하되, 나머지 루트 workspace 목록과 순서는 실제 root workspace manifest에서 읽어 오게 바꾼다.
- root template 생성, `--add` 경로의 manifest sync, inspector가 같은 topology source를 보게 정리해서 구조 확장 시 수정 지점을 줄인다.

### 작업 순서
1. 현재 root workspace contract를 red test로 먼저 고정한다. 새 테스트는 `pnpm-workspace.yaml` 또는 root `package.json#workspaces`를 source of truth로 읽어서 `frontend/server/backoffice` 외 새 workspace도 보존하고, `packages/*`만 계속 집계한다는 계약을 표현한다.
2. `resolveRootWorkspaces`를 디렉터리 하드코딩 대신 실제 manifest reader 기반으로 교체한다. manifest가 없거나 아직 생성 전인 bootstrap 시점만 최소 fallback을 둔다.
3. `normalizeRootWorkspaces`는 고정 canonical order를 버리고 manifest에 선언된 루트 workspace 순서를 보존하게 바꾼다. 단, `packages/...` 하위는 계속 `packages/*` 하나로 collapse한다.
4. `syncRootWorkspaceManifest`와 `applyRootTemplates`가 같은 normalization/serialization helper를 공유하게 정리하고, package manager별 회귀 테스트를 갱신한다.
5. `pnpm verify`로 회귀를 확인한 뒤 단일 목적 커밋으로 정리한다.

## 다음 작업: 외부 CLI 버전 고정과 Firebase provisioning 경계 재정의

### 목표
- `adapter.dlx(...)`와 `create-cloudflare@latest`에 흩어진 live CLI 의존을 repo-owned tool manifest 기준으로 exact version pin 한다.
- `wrangler`, `firebase-tools`, `supabase`, `create-cloudflare` 호출 결과가 lockfile 밖 최신 upstream 동작에 흔들리지 않게 만든다.
- Firebase provisioning은 `firebase-tools`로 가능한 범위와 GCP 권한 surface가 필요한 범위를 분리한다.

### 작업 순서
1. package-manager adapter와 provider/scaffold 호출부를 전수 조사해서 external CLI inventory와 pinned package spec source of truth를 만든다. `adapter.dlx(...)`가 raw package name 대신 manifest entry만 받도록 red test를 먼저 추가한다.
2. `wrangler`, `firebase-tools`, `supabase`, `create-cloudflare` 호출을 exact version spec으로 바꾸고, package manager adapter가 `pnpm dlx`, `yarn dlx`, `npx`, `bunx`로 같은 spec을 일관되게 렌더하도록 정리한다.
3. Firebase provisioning을 surface별로 분리한다. `projects:addfirebase`, app/web config, deploy는 pinned `firebase-tools`로 유지하고, Firestore 기본 DB 준비는 `firebase-tools` 전환 가능성을 live contract test로 먼저 검증한다. Blaze billing 확인/전환, Cloud Build service account/IAM 보정, Terms 수락은 `gcloud`/console/공식 API 경계로 명시한다.
4. 관련 README/에러 메시지/회귀 테스트를 새 계약 기준으로 갱신하고 `pnpm verify`로 고정한다.

## 다음 작업: parser/spec hardening 잔여 이슈 마감

### 목표
- Supabase/Firebase/Cloudflare provider 코드에서 남아 있는 output scraping과 command drift를 더 줄인다.
- generated server script의 env loader 렌더를 shared helper 한 곳에서만 소유하게 만든다.
- red test로 잔여 이슈를 먼저 고정한 뒤 구현, `pnpm verify`, 커밋, 푸시, PR까지 마친다.

### 작업 순서
1. Supabase mixed stdout, Firebase retry command, Cloud Build service account parse, shared env loader를 red test로 먼저 고정한다.
2. parser/command/env loader 구현을 structured output과 shared helper 기준으로 정리한다.
3. `pnpm verify`를 다시 통과시키고 단일 목적 커밋 후 브랜치 푸시와 PR 생성까지 마친다.

## 다음 작업: de-facto cleanup 브랜치에 main 최신 반영 후 충돌 정리

### 목표
- `codex/de-facto-cleanup` 브랜치에 최신 `origin/main`을 반영한다.
- 충돌이 나면 현재 PR의 표준 라이브러리 전환 의도를 유지하면서 live contract 기준으로만 정리한다.
- 정리 후 `pnpm verify`를 다시 통과시키고 브랜치를 재푸시한다.

### 작업 순서
1. `origin/main`을 fetch한 뒤 현재 브랜치에 병합한다.
2. 충돌 파일이 생기면 실제 최신 main 내용과 현재 변경 의도를 같이 읽고 수동 정리한다.
3. `pnpm verify`를 다시 통과시킨 뒤 merge commit과 함께 원격 브랜치로 푸시한다.

## 다음 작업: 표준/데팍토 대비 직접 구현 영역 2차 감사

### 목표
- 1차 감사에서 찾은 frontmatter, JSONC, provisioning 외에 남아 있는 직접 구현 영역을 더 찾는다.
- 특히 generic plumbing, AST/patching, release/dev tooling처럼 “표준 툴이 있는데 직접 든 것”을 추가로 찾는다.
- 결과는 SSoT 문맥과 분리해서, 유지 비용과 ecosystem 표준 기준으로만 정리한다.

### 작업 순서
1. scripts, src runtime module, provisioning helper를 다시 훑어서 generic utility 성격의 직접 구현을 추린다.
2. 표준/데팍토 대체재가 있는 후보는 근거와 함께 severity를 매긴다.
3. 바로 바꿀 후보와 남겨도 되는 후보를 구분해서 기록한다.

## 다음 작업: README skills 안내를 단일 skill 예시 기준으로 축약

### 목표
- 루트 README와 생성물 README의 skills 안내를 더 짧게 줄인다.
- 여러 skill을 한 번에 설치하는 예시는 제거하고, 단일 skill 설치 예시 한 줄만 남긴다.
- 생성물 README도 같은 톤으로 맞춰서 과한 목록/명령 설명을 줄인다.

### 작업 순서
1. 현재 README 회귀 테스트를 단일 skill 예시와 축약 문구 기준으로 먼저 깨뜨린다.
2. root README renderer와 generated README renderer를 같은 정책으로 간략화한다.
3. `pnpm verify`를 다시 통과시키고 필요하면 커밋한다.

## 다음 작업: main 최신과 충돌 정리 후 브랜치 재푸시

### 목표
- `codex/static-frontend-policy` 브랜치를 최신 `origin/main` 기준으로 다시 맞춘다.
- merge 과정에서 생기는 충돌은 실제 live contract 기준으로만 정리하고, 불필요한 과거 계획/실험 흔적은 끌고 오지 않는다.
- 정리 후 `pnpm verify`를 다시 통과시키고 브랜치를 재푸시한다.

### 작업 순서
1. `origin/main...HEAD` 차이와 merge 방향을 확인한 뒤 `origin/main`을 현재 브랜치에 병합한다.
2. 충돌 파일을 읽고 SSoT 기준으로 수동 정리한다.
3. `pnpm verify`를 다시 통과시킨 뒤 merge commit과 함께 브랜치를 푸시한다.

## 다음 작업: skill SSoT 정리 변경을 release metadata에 반영

### 목표
- 현재 브랜치의 skill SSoT 정리 결과를 changeset과 PR 설명에 맞게 반영한다.
- 공개 패키지 diff 기준으로 실제 변경된 패키지만 patch 릴리스 대상으로 올린다.
- verify를 다시 통과시킨 뒤 한글 PR을 생성한다.

### 작업 순서
1. `origin/main...HEAD` diff로 공개 패키지 변경 범위를 다시 확인한다.
2. 변경 범위에 맞는 changeset을 추가하고 release note를 한국어로 작성한다.
3. `pnpm verify`를 다시 통과시킨 뒤 커밋, 푸시, 한글 PR 생성까지 마친다.

## 다음 작업: 남은 skill/shared reference SSoT 드리프트 제거

### 목표
- `skills/shared/references/frontend-policy.md`처럼 live markdown이 코드 상수와 따로 움직이는 경로를 code-owned renderer 기준으로 정리한다.
- root README / generated README / skill install 관련 테스트에서 repo slug, skill id 목록, skills command를 수동 문자열로 반복하는 부분을 source 값에서 파생되게 줄인다.
- 이번 턴은 live contract만 대상으로 수정하고, 기록성 changelog/과거 plan은 제외한다.

### 작업 순서
1. shared frontend policy reference와 skills README/assertion 드리프트를 red test로 먼저 고정한다.
2. renderer + sync script를 추가하고, 테스트 기대값을 shared source에서 파생되게 바꾼다.
3. `pnpm verify`를 통과시킨 뒤 단일 목적 커밋으로 정리하고 푸시한다.

## 다음 작업: parser hardening과 직접 구현 축소

### 목표
- semver/env/TOML/CLI output parsing처럼 현재 직접 구현하거나 정규식으로 보정하는 경로를 공식 parser 또는 더 좁은 source-of-truth로 치환한다.
- provider/tooling capability를 text scraping과 하드코딩된 문자열 대신 structured output과 shared metadata에서 파생되게 만든다.
- 사용자가 지적한 직접 구현 목록을 체크리스트로 추적하고, 각 항목을 red test -> 구현 -> verify 순서로 닫는다.

### 체크리스트
- [x] Wrangler version parsing을 semver parser 기반으로 바꾸고 generated TS escaping도 안전한 serializer로 교체
- [x] generated server script의 `.env` parsing을 `parseEnv` 기반으로 교체
- [x] Cloudflare Wrangler auth parsing을 TOML parser 기반으로 교체
- [x] Supabase structured output parsing에서 text scraping 제거
- [x] Firebase/GCloud structured output parsing 보정 해킹 제거
- [x] Firebase error handling의 brittle한 영어 문구 매칭을 줄이고 structured signal 우선으로 전환
- [x] package-manager abstraction과 `packageManager` field parsing 면적을 점검하고 중복/직접 구현을 축소
- [x] AST clone과 low-risk string builder(`pnpm-workspace.yaml`, README managed block, generated TS escaping) 중 과도한 직접 구현을 정리

## 다음 작업: skill catalog를 source skill frontmatter에서 파생

### 목표
- skill id/label/category의 source of truth를 `skills/*/SKILL.md` frontmatter로 올리고, package 쪽 `skill-catalog.ts`는 generated file로 바꾼다.
- `SKILLS_SOURCE_REPO`도 `packages/create-rn-miniapp/package.json`의 repository URL에서 파생시켜 repo slug 이중 입력을 없앤다.
- red test로 source skill frontmatter -> generated catalog 정합성과 repo slug 파생을 먼저 고정한 뒤 구현, verify, 커밋, 푸시까지 마친다.

### 작업 순서
1. skill frontmatter 기반 catalog/generated marker, repo slug 파생을 기대하는 red test를 먼저 추가한다.
2. skill frontmatter에 metadata를 넣고 `scripts/sync-skill-catalog.ts`로 `skill-catalog.ts`를 generated file로 전환한다.
3. `skills-contract.ts`, AGENTS/README 관련 문구를 새 SSoT 기준으로 정리하고 `pnpm verify` 후 커밋/푸시한다.

## 다음 작업: 남은 skills SSoT 드리프트 제거

### 목표
- root README의 `skills 전략`, `server provider 고르기` 섹션을 shared renderer에서 파생시키고, static README는 managed block만 소비하게 만든다.
- installable skill registry와 root `skills/*` 디렉터리 사이의 drift를 테스트로 막고, dead metadata는 catalog에서 제거한다.
- provider -> optional skill 추천 규칙과 root README provider 설명을 provider registry 단일 source에서 파생시키고, skill 문서의 frontend policy 경로는 shared reference 한 곳으로 모은다.

### 작업 순서
1. root README managed block, skill catalog/skills 디렉터리 정합성, provider mapping, shared frontend-policy reference를 red test로 먼저 고정한다.
2. shared README renderer, provider metadata, skill catalog 정리, shared skill reference 파일을 구현하고 README를 sync한다.
3. targeted test와 `pnpm verify`를 통과시킨 뒤 단일 목적 커밋으로 정리한다.
## 다음 작업: frontend policy TDS 문구를 더 강하게 고정

### 목표
- `react-native` 기본 UI 제한 메시지에서 Granite UI 보완, `Text`/`Txt`, `Pressable` 한정 문구를 제거한다.
- TDS 사용은 항상-on 계약으로 고정하고, 예외 사용은 어떤 컴포넌트든 `biome-ignore` 이유를 남기게 바꾼다.
- red test를 먼저 바꾼 뒤 policy SSoT와 generated 산출물을 같이 맞춘다.

### 작업 순서
1. frontend policy/biome/generated docs 테스트를 새 문구 기준으로 먼저 깨뜨린다.
2. `frontend-policy.ts`의 공용 메시지와 reference line을 같은 의미로 수정한다.
3. `pnpm verify`를 다시 통과시키고 커밋한다.

## 다음 작업: frontend policy 항상-on 변경을 release metadata에 반영

### 목표
- 현재 브랜치의 frontend policy 변경을 changeset과 PR 설명에 정확히 반영한다.
- 공개 패키지는 `create-rn-miniapp`, `@create-rn-miniapp/scaffold-templates` 두 개만 patch로 올린다.
- verify 결과까지 확인한 뒤 브랜치를 푸시하고 PR을 연다.

### 작업 순서
1. changeset을 새로 추가해 두 패키지 patch와 변경 요약을 한국어로 적는다.
2. `pnpm verify` 결과를 다시 확인하고 커밋 상태를 점검한다.
3. 브랜치를 푸시하고 한국어 PR title/body를 현재 변경 범위 기준으로 작성한다.

## 다음 작업: frontend policy를 skill 설치 상태와 분리

### 목표
- root biome lint와 generated `docs/engineering/frontend-policy.md`가 skill 설치 여부에 따라 달라지지 않게 한다.
- TDS 우선, Granite routing 규칙은 MiniApp 공용 계약으로 고정하고, skill은 README onboarding만 담당하게 줄인다.
- skill-aware 경로 reference를 기대하던 테스트를 먼저 공용 정책 기준으로 바꾼 뒤 구현을 맞춘다.

### 작업 순서
1. root biome/frontend policy가 skill 설치 여부와 무관하게 같은 메시지를 가져야 한다는 red test로 바꾼다.
2. `frontend-policy.ts`, `root.ts`, 관련 docs 렌더에서 installed skill 기반 분기를 제거한다.
3. targeted test와 `pnpm verify`를 다시 통과시키고 커밋한다.

## 다음 작업: root README skills 안내를 배포 기준으로 전환

### 목표
- root README의 skills 안내를 maintainer 로컬 clone 기준이 아니라 배포된 사용자 기준으로 바꾼다.
- `npx skills add . ...` 예시는 제거하고, 실제 repo slug를 쓰는 설치 예시를 넣는다.
- 현재 설치 가능한 skill id 목록을 README에 직접 보여주고, 관련 회귀 테스트를 먼저 갱신한다.

### 작업 순서
1. root README 테스트에서 로컬 `.` 설치 예시 대신 배포 slug 기반 예시와 skill id 목록을 기대하게 바꾼다.
2. root README 문구를 배포 기준 install flow로 수정한다.
3. targeted test와 `pnpm verify`를 다시 통과시키고 커밋/푸시한다.

## 다음 작업: skills 전략 문구 토스체로 정리

### 목표
- root README와 generated README의 `skills 전략` 3줄 설명을 더 짧고 토스체 톤으로 다듬는다.
- 의미는 유지하되, `create-rn-miniapp`는 추천만 하고 실제 lifecycle은 표준 `skills` CLI가 담당한다는 점을 더 자연스럽게 전달한다.
- 관련 회귀 테스트를 먼저 갱신하고, 문구 수정 뒤 verify까지 다시 통과시킨다.

### 작업 순서
1. README 회귀 테스트의 해당 문장 기대값을 먼저 토스체 기준으로 바꾼다.
2. root README와 generated README renderer의 같은 문구를 같이 수정한다.
3. targeted test와 `pnpm verify`를 다시 통과시키고 커밋/푸시한다.

## 다음 작업: changeset / PR 설명 정합성 복구

### 목표
- 현재 브랜치의 구현 상태와 어긋난 changeset, PR title/body를 실제 optional skills 전략 기준으로 다시 맞춘다.
- 제거된 `skills-manager`, `agent-skills` 패키지를 changeset 대상과 PR 설명에서 걷어낸다.
- 루트 `skills/` source + `@vercel-labs/skills` 표준 CLI 위임 + SSoT 정리 내용을 release/PR 설명의 단일 기준으로 맞춘다.

### 작업 순서
1. 현재 changeset과 열린 PR의 제목/본문을 확인한다.
2. changeset frontmatter를 실제 공개 패키지 변경 범위로 줄이고, 본문을 현재 구조 설명으로 갱신한다.
3. PR title/body를 optional skills 전략과 SSoT 정리 기준으로 다시 작성한다.
4. 필요 시 `pnpm verify`를 다시 실행한 뒤 커밋하고 푸시한다.

## 다음 작업: skills 경로 강결합 전수 감사

### 목표
- skill 경로, skill 이름, skill 존재 가정에 강결합된 코드/문서/테스트를 전수 조사한다.
- 특히 경로 문자열을 직접 박아 넣어서 `skills` 설치 정책이나 README 계약이 바뀌면 정합성이 깨질 수 있는 P1 위험을 찾는다.
- 이번 턴은 수정 전 감사와 우선순위 정리에 집중하고, 결과는 severity와 파일/라인 기준으로 정리한다.

### 작업 순서
1. 코드베이스 전체에서 `skills`, `.agents/skills`, `.claude/skills`, `SKILL.md`, 개별 skill id, install/update command 참조를 수집한다.
2. 수집 결과를 source-of-truth 관점으로 분류한다.
   - shared contract를 소비하는 파생 참조
   - skill 경로/이름/설치 상태를 직접 소유하는 중복 참조
3. P1 위험만 우선 추려서 파일/라인과 함께 보고하고, 후속 수정 방향을 제안한다.

## 다음 작업: README skills 전략 섹션 축약

### 목표
- root README와 generated README의 skill 안내 섹션 제목을 `## skills 전략`으로 통일한다.
- 소개 문구는 5줄 안쪽의 짧은 전략 설명으로 줄이고, `create-rn-miniapp`는 추천만 하고 실제 lifecycle은 `@vercel-labs/skills` 표준 CLI를 직접 쓴다는 점을 더 선명하게 드러낸다.
- 추천 목록, 설치 예시, 표준 명령은 기존처럼 유지하되 장황한 도입 문장은 제거한다.

### 작업 순서
1. root README와 generated README 테스트에서 `Optional agent skills`와 기존 장문 설명을 `skills 전략` 기준으로 먼저 깨뜨린다.
2. root README와 generated README 렌더러를 같은 방향의 짧은 전략 설명으로 갱신한다.
3. targeted test와 `pnpm verify`를 다시 통과시키고 커밋한다.

## 다음 작업: dev publish 구현을 루트 scripts로 이동

### 목표
- `publish:dev`의 실행 파일을 `packages/create-rn-miniapp` 내부에서 제거하고, repo root `scripts/` 아래로 옮긴다.
- 루트 `package.json`의 `publish:dev`는 새 root script만 가리키게 한다.
- release test는 root script 경로와 package-local 구현 제거를 먼저 고정한다.

### 작업 순서
1. `release.test.ts`에서 `publish:dev` 경로 기대치를 `scripts/publish-dev.ts`로 바꾸고, 기존 package-local 구현 파일이 없어야 한다는 red test를 추가한다.
2. `packages/create-rn-miniapp/src/release/dev-publish.ts` 구현을 root `scripts/publish-dev.ts`로 옮기고, 관련 import와 root script를 갱신한다.
3. targeted test와 `pnpm verify`를 다시 통과시킨 뒤 커밋한다.

## 다음 작업: non-index re-export alias 금지

### 목표
- `index.ts`를 제외한 source module에서는 re-export syntax뿐 아니라 imported binding을 export const/type/export clause로 다시 노출하는 alias forwarding도 금지한다.
- 이 규칙은 `module-surface` 테스트로 고정하고, 남아 있는 alias surface는 실제 구현 또는 shared source module로 치환한다.

### 작업 순서
1. `module-surface.test.ts`에 imported binding alias export 금지 red test를 추가한다.
2. 현재 위반 중인 source module을 shared source-of-truth나 local definition으로 치환한다.
3. targeted test 후 `pnpm verify`까지 다시 통과시킨다.

## 다음 작업: SSoT 중복 제거 마감 및 커밋

### 목표
- optional skills 하드컷 이후 남아 있는 source-of-truth 중복을 정리한다.
- skill 추천 규칙, workspace topology 판별, local skill 경로/명령 문구를 한 곳에서만 소유하게 만든다.
- 전체 `pnpm verify`를 다시 통과시키고, 이번 리팩터를 하나의 커밋으로 정리한다.

### 작업 순서
1. 전체 `pnpm verify`를 실행해 현재 refactor 상태에서 깨지는 지점을 먼저 확인한다.
2. 실패 지점을 기준으로 `feature-catalog`, `skill-catalog`, `workspace-topology`, `skills-contract` 경계가 실제로 단일 SSoT로 작동하는지 점검한다.
3. 남아 있는 import/format/type/test 회귀를 최소 수정으로 정리한다.
4. `pnpm verify`를 다시 통과시킨 뒤 diff를 검토하고 커밋한다.

## 다음 작업: 2차 SSoT 감사와 잔여 중복 제거

### 목표
- 1차 리팩터 뒤에도 남아 있는 "같은 사실을 여러 곳에서 직접 적는" 경로와 조합 로직을 다시 걷어낸다.
- skill 설치 명령, project-local skill 탐색, skill catalog path 파생, tRPC legacy workspace path, skill 간 cross-reference path를 한 군데 기준으로 줄인다.
- 회귀 테스트를 먼저 추가한 뒤 수정하고 다시 커밋한다.

### 작업 순서
1. 남아 있는 SSoT 위반 후보를 코드와 문서에서 다시 수집한다.
2. failing test부터 추가한다.
3. `skills-install`, `skill-catalog`, `trpc-workspace-metadata`, skill reference 문서를 단일 source 기준으로 정리한다.
4. targeted test와 `pnpm verify`를 다시 통과시키고 커밋한다.

## 다음 작업: skill 자동 설치 출력 UX 정리

### 목표
- scaffold 중 skill 자동 설치는 유지하되, `skills add`의 장황한 raw copy 로그는 그대로 노출하지 않는다.
- 설치가 끝나면 실제 설치된 project-local skill 기준으로 `skills list` 스타일의 짧은 요약만 note로 보여준다.
- workspace-local 설치가 의도된 동작이라는 점이 출력에서도 더 명확히 드러나게 만든다.

### 작업 순서
1. `scaffold/index.test.ts`와 `skills-install.test.ts`에 red test를 추가한다.
2. `maybeInstallSelectedSkills()`가 install command를 capture mode로 실행하고, 설치 후 실제 installed skill 목록을 읽어 summary note를 만들게 수정한다.
3. targeted test 후 `pnpm verify`를 다시 통과시키고 커밋한다.

## 다음 작업: Optional Skills README Onboarding

### 목표
- skill 설치는 기본적으로 사용자 선택으로 두고, scaffold는 optional onboarding만 제공한다.
- scaffold 시 사용자가 skill 설치를 선택한 경우에만 generated `AGENTS.md`가 local skill 존재를 전제로 라우팅을 포함한다.
- skill 설치를 선택하지 않은 경우 generated `AGENTS.md`는 skill 경로나 ownership을 단정하지 않고, README가 optional skills 안내를 맡는다.
- `create-rn-miniapp`는 skill lifecycle을 소유하지 않고, 설치/목록/업데이트는 `npx skills ...` 표준 명령에 위임한다.
- skill taxonomy는 `core/derived/manual` 없이 flat skill set으로 단순화한다.

### 설계 원칙
- `AGENTS.md`는 강제 계약만 소유한다. optional 상태인 skill 설치 여부를 가정하지 않는다.
- scaffold는 “skill을 자동 유지보수”하지 않는다. 설치 여부와 업데이트 여부는 사용자 의사결정이다.
- generated repo의 skill onboarding은 README와 scaffold 종료 메시지에서 설명한다.
- skill source는 이 monorepo top-level `skills/` plain directory로 두고, npm package/workspace로 취급하지 않는다.
- 설치는 `npx skills add <repo> --skill ...`, 확인은 `npx skills list/check/update` 같은 표준 CLI만 사용한다.

### 작업 순서
1. `packages/agent-skills`와 `packages/skills-manager`를 제거하고, canonical skill source를 repo root `skills/`로 옮긴다.
2. `create-rn-miniapp`에서 manifest, snapshot sync/mirror, custom skills update wrapper를 제거한다.
3. CLI create flow에 optional skill prompt를 둔다.
   - 설치 여부를 먼저 묻고
   - 설치를 선택한 경우 flat skill multiselect를 보여준다.
4. scaffold 실행 후 skill 설치를 선택한 경우에만 `npx skills add <repo> --skill ...` 명령을 실행하거나, 최소한 실행 명령을 바로 출력한다.
5. generated `AGENTS.md`를 조건부 렌더링으로 바꾼다.
   - skill installed: project-local skill 사용 경로를 얇게 안내
   - skill not installed: skill 언급을 제거하고 contract/start here만 남긴다.
6. generated README에 `Optional agent skills` 섹션을 추가해 추천 skill, 설치 예시, `npx skills list/check/update` 사용법을 설명한다.
7. `docs/index.md`, `CLAUDE.md`, Copilot instructions도 `AGENTS.md`와 같은 가정을 따르도록 정리한다.
8. skill 관련 기존 테스트를 README/AGENTS conditional contract 기준으로 다시 작성하고, obsolete snapshot/manifest 테스트는 제거한다.

### 테스트 기준
- skill 미설치 scaffold 결과에는 `AGENTS.md`가 local skill path를 단정하지 않는다.
- skill 설치 선택 시에만 `AGENTS.md`가 installed project-local skill을 supplemental context로 안내한다.
- generated README는 skill 설치 여부와 무관하게 optional onboarding과 표준 `skills` CLI 명령을 설명한다.
- `create-rn-miniapp` 소스에는 manifest, skills mirror, custom sync/upgrade implementation이 남지 않는다.
- `pnpm verify`를 통과한다.

## 다음 작업: Snapshot-Managed Skill Catalog

### 목표
- `@create-rn-miniapp/agent-skills`를 `@create-rn-miniapp/agent-skills`로 rename하고, workspace 디렉터리도 `packages/agent-skills`로 맞춘다.
- 새 이름의 패키지는 “scaffold 내부 자산”이 아니라 “canonical skill catalog package”를 의미한다. 이번 작업에서 별도 repo 분리는 하지 않고, 같은 monorepo 안에서 ownership만 분리한다.
- generated repo는 계속 `.agents/skills`와 `.claude/skills`에 실제 snapshot을 가진다.
- 스캐폴더는 `core + derived + manual extra`를 계산해 초기 snapshot과 manifest를 만들고, 이후 업데이트는 explicit `skills diff|sync|upgrade`로만 수행한다.
- `tds-ui`를 포함한 skill-local self-refresh는 이번 구조로 대체하고 제거 방향으로 수렴시킨다.

### 고정 원칙
- selection model은 `effective = core + derived + manual`로 고정한다.
  - `core`: 항상 포함
  - `derived`: workspace/provider/topology에서 자동 파생
  - `manual`: scaffold 시 사용자 다중 선택으로만 추가
- generated repo의 canonical source는 항상 `.agents/skills`다. `.claude/skills`는 전체 mirror이며 직접 수정 대상이 아니다.
- custom skill은 별도 디렉터리로 분리하지 않고 `.agents/skills/<custom-skill>` sibling entry로 둔다. manifest에 없는 sibling entry는 unmanaged custom skill로 취급한다.
- `verify`와 일반 agent 실행 흐름에서는 upstream fetch, catalog version 변경, self-refresh를 허용하지 않는다.
- upstream catalog를 읽는 경로는 `create-miniapp skills diff|sync|upgrade`로 한정한다.
- generated repo는 symlink mirror를 기본값으로 쓰지 않는다. committed snapshot의 이식성과 cross-platform 안정성을 위해 `.claude/skills`는 복사 mirror로 유지한다.

### manifest schema
- 경로: `.create-rn-miniapp/skills.json`
- 이 파일은 code-owned이고 commit 대상이다.
- 필드:
  - `schema`
  - `generatorPackage`
  - `generatorVersion`
  - `catalogPackage`
  - `catalogVersion`
  - `manualExtraSkills`
  - `resolvedSkills[{ id, mode, renderedDigest }]`
  - `customSkillPolicy`
- `mode`는 `core | derived | manual`만 허용한다.
- `renderedDigest`는 catalog raw source digest가 아니라, token 반영 후 실제 `.agents/skills/<id>`에 materialize된 출력 기준 digest로 계산한다.
- `resolvedSkills`에 없는 skill 디렉터리는 user-owned unmanaged entry로 간주하고 sync/upgrade에서 보존한다.
- `installedAt` 같은 timestamp 필드는 넣지 않는다. code-owned manifest에 시간 필드를 넣으면 sync만으로 불필요한 diff가 생긴다.

### generated repo ownership 모델
- 현재처럼 `.agents/skills` 전체를 지우고 다시 만드는 방식은 중단한다.
- `skills sync`는 manifest에 기록된 managed skill id만 reconcile한다.
  - managed id가 존재하면 해당 디렉터리만 교체 가능
  - managed id가 사라지면 해당 디렉터리만 제거 가능
  - unknown/custom sibling skill 디렉터리는 유지
- `.claude/skills`는 `.agents/skills` 전체를 mirror한다.
  - managed + unmanaged custom sibling 모두 mirror 대상이다.
  - `.claude/skills`에서만 존재하는 파일/디렉터리는 drift로 간주하고 `skills:mirror`에서 제거된다.

### root scripts 분리
- `skills:mirror`
  - local `.agents/skills -> .claude/skills` 복사만 수행
  - 네트워크 없음
- `skills:check`
  - local mirror/drift 검사만 수행
  - `verify`에 포함
  - upstream latest 여부는 절대 확인하지 않음
- `skills:sync`
  - manifest의 pinned `generatorVersion`/`catalogVersion`과 현재 topology를 기준으로 managed skills/doc/router를 재materialize
  - 실행 후 `skills:mirror`까지 수행
- `skills:diff`
  - 현재 repo 상태와 `skills sync` 결과 차이를 read-only로 보고
  - 파일 쓰기 없음
- `skills:upgrade`
  - target version(`latest` 또는 명시 버전)으로 manifest의 `generatorVersion`/`catalogVersion`을 갱신한 뒤 `skills:sync`
- generated repo의 `skills:sync|diff|upgrade`는 단순 로컬 script가 아니라, manifest에 pinned 된 `generatorVersion`을 읽어 `create-miniapp skills ...`를 실행하는 wrapper script로 제공한다.
  - 예: package manager별 `dlx`/`npx` wrapper에서 pinned version 호출
  - 이렇게 해야 generated repo가 scaffold internals를 직접 devDependency로 들고 있지 않아도 explicit update flow를 재현할 수 있다.

### CLI surface
- 새 서브커맨드 추가:
  - `create-miniapp skills sync --root-dir .`
  - `create-miniapp skills diff --root-dir .`
  - `create-miniapp skills upgrade --root-dir . --to latest`
- create flow:
  - `--extra-skill <id>` 반복 옵션 추가
  - interactive multiselect 추가
  - 선택 가능한 대상은 `manual extra` only
  - `derived` skill은 체크박스로 고르지 않고 topology에서만 결정
- add flow:
  - manifest가 있으면 `manualExtraSkills`를 보존하고 `derived`만 재계산
  - 기존 manual을 silent drop 하지 않음
- manifest 없는 기존 repo:
  - 첫 `skills sync`에서 bootstrap 수행
  - 현재 topology로 `core/derived`를 추론
  - catalog에 존재하는 추가 installed skill만 `manual`로 기록
  - catalog에 없는 sibling entry는 unmanaged custom으로 그대로 둠
- `skills upgrade` safety:
  - target catalog에서 사라진 manual skill id가 있으면 silent drop 하지 않고 명시적으로 실패시킨다.
  - 사용자가 manual 목록을 정리하거나 대체 id를 선택한 뒤 다시 upgrade 하게 만든다.

### 문서 책임 재배치
- `AGENTS.md`와 `CLAUDE.md`는 thin router만 담당한다.
  - canonical source: `.agents/skills/*`
  - Claude mirror: `.claude/skills/*`
  - 상세 inventory와 ownership 규칙은 `docs/skills.md`로 위임
- 새 `docs/skills.md`가 소유할 내용:
  - installed managed skills 목록
  - 각 skill의 mode(`core/derived/manual`)
  - current pinned generator/catalog version
  - `skills:mirror`, `skills:check`, `skills:sync`, `skills:diff`, `skills:upgrade` 사용법
  - custom skill ownership 규칙
  - `.claude/skills` 직접 수정 금지 규칙
- `docs/index.md`는 `docs/skills.md`를 링크만 하고 inventory를 길게 반복하지 않는다.
- 기존 `skills:sync` 의미는 `skills:mirror`로 명확히 바꾼다.

### tds-ui self-refresh 정리
- 현재 진행 중인 `tds-ui` self-refresh hook 계획은 이번 작업으로 supersede 한다.
- `tds-ui`를 포함한 개별 skill은 더 이상 npm/docs를 직접 읽어 generated snapshot을 바꾸지 않는다.
- freshness 관련 메모가 필요하면 `docs/skills.md`와 catalog metadata에만 남기고, 실제 snapshot 갱신은 항상 `skills:upgrade` 경로로 수렴시킨다.

### 테스트 계획
- red test부터 추가한다.
- create 시 `manual` extra multiselect/CLI option이 manifest와 generated snapshot에 반영된다.
- add 시 manual extras는 유지되고 derived skills만 topology 기준으로 재계산된다.
- `skills sync`는 managed skill만 수정하고 unknown custom skill 디렉터리는 보존한다.
- `skills mirror`는 `.agents/skills` 전체를 `.claude/skills`에 정확히 복사한다.
- `skills check`는 mirror drift만 잡고 upstream 변경은 건드리지 않는다.
- `skills diff`는 파일을 쓰지 않고 pending diff만 보고한다.
- `skills upgrade`는 target version으로 manifest와 managed snapshot만 갱신한다.
- manifest 없는 기존 repo에서 bootstrap sync가 동작한다.
- target catalog에서 사라진 manual skill id가 있으면 `skills upgrade`가 실패한다.
- `AGENTS.md`는 thin router로 축소되고 `docs/skills.md`가 inventory를 가진다.
- generated root wrapper script가 manifest의 pinned version을 읽어 `create-miniapp skills ...`를 실행한다.
- 주 대상 테스트 파일:
  - `packages/create-rn-miniapp/src/cli.test.ts`
  - `packages/create-rn-miniapp/src/templates/index.test.ts`
  - `packages/create-rn-miniapp/src/scaffold/index.test.ts`
  - 필요 시 `src/templates/root.ts` 관련 회귀 assertion 추가
- 완료 전 `pnpm verify`를 반드시 통과시킨다.

### 완료 기준
- generated repo에는 `.agents/skills`와 `.claude/skills` local snapshot이 남아 있고, custom sibling skill도 깨지지 않는다.
- `verify`는 upstream과 무관한 local integrity check만 수행한다.
- upstream 변경 반영은 `skills:upgrade` 또는 `create-miniapp skills upgrade`에서만 일어난다.
- `AGENTS.md`/`CLAUDE.md`는 얇아지고, inventory와 ownership 규칙은 `docs/skills.md` 한 곳이 소유한다.
- 기존 `tds-ui` self-refresh 같은 skill-local auto-update 경로가 제거된다.
- `pnpm verify`를 통과한다.

## 다음 작업: tds-ui self-refresh hook 추가

### 목표
- generated repo의 `.agents/skills/tds-ui`가 7일 이상 오래된 snapshot이면 외부 package/docs 기준으로 자동 최신화되게 만든다.
- freshness check는 skill-local script(`scripts/ensure-fresh.mjs`, `scripts/refresh-catalog.mjs`)로 제공하고, `SKILL.md`와 `AGENTS.md`가 이 hook contract를 먼저 안내하게 만든다.
- refresh 성공 시 `generated/catalog.json`, `generated/anomalies.json`, `generated/catalog.md`, `AGENTS.md`, `metadata.json`을 실제 repo 파일로 다시 쓰고 `.claude/skills` mirror까지 다시 맞춘다.
- 저장 전 검증은 malformed output 방지에만 집중하고, 최신 package/docs가 실제로 바뀐 경우에는 canonical snapshot을 갱신할 수 있게 만든다.
- refresh 실패 시에는 hard fail 없이 기존 snapshot으로 계속 진행하게 만든다.
- `ensure-fresh.mjs`와 `refresh-catalog.mjs` entrypoint는 어떤 예외가 나도 warning만 남기고 `exit 0`으로 끝나게 만든다.

### 작업 순서
1. `packages/create-rn-miniapp/src/templates/index.test.ts`와 `src/scaffold/index.test.ts`에 freshness hook script tree, generated repo copy, stale auto-refresh, silent fallback red test를 추가한다.
2. `packages/agent-skills/tds-ui/scripts/*`와 supporting lib를 추가해 npm registry + Toss Mini Docs 기반 refresh pipeline을 구현한다.
3. refresh 결과를 malformed output 관점으로 검증하되, state model/doc URL/package version 같은 최신 사실 변화는 받아들일 수 있게 기준을 조정한다.
4. generated repo에서 실제 refresh를 돌려 최신 upstream diff를 확인하고, canonical `generated/*`와 `metadata.json`을 그 결과로 갱신한다.
5. malformed metadata와 direct `refresh-catalog.mjs` 실행까지 fail-open인지 red test로 잠근다.
6. `packages/agent-skills/tds-ui/{SKILL.md,AGENTS.md,metadata.json,generated/catalog.md}`를 hook contract와 refresh metadata에 맞춰 갱신한다.
7. targeted test 후 `pnpm verify`까지 다시 통과시키고 커밋한다.
8. npm dist-tag가 `latest=1.3.8`, `next=2.0.2`인 현재 상태에서는 `latest`가 아직 `1.x`일 때만 `2.0.2`를 refresh target으로 우선 선택하는 예외를 둔다.

### 완료 기준
- generated repo의 `.agents/skills/tds-ui/scripts/ensure-fresh.mjs`가 stale metadata를 보고 refresh를 자동 실행한다.
- refresh는 최신 `@toss/tds-react-native` 버전과 Toss Mini Docs를 다시 읽어 snapshot 파일을 갱신한다.
- refresh는 저장 전에 malformed output 검증을 통과해야 하며, 최신 source가 바뀐 경우에는 그 사실을 snapshot에 반영한다.
- `.claude/skills/tds-ui`에서 script를 실행해도 canonical `.agents/skills/tds-ui`가 갱신되고 mirror가 다시 sync된다.
- refresh 실패 시 어떤 진입 경로에서도 warning만 남기고 exit 0으로 계속 진행하며 기존 snapshot을 유지한다.
- `pnpm verify`를 통과한다.

## 다음 작업: 루트 README UX refresh

### 목표
- 루트 `README.md`를 처음 보는 사용자 기준으로 다시 써서, 도구의 가치와 시작 순서가 내부 구현 설명보다 먼저 읽히게 만든다.
- `생성물 계약`, `Provider IaC`, `렌더`, `catalog가 소유`, `skill-catalog.ts` 같은 maintainer 중심 표현을 걷어낸다.
- 사용자 중심 섹션 순서와 anti-jargon 규칙을 README 회귀 테스트로 고정한다.
- 긴 CLI 플래그 나열 대신 `--help` 중심 안내로 줄이고, Skill과 `nx`/`biome`이 생성 직후 어떤 역할을 하는지 사용자 언어로 설명한다.
- README 안에서 생성되는 Skill 목록도 사용자 관점 이름과 쓰임새로 같이 보여준다.
- `## 이런 경우에 잘 맞아요`에서는 Skill 공유보다 MiniApp에 필요한 Skill이 처음부터 준비돼 있다는 가치를 먼저 드러낸다.

### 작업 순서
1. `packages/create-rn-miniapp/src/templates/index.test.ts`에 README UX red test를 추가하고, 기존 maintainer-oriented assertion을 사용자 중심 규칙으로 치환한다.
2. `README.md`를 "무엇을 해주는지 -> 언제 쓰는지 -> 빠른 시작 -> 생성 후 어디를 볼지 -> Skill 목록과 verify 흐름 설명 -> 상세 안내" 순서로 재작성한다.
3. provider와 `--add` 설명은 선택 기준 중심으로 줄이고, CLI 플래그 상세 목록은 `--help`로 넘긴다.
4. `pnpm --filter create-rn-miniapp test -- src/templates/index.test.ts`와 `pnpm verify`를 다시 통과시킨 뒤 커밋한다.

### 완료 기준
- 첫 화면에서 내부 산출물 목록보다 사용자 가치와 다음 행동이 먼저 읽힌다.
- README가 `AGENTS.md`의 `Start Here`로 자연스럽게 연결된다.
- maintainer-only 표현과 내부 소스 파일 경로가 README에서 빠진다.
- README가 Skill과 `nx`/`biome`의 역할을 "왜 같이 생기는지" 기준으로 설명하고, 생성되는 Skill 목록을 사용자 언어로 보여준다.
- `pnpm verify`를 통과한다.

## 다음 작업: tds-ui decision skill 최종 마이그레이션

### 목표
- `packages/agent-skills/tds-ui`를 self-contained decision skill 구조로 재정의한다.
- `generated/catalog.json`을 truth source로 두고 anomaly, references, rules, output contract를 패키지 내부에서 모두 닫는다.
- 생성물과 generator metadata가 `.agents/skills/tds-ui`, `.claude/skills/tds-ui`만 가리키게 맞춘다.

### 후속 보정
- acceptance prompt 세트를 패키지 내부 문서에 exact phrase로 고정한다.
- `AGENTS.md`와 `generated/catalog.md`를 truth source projection/generated output 계약으로 명시한다.
- 위 두 항목을 red test로 잠근 뒤 `pnpm verify`까지 다시 통과시킨다.

### 후속 보정 2
- acceptance prompt 검증이 positive mapping만 보지 않도록, 대안 배제와 anomaly note 요구까지 같은 계약에서 직접 검사한다.
- output contract 7항 중 하나라도 빠지면 incomplete answer로 본다는 문구를 `SKILL.md`, `AGENTS.md`, local reference, 테스트에 명시한다.
- export-only 추천 시 doc-backed fallback 강제를 output contract enforcement로 다시 잠근다.

### 작업 순서
1. `tds-ui` 패키지 구조를 `SKILL.md`, `AGENTS.md`, `metadata.json`, `generated/*`, `references/*`, `rules/*` 기준으로 재편한다.
2. current export/docs 상태를 `generated/catalog.json`, `generated/anomalies.json`, `references/decision-matrix.md`, `references/export-gaps.md`에 decision cluster 용어로 고정한다.
3. generator core skill metadata와 관련 참조를 `tds-ui` decision skill contract에 맞춰 정리하고, red test로 rename/output contract를 먼저 고정한다.
4. acceptance prompt에 맞는 selection/anomaly handling이 문서와 생성물에 반영되는지 확인한 뒤 `pnpm verify`로 마무리한다.

### 완료 기준
- `packages/agent-skills/tds-ui`만 읽어도 component selection, anomaly handling, answer format이 끝난다.
- docs-backed / export-gap / export-only / blocked 상태가 `catalog.json`, `anomalies.json`, `references`, `rules`에서 분리돼 있다.
- `navbar`, `chart`, `stepper-row`, export-only 8개, `paragraph`가 decision tree와 anomaly note 규칙에 따라 처리된다.
- generated core skill 경로가 `.agents/skills/tds-ui`, `.claude/skills/tds-ui`로 고정되고 `pnpm verify`를 통과한다.

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
- patch changeset 범위를 `create-rn-miniapp`, `@create-rn-miniapp/agent-skills`, `@create-rn-miniapp/scaffold-templates` 세 패키지로 바로잡는다.
- changeset 수정 후 `pnpm verify`를 다시 통과시킨다.

## 다음 작업: skills-manager SSoT 하드컷

### 목표
- `create-rn-miniapp`는 scaffold만 담당하고, skill install/sync/diff/upgrade와 `docs/skills.md` 렌더링 책임은 전부 `@create-rn-miniapp/skills-manager`로 이동한다.
- skill metadata, topology 기반 derived rule, manifest reconcile, wrapper script source를 각각 한 군데서만 소유하도록 정리한다.
- generated repo의 skill lifecycle이 더 이상 `create-rn-miniapp` 내부 구현에 의존하지 않게 만든다.

### 확인된 중복/결합 지점
- `packages/create-rn-miniapp/src/scaffold/index.ts`가 여전히 `syncGeneratedSkills()`와 `applyDocsTemplates()`를 직접 호출해 scaffold 시점 skill lifecycle을 소유한다.
- skill catalog가 `packages/create-rn-miniapp/src/templates/skill-catalog.ts`와 `packages/skills-manager/src/skill-catalog.ts`에 중복돼 있다.
- manifest/reconcile/materialize 로직이 `packages/create-rn-miniapp/src/templates/skills.ts`와 `packages/skills-manager/src/skills.ts`에 중복돼 있다.
- `docs/skills.md` 렌더링이 `packages/create-rn-miniapp/src/templates/docs.ts`와 `packages/skills-manager/src/docs.ts`에 중복돼 있다.
- root wrapper script source가 `packages/scaffold-templates/root/*.mjs`와 `packages/skills-manager/src/root.ts`로 갈라져 있다.
- workspace topology/package manager 판단이 `packages/create-rn-miniapp/src/workspace-inspector.ts`, `packages/skills-manager/src/workspace.ts`, 각 package manager helper에 나뉘어 있다.

### 작업 순서
1. `skills-manager`에 `install` command를 추가하고, `create-rn-miniapp` scaffold flow는 마지막에 CLI boundary로 `skills-manager install`만 호출하게 바꾼다.
2. skill catalog를 `@create-rn-miniapp/agent-skills` 기준 metadata로 승격해 `create-rn-miniapp`와 `skills-manager`가 같은 source를 읽게 만든다.
3. `packages/create-rn-miniapp/src/templates/skills.ts`의 manifest/reconcile/materialize 책임을 제거하고, generated repo skill snapshot 변경은 `skills-manager`만 수행하게 만든다.
4. `packages/create-rn-miniapp/src/templates/docs.ts`에서 `docs/skills.md` 책임을 제거하고, `skills-manager`가 skills manifest와 installed snapshot 기준으로 렌더하게 만든다.
5. root wrapper script source를 한 군데로 정리하고, `packages/scaffold-templates`는 그 결과물을 복사만 하도록 맞춘다.
6. topology/package manager 판별 로직을 shared helper 또는 `skills-manager` SSoT로 정리하고, scaffold 쪽 중복 구현과 관련 테스트를 걷어낸다.

### 테스트/정리 기준
- `create-rn-miniapp` 테스트는 scaffold 결과와 초기 install 호출 여부만 검증하고, skill lifecycle 세부 동작 회귀는 `skills-manager` 테스트로 이동한다.
- `create-rn-miniapp`에서 skill 관련 dead code와 template-layer 중복 테스트를 제거한 뒤 `pnpm verify`를 다시 통과시킨다.
- generated repo wrapper는 `create-rn-miniapp`가 아니라 `@create-rn-miniapp/skills-manager`만 호출한다.
- 현재 브랜치 diff와 맞는 한국어 changeset 설명을 작성하고, PR 제목/본문도 같은 범위로 갱신한다.

### 작업 순서
1. 현재 diff 기준으로 배포 대상 패키지를 확정한다.
2. `.changeset/*.md` 파일을 추가해 patch bump와 한국어 릴리스 요약을 기록한다.
3. PR 제목과 본문을 현재 브랜치 범위에 맞게 한국어로 수정한다.
4. `pnpm verify`를 다시 실행해 최종 상태를 확인한다.
5. changeset 커밋을 만들고 현재 PR 브랜치에 푸시한다.

## 진행 예정: Skill taxonomy SSoT audit

### 목표
- 새 skill taxonomy migration에서 rename, mirror, generated output, provider state ownership이 서로 일관되게 따라가는지 점검한다.
- 한 곳을 바꾸면 같이 바뀌어야 하는 파생 산출물 중 누락된 항목이 있는지 찾는다.
- 테스트는 통과하지만 실제 계약이나 문서 의미상 미완성인 구현이 있는지 확인한다.

### 점검 순서
1. old skill name / old 경로 / old 문서명이 남아 있는지 repo 전체 grep으로 확인한다.
2. canonical source(`packages/agent-skills`)와 generator metadata(`templates/*`, `scaffold/*`, `patching/*`)가 같은 이름/구조를 소유하는지 대조한다.
3. generated repo 계약인 `AGENTS.md`, `README.md`, `.agents/skills`, `.claude/skills`, `server/.create-rn-miniapp/state.json`, `server/README.md`가 서로 일치하는지 테스트와 렌더링 로직을 함께 읽어 검수한다.

## 현재 skills-manager 하드컷 분리

### 목표
- `create-rn-miniapp`는 scaffold/create/add 흐름과 최초 skill install orchestration만 담당한다.
- `@create-rn-miniapp/agent-skills`는 skill asset과 catalog metadata만 소유하고 CLI를 갖지 않는다.
- 새 `@create-rn-miniapp/skills-manager`가 `.agents/skills`, `.claude/skills`, `docs/skills.md`, `.create-rn-miniapp/skills.json`의 lifecycle을 전담한다.
- generated repo wrapper script는 더 이상 `create-miniapp skills ...`를 호출하지 않고 `skills-manager`만 호출한다.

### 작업 순서
1. release/template 테스트에 `skills-manager` package와 wrapper ownership 변경을 red로 추가한다.
2. `packages/skills-manager` 패키지를 만들고 현재 `skills-command.ts` 중심 lifecycle 로직을 이동한다.
3. `create-rn-miniapp`는 scaffold 시 최초 install 호출만 남기고 `skills` subcommand와 관련 import를 제거한다.
4. generated root wrapper script와 manifest field를 `managerPackage`/`managerVersion` 기준으로 전환한다.
5. `docs/skills.md` 렌더와 skill manifest reconcile ownership을 `skills-manager`로 넘긴다.
6. `pnpm verify`를 통과시키고, 컷오버 완료 후 현재 브랜치에서 한 번 더 커밋한다.

### 테스트 범위
- release/dev-publish 테스트가 `@create-rn-miniapp/skills-manager`를 포함한다.
- generated wrapper script가 `skills-manager`를 호출하고 `create-miniapp skills ...`를 더 이상 호출하지 않는다.
- `create-rn-miniapp` CLI는 `skills` 서브커맨드를 더 이상 노출하지 않는다.
- `skills-manager` CLI가 `sync|diff|upgrade`를 처리하고 기존 manifest/snapshot 테스트를 유지한다.
- `pnpm verify`를 통과한다.

## 현재 skills-manager split 릴리스 및 SSoT 감사

### 목표
- 방금 완료한 `skills-manager` 분리를 changeset과 PR까지 한국어로 정리해 배포 준비 상태로 만든다.
- 공개 패키지 전체를 patch 대상으로 올리고, PR 제목/본문도 현재 브랜치 diff에 맞는 한국어 설명으로 정리한다.
- 이어서 dead code, 과한 테스트, SSoT 중복 구현을 전수 확인하고 다음 정리 작업 계획까지 남긴다.

### 작업 순서
1. 현재 브랜치와 PR 상태를 확인하고 changeset 대상 패키지를 확정한다.
2. `.changeset/*.md`에 한국어 patch changeset을 추가하고 필요하면 커밋한다.
3. 브랜치를 원격에 push하고, 기존 PR이 있으면 제목/본문을 한국어로 갱신하고 없으면 새 PR을 만든다.
4. repo 전체에서 dead code, 더 이상 의미 없는 회귀 테스트, duplicated catalog/manifest/rendering ownership을 grep과 파일 읽기로 감사한다.
5. 감사 결과를 severity 순으로 정리하고, SSoT 복구 관점의 후속 작업 계획을 `docs/ai/Plan.md` 또는 최종 보고에 남긴다.

### 완료 기준
- 공개 패키지 전체 patch changeset이 존재한다.
- 현재 브랜치용 PR 제목/본문이 한국어로 정리돼 있다.
- dead code / redundant test / SSoT duplication 감사 결과와 후속 정리 계획이 남아 있다.
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
- templates first: 생성물 규칙은 `packages/scaffold-templates`와 `packages/agent-skills`를 정본으로 두고, generator는 그 소스를 렌더링만 한다.
- old alias는 두지 않는다. rename 이후 생성물과 entrypoint 문서에는 old name이 남지 않아야 한다.

### 확인된 현재 상태
- canonical skill source는 `packages/agent-skills/*`이다.
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
   - 대상: `packages/agent-skills/package.json`, `packages/agent-skills/*`, `packages/create-rn-miniapp/src/templates/{skills,feature-catalog,docs,frontend-policy}.ts`, 관련 테스트
   - 작업:
     - 디렉터리 이름과 `SKILL.md` frontmatter `name`을 함께 rename한다.
     - core skill id와 optional skill metadata를 새 이름으로 교체한다.
     - `.agents/skills`와 `.claude/skills` mirror 생성 경로를 새 taxonomy로 맞춘다.
     - old alias 없이 generated repo grep이 0건이 되도록 만든다.
   - TDD:
     - rename snapshot/assertion, mirror equality assertion, old name absence assertion을 먼저 추가한다.

3. provider state 분리와 server README 재구성
   - 대상: `packages/agent-skills/{cloudflare-worker,supabase-project,firebase-functions}/**`, `packages/create-rn-miniapp/src/patching/server.ts`, 필요 시 provider finalize tests
   - 작업:
     - provider skill에서 existing/create 분기, remoteInitialization 상태, 실제 resource identifier 예시, deploy/init/apply/seed 절차를 제거한다.
     - generated repo에 `server/.create-rn-miniapp/state.json`을 추가하고 최소 필드(`serverProvider`, `serverProjectMode`, `remoteInitialization`, `trpc`, `backoffice`)를 고정한다.
     - `server/README.md`에 `Scaffold State`와 `Remote Ops` 섹션을 추가하고, provider skill은 state 확인만 안내하게 만든다.
     - provider 작업 전 확인용 read-only 스크립트(`check-env.mjs`, `check-client-links.mjs`, `print-next-commands.mjs`)를 생성한다.
   - TDD:
     - `packages/create-rn-miniapp/src/patching/index.test.ts`
     - provider별 README/state/script 생성 및 내용 assertion을 먼저 추가한다.

4. provider reference 분해와 overlap 제거
   - 대상: `packages/agent-skills/{cloudflare-worker,supabase-project,firebase-functions,miniapp-capabilities,granite-routing,tds-ui,trpc-boundary}/references/*`
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
   - Supabase 선택 생성물은 scaffold 과정에서 최신 Deno 설치/업그레이드 step을 가진다.
   - generated Supabase typecheck script는 PATH 미반영 상태에서도 기본 설치 경로를 fallback으로 사용할 수 있다.
   - `pnpm verify`를 통과한다.

## 다음 작업: generated route checker가 biome unsafe fix 뒤에도 깨지지 않게 만들기
1. 문제
   - `scripts/verify-frontend-routes.mjs`는 생성 직후에는 유효하지만, generated repo에서 `biome check . --write --unsafe`를 돌리면 `new RegExp("...")`가 잘못된 regex literal로 바뀌어 parse error가 난다.
   - 현재 테스트는 generated script의 동작만 확인하고, scaffold 직후 루트 biome 정리 단계를 거친 뒤에도 script가 살아있는지는 고정하지 않는다.
2. 방향
   - generated root에 실제 `biome check . --write --unsafe`를 적용하는 실패 테스트를 먼저 추가한다.
   - route checker는 Biome의 unsafe regex-literal 변환 대상이 되지 않도록 regex source 상수와 `new RegExp(variable, flags)` 조합으로 렌더한다.
3. 완료 기준
   - generated root에서 `biome check . --write --unsafe`가 parse error 없이 끝난다.
   - unsafe fix 이후에도 `scripts/verify-frontend-routes.mjs`가 실행 가능하다.
   - `pnpm verify`를 통과한다.

## 다음 작업: 남은 doc/script/onboarding/trpc metadata 중복 정리
1. 문제
   - code-owned doc manifest가 생겼지만 `AGENTS.md`와 `docs/index.md`의 Start Here / engineering 문서 목록은 아직 함수 안에 따로 박혀 있다.
   - tRPC workspace path와 root helper script 이름이 `templates/*`, `patching/*`, CLI 요약, template 문서에 흩어져 있다.
   - secondary agent docs와 starter page가 `AGENTS.md` 밖에서 onboarding 순서를 다시 적고 있고, frontend policy도 restriction surface를 여러 mini-manifest로 쪼개 들고 있다.
2. 방향
   - 문서 manifest를 code-owned/copy-owned 전체 관점으로 넓혀서 Start Here, engineering doc list, copy skip set을 같은 정의에서 파생시킨다.
   - tRPC workspace metadata와 root helper script catalog를 shared 모듈로 올리고, CLI 요약 / patching / template 문서 / generated messages가 그 정의만 사용하게 만든다.
   - `CLAUDE.md`, Copilot instructions, starter copy는 generated `AGENTS.md`와 `repo-contract.md`를 참조만 하게 줄인다.
   - frontend policy는 restriction manifest 하나에서 prose, Biome message, direct native import pattern message를 같이 만든다.
3. 테스트
   - `src/templates/index.test.ts`에 문서 manifest 파생, tRPC path reuse, helper script catalog tokenization, agent doc deferral, starter onboarding deferral, frontend restriction manifest red 테스트를 먼저 추가한다.
   - red를 확인한 뒤 구현하고 `pnpm verify`까지 통과한다.
4. 완료 기준
   - code-owned doc inventory와 rendered doc list가 같은 manifest를 source of truth로 쓴다.
   - tRPC workspace path와 root helper script 이름을 바꿀 때 production file 여러 곳을 수동으로 같이 고치지 않아도 된다.
   - secondary agent docs / starter copy가 onboarding 순서를 다시 적지 않는다.
   - frontend policy restriction surface가 단일 manifest에서 파생된다.
   - `pnpm verify`를 통과한다.

## 다음 작업: 남은 repo contract / frontend policy / tRPC metadata 중복 정리
1. 문제
   - frontend policy는 문서 renderer와 route verify script가 같은 규칙을 따로 들고 있고, core skill entrypoint도 policy module에 다시 하드코딩돼 있다.
   - code-owned `AGENTS.md`가 `repo-contract.md`와 같은 hard rule / done 기준을 다시 적고 있어 generated contract가 둘로 나뉜다.
   - tRPC workspace identity가 `feature-catalog.ts`, `templates/trpc.ts`, `patching/server.ts`에 흩어져 있고, `docs.ts` 안에서도 code-owned doc inventory를 skip set과 write 호출로 두 번 관리한다.
2. 방향
   - core skill reference path와 frontend route verifier source를 shared metadata에서 파생시키고, `verify-frontend-routes.mjs`는 template 복사가 아니라 code-owned renderer로 생성한다.
   - `AGENTS.md`는 repo-contract를 요약/참조만 하게 줄여서 detailed contract는 `docs/engineering/repo-contract.md` 한 곳이 소유하게 만든다.
   - tRPC workspace 문구와 source-of-truth 설명은 `templates/trpc.ts`의 shared descriptor에서 feature catalog와 server README가 같이 가져오게 바꾼다.
   - code-owned docs는 단일 definition manifest에서 skip 대상과 write 대상을 함께 계산한다.
3. 테스트
   - `src/templates/index.test.ts`에 core skill path, route verifier ownership, AGENTS contract delegation, tRPC descriptor import, code-owned docs manifest 회귀 테스트를 먼저 추가한다.
   - red를 확인한 뒤 구현하고 `pnpm verify`까지 통과한다.
4. 완료 기준
   - frontend policy / verifier / core skill reference path가 단일 source를 가진다.
   - repo contract detailed rules는 `repo-contract.md` 한 곳이 소유한다.
   - tRPC workspace identity를 바꿀 때 docs/README/server patch를 여러 파일에서 따로 수정하지 않아도 된다.
   - `pnpm verify`를 통과한다.

## 다음 작업: code-owned docs와 feature catalog를 단일 source로 정리
1. 문제
   - `AGENTS.md`, `docs/index.md`, `workspace-topology.md`, `frontend-policy.md`가 template markdown와 renderer code 사이에 반쯤 걸쳐 있어 section identity와 정책 wording이 둘 이상에서 관리된다.
   - optional workspace/skill catalog가 `docs.ts`와 `skills.ts`에 따로 있어 feature 추가나 rename 시 함께 바꿔야 한다.
   - 루트 `README.md`가 generated tree, helper scripts, provider별 파일/env 세부사항을 다시 적고 있어 생성 결과물과 drift할 수 있다.
2. 방향
   - dynamic docs와 frontend policy를 code-owned renderer로 올리고, scaffold template package에서는 해당 markdown source를 제거한다.
   - optional feature metadata를 shared catalog 모듈로 옮겨 docs/skills가 같은 정의를 사용하게 만든다.
   - root README는 exact generated output 설명을 줄이고, 생성된 repo 문서를 source of truth로만 가리키게 정리한다.
3. 테스트
   - `src/templates/index.test.ts`의 새 red 테스트를 먼저 통과시킨다.
   - scaffold template tarball/release 테스트를 현재 source ownership에 맞게 갱신한다.
   - 최종적으로 `pnpm verify`를 통과한다.
4. 완료 기준
   - code-owned docs가 template markdown 없이 생성된다.
   - optional feature catalog가 한 곳에서만 관리된다.
   - README가 generated file/env/script catalog를 별도로 들고 있지 않다.
   - `pnpm verify`를 통과한다.

## 다음 작업: main 대비 diff 기준 minor changeset과 한국어 PR 초안 정리
1. 문제
   - 현재 브랜치는 skill 기반 scaffold 구조, dynamic docs, runtime 실분리까지 포함해 publish 대상 패키지 변경 폭이 크다.
   - 릴리스 전에는 diff 기준으로 실제 영향 패키지를 묶어 한국어 changeset과 PR 설명을 맞춰야 한다.
2. 방향
   - `origin/main...HEAD` diff와 publish 대상 package manifest를 기준으로 변경 범위를 요약한다.
   - `create-rn-miniapp`, `@create-rn-miniapp/scaffold-templates`, `@create-rn-miniapp/agent-skills`에 minor changeset을 한국어로 추가한다.
   - `pnpm verify`를 다시 실행한 뒤, 같은 diff 기준으로 한국어 PR 초안을 작성한다.
3. 완료 기준
   - minor changeset이 한국어로 추가된다.
   - `pnpm verify`를 통과한다.
   - PR 초안이 main 대비 변경을 정확히 반영한다.

## 다음 작업: runtime 실분리 후 남은 barrel 우회와 duplicated resolver 정리
1. 문제
   - `runtime.ts`는 없어졌지만 leaf 구현 파일 일부가 아직 `templates/index.ts` 같은 public barrel을 내부에서 다시 타고 있다.
   - `module-surface.test.ts`도 direct-import contract를 검증하지 않아 이런 우회가 테스트를 통과한다.
   - `resolveTemplatesPackageRoot()`가 `templates/filesystem.ts`에 올라갔는데 `patching/frontend.ts`, `patching/server.ts`에 중복으로 남아 있다.
2. 방향
   - non-test source가 `templates/index.js`, `patching/index.js`를 내부 import하지 못하게 실패 테스트부터 추가한다.
   - `patching/*`, `providers/*/provision.ts`, `patching/ast/granite.ts`, `templates/trpc.ts`를 concrete module import로 바꾼다.
   - duplicated template root resolver는 `templates/filesystem.ts` export를 직접 쓰도록 정리한다.
3. 완료 기준
   - internal barrel import가 사라지고 regression test가 이를 고정한다.
   - duplicated resolver helper가 제거된다.
   - `pnpm verify`를 통과한다.

## 다음 작업: index.ts 외 re-export 금지 규칙으로 area facade를 직접 export 모듈로 바꾸기
1. 문제
   - 방금 쪼갠 `templates/docs.ts`, `templates/root.ts`, `patching/frontend.ts` 같은 area 모듈이 여전히 `export ... from './runtime.js'` 형태의 re-export 파일이다.
   - 사용자는 `index.ts`를 제외한 모든 파일에서 re-export가 없어야 한다고 명시했고, 지금 상태는 그 규칙을 어긴다.
2. 방향
   - non-`index.ts` 파일의 `export ... from` / `export type ... from`를 전수조사한다.
   - 이 파일들은 runtime import 후 직접 function/type/const를 export 하도록 바꾼다.
   - `index.ts`만 public barrel re-export로 남기고, 나머지는 직접 선언 또는 wrapper export만 사용한다.
3. 테스트
   - `src` 전체를 스캔해서 non-`index.ts` 파일에 re-export 구문이 없다는 실패 테스트를 먼저 추가한다.
   - 수정 후 targeted test와 `pnpm verify`를 통과한다.
4. 완료 기준
   - `index.ts`를 제외한 `src` 모든 파일에서 re-export 구문이 사라진다.
   - `pnpm verify`를 통과한다.

## 다음 작업: templates/patching 진입점을 area facade로 쪼개서 실행 흐름을 읽히게 만들기
1. 문제
   - `templates/index.ts`, `patching/index.ts`가 각각 2천 줄이 넘어, 실제 orchestration entrypoint는 `scaffold/index.ts`, `providers/index.ts`인데도 호출 경로가 한눈에 보이지 않는다.
   - 지금 구조에서는 root/docs/skills/server/frontend/backoffice/provider patch 책임이 한 파일 안에 섞여 있어, "어디가 실행부인지"를 찾으려면 거대한 파일 전체를 읽어야 한다.
2. 방향
   - 실제 동작은 바꾸지 않고 기존 로직 파일을 `runtime.ts`로 격리한다.
   - `templates/root.ts`, `templates/docs.ts`, `templates/skills.ts`, `templates/server.ts`, `templates/filesystem.ts` 같은 area facade를 추가하고, `templates/index.ts`는 re-export 전용 얇은 facade로 줄인다.
   - `patching/frontend.ts`, `patching/backoffice.ts`, `patching/server.ts`를 추가하고, `patching/index.ts`도 re-export 전용 얇은 facade로 줄인다.
   - `scaffold/index.ts`, `providers/index.ts`, 관련 helper는 가능하면 `index.ts`가 아니라 area facade를 직접 import해서 실행 흐름이 import graph만 봐도 드러나게 만든다.
3. 테스트
   - 기존 template/patching/scaffold/provider 테스트가 그대로 통과해야 한다.
   - skill sync 테스트는 docs setup이 없는 현재 형태를 유지한다.
   - 최종적으로 `pnpm verify`를 통과한다.
4. 완료 기준
   - `templates/index.ts`, `patching/index.ts`가 얇은 facade가 된다.
   - 실행 entrypoint 파일에서 area별 import가 직접 드러난다.
   - 동작 변경 없이 `pnpm verify`를 통과한다.

## 다음 작업: dynamic doc anchor와 provider script catalog를 다시 단일화하기
1. 문제
   - `AGENTS.md`, `docs/index.md`, `workspace-topology.md`의 dynamic section은 heading wording은 줄었지만 template token과 renderer definition이 여전히 같은 section identity를 양쪽에서 들고 있다.
   - Supabase/Cloudflare/Firebase server README는 `server/package.json` scripts와 같은 catalog를 prose로 다시 적고 있어 script rename/change 시 문서와 생성물이 같이 drift할 수 있다.
   - `package-manager.ts`의 `rootVerifyScript()`는 더 이상 실제 verify source가 아닌데 adapter interface와 구현에 남아 있어 dead second source가 됐다.
   - root README도 generated repo onboarding 순서를 `AGENTS.md`와 별도로 다시 설명해 이미 순서가 어긋나 있다.
2. 방향
   - dynamic docs는 template literal token에 section anchor를 맡기지 않고, empty section slot를 순서 기반으로 채우거나 code-owned renderer로 올려 section identity를 한 군데로 줄인다.
   - provider별 server script catalog를 shared metadata/helper로 올리고, `server/package.json` scripts와 README의 `주요 스크립트`가 같은 metadata에서 렌더되게 만든다.
   - `package-manager.ts`에서 더 이상 쓰이지 않는 `rootVerifyScript()` interface/implementation을 제거한다.
   - README onboarding 문구는 generated `AGENTS.md`의 `Start Here`를 source of truth로만 가리키게 줄인다.
3. 테스트
   - dynamic doc template source에 section anchor token이 남아 있지 않고 empty section 기반으로 렌더된다는 실패 테스트를 먼저 추가한다.
   - provider README의 script bullets가 shared script catalog helper와 일치한다는 실패 테스트를 추가한다.
   - adapter가 legacy `rootVerifyScript`를 더 이상 노출하지 않는지와 README가 `AGENTS.md` `Start Here`를 참조하는지 고정한다.
   - 수정 후 `pnpm verify`를 통과한다.
4. 완료 기준
   - dynamic doc section identity가 template token과 renderer 양쪽에서 따로 관리되지 않는다.
   - provider server README와 generated scripts가 같은 metadata를 공유한다.
   - `rootVerifyScript()` dead source가 제거된다.
   - README onboarding 순서가 `AGENTS.md`와 다시 단일화된다.
   - `pnpm verify`를 통과한다.

## 다음 작업: verify/doc anchor/package manager source를 다시 단일화하기
1. 문제
   - root verify 파이프라인은 generator code가 소유하지만, `docs/index.md`와 `docs/engineering/repo-contract.md`가 같은 단계 목록을 별도로 열거해 관리 포인트가 둘 이상이다.
   - dynamic markdown 문서는 visible heading 문자열을 code와 template 양쪽에서 같이 들고 있어, 섹션 이름이나 depth를 바꾸면 둘을 동시에 수정해야 한다.
   - root template `package.json`은 실제 source of truth가 아닌 pnpm version literal을 들고 있고, package manager/version/verify 기대값도 여러 테스트 파일에 하드코딩되어 있다.
2. 방향
   - verify 단계 목록을 공통 metadata로 올리고, root `package.json` scripts와 verify 관련 문서가 같은 metadata에서 렌더되게 만든다.
   - dynamic doc section heading은 template literal이 아니라 공통 anchor metadata에서 token으로 주입해, visible heading wording을 한 군데서만 관리한다.
   - root template `package.json`은 package manager version literal을 제거하고 generator patch 단계 또는 token으로만 채운다.
   - 테스트는 package manager adapter와 shared helper를 써서 version/verify/user-agent 기대값을 조합하고, raw literal 반복을 줄인다.
3. 테스트
   - verify 문서 섹션과 generated root verify script가 같은 source를 공유하는 실패 테스트를 먼저 추가한다.
   - dynamic doc template heading이 hardcoded literal이 아니라 shared anchor token으로 유지되는지 실패 테스트를 추가한다.
   - root package template에 concrete package manager version이 남아 있지 않은지, package-manager 관련 테스트가 shared helper를 통해 기대값을 계산하는지 확인한다.
   - 수정 후 `pnpm verify`를 통과한다.
4. 완료 기준
   - verify 단계 정의가 code와 generated docs 사이에서 한 군데만 관리된다.
   - dynamic doc heading wording을 바꿀 때 template와 renderer를 각각 손보지 않아도 된다.
   - root template와 테스트에서 package manager version/verify literal 중복이 줄어든다.
   - `pnpm verify`를 통과한다.

## 다음 작업: scaffold metadata를 단일 source로 더 끌어올리기
1. 문제
   - dynamic doc section body가 renderer 코드와 markdown template 양쪽에 남아 있어 wording drift가 생길 수 있다.
   - workspace 설명은 root/topology/roles/ownership에 나뉘어 있고, root biome 정책도 package manager별 template에 복제되어 이미 npm variant가 drift했다.
   - root `package.json` scripts는 template과 generator code 양쪽에 있고, starter onboarding copy와 README도 generated contract/skill entrypoint를 따로 열거한다.
2. 방향
   - `AGENTS.md`, `docs/index.md`, `workspace-topology.md`의 동적 section은 heading만 남기고 body는 renderer code만 소유하게 바꾼다.
   - workspace/skill/start-here/root-scripts/biome policy를 공통 metadata와 renderer 함수로 모으고, package manager별 차이는 include/exclude 같은 adapter 값만 남긴다.
   - README는 exact generated catalog를 직접 열거하지 않고, generated repo의 `AGENTS.md`/`docs/index.md`를 SSOT로 안내한다.
   - starter page 안내 문구는 `AGENTS.md`의 Start Here와 같은 metadata를 공유하게 만든다.
3. 테스트
   - dynamic doc template section body empty, root package template script 부재, package-manager별 shared biome guidance 일치 테스트를 먼저 실패시키고 통과시킨다.
   - 기존 docs/skills/root template 테스트와 함께 `pnpm verify`를 통과한다.
4. 완료 기준
   - 동적 section 본문, root scripts, biome policy, onboarding entrypoint가 각각 단일 source를 가진다.
   - README가 generated skill/script catalog를 별도 열거하지 않는다.
   - `pnpm verify`를 통과한다.

## 다음 작업: dynamic docs/skills 메타데이터를 한 군데로 모으고 렌더 경로를 단일화하기
1. 문제
   - `renderDynamicMarkdownSource()`가 optional 문구를 최종 prose 문자열로 판별해 wording이 조금만 바뀌어도 필터가 깨질 수 있다.
   - optional skill 목록이 실제 skill sync, `AGENTS.md`, `docs/index.md`, `workspace-topology.md`에 각각 흩어져 있어 rename/add/remove 시 문서와 생성물이 쉽게 어긋난다.
   - `applyDocsTemplates()`도 `docs/` 통복사 후 일부 문서를 다시 렌더링하는 이중 경로라 동적 문서가 늘어날수록 관리 포인트가 늘어난다.
   - skill sync 테스트는 docs 렌더를 선행 호출해, 테스트 책임보다 넓은 setup 때문에 실패 원인을 흐린다.
2. 방향
   - core/optional skill catalog와 workspace/doc section metadata를 한 manifest 계층으로 올린다.
   - dynamic markdown은 prose 비교로 node를 지우지 않고, 섹션 단위 body를 AST로 교체하는 방식으로 렌더링한다.
   - `applyDocsTemplates()`는 dynamic docs를 bulk copy 대상에서 제외하고, 명시된 dynamic doc 목록만 별도 렌더링한다.
   - `syncGeneratedSkills()` 테스트는 docs setup 없이 skill sync 책임만 검증하게 줄인다.
3. 테스트
   - 기존 base-only / selected optional / backoffice-only / rerender-after-add 문서 테스트가 그대로 통과해야 한다.
   - 기존 skill sync 테스트는 docs setup 없이도 `.agents/.claude` mirror와 optional skill selection을 검증해야 한다.
   - 최종적으로 `pnpm verify`를 통과한다.
4. 완료 기준
   - optional docs filtering이 template prose 변경에 직접 결합되지 않는다.
   - skill catalog의 source of truth가 문서와 skill sync 사이에서 한 군데로 모인다.
   - dynamic docs가 통복사 경로와 별도 덮어쓰기 경로로 이중 관리되지 않는다.
   - `pnpm verify`를 통과한다.

## 다음 작업: markdown AST 문서 렌더 후속 리뷰 지적 2건 수정하기
1. 문제
   - base-only scaffold에서 `docs/engineering/workspace-topology.md`에 빈 `- import boundary:` bullet이 남는다.
   - backoffice-only scaffold에서 실제 `server/` workspace가 없는데도 `backoffice ↔ server 직접 import 금지`가 남아 no-server 출력 요구를 깨뜨린다.
2. 방향
   - 두 현상을 실제 generated markdown 기준으로 재현하는 테스트를 먼저 추가한다.
   - `workspace-topology` AST 필터에서 parent list item의 자식 제거 여부를 문자열 비교가 아니라 child structure 기준으로 판단한다.
   - backoffice 관련 bullet 중 server workspace를 전제로 하는 문구는 `hasBackoffice`만이 아니라 실제 server 존재 조건도 함께 보게 수정한다.
3. 테스트
   - base-only docs 렌더 테스트에 `import boundary:` 잔재 부재를 실패 테스트로 추가한다.
   - backoffice-only docs 렌더 테스트를 추가해 `server` 관련 문구와 `backoffice ↔ server` 경계 문장이 없는지 확인한다.
   - 수정 후 `pnpm verify`를 통과한다.
4. 완료 기준
   - base-only 출력에 빈 `import boundary:` bullet이 남지 않는다.
   - backoffice-only 출력에 존재하지 않는 `server` workspace를 전제한 문구가 남지 않는다.
   - `pnpm verify`를 통과한다.

## 다음 작업: optional workspace에 맞춰 계약 문서와 skill 라우팅도 markdown AST 기준으로 동적 생성하기
1. 문제
   - 지금 워킹트리의 동적 문서 렌더링은 marker comment를 템플릿 본문에 심고 string replace로 잘라내는 방식이라 템플릿 가독성이 떨어지고 유지보수성이 약하다.
   - 그래서 `server`를 만들지 않은 생성물에도 `server` workspace, provider skill, tRPC boundary 같은 optional 내용을 동적으로 관리해야 한다는 요구는 맞지만, 구현 방식은 markdown source를 오염시키지 않는 쪽으로 바꿔야 한다.
   - `--add` 이후에도 문서가 현재 구조를 정확히 설명해야 하므로, 생성 옵션이 아니라 rerender 시점의 실제 workspace 상태를 기준으로 문서를 다시 계산해야 한다.
2. 방향
   - 템플릿 markdown은 marker 없이 사람이 읽기 좋은 정적 문서로 유지한다.
   - 생성 시점에는 markdown AST를 파싱해 heading, list item, paragraph 단위로 optional node를 걸러낸다.
   - `server`, `backoffice`, `trpc` 유무와 provider 종류는 target root의 실제 workspace 존재 여부와 현재 provider/trpc 설정을 합쳐 계산한다.
   - `scaffoldWorkspace`와 `addWorkspaces` 모두 같은 context resolver + AST renderer를 호출해, 최초 생성과 `--add`가 동일한 결과를 내게 한다.
3. 테스트
   - template 테스트에서 template source에 optional marker comment가 남아 있지 않다는 실패 테스트를 먼저 추가한다.
   - `server` 미생성 시 `AGENTS.md`와 문서에 server/provider/trpc 언급이 없는지, 그리고 실제 workspace 디렉터리 상태에서 context가 계산되는지 실패 테스트로 고정한다.
   - `--add` 성격의 재렌더 테스트를 추가해, server/backoffice/trpc가 생긴 뒤 문서와 skill 라우팅이 다시 확장되는지 확인한다.
   - 최종적으로 `pnpm verify`를 통과한다.
4. 완료 기준
   - optional workspace를 만들지 않은 생성물에 해당 workspace 설명과 skill 라우팅이 남지 않는다.
   - `--add` 후에는 문서와 skill 라우팅이 현재 workspace 구조에 맞춰 다시 생성된다.
   - 템플릿 markdown source에는 optional marker comment가 남아 있지 않다.
   - `pnpm verify`를 통과한다.

## 다음 작업: Skills 마이그레이션 리뷰 후속 정리와 체크리스트 라인 감사
1. 문제
   - 리뷰에서 남은 쟁점은 `.claude/skills` mirror 자동 생성 사실이 README와 조합 테스트에 충분히 고정되지 않았다는 점, stale `syncOptionalDocsTemplates` 래퍼가 남아 있다는 점, 체크리스트를 글자 그대로 보면 아직 미검증 항목이 있다는 점이다.
   - 특히 Phase 9는 helper 단위 테스트만으로는 부족하고, base/backoffice/provider/trpc 조합별 generated docs/skills tree와 old engineering docs 부재를 실제 트리 기준으로 다시 고정할 필요가 있다.
2. 방향
   - `.claude/skills`는 사용자 수동 동기화 전제가 아니라 scaffold 시점에 같이 생성된다는 점을 코드/테스트/README에서 명확히 한다.
   - `templates/index.ts`의 구 optional docs 용어를 정리하고, 조합별 generated tree 테스트를 추가해 docs tree / skills tree / mirror equality / optional skill presence를 한 번에 확인한다.
   - 루트 체크리스트 문서는 라인 단위로 다시 대조해, 실제 완료된 항목은 체크하고 남은 항목은 그대로 드러내도록 갱신한다.
3. 테스트
   - `packages/create-rn-miniapp/src/scaffold/index.test.ts`에 6개 scaffold 조합 generated tree 검증을 추가한다.
   - 기존 template/release 테스트와 함께 `pnpm verify`를 다시 실행한다.
4. 완료 기준
   - `.claude/skills` mirror 자동 생성이 테스트와 README로 고정된다.
   - stale optional docs 래퍼/용어가 제거된다.
   - 체크리스트가 현재 상태를 line-by-line으로 반영한다.
   - `pnpm verify`를 통과한다.

## 다음 작업: 0.1.0-rc.0 준비용 Skills 중심 스캐폴드 마이그레이션
1. 문제
   - 현재 생성물은 `AGENTS.md + docs/engineering + optional engineering docs` 중심 구조라, 반복 플레이북/외부 플랫폼 카탈로그와 강제 규칙이 한곳에 섞여 있다.
   - 실제 생성 구조에는 `CLAUDE.md`, `.github/copilot-instructions.md`, `.agents/skills`, `.claude/skills`가 없어서 agent adapter와 canonical skill corpus를 릴리스 기준으로 설명하기 어렵다.
   - 생성기 코드도 optional doc marker 삽입에 기대고 있어, skill source/mirror를 기준으로 구조를 확장하기 어렵다.
2. 방향
   - 계약 문서와 skill corpus의 책임을 분리하고, 생성 결과를 기준으로 문서/테스트를 함께 갱신한다.
   - `packages/scaffold-templates`는 계약 문서와 실제 workspace asset만 남기고, `packages/agent-skills`를 새 canonical source로 추가한다.
   - 생성기는 contract/docs/skills/workspace asset 렌더링 책임으로 쪼개고, `.agents/skills` 정본과 `.claude/skills` mirror를 함께 생성한다.
   - `verify`에는 skills mirror drift 검사를 추가하고, README/테스트/스냅샷을 새 출력 구조 기준으로 갱신한다.
3. 테스트
   - 템플릿 테스트에서 base scaffold가 `AGENTS.md`, `CLAUDE.md`, `.github/copilot-instructions.md`, `docs/engineering/{repo-contract,frontend-policy,workspace-topology}.md`, `.agents/skills/{miniapp,granite,tds}`, `.claude/skills/*`를 생성하는지 먼저 실패 테스트로 고정한다.
   - optional 조합 테스트에서 선택한 feature에 맞는 optional skill만 생기고, 기존 engineering 카탈로그 문서는 생성되지 않는지 고정한다.
   - `scripts/check-skills.mjs` 테스트와 `release` 테스트에서 새 package/file publish 구성이 유지되는지 검증한다.
   - 최종적으로 `pnpm verify`를 통과한다.
4. 제외 범위
   - 이번 작업에서는 publish version bump, changeset 작성, 실제 `0.1.0-rc.0` 배포 실행은 하지 않는다.
   - 이미 존재하는 unrelated untracked 파일(`docs/superpowers/`)은 건드리지 않는다.
5. 완료 기준
   - 생성물 루트에 계약/adapter/docs/skills 구조가 체크리스트와 일치하게 생성된다.
   - old engineering 문서 체계와 marker 기반 optional doc 삽입 로직이 제거된다.
   - `.claude/skills` mirror drift가 `pnpm verify`에서 검출된다.
   - README와 테스트가 새 구조를 기준으로 설명/검증한다.

## 다음 작업: Supabase 기존 프로젝트 skip 경로에서 generated Biome/schema와 `.mjs` 스크립트 문법을 정상화하기
1. 문제
   - 기존 Supabase 프로젝트에서 원격 초기화를 건너뛴 뒤 generated root `biome.json`이 CLI `2.4.8`과 다른 `2.4.7` schema를 가리켜 root `biome check`가 깨진다.
   - generated `server/scripts/supabase-db-apply.mjs`, `server/scripts/supabase-functions-deploy.mjs`에 TypeScript 타입 문법이 들어가 있어 Biome parse가 실패한다.
2. 방향
   - repo root와 generated root template의 Biome schema/version을 `2.4.8` 기준으로 맞춘다.
   - Supabase generated `.mjs` 스크립트 문자열에서 TypeScript 타입 표기를 제거해 plain ESM으로 유지한다.
   - 관련 README나 test fixture의 기대값도 새 기준으로 같이 갱신한다.
3. 테스트
   - template test에서 generated Biome 버전과 schema가 `2.4.8`인지 고정한다.
   - generated Supabase `.mjs` 스크립트에 `: string` 같은 TS 문법이 없는지 테스트로 고정한다.
   - `pnpm verify`를 통과한다.
4. 완료 기준
   - Supabase 기존 프로젝트 skip 경로로 생성한 repo가 root `biome check` 단계에서 더 이상 깨지지 않는다.
   - generated Supabase `.mjs` 스크립트가 Biome parse를 통과한다.
   - `pnpm verify` 통과

## 다음 작업: 기존 원격 초기화 후속 보정을 별도 릴리스 PR로 분리하기
1. 문제
   - `#67` 본체는 이미 main에 머지됐고, 이후 follow-up 수정인 Firebase 기존 프로젝트 권한 유지와 Supabase generated Biome/스크립트 보정만 따로 릴리스해야 한다.
   - 이 범위를 분리하지 않으면 이미 머지된 변경과 후속 수정의 릴리스 이력이 섞인다.
2. 방향
   - 최신 main에서 후속 커밋만 새 브랜치로 분리한다.
   - 두 publish 패키지를 모두 patch로 올리는 한글 changeset을 추가한다.
   - 별도 PR로 올리고 `pnpm verify`를 다시 통과시킨다.
3. 테스트
   - 새 브랜치 diff가 후속 수정만 담는지 확인한다.
   - changeset frontmatter가 두 패키지를 모두 patch로 올리는지 확인한다.
   - `pnpm verify`를 통과한다.
4. 완료 기준
   - Firebase/Supabase 후속 보정만 담은 새 PR이 생성된다.
   - 두 publish 패키지 patch changeset이 포함된다.
   - `pnpm verify` 통과

## 다음 작업: 기존 provider 프로젝트 연결 시 원격 초기화 여부를 먼저 묻게 바꾸기
1. 문제
   - 지금은 기존 provider 프로젝트를 고른 뒤에도 원격 반영 동작이 provider마다 제각각이고, 일부는 바로 deploy나 원격 상태 변경으로 이어진다.
   - 사용자 입장에서는 "기존 프로젝트"에 붙는 것과 "원격 내용을 스캐폴드 기본값으로 초기화하는 것"이 다른데, 이 선택이 provisioning UI에 드러나지 않는다.
2. 방향
   - 기존 `supabase`, `firebase`, `cloudflare` 프로젝트/Worker를 고른 경우에는 공통으로 `원격에 있는 내용을 초기화할까요?`를 먼저 묻는다.
   - `건너뛸게요`를 고르면 provider별 deploy/init 단계는 수행하지 않고, local env와 문서만 준비한다.
   - Firebase는 기존 프로젝트에서 원격 초기화를 건너뛰어도 Blaze와 build IAM 확인은 계속 하고, Firestore 준비와 deploy만 건너뛴다.
   - `초기화할게요`를 고르면 지금처럼 공식 CLI 경로를 통해 원격 반영을 진행한다.
   - 마지막 note와 README/provider guide/generated server README에도 이번 실행에서 원격 초기화를 건너뛰었는지 남긴다.
3. 테스트
   - 공통 prompt helper를 테스트로 고정한다.
   - provider별 finalize note가 skip/apply 결과를 반영하는지 테스트한다.
   - `pnpm verify`를 통과한다.
4. 완료 기준
   - 기존 provider 프로젝트를 고르면 원격 초기화 여부를 먼저 선택할 수 있다.
   - `건너뛸게요`를 고르면 불필요한 원격 deploy/init가 발생하지 않는다.
   - `pnpm verify` 통과

## 다음 작업: 기존 Supabase 프로젝트 연결 시 원격 DB/Edge Function 자동 반영을 건너뛰고 안내 노트를 남기기
1. 문제
   - 현재 Supabase provisioning은 새 프로젝트와 기존 프로젝트를 같은 흐름으로 처리해서, 기존 프로젝트를 고르면 `supabase db push --include-all`과 기본 Edge Function deploy까지 바로 실행한다.
   - 기존 프로젝트는 이미 원격 migration history가 있을 수 있어서 `db push`가 실패하기 쉽고, `api` 함수가 이미 있으면 기본 Edge Function deploy도 덮어쓰기 위험이 있다.
2. 방향
   - 새 Supabase 프로젝트를 만든 경우에만 원격 `db push`와 기본 Edge Function deploy를 자동으로 적용한다.
   - 기존 프로젝트를 고른 경우에는 `link`만 진행하고, 원격 DB/Edge Function 반영은 자동으로 건너뛴다.
   - 마지막 note와 README에 기존 프로젝트 경로에서는 `db:apply`, `functions:deploy`를 직접 하도록 짧게 안내한다.
3. 테스트
   - `mode: existing`일 때 원격 DB/Edge Function 자동 반영이 꺼지는 분기 로직을 테스트로 고정한다.
   - finalize note에 기존 프로젝트용 DB/함수 반영 안내가 들어가는지 테스트한다.
   - `pnpm verify`를 통과한다.
4. 완료 기준
   - 기존 Supabase 프로젝트를 골라도 스캐폴딩이 `db push`나 기본 함수 배포 단계에서 실패하지 않는다.
   - 새 프로젝트와 기존 프로젝트의 원격 DB/함수 반영 동작 차이가 문서와 note에 반영된다.
   - `pnpm verify` 통과

## 다음 작업: Granite/TDS 문서 보강분을 두 패키지 patch release로 올리고 한글 PR을 생성하기
1. 문제
   - 방금 정리한 Granite 하네스 문서, MiniApp framework 인덱스, TDS 인덱스 보강분을 릴리스 대상으로 묶어야 한다.
   - 두 publish 패키지(`create-rn-miniapp`, `@create-rn-miniapp/scaffold-templates`) 모두 문서/템플릿 변경 영향을 받으므로 함께 patch release 대상으로 올리는 편이 맞다.
2. 방향
   - `.changeset`에 두 패키지를 모두 `patch`로 올리는 한글 changeset을 추가한다.
   - 변경사항을 커밋하고 현재 브랜치를 원격에 푸시한다.
   - 변경 목적과 범위를 설명하는 한글 PR 제목/본문으로 PR을 생성한다.
3. 테스트
   - changeset frontmatter에 두 패키지명이 정확히 들어가는지 확인한다.
   - 커밋 전후 `git status`가 의도한 파일만 포함하는지 확인한다.
   - PR 생성 전 브랜치 푸시와 기본 브랜치 대상 설정이 정상인지 확인한다.
4. 완료 기준
   - 두 패키지를 patch로 올리는 changeset이 추가된다.
   - 관련 변경이 커밋되어 원격 브랜치에 올라간다.
   - 한글 제목/본문의 PR이 생성된다.

## 다음 작업: TDS RN 문서를 실제 export와 공개 문서 기준으로 재정리하기
1. 문제
   - 현재 `tds-react-native-index.md`는 과거 패키지 스캔 기준 인덱스라, 실제 export 중 문서에 빠진 컴포넌트나 문서만 있고 export 정리가 덜 된 항목이 있을 수 있다.
2. 방향
   - 현재 기준 TDS RN 패키지에서 실제로 export되는 컴포넌트 이름과 개수를 먼저 뽑는다.
   - 공개 문서 사이트에서 노출하는 컴포넌트 목록과 개수를 별도로 뽑는다.
   - 둘을 대조해 문서 누락, 문서-only 항목, 패키지-only 항목을 구분하고 `tds-react-native-index.md` 보강 방향을 정한다.
3. 테스트
   - 실제 패키지 export 목록과 문서 사이트 목록을 재현 가능한 방식으로 추출한다.
   - 필요 시 문서 보강 후 `pnpm verify`를 통과한다.
4. 완료 기준
   - 실제 export 컴포넌트 개수와 전체 이름 목록을 설명할 수 있다.
   - 문서 노출 컴포넌트 개수와 전체 이름 목록을 설명할 수 있다.
   - 빠진 항목이 있으면 어떤 기준에서 빠졌는지 구분해 정리한다.

## 다음 작업: frontend 전용 참고 문서 강제 규칙을 root AGENTS로 끌어올리고 Plan 템플릿은 공통으로 유지하기
1. 문제
   - `Plan.md` 템플릿 자체에 MiniApp 전용 필드를 넣으면 server/backoffice 작업에서도 불필요한 빈칸이 생겨 공통 계획서 역할이 흐려진다.
   - 반면 frontend 작업은 구현 전에 MiniApp framework/TDS 문서를 실제로 읽었다는 흔적을 남겨야 하므로, root `AGENTS.md` 수준에서 별도 강제 규칙이 필요하다.
2. 방향
   - `packages/scaffold-templates/base/docs/ai/Plan.md`는 공통 템플릿으로 유지한다.
   - root `AGENTS.md`에 frontend 작업 전용 golden rule을 추가해, `Plan`에 `MiniApp 참고 문서` 섹션을 직접 만들고 채우기 전에는 구현을 시작하지 못하게 한다.
   - `하네스-실행가이드.md`에는 그 섹션에 무엇을 적어야 하는지 구체적으로 적는다.
3. 테스트
   - `AGENTS.md`와 `하네스-실행가이드.md`가 frontend 전용 규칙을 같은 의미로 가리키는지 확인한다.
   - `Plan.md` 템플릿이 공통 구조로 남아 있는지 확인한다.
   - `pnpm verify`를 통과한다.
4. 완료 기준
   - 공통 `Plan.md` 템플릿은 MiniApp 전용 필드 없이 유지된다.
   - frontend 작업은 root `AGENTS.md`만 읽어도 `Plan`에 참고 문서 섹션을 추가해야 한다는 사실을 알 수 있다.
   - `pnpm verify` 통과

## 다음 작업: frontend 기능 구현 시작점이 하네스-실행가이드로 자연스럽게 이어지도록 동선을 보강하기
1. 문제
   - 현재 문서 구성은 `AGENTS.md`에 진입한 뒤 `하네스-실행가이드.md`까지 흘러갈 수는 있지만, frontend 기능 구현 직전 반드시 그 문서를 보게 만드는 힘은 약하다.
   - 새 문서를 추가하면 갈라파고스화 위험이 있으므로, 기존 root `AGENTS.md`와 starter 안내 문구 안에서 실행가이드로 더 강하게 유도하는 편이 낫다.
2. 방향
   - root `AGENTS.md`의 `Start Here`와 `Working Loop`에 frontend 기능 구현 전 `하네스-실행가이드.md`를 먼저 보라고 명시한다.
   - `하네스-실행가이드.md` 안에는 frontend 기능 구현 전 체크 섹션을 추가해, 기능 축/라우팅/UI/TDD 순서를 한 번에 보게 만든다.
   - starter 페이지 안내 문구도 `AGENTS.md`와 `하네스-실행가이드.md`를 먼저 보라고 맞춘다.
3. 테스트
   - 관련 문서와 starter 안내 문구가 같은 흐름을 가리키는지 확인한다.
   - `pnpm verify`를 통과한다.
4. 완료 기준
   - root `AGENTS.md`에서 frontend 기능 구현 전 `하네스-실행가이드.md`를 보라는 동선이 명확하다.
   - `하네스-실행가이드.md`만 읽어도 frontend 기능 구현 직전 체크 순서를 따라갈 수 있다.
   - starter 안내 문구도 같은 흐름을 따른다.
   - `pnpm verify` 통과

## 다음 작업: 공식 framework 문서와 로컬 인덱스를 한 번 더 맞춰 마지막 누락을 정리하기
1. 문제
   - 이벤트 제어 보강 이후에도 공식 `llms-full.txt` 기준으로 로컬 인덱스에 남은 미세한 누락이 있는지 마지막 확인이 필요하다.
   - 실제 기능 축 누락과, 같은 문서의 alias 경로 차이, quick feature map에서 빠진 대표 항목을 구분해서 정리해야 한다.
2. 방향
   - 공식 `llms-full.txt`의 framework 문서 경로와 로컬 `appsintoss-granite-full-api-index.md`의 링크를 경로 정규화 기준으로 다시 비교한다.
   - 남는 차이가 있으면 실제 누락인지, alias인지 판별한다.
   - quick feature map에서 빠진 대표 항목은 함께 보강한다.
3. 테스트
   - 추가하는 공식 URL이 실제로 열리는지 확인한다.
   - `pnpm verify`를 통과한다.
4. 완료 기준
   - 공식 export 기준으로 설명 가능한 차이만 남는다.
   - quick/full index 모두 마지막 누락이 정리된다.
   - `pnpm verify` 통과

## 다음 작업: granite 문서 QA에서 남은 이벤트 제어 가이드를 반영하기
1. 문제
   - 공식 개발자센터를 다시 대조한 결과, 로컬 granite 문서는 `useBackEvent` 자체는 안내하지만 `이벤트 제어하기(back-event)`와 `entry-message-exited` 같은 가이드형 문서가 기능 축으로 드러나지 않는다.
   - 이 상태면 API 존재는 파악해도, 뒤로가기/홈/앱 진입 완료 이벤트를 어떤 문서에서 통합적으로 확인해야 하는지 빠르게 찾기 어렵다.
2. 방향
   - `appsintoss-granite-api-index.md`에 `이벤트 제어` 축을 추가해 back/home/entry 이벤트가 존재함을 먼저 보이게 한다.
   - `appsintoss-granite-full-api-index.md`에는 공식 `back-event`, `entry-message-exited` 링크와 관련 이벤트 이름을 명시한다.
   - 문서 QA를 다시 수행한 날짜에 맞춰 `granite-ssot.md`의 검증 기준일도 갱신한다.
3. 테스트
   - 추가하는 공식 URL이 실제로 열리는지 확인한다.
   - `pnpm verify`를 통과한다.
4. 완료 기준
   - quick feature map에 `이벤트 제어` 축이 보인다.
   - full catalog에서 back/home/entry 이벤트 관련 공식 문서를 바로 찾을 수 있다.
   - `pnpm verify` 통과

## 다음 작업: 개발자센터 기준 granite 문서 QA를 다시 수행하기
1. 문제
   - 현재 `appsintoss-granite-api-index.md`와 `appsintoss-granite-full-api-index.md`를 공식 MiniApp 개발자센터 기준으로 다시 점검해, 빠진 축이 없는지와 링크 404가 없는지 재검증할 필요가 있다.
   - 이전에 링크와 범위를 보강했지만, 실제 공식 문서 구조가 바뀌었거나 특정 링크가 누락됐을 가능성을 QA 관점에서 다시 확인해야 한다.
2. 방향
   - 에이전트 3개를 병렬로 사용해 공식 문서 범위, 로컬 문서 범위, 링크 유효성을 분담 검증한다.
   - 공식 개발자센터 문서 범위와 로컬 문서 범위를 다시 정규화해 누락/중복/오래된 링크를 찾는다.
   - 로컬 템플릿 문서의 외부 링크는 실제 404 여부를 다시 확인한다.
3. 테스트
   - 공식 개발자센터 페이지와 `llms-full.txt` 기준으로 카테고리 및 대표 API/가이드를 재대조한다.
   - 로컬 granite 문서에 포함된 외부 링크를 실제 요청으로 점검한다.
   - `pnpm verify`를 통과한다.
4. 완료 기준
   - 공식 문서 대비 빠진 기능 축이나 대표 API가 있는지 설명할 수 있다.
   - 로컬 granite 문서 외부 링크에 404가 남아 있지 않다.
   - `pnpm verify` 통과

## 다음 작업: Implement.md를 제거하고 Plan.md로 실행 계획을 흡수하기
1. 문제
   - 현재 `Implement.md`는 동적인 구현 계획서라기보다 정적인 규칙 요약에 가까워 `AGENTS.md`, `하네스-실행가이드.md`와 역할이 많이 겹친다.
   - 반면 실제 작업 흐름에서는 `Plan.md`가 이미 목표, 범위, TDD, DoD를 담고 있어 구현 단계와 검증 계획까지 흡수하는 편이 더 단순하다.
2. 방향
   - `packages/scaffold-templates/base/docs/ai/Implement.md`를 제거한다.
   - `packages/scaffold-templates/base/docs/ai/Plan.md` 템플릿에 수정 파일, 구현 순서, 제외 범위, 검증 명령을 담도록 보강한다.
   - `AGENTS.md`, `하네스-실행가이드.md`, `docs/index.md`에서 `Implement.md` 참조를 제거하고 `Plan.md` 중심 흐름으로 바꾼다.
3. 테스트
   - 남아 있는 `Implement.md` 참조가 없는지 확인한다.
   - `pnpm verify`를 통과한다.
4. 완료 기준
   - 생성 템플릿 문서군에 `Implement.md`가 남지 않는다.
   - 구현 계획은 `Plan.md` 하나로 표현된다.
   - `pnpm verify` 통과

## 다음 작업: granite api-index를 기능 맵으로 축소하고 full-api-index와 역할을 분리하기
1. 문제
   - 현재 `appsintoss-granite-api-index.md`와 `appsintoss-granite-full-api-index.md`가 모두 API 목록을 많이 담고 있어 역할 차이가 충분히 선명하지 않다.
   - quick index가 링크 카탈로그처럼 비대해지면 에이전트와 개발자가 어떤 문서를 먼저 봐야 하는지 헷갈린다.
2. 방향
   - `appsintoss-granite-api-index.md`는 정확한 URL 모음이 아니라 기능 맵 문서로 축소한다.
   - `appsintoss-granite-full-api-index.md`는 실제 링크, 세부 타입, 에러, 보조 문서를 담는 전체 카탈로그 역할로 유지한다.
   - `AGENTS.md`, `하네스-실행가이드.md`, `docs/index.md`의 설명도 새 역할에 맞게 맞춘다.
3. 테스트
   - 문서 간 링크가 맞는지 확인한다.
   - `pnpm verify`를 통과한다.
4. 완료 기준
   - `api-index`만 읽어도 기능 축을 빠르게 파악할 수 있다.
   - 정확한 URL을 보려면 `full-api-index`로 가야 한다는 경계가 문서상 명확하다.
   - `pnpm verify` 통과

## 다음 작업: granite-api 인덱스를 공식 MiniApp framework 범위까지 확장하기
1. 문제
   - 현재 `appsintoss-granite-api-index.md`와 `appsintoss-granite-full-api-index.md`는 RN 미니앱의 핵심 happy path는 담고 있지만, 공식 개발자센터의 framework 범위 전체를 기준으로 보면 시작/코어/설정/로그인/카메라/연락처/게임/화면제어 세부 API 등이 빠져 있다.
   - 문서 제목은 full API index인데 실제 범위가 더 좁아서, 에이전트와 개발자가 로컬 문서를 source of truth처럼 믿고 찾다가 공식 기능을 놓칠 수 있다.
2. 방향
   - `llms-full.txt`와 공식 개발자센터 페이지를 기준으로 framework 카테고리와 주요 API/가이드를 다시 정리한다.
   - quick index는 자주 쓰는 시작점과 대표 API를 더 넓게 보여주되, full index는 공식 카테고리 전반을 빠짐없이 탐색할 수 있게 확장한다.
   - 기존 Granite 우선 원칙과 공식 문서 우선 원칙은 유지한다.
3. 테스트
   - 수정 후 `pnpm verify`를 통과한다.
   - quick/full index에서 공식 문서의 주요 카테고리와 시작 문서가 빠지지 않았는지 수동 대조한다.
4. 완료 기준
   - quick index가 시작/설정/핵심 디바이스 API까지 안내한다.
   - full index가 공식 framework의 주요 카테고리와 대표 API를 빠짐없이 연결한다.
   - `pnpm verify` 통과

## 다음 작업: 미니앱 개발자센터 공식 시작 문서와 로컬 granite-api 인덱스를 교차점검하기
1. 문제
   - 공식 Bedrock 문서에는 `tutorial`, `시작하기`, `SDK 2.x 마이그레이션`, `공통 설정` 같은 시작 문서가 별도로 존재하는데, 로컬 granite-api 인덱스는 API 카탈로그 중심이라 이 흐름을 충분히 드러내지 못할 수 있다.
   - 생성기 문서가 시작 가이드를 빠뜨리면 사용자는 API는 찾지만 실제 초기화/설정/마이그레이션 흐름은 놓치게 된다.
2. 방향
   - 공식 문서에서 MiniApp 시작에 필요한 페이지를 먼저 수집한다.
   - 로컬 `appsintoss-granite-api-index.md`와 `appsintoss-granite-full-api-index.md`를 비교해 누락 후보를 추린다.
   - 공식 URL과 함께, 근거가 확실한 항목과 추측 항목을 분리해 정리한다.
3. 테스트
   - 공식 문서의 제목/경로를 기준으로 목록을 작성한다.
   - 로컬 인덱스에 이미 포함된 항목과 별도 시작 가이드를 구분한다.
4. 완료 기준
   - 공식 시작 문서 목록과 로컬 문서의 보완 후보를 분리해서 설명할 수 있다.
   - 추측은 추측으로 표시한다.

## 다음 작업: create-rn-miniapp의 현재 완성도와 홍보 readiness를 객관적으로 평가하기
1. 문제
   - 지금 시점에 이 스캐폴딩 도구가 어느 정도 수준인지, 외부 홍보를 시작해도 되는지 판단 근거가 필요하다.
   - 감으로 판단하면 과대평가하거나, 반대로 실제 강점을 놓칠 수 있다.
2. 방향
   - 코드 구조, 테스트 밀도, 문서 완성도, 릴리스/배포 준비, 실제 검증 흐름을 함께 본다.
   - `README`, CLI/patch/provision 코드, 테스트, CI/Changesets, `pnpm verify` 결과를 근거로 강점과 리스크를 분리해서 평가한다.
   - 결과는 "홍보 가능/보완 후 홍보" 수준으로 명확하게 판정한다.
3. 테스트
   - `pnpm verify`를 실행해 현재 기준선이 실제로 통과하는지 확인한다.
   - 필요하면 테스트 파일 수와 핵심 시나리오 커버 범위를 같이 점검한다.
4. 완료 기준
   - 근거 기반으로 현재 도구의 성숙도를 설명할 수 있다.
   - 홍보 전에 꼭 보완할 항목과, 지금 바로 내세워도 되는 강점을 분리해서 제시한다.

## 다음 작업: yarn 스캐폴딩/verify 경로를 실제로 재검증하고 평가 근거를 바로잡기
1. 문제
   - 이전 평가에서 `pnpm` 기준 검증과 `--skip-install` 경로 해석이 섞여 보여, 실제 제품 리스크를 더 정확히 구분할 필요가 있다.
   - 특히 `yarn` 지원은 README에 명시돼 있으므로 실제 생성과 `yarn verify` 통과 여부를 별도로 확인해야 한다.
2. 방향
   - `verify.yml`은 이 저장소 자체 CI가 `pnpm`만 도는 사실과 generated repo 지원 범위를 분리해서 설명한다.
   - `--skip-install`은 "의존성 미설치" 문제가 아니라 "root finalize/format 생략"까지 포함한 옵션인지 실제 생성물로 확인한다.
   - `--package-manager yarn`으로 실제 스캐폴딩한 뒤 generated repo에서 `yarn verify`까지 실행한다.
3. 테스트
   - `yarn` 스캐폴딩 스모크 실행
   - generated repo에서 `yarn verify` 실행
4. 완료 기준
   - `yarn` 경로가 실제로 어느 수준까지 동작하는지 확인했다.
   - 이전 평가에서 보정할 부분과 유지할 부분을 명확히 설명할 수 있다.

## 다음 작업: 최종 패치 이후 generated repo의 peer dependency warning 잔존 여부 확인하기
1. 문제
   - 초기 Granite/AppInToss 설치 단계 경고와 최종 generated repo 상태의 경고를 구분해서 봐야 한다.
   - 사용자는 마지막 패치 이후에는 peer warning이 정리되었을 가능성을 제기했다.
2. 방향
   - 이미 생성된 `pnpm`/`yarn` generated repo에서 최종 상태 기준으로 install을 다시 실행한다.
   - warning이 남으면 어떤 peer mismatch가 남는지 실제 패키지 기준으로 확인한다.
3. 테스트
   - generated pnpm repo에서 `pnpm install`
   - generated yarn repo에서 `yarn install`
4. 완료 기준
   - 최종 패치 이후에도 peer warning이 남는지, 아니면 초기 scaffold 경고만 있었는지 구분해서 설명할 수 있다.

## 다음 작업: 루트 README의 provider 공통 설명을 실제 생성 구조에 맞게 정리하기
1. 문제
   - 현재 루트 README의 `Provider 공통 생성` 섹션은 `frontend/src/lib/supabase.ts`, `backoffice/src/lib/supabase.ts`가 모든 provider에서 생기는 것처럼 적혀 있다.
   - 실제 생성물은 provider마다 bootstrap 파일이 다르고, Firebase는 Firestore bootstrap까지 포함하는데 상단 요약은 이 흐름을 충분히 설명하지 못한다.
2. 방향
   - `Provider IaC` 요약은 Firebase의 Firestore API / `(default)` DB 준비까지 반영한다.
   - `Provider 공통 생성` 섹션은 공통 파일만 남기고, provider-specific client/bootstrap은 각 provider 섹션에서 설명하게 정리한다.
3. 테스트
   - 루트 README만 수정한 뒤 `pnpm verify`를 다시 통과시킨다.
4. 완료 기준
   - 루트 README의 공통 설명이 실제 생성 구조와 어긋나지 않는다.
   - `pnpm verify` 통과

## 다음 작업: generated frontend의 Granite preset 로직을 로컬 helper로 분리하기
1. 문제
   - 지금 `frontend/granite.config.ts`는 repoRoot, env 로딩, provider별 `env()` plugin, Firebase crypto shim resolver까지 모두 직접 들고 있어 patch 결과가 점점 비대해진다.
   - 설정 주입이 늘어날수록 `granite.config.ts` 자체가 overlay 구현 파일처럼 변해서, Granite 기본 설정과 generator overlay의 경계가 흐려진다.
2. 방향
   - generated frontend에 `scaffold.preset.ts` 같은 로컬 helper 파일을 만든다.
   - provider별 env 로딩, `workspaceRepoRoot`, Firebase crypto shim resolver는 helper로 옮기고, `granite.config.ts`는 `defineConfig()`와 `appsInToss()` 중심의 얇은 선언형 파일로 유지한다.
   - 기존 Firebase / Supabase / Cloudflare patch는 helper 파일 생성과 얇은 config wiring 기준으로 다시 맞춘다.
3. 테스트
   - frontend patch 테스트를 먼저 바꿔 `granite.config.ts`가 helper를 import하는지, helper가 provider별 env/resolver를 담는지 고정한다.
4. 완료 기준
   - generated `frontend/granite.config.ts`는 얇은 wiring만 남는다.
   - provider별 env/resolver 로직은 generated helper 파일로 이동한다.
   - `pnpm verify` 통과

## 다음 작업: Firebase frontend에 Granite crypto shim과 resolver alias를 같이 패치하기
1. 문제
   - 실제 Firebase 생성물은 `firebase`가 `crypto` / `node:crypto`를 참조하는데, 현재 `frontend/granite.config.ts`에는 Granite build / metro resolver alias가 없어 `ait build`가 깨진다.
   - 지금 생성기는 Firebase bootstrap만 만들고 `src/shims/crypto.ts`와 resolver 설정은 넣지 않는다.
2. 방향
   - `packages/scaffold-templates`에 Firebase frontend용 crypto shim 템플릿을 추가한다.
   - `patchFrontendWorkspace(..., serverProvider: 'firebase')`가 `frontend/src/shims/crypto.ts`를 만들고, `granite.config.ts`에 `build.resolver.alias`와 `metro.resolver.extraNodeModules`, `conditionNames`를 주입한다.
3. 테스트
   - Firebase frontend patch 테스트에 shim 파일 생성과 Granite resolver 설정을 먼저 고정한다.
4. 완료 기준
   - Firebase 생성물은 `frontend/src/shims/crypto.ts`를 포함한다.
   - `granite.config.ts`가 `crypto` / `node:crypto` alias를 포함한다.
   - `pnpm verify` 통과

## 다음 작업: backoffice React 버전을 frontend 기준으로 정렬해 hoist 충돌을 막기
1. 문제
   - 실제 생성물에서 frontend는 `react@19.2.3`, backoffice는 `react@19.2.4`를 선언해 루트 hoist가 더 최신 React를 잡는다.
   - 이 상태면 Jest / react-test-renderer는 hoisted React를 보고, frontend 컴포넌트는 로컬 React를 보면서 React 인스턴스가 갈라져 Invalid hook call과 peer mismatch가 난다.
2. 방향
   - backoffice patch 단계에서 frontend `package.json`을 source of truth로 읽는다.
   - backoffice의 `react`, `react-dom`, `@types/react`는 frontend와 같은 버전으로 맞춘다.
   - `@types/react-dom`은 frontend가 같은 패키지를 선언하면 그대로 따르고, 없으면 frontend React 버전 기준으로만 내려오게 정렬한다.
3. 테스트
   - backoffice patch 테스트에 frontend `19.2.3` / backoffice `19.2.4` fixture를 두고 patch 후 정렬되는지 먼저 고정한다.
4. 완료 기준
   - generated backoffice는 frontend보다 높은 React 계열 버전을 유지하지 않는다.
   - `pnpm verify` 통과

## 다음 작업: Firebase scaffold의 seed script strict 오류와 provisioning deploy target 누락을 고치기
1. 문제
   - 실제 Firebase 생성물에서 `server/functions/src/seed-public-status.ts`가 strict TypeScript 기준으로 `implicit any`와 index signature 오류를 내며 build를 막는다.
   - provisioning 단계의 Firebase deploy는 아직 `--only functions`만 써서 Firestore rules / indexes가 함께 배포되지 않는다.
2. 방향
   - `seed-public-status.ts` 생성 템플릿에 명시적 타입을 넣어 `tsc -p tsconfig.json`이 바로 통과하게 한다.
   - provisioning deploy command를 `functions,firestore:rules,firestore:indexes` 기준으로 올려 현재 템플릿의 server deploy 스크립트와 맞춘다.
3. 테스트
   - template test에 seed script의 타입 시그니처를 추가한다.
   - provider test에 Firebase provisioning deploy command helper가 Firestore rules / indexes를 포함하는지 추가한다.
4. 완료 기준
   - Firebase 생성물은 predeploy build에서 `seed-public-status.ts` 타입 오류가 나지 않는다.
   - provisioning deploy와 generated server deploy가 같은 target 구성을 사용한다.
   - `pnpm verify` 통과

## 다음 작업: README의 tRPC shared workspace 설명을 Cloudflare 문맥으로만 제한하기
1. 문제
   - 현재 README 상단 소개에 `packages/contracts`, `packages/app-router` 설명이 일반 기능처럼 보인다.
   - 실제로는 Cloudflare + tRPC일 때만 생성되므로, provider-independent 기능처럼 오해하기 쉽다.
2. 방향
   - 상단 bullet에서는 두 workspace 설명을 제거한다.
   - 생성 구조 주석은 `optional (cloudflare + trpc)`로 명확히 바꾼다.
   - Cloudflare 섹션과 Cloudflare+tRPC 설명만 canonical 설명으로 유지한다.
3. 테스트
   - 문서 변경 후 `pnpm verify`를 다시 통과시킨다.
4. 완료 기준
   - README에서 두 workspace 설명은 Cloudflare 문맥에서만 보인다.
   - `pnpm verify` 통과

## 다음 작업: 실제 생성물에서 확인된 Firebase/Granite 결함 4개를 스캐폴더에 반영하기
1. 문제
   - Firebase 스캐폴딩은 Firestore API / `(default)` database / public status seed 흐름이 없어 frontend direct read가 바로 이어지지 않는다.
   - Firebase Functions runtime이 `node:24`로 남아 있어 배포 리스크가 있고, deploy도 Functions만 올려 Firestore rules / indexes 반영이 빠진다.
   - frontend Firebase bootstrap은 Firestore direct read 실패 시 callable fallback이 없어 권한 오류를 그대로 노출한다.
   - `frontend/granite.config.ts`는 `__dirname` 기준으로 `.env.local`을 읽어 `ait build`의 `.granite` 실행 경로에서 깨진다.
2. 방향
   - 실제 생성물 기준으로 `firebase-ensure-firestore.mjs`, `firestore.rules`, `firebase-functions-deploy.mjs`, `public-app-status.ts`, `process.cwd()` 기반 Granite env patch를 생성기에 그대로 반영한다.
   - Firebase server README / provider guide / 루트 README도 새 Firestore + fallback 흐름 기준으로 맞춘다.
3. 테스트
   - 실패 중인 Granite preamble 테스트부터 현재 `process.cwd()` 기준으로 고친다.
   - Firebase template / patch / provision 테스트가 `firestore.rules`, `firebase-ensure-firestore`, `seed:public-status`, fallback bootstrap, `MINIAPP_FIREBASE_FUNCTION_REGION`을 고정하도록 유지한다.
4. 완료 기준
   - Firebase 생성물이 Firestore 준비, rules/indexes deploy, public status seed, frontend fallback, Granite build env 로딩을 모두 포함한다.
   - README와 provider guide가 실제 생성 구조와 일치한다.
   - `pnpm verify` 통과

## 다음 작업: Firebase provider가 Firestore 리소스와 seed 흐름까지 같이 준비하게 만들기
1. 문제
   - 지금 Firebase provider는 `frontend/src/lib/firestore.ts`와 `backoffice/src/lib/firestore.ts`를 생성하지만, 원격 프로젝트에는 Firestore API와 `(default)` 데이터베이스를 준비하지 않는다.
   - 이 상태면 스캐폴딩 직후 클라이언트 코드는 Firestore를 바라보는데, 실제 Firebase 프로젝트는 DB 자체를 바로 쓸 수 없는 구조적 빈틈이 남는다.
2. 방향
   - provisioning 단계에서 `firestore.googleapis.com`을 활성화하고 `(default)` Firestore database가 없으면 function region 기준으로 자동 생성한다.
   - Firebase server workspace에는 `firestore.rules`, `firestore.indexes.json`, `firestore.seed.json`, `scripts/firebase-firestore-seed.mjs`를 함께 만든다.
   - generated `server/package.json`은 `deploy`에서 `functions,firestore`를 같이 배포하고, `firestore:seed` 스크립트를 추가한다.
   - generated README와 Firebase provider guide도 Firestore rules/indexes/seed 흐름을 같이 설명한다.
3. 테스트
   - Firestore API 활성화와 default database 생성 helper 테스트를 먼저 추가한다.
   - Firebase server template 테스트에 `firestore.rules`, `firestore.indexes.json`, `firestore:seed`와 deploy script 변경을 고정한다.
4. 완료 기준
   - Firebase provisioning이 Firestore API와 기본 DB를 자동으로 준비한다.
   - generated Firebase server workspace에 Firestore 설정 파일과 seed 진입점이 존재한다.
   - `pnpm verify` 통과

## 다음 작업: Firebase deploy auth note를 짧게 줄이고 발급 경로만 남기기
1. 문제
   - 지금 Firebase provisioning note는 역할 설명, 자동 보정, 일반 설정 링크까지 섞여 있어서 필요한 행동이 바로 보이지 않는다.
   - 특히 `firebase login:ci`는 설치 경로가 빠져 있어 그대로 따라 하기 어렵고, 발급 화면 예시가 이미 `server/README.md`에 있는데 note가 그걸 활용하지 못한다.
2. 방향
   - note는 `server/.env.local`의 빈 값과 발급 경로만 짧게 안내한다.
   - `FIREBASE_TOKEN`은 `npx firebase-tools login:ci`로 직접 안내한다.
   - `GOOGLE_APPLICATION_CREDENTIALS`는 프로젝트별 Service Accounts URL만 보여준다.
   - 역할 설명, 자동 보정 설명, 일반 Firebase 설정 링크는 note에서 제거하고, 발급 화면 예시는 `server/README.md`로 안내한다.
3. 테스트
   - provisioning note 테스트를 먼저 짧은 문구와 `server/README.md` 기준으로 고정한다.
4. 완료 기준
   - Firebase note가 짧아지고 필요한 행동만 바로 보인다.
   - `pnpm verify` 통과

## 다음 작업: Supabase server typecheck를 placeholder에서 실제 Edge Function 정적 검사로 바꾸기
1. 문제
   - 현재 generated `server/package.json`의 `typecheck`는 placeholder라 `supabase/functions/*/index.ts` entrypoint 자체를 검사하지 않는다.
   - 이 상태면 `pnpm verify`가 통과해도 Supabase Edge Function 소스 오류를 놓칠 수 있다.
2. 방향
   - `server/scripts/supabase-functions-typecheck.mjs`를 생성해서 모든 function entrypoint를 순회한다.
   - 각 function root의 `deno.json`이 있으면 그 config를 사용하고, 없으면 entrypoint만 대상으로 `deno check`를 실행한다.
   - generated `server/package.json`의 `typecheck`는 새 스크립트를 실행하게 바꾸고, generated README와 Supabase guide도 같은 기준으로 맞춘다.
3. 테스트
   - template 테스트에서 `typecheck` 스크립트가 placeholder가 아니라 새 node script를 가리키는지 고정한다.
   - generated script가 `deno check`와 `supabase/functions` 탐색을 포함하는지도 고정한다.
   - Supabase server README 테스트에 `typecheck`와 `deno check` 안내를 추가한다.
4. 완료 기준
   - Supabase 생성물의 `server typecheck`가 실제 Edge Function entrypoint를 정적 검사한다.
   - README와 provider guide가 새 스크립트 의미를 설명한다.
   - `pnpm verify` 통과

## 다음 작업: Supabase를 tRPC 정식 경로에서 제외하고 Cloudflare 전용으로 정리하기
1. 문제
   - 현재 CLI와 문서는 `supabase`도 `--trpc`를 정식 지원하는 것처럼 보이지만, 실제 runtime 구조는 workaround 성격이 강하다.
   - 이 상태로 두면 사용자와 에이전트가 Supabase+tRPC를 happy path로 오해하게 된다.
2. 방향
   - `--trpc`는 `cloudflare`일 때만 허용한다.
   - Supabase patch, README, engineering docs에서 tRPC 관련 분기를 제거한다.
   - `frontend`/`backoffice`의 Supabase tRPC client bootstrap도 제거하고, Supabase는 `supabase-js`와 `functions.invoke('api')` 기준으로 유지한다.
   - `packages/contracts`, `packages/app-router`, tRPC SSOT 문서는 Cloudflare+tRPC일 때만 생성되는 구조로 유지한다.
3. 테스트
   - CLI 테스트에서 `supabase + --trpc`를 에러로 고정한다.
   - patch 테스트에서 Supabase tRPC bootstrap 기대값을 제거한다.
   - README/help 문구도 `cloudflare 전용` 기준으로 맞춘다.
4. 완료 기준
   - `supabase + --trpc`는 인터랙티브와 비대화형 모두 막힌다.
   - Supabase 생성물에는 더 이상 tRPC bootstrap과 관련 문서가 없다.

## 다음 작업: Supabase provisioning note에서 배포 설명을 빼고 값 입력 안내만 남기기
1. 문제
   - 지금 Supabase provisioning note에는 `db:apply`, `functions:deploy`, Edge Function 위치 같은 배포 설명이 섞여 있다.
   - 이 내용은 이미 generated `server/README.md`에 있으니, note까지 같은 책임을 지면 오히려 혼잡하다.
2. 방향
   - note에서는 `.env.local`에 어떤 값을 넣어야 하는지와 해당 대시보드 URL만 남긴다.
   - 배포/재배포 명령과 Edge Function 설명은 `server/README.md`에만 남긴다.
3. 테스트
   - Supabase note 테스트에서 `functions:deploy`, `db:apply` 같은 문구를 더 이상 기대하지 않게 바꾼다.
4. 완료 기준
   - note는 값 입력 안내만 짧게 보여준다.
   - 배포 설명은 `server/README.md`에만 남는다.
   - `pnpm verify` 통과

## 다음 작업: Supabase provisioning note를 짧게 줄이고 DB password 대시보드 URL을 바로 안내하기
1. 문제
   - 지금 Supabase provisioning note는 access token, DB password, publishable key 설명이 길게 섞여 있어서 필요한 행동이 바로 보이지 않는다.
   - 특히 DB password는 생성기가 알 수 없는 경우가 많으니, 프로젝트별 Database Settings 대시보드 URL을 바로 주는 편이 더 낫다.
2. 방향
   - note에서 `SUPABASE_ACCESS_TOKEN`과 `SUPABASE_DB_PASSWORD`가 비어 있으면 한 줄로 묶어서 짧게 안내한다.
   - 바로 아래에 access token dashboard URL과 project database settings URL만 남긴다.
   - success note와 manual setup note 둘 다 같은 톤으로 정리한다.
3. 테스트
   - provisioning note test가 짧은 문구와 두 URL만 기대하도록 먼저 고친다.
4. 완료 기준
   - note가 짧아지고, 어디서 값을 넣어야 하는지 URL만 봐도 바로 알 수 있다.
   - `pnpm verify` 통과

## 다음 작업: Supabase DB 비밀번호는 CLI에 맡기고 생성기는 note만 남기기
1. 문제
   - 생성기가 DB 비밀번호를 직접 물어보거나 만들어서 넘기는 방식은 Supabase CLI 비밀번호 정책이 바뀔 때마다 쉽게 깨진다.
   - 사용자는 Supabase 공식 interactive prompt를 그대로 쓰는 편이 더 자연스럽고, 생성기가 그 규칙까지 복제하는 건 유지보수 비용이 크다.
2. 방향
   - `supabase projects create <name>`는 다시 공식 interactive CLI 흐름만 띄운다.
   - 생성기는 DB 비밀번호를 직접 입력받거나 만들지 않는다.
   - 새 프로젝트 생성 뒤에는 `server/.env.local`의 `SUPABASE_DB_PASSWORD`를 자동으로 채우지 않고, 마지막 note에서 직접 넣으라고 안내한다.
   - CLI 출력에서 비밀번호를 안정적으로 읽을 수 있는 경우만 나중에 별도 확장하고, 지금은 보수적으로 비워 둔다.
3. 테스트
   - create args에 `--db-password`가 더 이상 붙지 않는지 먼저 고정한다.
   - 새 프로젝트 생성 후 note가 `SUPABASE_DB_PASSWORD`를 직접 넣으라고 안내하는지 유지한다.
4. 완료 기준
   - Supabase 프로젝트 생성은 공식 interactive CLI 그대로 동작한다.
   - 생성기는 비밀번호 규칙을 직접 구현하지 않는다.
   - 새 프로젝트를 만든 뒤에는 `SUPABASE_DB_PASSWORD`를 직접 넣으라는 안내가 남는다.
   - `pnpm verify` 통과

## 다음 작업: Supabase 새 프로젝트 DB 비밀번호를 생성기가 직접 만들고 저장하기
1. 문제
   - Supabase CLI prompt에서 DB 비밀번호를 비워 두면 생성된 값을 CLI가 다시 보여주지 않아, 사용자가 비밀번호를 모른 채 프로젝트가 만들어질 수 있다.
   - 현재 생성기는 그 값을 알 수 없어서 `server/.env.local`에도 비워 둔다.
2. 방향
   - 생성기가 강한 DB 비밀번호를 직접 만들고, `supabase projects create <name> --db-password <generated>`로 넘긴다.
   - create는 여전히 interactive TTY로 실행해서 org와 region 선택은 Supabase CLI 흐름을 그대로 쓴다.
   - 생성한 비밀번호는 `server/.env.local`에 바로 적어 두고, 기존 값이 있으면 덮어쓰지 않는다.
3. 테스트
   - create args가 `--db-password`를 포함하는지 먼저 고정한다.
   - `writeSupabaseServerLocalEnvFile`이 새 비밀번호를 초기값으로 기록하는지 테스트를 추가한다.
4. 완료 기준
   - 새 Supabase 프로젝트를 만들 때 DB 비밀번호를 잃어버리지 않는다.
   - `server/.env.local`에 바로 이어서 쓸 수 있는 비밀번호가 남는다.
   - `pnpm verify` 통과

## 다음 작업: Supabase create 명령에 프로젝트 이름 positional arg 넣기
1. 문제
   - 최신 Supabase CLI는 `supabase projects create [project name]` 형태를 요구한다.
   - 지금 생성기는 `projects create`까지만 호출해서, 특히 bun 경로에서 `accepts 1 arg(s), received 0`로 바로 실패한다.
2. 방향
   - 새 프로젝트 생성 전 이름을 한 번 더 물어보고, 그 값을 positional arg로 넘긴다.
   - 기본값은 target root 이름을 쓰고, 빈 값은 막는다.
   - create 단계는 다시 interactive TTY 흐름을 유지하고, 생성 후에는 이전 목록 대비 새 프로젝트를 polling으로 찾는다.
3. 테스트
   - create command args에 project name이 포함되는지 먼저 고정한다.
4. 완료 기준
   - bun/pnpm/yarn/npm 모두 `supabase projects create <name>` 형태로 실행된다.
   - `pnpm verify` 통과

## 다음 작업: Supabase 새 프로젝트 생성 직후 재선택 프롬프트를 없애기
1. 문제
   - `supabase projects create` 직후 프로젝트 목록이 바로 최신화되지 않으면, 방금 만든 프로젝트가 리스트에 안 보여도 다시 고르게 만든다.
   - 이 흐름은 새 프로젝트를 만든 직후 가장 불편한 구간이고, 사용자 입장에선 방금 만든 프로젝트를 또 찾으라는 형태가 된다.
2. 방향
   - create 전의 프로젝트 목록을 기준선으로 잡는다.
   - create 뒤에 1초, 2초, 4초, 5초 간격으로 목록을 폴링하면서 “이전엔 없던 새 프로젝트”를 찾는다.
   - 새 프로젝트가 하나로 잡히면 바로 그 ref로 진행하고, 끝까지 안 잡히면 그때만 다시 선택하게 한다.
3. 테스트
   - create command args에 project name이 positional로 붙는지 먼저 고정한다.
   - 폴링이 1/2/4/5초 순서로 돌고, 이전 목록에 없던 프로젝트를 찾으면 즉시 멈추는 테스트를 먼저 추가한다.
4. 완료 기준
   - 새 프로젝트 생성 직후 재선택 프롬프트가 사라진다.
   - `pnpm verify` 통과

## 다음 작업: tRPC shared packages를 `tsdown` 빌드 산출물 기반으로 전환하기
1. 문제
   - 지금 `packages/contracts`, `packages/app-router`는 package root가 `src/index.ts`를 바로 export하는 source package 구조다.
   - 이 구조는 type-only import는 가능하지만, 일부 에이전트와 툴이 package root의 named type export를 덜 신뢰하고 `import('@workspace/app-router').AppRouter`나 direct source path로 우회하게 만든다.
   - Cloudflare runtime도 package root를 runtime import하는데, source export 상태라 “빌드된 패키지”처럼 보이지 않는다.
2. 방향
   - `packages/contracts`, `packages/app-router`에 `tsdown` 기반 `build` 스크립트를 넣고 `dist/index.mjs`, `dist/index.cjs`, `dist/index.d.mts`를 생성하게 한다.
   - package root `exports`는 `import`/`require`/`types`를 모두 `dist` 기준으로 가리키게 바꾼다.
   - generated root `nx.json`의 `build`, `typecheck`, `test` target defaults에 dependency build 순서를 추가해서, shared package가 필요한 workspace가 root orchestration에서 먼저 `dist`를 확보하게 한다.
   - Cloudflare tRPC server scripts도 shared package build를 먼저 보장하는지 점검하고 필요하면 prefix를 붙인다.
3. 테스트
   - shared package template test를 먼저 깨서 `tsdown` build script, `dist` export, `files: ["dist"]`, `tsdown` config 생성을 기대하게 한다.
   - generated `nx.json` test를 먼저 깨서 dependency build 순서를 기대하게 한다.
   - 마지막에 `pnpm verify`를 다시 통과시킨다.
4. 완료 기준
   - generated `packages/contracts`, `packages/app-router`는 `tsdown`으로 빌드된다.
   - generated consumers는 package root import 기준으로 `AppRouter`를 보는 구조가 더 자연스러워진다.
   - root orchestration에서 shared package build 순서가 보장된다.
   - generated package.json이 실제 `tsdown` 산출물인 `index.mjs`, `index.cjs`, `index.d.mts`와 정확히 맞는다.
   - `pnpm verify` 통과

## 다음 작업: starter Lottie asset을 `Marketing.json`으로 교체하고 README에 guardrail 의도를 추가하기
1. 문제
   - starter Lottie asset이 아직 임시 `dots loading` JSON이라 기본 화면 인상이 약하다.
   - README 초반에는 lint/verify가 왜 TDS와 Granite 쪽으로 유도하는지, 특히 에이전트가 컨텍스트를 놓치지 않게 하려는 guardrail이라는 설명이 부족하다.
2. 방향
   - `packages/scaffold-templates/root/assets/frontend/miniapp-starter-hero.lottie.json`을 사용자가 준 `Marketing.json`으로 교체한다.
   - asset 관련 테스트 기대값도 새 animation 이름 기준으로 바꾼다.
   - README 초반에 lint/verify가 TDS와 Granite 기준으로 유도하는 이유를 한 문단 추가한다.
3. 테스트
   - starter asset 테스트가 `Marketing` 식별값을 기대하도록 먼저 고친다.
   - 마지막에 `pnpm verify`를 다시 통과시킨다.
4. 완료 기준
   - generated starter hero는 `Marketing.json`을 기본 asset으로 쓴다.
   - README 초반에 guardrail 의도가 바로 보인다.
   - `pnpm verify` 통과

## 다음 작업: frontend starter Lottie를 `LottieView` + JSON import 기준으로 맞추고 starter copy를 정리하기
1. 문제
   - 지금 generated starter page는 `@granite-js/react-native`의 `Lottie.AnimationObject`와 `animationObject` prop을 쓰고 있다.
   - 실제 Granite native wrapper 타입은 `@granite-js/native/lottie-react-native`의 `LottieView`이고, `source` + `style`을 받는다.
   - starter hero 상단의 `AppInToss MiniApp starter` 라벨도 지금 화면에선 정보 가치가 낮다.
2. 방향
   - starter page를 `import LottieView from '@granite-js/native/lottie-react-native'` 기준으로 바꾼다.
   - local JSON asset은 ESM import로 읽고 `source={starterHeroLottie}`로 넘긴다.
   - 크기는 `height` prop 대신 `style`로 준다.
   - 상단 `AppInToss MiniApp starter` 문구는 제거하고 나머지 안내 copy만 유지한다.
3. 테스트
   - frontend patch 테스트가 `LottieView`, JSON import, `source={starterHeroLottie}`, `heroAnimationView`를 기대하도록 먼저 고친다.
   - 기존 `animationObject`와 `AppInToss MiniApp starter` 문구가 더 이상 나오지 않는지도 같이 검증한다.
4. 완료 기준
   - generated starter page가 `discount-board`에서 검증한 사용 방식과 같아진다.
   - `pnpm verify` 통과

## 다음 작업: frontend starter Lottie를 인라인 object 대신 실제 JSON asset 파일로 바꾸기
1. 문제
   - 지금 starter page의 Lottie는 `index.tsx` 안에 직접 박아 넣은 object를 쓴다.
   - 이 방식은 실제 asset 기반이 아니라서 수정 이력도 추적하기 어렵고, 사용자가 보기에도 "추측해서 만든 animation"처럼 느껴질 수 있다.
2. 방향
   - Granite showcase에서 검증된 Lottie 데이터를 실제 `.lottie.json` asset 파일로 템플릿 패키지에 둔다.
   - generated frontend starter page는 그 asset 파일을 import해서 `Lottie.AnimationObject`에 넘긴다.
   - 재현 repo인 `discount-board`도 같은 방식으로 asset 파일을 두고 starter page를 맞춘다.
3. 테스트
   - frontend patch 테스트가 starter page에 JSON asset import가 들어가는지 검증한다.
   - patch 뒤에 `frontend/src/assets/miniapp-starter-hero.lottie.json`이 생성되는지도 함께 검증한다.
4. 완료 기준
   - generated starter page는 인라인 Lottie object 없이 실제 asset 파일을 쓴다.
   - generator repo와 재현 repo 둘 다 verify가 통과한다.

## 다음 작업: generated root Biome에서 `frontend/.granite/**`를 제외하기
1. 문제
   - generated repo의 root `verify`가 `frontend/.granite/**` 산출물까지 format/lint 대상으로 잡고 있다.
   - 이 디렉터리는 Granite가 만드는 build/runtime artifact라서 사용자가 직접 관리하는 소스가 아니고, root Biome 규칙을 그대로 적용하면 unrelated lint가 verify를 깨뜨린다.
2. 방향
   - generated root `biome.json` 템플릿 4종에 `!!frontend/.granite` ignore를 추가한다.
   - template test도 generated `biome.json`에 이 ignore가 들어가는지 먼저 고정한다.
   - 실제 재현 repo에서도 같은 ignore를 넣고 `pnpm verify`를 다시 돌려 남는 실패가 artifact 때문이 아닌지 확인한다.
3. 테스트
   - template test가 `!!frontend/.granite`를 기대하도록 추가한다.
   - `pnpm verify`로 generator repo를 다시 검증한다.
4. 완료 기준
   - generated repo의 root Biome는 `frontend/.granite`를 검사하지 않는다.
   - 재현 repo에서도 root `verify`가 Granite artifact lint 때문에 막히지 않는다.

## 다음 작업: Granite 기본 `_404.tsx`도 frontend starter patch 범위에 포함하기
1. 문제
   - root Biome는 `react-native`의 `Text`를 막는데, Granite 공식 scaffold가 만드는 `frontend/pages/_404.tsx`는 여전히 `Text`를 직접 import한다.
   - `patchFrontendWorkspace`는 지금 `src/pages/index.tsx`, `src/pages/about.tsx`만 교체해서 `_404.tsx`는 root Biome 전에 그대로 남는다.
2. 방향
   - Granite 공식 `_404.tsx` source를 감지하는 matcher를 추가한다.
   - official default source일 때만 TDS `Txt` 기반 not-found page로 교체한다.
   - root Biome 순서는 그대로 두고, patch 대상만 넓혀서 문제를 닫는다.
3. 테스트
   - frontend patch 테스트에 공식 `_404.tsx` fixture를 추가한다.
   - patch 뒤에 `Text` import가 사라지고 `Txt` import가 들어가는지 검증한다.
4. 완료 기준
   - generated repo는 create 직후 `_404.tsx` 때문에 root Biome이 깨지지 않는다.
   - `pnpm verify` 통과

## 다음 작업: frontend starter page를 TDS와 Granite Lottie로 보기 좋게 다듬기
1. 문제
   - 지금 starter page는 정책 위반을 피하는 최소 텍스트 안내만 있고, 생성 직후 화면으로는 너무 밋밋하다.
   - 사용자는 생성 직후부터 AppInToss + TDS 기준이 반영된 starter 화면을 보는 편이 이해하기 쉽다.
2. 방향
   - Granite starter page 교체본에 TDS `Txt`와 TDS `Button`을 넣는다.
   - Granite Lottie를 써서 간단한 hero animation을 함께 보여준다.
   - 안내 문구는 `docs/product`, `AGENTS.md`, `docs/engineering`을 먼저 보라는 흐름으로 맞춘다.
3. 테스트
   - starter page patch 테스트가 `Txt`, `Button`, `Lottie.AnimationObject`가 들어가는지 확인한다.
4. 완료 기준
   - generated starter page는 생성 직후부터 lint 규칙을 지키면서도 안내 화면으로 충분히 읽을 만하다.
   - `pnpm verify` 통과

## 다음 작업: `react-native` `Text`를 금지하고 starter page를 TDS `Txt`로 맞추기
1. 문제
   - generated frontend lint는 `react-native` 기본 UI 직접 import를 막고 있지만, 아직 `Text`는 금지 목록에 없다.
   - 그런데 starter page는 여전히 `react-native`의 `Text`를 쓰고 있어서, `Text`를 금지하려면 starter page도 같이 바꿔야 생성 직후 verify가 깨지지 않는다.
2. 방향
   - generated root `biome.json`의 `noRestrictedImports`에 `react-native` `Text`를 추가한다.
   - 관련 에러 메시지는 `Text` 대신 TDS `Txt`를 쓰라고 바로 안내한다.
   - Granite 공식 starter page를 교체하는 patch도 `Txt` 기준으로 맞춘다.
3. 테스트
   - generated `biome.json` test가 `Text` 금지와 `Txt` 안내 문구를 기대하도록 먼저 고친다.
   - starter page patch 테스트가 `Text` import가 사라지고 `Txt` import가 들어가는지 검증한다.
4. 완료 기준
   - generated repo는 `react-native` `Text`를 lint에서 막는다.
   - starter page는 create 직후부터 TDS `Txt`를 사용한다.
   - `pnpm verify` 통과

## 다음 작업: Granite starter page를 frontend 정책에 맞게 조건부 교체하기
1. 문제
   - 공식 Granite scaffold가 만드는 기본 `frontend/src/pages/index.tsx`, `frontend/src/pages/about.tsx`가 `TouchableOpacity`를 사용한다.
   - generated repo는 create 직후 root Biome 금지 룰을 적용하므로, 사용자가 아무 것도 바꾸지 않아도 `biome check`가 깨질 수 있다.
2. 방향
   - `patchFrontendWorkspace`에서 Granite 공식 starter page로 보이는 파일만 감지해서 우리 기준의 안전한 starter page로 교체한다.
   - `TouchableOpacity` 없는 최소 route 예시로 바꾸고, 사용자가 이미 수정한 페이지는 덮어쓰지 않도록 공식 starter 문구가 있을 때만 적용한다.
3. 테스트
   - frontend patch 테스트에 Granite 공식 starter source를 재현해서, patch 뒤에 `TouchableOpacity`가 사라지고 새 starter 문구가 들어가는지 검증한다.
4. 완료 기준
   - create 직후 generated frontend는 Biome 금지 import를 스스로 어기지 않는다.
   - `pnpm verify` 통과

## 다음 작업: generated Biome restricted import glob을 Biome 2 문법으로 고치기
1. 문제
   - generated `biome.json`의 `noRestrictedImports.patterns.group`에 `react-native-**`처럼 잘못된 glob이 들어가 있다.
   - Biome 2는 이 패턴을 deserialize 단계에서 거부해서, 스캐폴딩 직후 root `biome check`가 실패할 수 있다.
2. 방향
   - Biome 공식 `noRestrictedImports` 예시처럼 package name 패턴은 `@scope/*`, `react-native-*` 형태로 맞춘다.
   - root template 4종 `biome.json`과 관련 template test를 같이 수정한다.
3. 테스트
   - generated `biome.json` test가 `react-native-*`, `@react-navigation/*`, `@react-native-community/*`를 기대하도록 고친다.
   - `pnpm verify`로 root와 template 전체를 다시 검증한다.
4. 완료 기준
   - generated repo의 Biome config가 deserialize 오류 없이 통과한다.
   - `pnpm verify` 통과

## 다음 작업: Biome 금지 import 에러 메시지를 원천 engineering docs로 연결
1. 문제
   - generated repo의 Biome 금지 import 에러는 금지 이유는 알려주지만, 어떤 engineering 문서를 보면 되는지 바로 연결되지 않는다.
   - AGENTS와 docs index에 문서가 인덱싱돼 있어도, lint 에러에서 바로 그 문서 경로를 보지 못하면 수정 속도가 떨어진다.
2. 방향
   - generated root `biome.json`의 `noRestrictedImports` 메시지에 각 규칙의 원천 문서 경로를 함께 넣는다.
   - native module / AsyncStorage 규칙은 `docs/engineering/native-modules-policy.md`로, RN 기본 UI/TDS 규칙은 `docs/engineering/tds-react-native-index.md`와 `docs/engineering/native-modules-policy.md`로 안내한다.
   - 관련 template test를 먼저 고쳐 message drift를 막는다.
3. 테스트
   - generated `biome.json` template test가 각 메시지에 대응 문서 경로가 포함되는지 검증한다.
4. 완료 기준
   - generated repo의 Biome 에러 메시지만 보고도 어떤 engineering 문서를 열어야 하는지 바로 알 수 있다.

## 작업명
`create-miniapp` 오케스트레이션 CLI 구현

## 다음 작업: TDS lint 범위와 Granite `:$param` 허용 기준 맞추기
1. 문제
   - 지금 generated lint는 RN 기본 primitive 일부만 막고 있어서 TDS 인덱스 문서 대비 범위가 왜 이 정도인지 설명이 약하다.
   - Granite SSoT와 route checker 문구는 `$param`만 금지하면 되는데도 `고정 path만`처럼 읽혀 `:bookId` path params 허용 기준과 어긋난다.
2. 방향
   - Granite SSoT와 route checker 안내 문구를 `$param` 금지 기준으로 좁히고, `:param` route params는 허용 예시로 정리한다.
   - RN 기본 primitive 중 TDS 대체제가 명확한 `ActivityIndicator`, `Alert`까지 `noRestrictedImports`에 추가한다.
   - native modules policy 문서에 현재 lint 범위가 “TDS 전체 금지”가 아니라 “직접 쓰면 안 되는 RN 기본 primitive + 네이티브 모듈”이라는 점을 명시한다.
3. 테스트
   - generated `biome.json`에 `ActivityIndicator`, `Alert`가 포함되는지 template test를 보강한다.
   - Granite SSoT 문서와 route checker 메시지가 `:$param` 허용 예시를 가지는지 확인한다.
4. 완료 기준
   - `$param` 금지와 `:param` 허용 기준이 문서/메시지에 일관되게 반영된다.
   - TDS 대응이 명확한 RN primitive 금지 범위가 lint에 추가된다.

## 다음 작업: Biome 2로 올리고 frontend 정책을 lint/verify로 재배치
1. 문제
   - 지금 generated repo는 Biome 1.9.4 기준이라 `react-native` named import 금지 같은 세밀한 import restriction을 lint로 옮기기 어렵다.
   - native module / AsyncStorage 금지는 custom verify에 몰려 있는데, 이건 lint가 더 자연스러운 영역이고 `$param` 라우트 금지와 성격이 다르다.
   - Biome 2 마이그레이션 시 package별 `biome.json`이 필요한지부터 공식 문서 기준으로 정리해야 한다.
2. 방향
   - 공식 문서 기준으로 Biome 2는 루트 config 하나로 계속 운용하고, package별 override가 필요할 때만 nested `biome.json`을 추가한다.
   - repo root와 generated root template의 `@biomejs/biome`를 최신 stable `2.4.7`로 올린다.
   - root `biome.json` 스키마를 v2로 올리고, generated `biome.json`도 같은 기준으로 맞춘다.
   - native module / AsyncStorage 금지는 Biome `noRestrictedImports`로 이동한다.
   - `frontend:policy:check`는 Granite `$param` 라우트 금지 전용 custom verify로 줄인다.
3. 테스트
   - generated `biome.json`이 Biome 2 스키마와 `noRestrictedImports` 규칙을 가지는 실패 테스트를 먼저 추가한다.
   - generated route checker가 `$param` 파일/경로를 막고 고정 경로는 통과시키는 실패 테스트를 먼저 추가한다.
   - root package와 generated root package의 Biome 버전이 같이 올라가는지 검증한다.
4. 완료 기준
   - generated repo에서 native module / AsyncStorage 금지는 lint가 맡고, `$param` 라우트 금지만 verify가 맡는다.
   - package별 `biome.json` 없이도 root config 하나로 `pnpm verify`가 통과한다.

## 다음 작업: 인덱싱된 문서 기준으로 verify 후보 규칙을 추리기
1. 문제
   - 지금 generated repo에는 AGENTS와 engineering docs로 여러 구현 규칙이 인덱싱돼 있지만, 어떤 규칙은 문서에만 머물고 있다.
   - agent나 개발자가 자주 어기는 규칙 중 일부는 verify에서 자동으로 막을 수 있는데, 아직 후보 정리가 안 되어 있다.
2. 방향
   - base/optional docs index와 AGENTS에 연결된 engineering 문서를 훑는다.
   - import 패턴, forbidden dependency, 금지 컴포넌트 사용처럼 정적 검사로 막을 수 있는 규칙을 먼저 추린다.
   - TDS, native modules, storage, tRPC SSOT처럼 verify 친화적인 것과 문서/리뷰로만 다뤄야 하는 것을 구분한다.
3. 결과물
   - verify로 바로 막을 수 있는 후보 목록
   - 구현 난이도와 오탐 가능성
   - 우선순위 제안

## 다음 작업: 누락된 Cloudflare env fix의 버전 PR 생성
1. 문제
   - Cloudflare server env fix가 `main`에 changeset 없이 머지됐다.
   - release 기준으로는 두 패키지 버전 반영 PR이 한 번 더 필요하다.
2. 방향
   - 최신 `origin/main`을 기준으로 새 브랜치를 딴다.
   - 누락된 patch changeset을 추가한 뒤 `changeset version`을 실행한다.
   - 버전 변경 결과와 changelog 갱신을 포함한 PR을 따로 올린다.
3. 테스트
   - `changeset version` 결과가 두 패키지에 반영되는지 확인한다.
   - `pnpm verify`를 다시 통과시킨다.
4. 완료 기준
   - `create-rn-miniapp`, `@create-rn-miniapp/scaffold-templates` 둘 다 patch 버전이 올라간 PR이 열린다.
   - `pnpm verify` 통과

## 다음 작업: Cloudflare server env에서 공개 Worker URL을 제거
1. 문제
   - 지금 Cloudflare provisioning은 `server/.env.local`에 `CLOUDFLARE_API_BASE_URL=https://<worker>.workers.dev`를 기록한다.
   - 이 이름은 Wrangler가 Cloudflare 관리 API override로도 해석해서, 배포 요청이 `api.cloudflare.com` 대신 공개 Worker URL로 잘못 향할 수 있다.
   - 공개 Worker URL은 app client가 쓰는 값이지, server deploy 메타데이터로는 적절하지 않다.
2. 방향
   - `frontend/.env.local`의 `MINIAPP_API_BASE_URL`, `backoffice/.env.local`의 `VITE_API_BASE_URL`은 그대로 유지한다.
   - `server/.env.local`에서는 `CLOUDFLARE_API_BASE_URL`를 제거하고, 배포 메타데이터만 남긴다.
   - 기존 잘못 생성된 `CLOUDFLARE_API_BASE_URL=` 줄도 다음 provisioning/overwrite 시 자동으로 제거한다.
   - README와 provisioning note도 server env 설명을 새 기준으로 고친다.
3. 테스트
   - `writeCloudflareServerLocalEnvFile` 테스트에서 `CLOUDFLARE_API_BASE_URL`가 더 이상 생성되지 않는지 검증한다.
   - 기존 env에 `CLOUDFLARE_API_BASE_URL`가 있어도 다음 write에서 제거되는지 검증한다.
   - finalize/provision note 테스트와 README 설명도 새 메타데이터 목록 기준으로 맞춘다.
4. 완료 기준
   - 공개 Worker URL은 frontend/backoffice env에만 기록된다.
   - `server/.env.local`은 Wrangler deploy용 메타데이터만 가진다.
   - `pnpm verify` 통과

## 다음 작업: tRPC overlay를 `packages/contracts` + `packages/app-router`로 재구성
1. 문제
   - 기존 `packages/trpc` 하나에 boundary schema, router, `AppRouter` 타입을 같이 두면 shared runtime code와 server-oriented code의 책임이 흐려진다.
   - generated README, provider engineering docs, optional tRPC guide도 모두 옛 구조를 기준으로 설명하고 있어서 생성 결과물의 mental model이 어긋난다.
2. 방향
   - tRPC를 고른 경우에만 `packages/contracts`와 `packages/app-router`를 함께 만든다.
   - `packages/contracts`는 Zod schema와 `z.infer` 기반 boundary type의 source of truth로 둔다.
   - `packages/app-router`는 tRPC router와 `AppRouter` 타입의 source of truth로 둔다.
   - frontend, backoffice, provider server README, optional engineering docs, AGENTS 링크가 모두 같은 구조를 설명하게 맞춘다.
3. 테스트
   - template test, patching test, workspace inspector test를 새 구조 기준으로 먼저 고친다.
   - README와 provider engineering docs의 `packages/trpc` 설명을 모두 교체한다.
   - 마지막에 `pnpm verify`를 통과시킨다.
4. 완료 기준
   - generated repo는 `packages/contracts`, `packages/app-router`를 기준으로 tRPC mental model을 설명한다.
   - `pnpm verify` 통과

## 다음 작업: tRPC를 만든 경우에만 AGENTS Golden Rule에 schema-derived boundary type 규칙 추가
1. 문제
   - 지금 generated `AGENTS.md`는 tRPC가 있는 repo와 없는 repo의 Golden Rules가 같다.
   - `packages/trpc`를 만든 경우에는 client-server 경계 타입을 schema에서만 파생한다는 규칙을 바로 보여주는 게 맞지만, base template에 고정으로 넣으면 non-tRPC repo에도 불필요한 규칙이 남는다.
2. 방향
   - base `AGENTS.md`에 optional Golden Rule marker를 둔다.
   - `syncOptionalDocsTemplates()`가 `hasTrpc`일 때만 `8. Boundary types from schema only: ...` 규칙을 넣는다.
   - tRPC를 만들지 않은 repo에는 이 규칙이 전혀 생기지 않게 한다.
3. 테스트
   - base docs copy 후에는 Golden Rule 8이 없는지 검증한다.
   - optional docs sync에서 `hasTrpc: false`면 여전히 없는지 검증한다.
   - `hasTrpc: true`면 Golden Rule 8이 들어가는지 검증한다.
4. 완료 기준
   - tRPC repo에서만 AGENTS Golden Rule 8이 보인다.
   - `pnpm verify` 통과

## 다음 작업: tRPC frontend tsconfig 조합을 TypeScript 제약에 맞게 보정
1. 문제
   - `allowImportingTsExtensions`만 켜면 TypeScript가 바로 통과하지 않는다.
   - 공식 제약상 같은 tsconfig에 `moduleResolution: "bundler"`와 `noEmit: true` 또는 `emitDeclarationOnly: true`가 함께 필요하다.
   - 현재 generated `frontend/tsconfig.json`에는 이 조합이 완전히 들어가지 않아, tRPC를 켠 생성물에서 TS 에러가 난다.
2. 방향
   - tRPC를 고른 `frontend` workspace에는 `allowImportingTsExtensions`, `moduleResolution: "bundler"`, `noEmit: true`를 같이 넣는다.
   - 이 보정은 `supabase` / `cloudflare` + tRPC일 때만 적용한다.
3. 테스트
   - `patchTsconfigModuleSource` 테스트에서 세 옵션이 함께 들어가는지 검증한다.
   - `patchFrontendWorkspace`의 `supabase` / `cloudflare` + tRPC 테스트에서 generated `tsconfig.json`이 세 옵션을 모두 가지는지 검증한다.
4. 완료 기준
   - tRPC를 켠 frontend 생성물은 TypeScript 제약을 만족하는 tsconfig 조합을 가진다.
   - `pnpm verify` 통과

## 다음 작업: tRPC overlay가 필요한 frontend / Cloudflare test config를 같이 생성
1. 문제
   - `packages/trpc`는 source export(`src/index.ts`)와 `.ts` 확장자 import를 쓰는데, generated `frontend/tsconfig.json`은 `allowImportingTsExtensions`를 켜지 않아 Granite frontend typecheck가 깨질 수 있다.
   - Cloudflare는 deploy용 `wrangler.jsonc`에 D1/R2 binding을 `remote: true`로 기록하는데, Worker 테스트도 같은 config를 보면 local test가 원격 리소스를 바라봐 timeout/502가 날 수 있다.
   - 현재 tRPC overlay는 router/client wiring까지만 해 주고, 이 두 보조 설정은 사용자가 직접 메워야 한다.
2. 방향
   - tRPC overlay를 고른 `frontend` workspace에는 `allowImportingTsExtensions`를 자동으로 넣는다.
   - 특히 Granite frontend가 `@workspace/trpc` source export를 바로 읽는 `supabase` / `cloudflare` 경로를 우선 보정한다.
   - Cloudflare + tRPC server에는 deploy config와 분리된 `wrangler.vitest.jsonc`, `vitest.config.mts`, 샘플 test를 생성해서 local D1/R2 binding으로 Worker 테스트가 돌게 한다.
   - `server/package.json`의 test 스크립트도 generated Vitest config를 쓰도록 맞춘다.
   - Supabase는 Deno alias 기반 구조에서 추가로 깨질 지점이 있는지 테스트로 먼저 점검하고, 별도 설정이 필요 없으면 문서화만 한다.
3. 테스트
   - `patchFrontendWorkspace` 테스트에서 `supabase` / `cloudflare` + `trpc`일 때 `tsconfig.json`에 `allowImportingTsExtensions`가 들어가는지 검증한다.
   - `patchCloudflareServerWorkspace` 테스트에서 `wrangler.vitest.jsonc`, `vitest.config.mts`, example test와 local binding 설정이 생성되는지 검증한다.
   - Supabase tRPC patch 테스트는 현재 생성물만으로 필요한 alias/config가 닫혀 있는지 검증한다.
4. 완료 기준
   - tRPC overlay 생성물은 frontend typecheck를 위해 추가 수작업이 필요 없다.
   - Cloudflare Worker 테스트는 deploy binding과 분리된 local config를 기본 제공한다.
   - `pnpm verify` 통과

## 다음 작업: root workspace manifest의 `packages/trpc`를 `packages/*`로 일반화
1. 문제
   - 지금 generated root workspace manifest는 optional package workspace가 생기면 `packages/trpc`를 그대로 등록한다.
   - 이 표현은 현재 구조엔 맞지만, 앞으로 `packages/*` 아래에 다른 shared package가 생겨도 root manifest를 다시 바꿔야 해서 확장성이 떨어진다.
2. 방향
   - 내부 source of truth 경로는 계속 `packages/trpc`로 유지한다.
   - 다만 root `pnpm-workspace.yaml`과 `package.json.workspaces`에는 `packages/*`를 등록한다.
   - 즉 실제 생성/감지 로직은 `packages/trpc`를 보되, manifest에 쓸 때만 `packages/*`로 normalize 한다.
3. 테스트
   - root workspace manifest 테스트에서 `packages/trpc`를 넘겨도 최종 manifest는 `packages/*`를 쓰는지 검증한다.
   - pnpm, yarn/npm/bun 공통 기대값을 함께 갱신한다.
4. 완료 기준
   - generated root manifest는 optional package workspace가 있으면 `packages/*`를 쓴다.
   - `pnpm verify` 통과

## 다음 작업: Cloudflare + tRPC일 때 `api.ts`는 만들지 않고 `--add`에서는 삭제 여부를 고르게
1. 문제
   - 지금 Cloudflare에 tRPC overlay를 켜도 `frontend/src/lib/api.ts`, `backoffice/src/lib/api.ts`가 그대로 남는다.
   - 이 상태에선 generated repo에 `api.ts`와 `trpc.ts`가 같이 있어서 어떤 client를 써야 하는지 애매하다.
   - 특히 `--add --trpc`로 기존 Cloudflare workspace에 overlay만 붙일 때는 이미 만들어진 `api.ts`를 우리가 알아서 지울지, 사용자가 유지할지 선택할 수 있어야 한다.
2. 방향
   - create 경로에서 Cloudflare + tRPC를 고르면 `api.ts`를 새로 만들지 않는다.
   - Cloudflare용 `trpc.ts`는 더 이상 `./api`를 import하지 않고, 각 workspace env를 직접 읽어 URL을 만든다.
   - `--add --trpc`에서 기존 provider가 Cloudflare이고 기존 `api.ts`가 있으면, 지워둘지 직접 남길지 select prompt로 고른다.
   - `--yes`에서는 비파괴가 기본이라 기존 `api.ts`를 유지한다.
   - README도 Cloudflare + tRPC일 때는 `api.ts`가 아니라 `trpc.ts`가 기본 client라는 점만 보여준다.
3. 테스트
   - `resolveAddCliOptions` 테스트에서 기존 Cloudflare repo + `api.ts` 존재 시 삭제 여부를 묻는지 검증한다.
   - Cloudflare frontend/backoffice patch 테스트에서 tRPC일 때 `api.ts`가 생성되지 않는지 검증한다.
   - 기존 `api.ts`가 있는 상태에서 제거 옵션을 주면 실제로 삭제되는지도 검증한다.
4. 완료 기준
   - Cloudflare + tRPC 생성물에는 `api.ts`가 기본 생성되지 않는다.
   - `--add --trpc`는 기존 `api.ts`가 있을 때만 삭제 여부를 고를 수 있다.
   - `pnpm verify` 통과

## 다음 작업: tRPC일 때만 AGENTS / server README에 API SSOT 추가
1. 문제
   - 현재 tRPC 관련 설명은 provider README나 shared workspace README에는 있지만, root `AGENTS.md`와 generated `server/README.md`에 “server API의 source of truth가 `packages/trpc`다”라는 신호가 항상 일관되게 드러나지 않는다.
   - 이 문구를 base template에 고정으로 넣으면 tRPC를 만들지 않은 repo에도 불필요한 설명이 남는다.
2. 방향
   - `AGENTS.md`에는 optional docs 주입 경로를 이용해서, tRPC를 만들었을 때만 `docs/engineering/server-api-ssot-trpc.md` 링크를 추가한다.
   - generated `server/README.md`도 provider plain mode에는 넣지 않고, tRPC가 켜졌을 때만 `## API SSOT` 섹션을 렌더링한다.
   - 즉 base template에 고정하지 않고 create/add 옵션 결과에 따라 동적으로 생성한다.
3. 테스트
   - optional docs sync 테스트에서 `hasTrpc`가 true일 때만 AGENTS/index와 engineering doc이 생기는지 검증한다.
   - Supabase/Cloudflare server README 테스트에서 tRPC일 때만 `API SSOT` 문구가 생기는지 검증한다.
4. 완료 기준
   - tRPC를 만들지 않은 repo에는 API SSOT 문구가 없다.
   - tRPC를 만든 repo에는 AGENTS와 server README에서 `packages/trpc`가 server API의 source of truth라는 점이 분명히 보인다.

## 다음 작업: Supabase tRPC를 sync 없이 `deno.json` alias로 연결
1. 문제
   - 현재 Supabase tRPC overlay는 `server/scripts/trpc-sync.mjs`로 `packages/trpc`를 `server/supabase/functions/_shared/trpc`에 mirror하는 구조다.
   - 이 방식은 안전하지만, Cloudflare와 mental model이 달라지고 사용자가 `packages/trpc`를 수정한 뒤 왜 sync를 거쳐야 하는지 이해하기 어렵다.
   - `packages/trpc`를 canonical source of truth로 둔다는 메시지와 실제 runtime 연결 방식이 어긋난다.
2. 기준
   - `packages/trpc`는 계속 canonical source of truth로 유지한다.
   - Supabase Edge Functions runtime도 `_shared` mirror 대신 `@workspace/trpc`를 직접 보게 만든다.
   - 단, Deno runtime이라 npm workspace resolution을 그대로 기대하지 않고 function-local `deno.json`의 `imports`로 alias를 명시한다.
   - `@workspace/trpc`뿐 아니라 shared package 내부에서 쓰는 `@trpc/server`, `zod`도 Deno에서 풀 수 있게 `npm:` mapping을 같이 둔다.
3. 방향
   - `server/supabase/functions/api/deno.json`를 생성한다.
   - `imports`에는 아래를 넣는다.
     - `@workspace/trpc`: `../../../../packages/trpc/src/index.ts`
     - `@trpc/server`: `npm:@trpc/server@^11.13.4`
     - `zod`: `npm:zod@^4.3.6`
   - `server/supabase/functions/api/index.ts`는 `_shared/trpc` 대신 `@workspace/trpc`를 직접 import 한다.
   - `server/scripts/trpc-sync.mjs`는 더 이상 생성하지 않는다.
   - `functions:serve`, `functions:deploy`도 sync prefix 없이 원래 명령만 유지한다.
   - `README`와 provider engineering docs에서도 `_shared` / `trpc:sync` 설명을 제거하고, function-local `deno.json` alias 설명으로 바꾼다.
4. 테스트
   - Supabase tRPC patch 테스트는 `trpc:sync`가 없고 `functions/api/deno.json`이 생기는지 검증한다.
   - handler source가 `@workspace/trpc`를 직접 import 하는지 검증한다.
   - README / docs 기대값도 `deno.json` alias 설명 기준으로 갱신한다.
5. 완료 기준
   - Supabase tRPC overlay는 `packages/trpc` 수정이 별도 sync 없이 바로 source of truth가 된다.
   - Supabase generated repo에는 `_shared/trpc`와 `trpc:sync`가 더 이상 없다.
   - `pnpm verify` 통과

## 다음 작업: Supabase / Cloudflare 선택 시 optional tRPC overlay 추가
1. 문제
   - 지금 `server` provider는 `supabase`, `cloudflare`, `firebase` 중 하나를 고르면 provider별 기본 연결만 만들어 준다.
   - `supabase`는 `frontend/src/lib/supabase.ts`, `cloudflare`는 `frontend/src/lib/api.ts`처럼 provider별 기본 client만 있고, 타입 안전한 API layer를 선택적으로 얹는 경로는 없다.
   - 사용자는 `create-t3-app`의 tRPC처럼 provider를 고른 뒤 `tRPC도 같이 이어줄지` 결정하고 싶어 한다.
   - 특히 `frontend` / `backoffice`가 `../../server/...` 같은 상대 경로로 server router 타입을 직접 참조하는 구조는 원하지 않는다. 그 방식은 tsconfig와 번들러 설정까지 끌고 와서 generated repo 사용성이 급격히 나빠진다.
2. 기준
   - 범위는 1차에 `supabase`, `cloudflare`만 포함한다.
   - `firebase`는 기본 SDK 중심 provider라 1차 tRPC overlay 대상에서 제외한다.
   - 구현 방식은 `create-t3-app`처럼 “옵션 installer/overlay”로 보고, provider 기본 scaffold 위에 추가 파일과 의존성을 얹는다.
   - 타입 공유는 `server` 직접 참조가 아니라, tRPC를 켠 경우에만 생기는 별도 workspace package로 해결한다.
   - 조사 기준은 `create-t3-app` 단일 앱 구조, `create-t3-turbo` 모노레포 구조, tRPC 공식 docs를 함께 본다.
3. 방향
   - CLI
     - `serverProvider`가 `supabase` 또는 `cloudflare`일 때만 `tRPC도 같이 이어줄까요?`를 묻는다.
     - non-interactive 경로도 필요하므로 `--trpc` 같은 명시 옵션을 추가한다.
     - `--yes`일 때는 기본값을 `false`로 두고, `--trpc`를 줬을 때만 켠다.
   - 옵션 모델
     - `server provider`와 별개로 `server API overlay` 개념을 추가한다.
     - 1차 값은 `none | trpc` 정도로 단순하게 두고, provider adapter에 `supportsTrpc` 또는 `apiOverlays` 메타데이터를 둔다.
     - `add` 모드에서도 기존 provider가 `supabase`/`cloudflare`면 tRPC overlay만 추가할 수 있게 한다.
   - 공통 타입 / router source of truth
     - tRPC를 선택하면 root에 optional workspace `packages/trpc`를 만든다.
     - 이름을 `packages/api`가 아니라 `packages/trpc`로 두는 이유는, 우리 generated repo에는 이미 provider별 `server` workspace가 있고 `api`라는 이름이 너무 넓기 때문이다.
     - `create-t3-turbo`는 `packages/api`를 쓰지만, 우리는 “provider 위에 얹는 optional tRPC overlay”라는 의미가 더 분명해야 해서 `packages/trpc`가 맞다.
     - 이 workspace가 tRPC router, procedure, validator, `AppRouter` type의 source of truth가 된다.
     - `frontend` / `backoffice`는 `../../server/...`를 보지 않고, 오직 `@workspace/trpc` 같은 workspace package 이름만 import 한다.
     - 이 package는 generated app에서만 생기고, tRPC를 선택하지 않으면 만들지 않는다.
   - frontend / backoffice 타입 공유 방식
     - `frontend` / `backoffice`는 runtime 코드를 shared package에서 직접 가져오지 않고, 기본적으로 `import type { AppRouter } from '@workspace/trpc'`만 사용한다.
     - 각 workspace의 `src/lib/trpc.ts`는 자기 환경에 맞는 client factory를 로컬에 두고, shared package에서는 router type만 받아 inference에 쓴다.
     - 이렇게 하면 Metro/Vite가 shared package 런타임 코드를 번들링하는 부담을 줄이고, client 쪽 tsconfig path alias도 별도로 강요하지 않을 수 있다.
     - import 문자열은 실제 구현에서 `@workspace/trpc`로 맞춘다.
     - `create-t3-turbo` README도 Expo 같은 다른 앱은 shared API package를 devDependency로만 두고 타입만 가져가는 패턴을 권장한다.
   - workspace 연결 방식
   - `packages/trpc`는 실제 workspace package로 등록한다.
   - `frontend`, `backoffice`, `server`는 상대 경로 대신 workspace dependency로만 이 package를 본다.
   - 즉 tRPC overlay가 켜진 경우에만 root workspace manifest와 Nx project graph에 `packages/trpc`가 추가된다.
   - client workspace는 `@workspace/trpc`를 devDependency로만 두고 `import type`만 쓴다.
    - Cloudflare server는 `@workspace/trpc`를 runtime dependency로 직접 가져간다.
    - 이 분리는 `create-t3-turbo`의 `api` package 원칙을 거의 그대로 따르되, package 이름만 우리 문맥에 맞게 바꾼 것이다.
    - 서버 생성물
     - `packages/trpc`
     - 샘플 router 파일명은 바뀔 수 있으니, canonical entrypoint는 `src/index.ts`, `src/root.ts`처럼 안정적인 엔트리 기준으로 둔다.
       - 여기에는 provider-specific handler가 아니라 runtime-neutral router 정의와 `AppRouter` export만 둔다.
       - 내부 import는 tsconfig path alias를 쓰지 않고 package 내부 상대 경로만 쓴다.
       - `AppRouter`가 client 쪽에서 `any`로 무너지는 문제를 피하려고 `composite: true`, declaration emit, portable export를 기본값으로 둔다.
     - `cloudflare`
       - `server/src/trpc/context.ts`와 `server/src/index.ts`만 provider-specific entry로 둔다.
       - Worker fetch handler는 `packages/trpc`의 router를 직접 받아 `fetchRequestHandler`에 연결한다.
       - Cloudflare는 Node/Workers 번들러가 workspace package import를 처리할 수 있으니, 별도 mirror/sync는 두지 않는다.
     - `supabase`
       - tRPC 공식 `fetch` adapter는 Cloudflare Worker와 Deno를 둘 다 지원하므로, handler 패턴 자체는 Cloudflare와 크게 다르지 않다.
       - 다만 Supabase Edge Functions는 Deno runtime이라 npm workspace resolution을 그대로 기대하지 않는다.
       - 그래서 `server/supabase/functions/api/deno.json`의 `imports`로 `@workspace/trpc`를 `../../../../packages/trpc/src/index.ts`에 alias한다.
       - shared package 내부 의존성도 Deno가 풀 수 있게 `@trpc/server`, `zod`를 `npm:` specifier로 함께 매핑한다.
       - `functions/api/index.ts`는 `_shared` mirror 없이 `@workspace/trpc`를 직접 import 한다.
     - 공통 원칙
       - canonical router/type은 `packages/trpc`
       - runtime handler entry는 provider-specific
       - client bootstrap은 workspace-specific
       - relative import로 server를 직접 참조하는 구조는 만들지 않는다.
   - frontend / backoffice runtime bootstrap
   - `cloudflare`
       - 기존 `src/lib/api.ts` 대신 `src/lib/trpc.ts`와 필요하면 `src/lib/trpc-provider.tsx`를 추가한다.
       - base URL은 현재 `MINIAPP_API_BASE_URL`, `VITE_API_BASE_URL`을 그대로 쓴다.
     - `supabase`
       - 기존 `src/lib/supabase.ts`는 유지한다. auth/storage/client DB에 여전히 필요하다.
       - 그 위에 Edge Function endpoint를 치는 `src/lib/trpc.ts`를 추가한다.
       - Supabase Edge Functions는 `apikey` / `Authorization` header 처리가 필요하므로, tRPC client link에서 기존 Supabase config와 세션을 읽어 헤더를 붙이는 방식을 먼저 설계한다.
   - tsconfig / tooling 원칙
     - `frontend` / `backoffice` / `server`에 `paths`로 `../../server/...`를 억지로 매핑하지 않는다.
     - workspace package import가 되게 root workspace manifest만 갱신하고, 개별 workspace tsconfig는 가능한 한 건드리지 않는다.
   - `packages/trpc`는 typecheck 가능하도록 자기 `package.json`, `tsconfig.json`, `project.json`을 가진다.
   - Cloudflare runtime direct import를 위해 `package.json`의 `files`는 `src`를 포함하고, `exports` / `types`도 `src/index.ts`를 가리킨다.
     - `packages/trpc` 안에서는 alias import를 쓰지 않는다. community 사례를 보면 이런 alias가 `AppRouter`를 client에서 `any`로 무너뜨릴 가능성이 있다.
     - 필요하면 `packages/trpc`만 project references / declaration emit을 가진 독립 TS package로 본다.
   - docs / README
     - provider engineering docs에 `plain mode`와 `tRPC overlay mode` 차이를 설명한다.
     - generated `server/README.md`도 provider별로 tRPC가 켜진 경우에만 router 구조와 호출 예시를 추가한다.
     - tRPC overlay를 선택한 경우 `packages/trpc/README.md` 또는 engineering doc에 “왜 server를 직접 참조하지 않고 package를 두는지”를 짧게 설명한다.
4. 테스트
   - CLI
     - `supabase` / `cloudflare` 선택 시에만 tRPC prompt가 뜨는지 검증
     - `firebase`나 `no server`에선 prompt가 없는지 검증
     - `--trpc` without supported provider 조합은 에러 처리 검증
   - patch / template
     - `packages/trpc` workspace 생성, workspace registration, Nx project 등록 검증
     - Cloudflare tRPC server files, client files, shared package deps 생성 검증
     - Supabase tRPC Edge Function files, function-local `deno.json` alias, shared package deps 생성 검증
     - 기존 plain provider 생성물에는 tRPC 파일이 안 생기는지 검증
   - add mode
     - 기존 `cloudflare` / `supabase` workspace에 tRPC overlay만 추가 가능한지 검증
5. 리스크
   - Supabase Edge Functions는 Deno runtime이라 `deno.json` alias가 정확하지 않으면 `packages/trpc`를 runtime에서 직접 참조하지 못한다.
   - Granite/React Native가 workspace package runtime import까지 자연스럽게 먹는지는 별도 확인이 필요하다.
   - 그래서 client는 type-only import, server는 provider별 runtime adapter, Supabase는 `deno.json imports` alias 전략으로 간다.
   - Supabase tRPC client는 anon key/session header를 어떻게 실어 보낼지 먼저 정리해야 한다.
   - `AppRouter` shared package는 내부 alias import나 불완전한 TS 설정이 있으면 client에서 `any`로 무너질 수 있다. 이건 공식 docs보다는 community issue에서 반복적으로 보이는 문제라, 구현 때 예방적으로 피한다.
6. 완료 기준
   - `supabase` / `cloudflare` provider 선택 시 tRPC overlay 여부를 결정할 수 있다.
   - 선택한 경우 `packages/trpc`와 server/frontend/backoffice의 tRPC 구조가 함께 생성된다.
   - `frontend` / `backoffice`는 server 상대 경로 import 없이 `AppRouter` 타입을 사용할 수 있다.
   - plain mode 기존 동작은 유지된다.
   - `pnpm verify` 통과

## 다음 작업: changeset frontmatter 파싱 실패 수정
1. 문제
   - release CI에서 `.changeset/early-pumas-design.md`를 읽는 단계가 `invalid frontmatter`로 실패하고 있다.
   - 원인은 파일이 YAML frontmatter 시작 구분자 `---` 없이 바로 package/version 매핑으로 시작하기 때문이다.
2. 방향
   - 문제가 난 changeset 파일 frontmatter를 정상 형태로 고친다.
   - 같은 실수를 막기 위해 `release.test.ts`에 `.changeset/*.md`가 모두 `---`로 시작하는지 검증하는 회귀 테스트를 추가한다.
3. 완료 기준
   - changesets/action이 해당 파일을 정상 파싱할 수 있다.
   - 로컬 `pnpm verify`가 통과한다.

## 다음 작업: Supabase / Firebase auth guide 이미지를 generated server README에 반영
1. 문제
   - Supabase와 Firebase는 auth 안내 섹션을 추가했지만, 실제 발급 화면 예시는 아직 generated `server/README.md`에 붙지 않는다.
   - 사용자가 찍어 준 스크린샷을 provider별로만 복사하고 렌더하는 경로가 필요하다.
2. 방향
   - `packages/scaffold-templates/optional/server-supabase/assets`, `optional/server-firebase/assets`에 guide 이미지를 넣는다.
   - provider별 patch 단계에서만 해당 asset을 `server/assets/`로 복사하고, generated `server/README.md`에 상대 경로로 붙인다.
   - Supabase는 access token guide 2장, Firebase는 `login:ci` 1장 + service account guide 2장을 별도 소제목 아래 렌더한다.
3. 완료 기준
   - Supabase provider일 때만 Supabase guide 이미지가 `server/README.md`에 보인다.
   - Firebase provider일 때만 Firebase guide 이미지가 `server/README.md`에 보인다.
   - `pnpm verify` 통과

## 다음 작업: Supabase / Firebase auth 안내를 Cloudflare 수준으로 보강
1. 문제
   - 현재 Supabase와 Firebase는 `server/.env.local`과 재배포 경로가 이미 있는데도, note와 generated `server/README.md`에는 어디서 토큰이나 서비스 계정 정보를 발급받는지 설명이 Cloudflare보다 약하다.
   - 특히 Supabase는 `SUPABASE_DB_PASSWORD`만 눈에 띄고, 비대화형 재배포에 쓸 access token 경로가 문서와 env 파일에 드러나지 않는다.
   - Firebase도 `FIREBASE_TOKEN`, `GOOGLE_APPLICATION_CREDENTIALS` 설명은 있지만, 발급 위치와 필요한 역할이 섹션 단위로 정리돼 있지 않아 빠르게 따라가기 어렵다.
2. 방향
   - Supabase는 `server/.env.local`에 `SUPABASE_ACCESS_TOKEN` placeholder를 추가하고, note와 `server/README.md`에 별도 인증 섹션을 만든다.
   - Firebase는 note와 `server/README.md`에 `Firebase deploy auth` 섹션을 만들고 `FIREBASE_TOKEN`, `GOOGLE_APPLICATION_CREDENTIALS`, 발급 위치, 권장 역할을 정리한다.
   - 이미지 삽입은 하지 않고, 나중에 스크린샷을 붙일 수 있게 섹션 구조만 먼저 준비한다.
3. 완료 기준
   - Supabase / Firebase 생성물의 `server/README.md`만 읽어도 비대화형 재배포에 필요한 토큰/서비스 계정 발급 위치와 넣을 위치를 바로 알 수 있다.
   - provisioning note도 같은 내용을 짧게 요약해준다.
   - `pnpm verify` 통과

## 다음 작업: 제공받은 Cloudflare token guide 이미지 반영
1. 문제
   - Cloudflare token guide 이미지를 생성물 `server/README.md`에 노출할 수 있게 패치했지만, 실제 이미지 파일은 아직 template asset 경로에 들어가 있지 않다.
2. 방향
   - 사용자가 전달한 이미지를 `packages/scaffold-templates/optional/server-cloudflare/assets/cloudflare-api-token-guide.png`로 복사한다.
3. 완료 기준
   - template asset 경로에 실제 이미지 파일이 존재하고, 다음 Cloudflare scaffold부터 `server/README.md`에서 그대로 보일 수 있다.

## 다음 작업: Cloudflare token 안내를 note/README 공통 섹션으로 정리
1. 문제
   - 현재 Cloudflare token 안내는 provisioning note와 `server/README.md`에 흩어진 짧은 문장으로만 들어가 있다.
   - 그래서 어디서 토큰을 만들고, 어떤 권한이 필요한지, `server/.env.local` 어디에 넣는지 한 번에 읽기 어렵다.
2. 방향
   - provisioning note 본문에 `Cloudflare API token` 섹션을 따로 만든다.
   - generated `server/README.md`에도 같은 주제의 별도 섹션을 추가한다.
   - Dashboard URL, 공식 문서, 권장 권한, `CLOUDFLARE_API_TOKEN=`에 secret을 붙여 넣는 방법을 함께 적는다.
3. 완료 기준
   - TUI note와 `server/README.md`만 읽어도 토큰 발급 경로, 필요한 권한, 붙여 넣을 위치를 바로 알 수 있다.

## 다음 작업: generated root `tsconfig.base.json` 제거
1. 문제
   - 현재 generated repo 루트에는 `tsconfig.base.json`이 항상 생성되지만, 실제 `frontend` / `backoffice` / `server`는 각 workspace가 자기 tsconfig를 들고 있고 루트 base를 공통 상속하지 않는다.
   - 그런데 루트 템플릿과 README에는 이 파일이 공통 TS 기준처럼 남아 있어서, `NodeNext` 같은 설정이 생성물 전체에 적용되는 것처럼 보인다.
2. 방향
   - `packages/scaffold-templates/root/tsconfig.base.json` 템플릿을 제거한다.
   - root template copy 경로와 `nx.json`의 `sharedGlobals`에서 `tsconfig.base.json` 참조를 제거한다.
   - 관련 README / 템플릿 README 설명과 테스트를 함께 갱신한다.
3. 완료 기준
   - 새 생성물 루트에는 `tsconfig.base.json`이 생기지 않는다.
   - 루트 README와 scaffold-templates README에도 더 이상 이 파일을 공통 생성물로 설명하지 않는다.
   - `pnpm verify`가 통과한다.

## 다음 작업: README Cloudflare 설명을 Worker + D1 + R2 기준으로 정리
1. 문제
   - 현재 README의 Cloudflare 섹션 첫 문장이 `Worker only + TypeScript scaffold`로 남아 있어서, 지금 구현된 D1 / R2 provisioning 범위가 바로 드러나지 않는다.
   - 본문 아래쪽 bullet에는 D1 / R2가 적혀 있어도 첫 인상이 현재 기능보다 축소돼 보인다.
2. 방향
   - Cloudflare 소개 문장을 `Worker + D1 + R2`까지 포함하는 표현으로 바꾼다.
   - provider 섹션 전체 톤은 그대로 두고, 실제 생성/연결 범위와 맞지 않는 표현만 걷어낸다.
3. 완료 기준
   - README만 읽어도 Cloudflare provider가 Worker-only가 아니라 Worker + D1 + R2까지 연결해준다는 점이 바로 보인다.

## 다음 작업: README provider 섹션에 generated `.env.local` 명시
1. 문제
   - 현재 README provider 섹션은 `frontend` / `backoffice`에 어떤 파일이 생기는지 설명하지만, 실제로 같이 써주는 `.env.local`이 목록에서 빠져 있다.
   - 그래서 provider를 고르면 어느 workspace에 env 파일이 같이 생기는지 한눈에 안 들어온다.
2. 방향
   - Supabase, Cloudflare, Firebase 각 섹션의 `frontend` / `backoffice` 목록에 generated `.env.local`을 명시한다.
   - 필요하면 `server` 쪽 `.env.local`과 톤도 같이 맞춘다.
3. 완료 기준
   - README만 봐도 provider별로 어떤 workspace에 `.env.local`이 만들어지는지 바로 알 수 있다.

## 다음 작업: 루트 git 기본 브랜치를 main으로 강제
1. 문제
   - 현재 create 흐름은 루트에서 `git init`만 실행한다.
   - 사용 환경에 따라 기본 브랜치가 `master`로 잡힐 수 있어서, 생성 직후 branch naming이 일관되지 않다.
2. 방향
   - 루트 git 초기화는 `git init` 뒤에 `HEAD`를 `main`으로 맞추는 후속 명령까지 함께 실행한다.
   - 아직 첫 커밋 전이라 실제 `master` ref가 생기지 않은 상태에서 `HEAD`만 `main`으로 옮기면, 결과적으로 `master` 없이 `main`으로 시작할 수 있다.
   - 실행 순서와 테스트에도 이 후속 단계를 드러낸다.
3. 테스트
   - 루트 git setup plan이 `git init`과 `HEAD -> main` 명령을 순서대로 가지는지 검증한다.
   - create lifecycle label에도 `main` 브랜치 설정 단계가 포함되는지 검증한다.
4. 완료 기준
   - 새 스캐폴드 루트 git repo는 생성 직후 기본 브랜치가 항상 `main`이다.
   - `pnpm verify` 통과

## 다음 작업: changeset과 PR 설명을 최신 범위로 정리
1. 문제
   - 현재 PR은 처음 추가한 Cloudflare D1/R2, deploy auth 범위 위주로 설명돼 있고, 이후에 들어간 Cloudflare token 안내 보강, Firebase build service account 재시도, TUI 톤 정리가 충분히 반영되지 않았다.
   - changeset도 패키지 버전 범위는 맞지만, 릴리스 노트 설명은 최신 작업까지 한 번에 읽히도록 더 구체적으로 정리하는 편이 좋다.
2. 방향
   - changeset은 `create-rn-miniapp`, `@create-rn-miniapp/scaffold-templates` 둘 다 `patch`를 유지한다.
   - 본문에는 Cloudflare D1/R2 IaC, Cloudflare/Firebase `.env.local` 기반 deploy, Cloudflare token 발급 안내, Firebase build service account 재시도와 TUI 톤 정리를 함께 반영한다.
   - PR summary와 testing도 지금 상태 기준으로 다시 쓴다.
3. 완료 기준
   - changeset만 읽어도 이번 릴리스에서 바뀐 provider 경험을 이해할 수 있다.
   - PR 본문이 실제 diff 범위를 빠짐없이 설명한다.

## 다음 작업: Firebase build service account 확인 타이밍 재시도
1. 문제
   - Firebase에서 Blaze 플랜을 올리거나 Cloud Build API를 켠 직후에는 기본 build service account가 아직 보이지 않을 때가 있다.
   - 지금은 그 순간 바로 권한 보정으로 들어가서, 계정이 아직 생기기 전 상태를 곧바로 실패로 처리할 수 있다.
2. 방향
   - Firebase build service account 확인 단계는 최소 5번까지 재시도한다.
   - 각 시도 사이에는 750ms씩 기다려서 총 대기 시간이 최소 3초가 되게 한다.
   - TUI에는 `Cloud Build 기본 service account를 확인하는 중이에요. (1/5)`처럼 현재 시도 횟수를 보여준다.
   - build service account가 실제로 보일 때만 IAM 권한 보정으로 넘어간다.
3. 테스트
   - build service account가 몇 번 뒤에 생기는 경우 재시도 후 성공하는지 검증한다.
   - 5번 모두 준비되지 않으면 최종적으로 기존 에러를 내는지 검증한다.
   - 시도 로그와 wait 횟수를 함께 검증한다.
4. 완료 기준
   - Blaze/Cloud Build 설정 직후의 eventual consistency 때문에 바로 실패하지 않는다.
   - 사용자는 TUI에서 현재 몇 번째 재시도인지 볼 수 있다.
   - `pnpm verify` 통과

## 다음 작업: TUI 말투를 README 톤으로 정리
1. 문제
   - 현재 CLI/TUI 문구는 기능은 맞지만, 전체적으로 딱딱하고 설명조 표현이 많다.
   - 같은 흐름 안에서도 prompt, step label, 완료 note, 수동 안내 note의 말투가 제각각이라 사용자 경험이 조금 거칠다.
2. 방향
   - runtime에서 보이는 prompt, step label, 완료/수동 note를 README의 `~요` 톤으로 맞춘다.
   - 단순히 존댓말만 바꾸지 않고, "안내", "작성 완료" 같은 딱딱한 제목도 "이렇게 넣어 주세요", "적어뒀어요"처럼 더 자연스럽게 바꾼다.
   - provider별 note 제목과 주요 입력 프롬프트를 우선 정리하고, 테스트 기대값도 같이 갱신한다.
3. 테스트
   - provider별 provisioning note 테스트에 바뀐 제목을 반영한다.
   - CLI prompt 테스트에 바뀐 문구를 반영한다.
4. 완료 기준
   - 사용자가 생성 중에 보게 되는 주요 TUI 문구가 README와 같은 톤으로 읽힌다.
   - `pnpm verify` 통과

## 다음 작업: Firebase deploy auth 안내에 발급 경로 추가
1. 문제
   - 현재 Firebase provisioning 완료 note는 `FIREBASE_TOKEN` 과 `GOOGLE_APPLICATION_CREDENTIALS`가 비어 있으니 필요할 때 채우라고만 안내한다.
   - 하지만 어디서 발급받는지와 어떤 명령이나 콘솔 페이지를 써야 하는지 빠져 있어서, 처음 보는 사용자는 바로 막힌다.
2. 방향
   - `FIREBASE_TOKEN` 안내에는 `firebase login:ci`와 Firebase CLI 공식 문서 URL을 포함한다.
   - `GOOGLE_APPLICATION_CREDENTIALS` 안내에는 Firebase/Google 공식 문서와 Google Cloud Service Accounts 콘솔 URL을 포함한다.
   - 자동 작성 완료 note와 수동 안내 note 모두 같은 수준으로 친절하게 맞춘다.
3. 테스트
   - Firebase finalize/manual note 테스트에 `firebase login:ci`와 Service Accounts URL이 포함되는지 검증한다.
4. 완료 기준
   - Firebase deploy auth 관련 note만 읽어도 발급 위치와 다음 행동을 바로 알 수 있다.
   - `pnpm verify` 통과

## 다음 작업: Cloudflare OAuth scope 축소로 인한 D1/R2 인증 오류 복구
1. 문제
   - 현재 Cloudflare provider는 `wrangler login --scopes ...`로 OAuth scope를 좁혀서 발급받는다.
   - 예전 scope로 남아 있는 Wrangler 로그인 토큰은 Worker 관련 API는 통과해도 D1 / R2 조회 단계에서 `Authentication error`로 실패할 수 있다.
   - 사용자는 Worker 이름까지 입력한 뒤 D1 / R2 단계에서 원인 설명 없이 중단되는 흐름을 겪게 된다.
2. 방향
   - Wrangler 로그인은 더 이상 `--scopes`를 강제하지 않고, Cloudflare 기본 full scope 발급 경로를 사용한다.
   - Cloudflare REST API 호출이 `Authentication error`류 응답으로 실패하면 scope가 부족한 토큰으로 보고 `wrangler login`을 한 번 더 실행한 뒤 같은 호출을 재시도한다.
   - R2가 계정에서 아직 활성화되지 않은 경우에는 대시보드 R2 Overview URL을 안내하고, 같은 실행 안에서 `다시 확인` 루프를 돌려 복구한다.
   - 관련 helper를 테스트 가능한 함수로 분리해서 login args와 auth retry 분기를 고정한다.
3. 테스트
   - Wrangler login args가 더 이상 `--scopes`를 포함하지 않는지 검증
   - `Authentication error` 메시지를 auth retry 대상으로 인식하는지 검증
4. 완료 기준
   - 새 Cloudflare 로그인은 scope 축소 없이 발급된다.
   - 기존 제한된 Wrangler 토큰으로 시작해도 D1 / R2 단계에서 자동 재로그인 후 복구할 수 있다.
   - `pnpm verify` 통과

## 다음 작업: Cloudflare D1/R2 IaC와 Cloudflare/Firebase 재배포 토큰 경로 정리
1. 문제
   - 현재 `cloudflare` provider는 Worker deploy와 API URL 작성까지만 하고, D1 database나 R2 bucket은 선택/생성하지 않는다.
   - 현재 `cloudflare` / `firebase` `server/package.json`의 `deploy`는 plain CLI 호출이라 `server/.env.local`에 적힌 token/credentials를 자동으로 읽지 않는다.
   - 그래서 provider별로 “IaC 이후 `.env.local`만 채우면 한 명령으로 재배포” 경험이 일관되지 않는다.
2. 방향
   - Cloudflare provider에 D1 / R2 목록 조회, 기존 리소스 선택 또는 새 리소스 생성, `wrangler.jsonc` bindings 자동 반영을 추가한다.
   - Cloudflare는 `server/.env.local`에 Worker / D1 / R2 메타데이터와 `CLOUDFLARE_API_TOKEN`을 기록하고, `deploy`는 이 파일을 읽어 `wrangler deploy`를 실행하는 wrapper로 바꾼다.
   - Firebase는 `server/.env.local`의 `GOOGLE_APPLICATION_CREDENTIALS`와 project metadata를 읽어 `firebase deploy --only functions`를 실행하는 wrapper로 바꾼다.
   - Firebase 쪽은 자동 권한 보정이 가능한 부분만 CLI로 처리하고, 불가한 권한/정책 제약은 raw 에러 대신 명확한 복구 안내를 유지한다.
3. 테스트
   - Cloudflare provision/finalize 테스트에 D1 / R2 metadata 기록과 note 문구를 추가한다.
   - `wrangler.jsonc` patch 테스트에 D1 / R2 bindings와 schema/name 보존을 추가한다.
   - Cloudflare/Firebase server package template / patch 테스트에 deploy wrapper 생성과 `server/.env.local` 로딩을 검증한다.
4. 완료 기준
   - `cloudflare` provider가 Worker + D1 + R2를 함께 연결한다.
   - `cloudflare` / `firebase`는 `server/.env.local` 기반 one-command redeploy 경로를 가진다.
   - 관련 README / engineering 문서가 새 동작을 설명한다.
   - `pnpm verify` 통과

## 다음 작업: README 상단 소개와 빠른 시작 축약
1. 문제
   - 현재 README 상단은 같은 의미를 반복해서 설명하고, package manager별 문장을 길게 늘어놓고 있다.
   - 생성 구조에서도 내부 workspace manifest와 lockfile 설명이 너무 앞단에 나와 제품 설명 집중도가 떨어진다.
2. 방향
   - 소개 문장을 에이전트가 Granite, `@apps-in-toss/framework`, TDS를 바로 활용할 수 있는 실행 컨텍스트 patch 도구라는 관점으로 다시 쓴다.
   - `npm/pnpm/yarn/bun create` 예시는 한 코드 블록으로 묶고, package manager 자동 선택은 한 문장으로 압축한다.
   - 생성 구조에서는 꼭 필요한 루트 파일만 남기고 package-manager별 manifest/lockfile 상세는 제거한다.
3. 완료 기준
   - README 상단이 반복 없이 더 짧고 제품 중심으로 읽힌다.
   - 빠른 시작 설명이 중복 없이 정리된다.
   - `pnpm verify` 통과

## 다음 작업: watch 모드 `vitest` 스크립트 정규화
1. 문제
   - 생성물 workspace가 `test: "vitest"`를 그대로 가지면 루트 `nx test`에서 watch 모드로 붙잡혀 종료되지 않는다.
   - 특히 backoffice나 Cloudflare server처럼 외부 scaffold가 넣어준 기본 Vitest 스크립트가 그대로 남을 수 있다.
2. 방향
   - workspace patch 단계에서 plain `vitest` test script를 `vitest run`으로 정규화한다.
   - placeholder test를 넣는 기존 규칙은 유지하고, 이미 `vitest run` 등 non-watch 스크립트인 경우는 건드리지 않는다.
3. 테스트
   - backoffice package patch가 `vitest`를 `vitest run`으로 바꾸는지 검증
   - Cloudflare server patch가 `vitest`를 `vitest run`으로 바꾸는지 검증
4. 완료 기준
   - 루트 `nx test`가 watch 모드 때문에 멈추지 않는다.
   - `pnpm verify` 통과

## 다음 작업: `--with-server` 제거하고 `--server-provider`로 단일화
1. 문제
   - 현재 CLI에는 `--with-server`와 `--server-provider`가 같이 있어서 `server` 생성 책임이 중복된다.
   - 이 중복 때문에 `--with-server` 기본값, `--yes` 조합, provider 선택 예외 처리가 계속 생긴다.
2. 방향
   - `--with-server`는 CLI에서 완전히 제거한다.
   - `server` 생성은 `--server-provider <supabase|cloudflare|firebase>` 하나로만 표현한다.
   - 인터랙티브에서는 `server-provider`가 없을 때만 `none + providers` 선택을 보여준다.
   - `--yes`에서는 `--server-provider`가 없으면 `server`를 만들지 않는다.
   - `--server-project-mode`는 `--server-provider`가 있을 때만 허용한다.
   - `--add`도 같은 규칙으로 맞춘다.
3. 테스트
   - `--server-provider`만으로 `server`가 포함되는지 검증
   - `--yes` + no `--server-provider`면 `server` 없이 진행하는지 검증
   - `--server-project-mode` without `--server-provider`면 에러를 내는지 검증
   - `--add`에서도 같은 규칙을 검증
4. 완료 기준
   - `--with-server` 관련 파싱/문구/테스트가 사라진다.
   - `server` 생성 여부는 `--server-provider` 유무와 인터랙티브 선택으로만 결정된다.
   - `pnpm verify` 통과

## 다음 작업: granite.config.ts unused optional env helper 제거
1. 문제
   - 현재 frontend `granite.config.ts` 코드젠은 optional env binding이 없는 provider(`supabase`, `cloudflare`)에서도 `resolveOptionalMiniappEnv()` helper를 항상 생성한다.
   - 결과적으로 실제로 쓰이지 않는 helper가 생성물에 남고, provider별 preamble이 필요 이상으로 비대해진다.
2. 방향
   - Granite frontend env preamble 생성 로직을 다시 보고, optional binding이 있는 provider에서만 optional helper를 만들게 조정한다.
   - `resolveMiniappEnv`, `resolveOptionalMiniappEnv`, env binding 선언 중 provider별로 실제 쓰는 항목만 남기도록 정리한다.
3. 테스트
   - `supabase` frontend patch 결과에 `resolveOptionalMiniappEnv`가 없어야 한다.
   - `cloudflare` frontend patch 결과에 `resolveOptionalMiniappEnv`가 없어야 한다.
   - `firebase` frontend patch 결과에는 optional measurement id 때문에 helper가 유지되어야 한다.
4. 완료 기준
   - `supabase`/`cloudflare` 생성물의 `granite.config.ts`에는 unused optional helper가 없다.
   - `firebase` 생성물은 기존 optional measurement id 지원을 유지한다.
   - `pnpm verify` 통과

## 다음 작업: npm peer dependency install 완화
1. 문제
   - `npm`으로 MiniApp frontend를 설치하면 Granite/React Native 쪽 peer dependency 충돌 때문에 `ERESOLVE unable to resolve dependency tree`가 발생한다.
   - 루트 `.npmrc`를 먼저 만들어도 `frontend`처럼 별도 `package.json`이 있는 하위 workspace install에는 설정이 전파되지 않는다.
   - 이 충돌은 생성 직후 frontend install뿐 아니라, 최종 루트 workspace install, Firebase functions nested install, 이후 사용자의 수동 `npm install`에도 영향을 줄 수 있다.
2. 방향
   - npm 전용 완화 전략은 CLI flag가 아니라 workspace별 `.npmrc`로 옮긴다.
   - 루트에는 기존대로 `.npmrc`를 만들고, `frontend`, `backoffice`, `server`, `server/functions`에도 필요할 때 같은 `.npmrc`를 만든다.
   - create 시에는 `frontend` 생성 직후 `.npmrc`를 먼저 써서 첫 `npm install`부터 설정이 적용되게 한다.
   - 이 구성이 되면 npm adapter의 `--legacy-peer-deps` 플래그는 제거한다.
3. 테스트
   - npm create command plan이 더 이상 `--legacy-peer-deps`를 붙이지 않는지 검증
   - npm root finalize install args 검증
   - npm root/server/firebase functions `.npmrc` 생성 검증
   - npm Firebase functions predeploy/build script가 플래그 없이 동작하는지 검증
4. 완료 기준
   - `frontend` 첫 install 전 `.npmrc`가 생성된다.
   - 생성물의 npm workspace들에 `legacy-peer-deps=true`가 남는다.
   - npm adapter 명령에는 더 이상 `--legacy-peer-deps`가 없다.
   - `pnpm verify` 통과

## 다음 작업: Bun directory command 순서 보정
1. 문제
   - 현재 Bun adapter가 `bun --cwd <dir> install`, `bun --cwd <dir> run <script>` 형태를 만든다.
   - 실제 Bun CLI는 `bun install --cwd <dir>`, `bun run --cwd <dir> <script>` 순서를 기대해서, Firebase predeploy 같은 generated command가 실패한다.
2. 방향
   - Bun adapter의 directory/script command 순서를 Bun CLI 실제 문법에 맞게 수정한다.
   - Bun 기반 root/workspace 템플릿 테스트 기대값도 같이 갱신한다.
3. 완료 기준
   - Firebase predeploy의 Bun 경로가 `bun install --cwd "$RESOURCE_DIR" && bun run --cwd "$RESOURCE_DIR" build` 형태로 나온다.
   - Bun workspace build command도 올바른 순서를 쓴다.
   - `pnpm verify` 통과

## 다음 작업: Firebase build service account 추론 보정
1. 문제
   - 현재 Firebase Functions IAM 보정은 `PROJECT_NUMBER-compute@developer.gserviceaccount.com`를 기본 build service account로 고정 가정한다.
   - 실제 Cloud Build 기본 service account는 프로젝트 설정에 따라 Compute Engine default account일 수도 있고, legacy Cloud Build account나 다른 기본 account일 수도 있다.
   - 그래서 존재하지 않는 compute service account에 role을 추가하려다 `Service account ... does not exist`로 실패할 수 있다.
2. 방향
   - Firebase IAM 보정 시 `gcloud builds get-default-service-account --project <id>`를 먼저 호출해서 실제 기본 build service account를 조회한다.
   - 조회된 service account 기준으로 project IAM role 보정을 수행한다.
   - 조회된 기본 account가 존재하지 않으면, 잘못된 role add 시도 대신 복구 안내를 내보낸다.
3. 테스트
   - default build service account 조회값을 기준으로 role 보정하는 테스트
   - 조회된 default account가 존재하지 않을 때 명확한 에러를 내는 테스트
4. 완료 기준
   - 더 이상 compute default service account를 하드코딩하지 않는다.
   - Firebase IAM 보정이 실제 Cloud Build 기본 service account 기준으로 동작한다.
   - `pnpm verify` 통과

## 다음 작업: Cloud Build API 자동 활성화 후 IAM 보정 재시도
1. 문제
   - 새 Firebase 프로젝트에서는 `gcloud builds get-default-service-account` 호출 시 `cloudbuild.googleapis.com`이 아직 비활성화된 경우가 있다.
   - 지금은 이 상태를 에러로 끝내서, 실제로는 자동 복구 가능한 초기 프로젝트에서도 스캐폴딩이 중단된다.
2. 방향
   - Firebase IAM 보정 중 `SERVICE_DISABLED`로 `cloudbuild.googleapis.com`이 감지되면 `gcloud services enable cloudbuild.googleapis.com --project <id>`를 먼저 실행한다.
   - enable 후 같은 루프에서 default build service account 조회를 다시 시도한다.
3. 완료 기준
   - Cloud Build API가 꺼진 새 Firebase 프로젝트에서도 IAM 보정이 자동으로 복구된다.
   - `pnpm verify` 통과

## 다음 작업: dev prerelease publish 스크립트 추가
1. 문제
   - 현재 루트에는 changeset 기반 정식 릴리스만 있고, 두 패키지를 같은 dev 버전으로 바로 npm에 올리는 스크립트가 없다.
   - `create-rn-miniapp`는 `@create-rn-miniapp/scaffold-templates`를 `workspace:*`로 참조하므로, dev publish 시에는 staging된 manifest에서 실제 prerelease 버전으로 치환해야 한다.
2. 방향
   - 루트에 `publish:dev` 스크립트를 추가한다.
   - 버전은 `0.0.0-dev.<timestamp>` 형식으로 계산한다.
   - 작업 트리를 수정하지 않고, 두 패키지를 임시 디렉터리에 stage해서 publish한다.
   - publish 순서는 `@create-rn-miniapp/scaffold-templates` 먼저, `create-rn-miniapp` 나중으로 고정한다.
   - `NPM_TOKEN`은 사용자가 export 해둔 값을 그대로 사용하고, 없으면 즉시 에러를 낸다.
3. 구현 메모
   - 루트 `pnpm build` 후 publish한다.
   - staging된 CLI `package.json`에서는 templates dependency를 같은 dev 버전으로 바꾼다.
   - publish는 `npm publish --tag dev --access public` 기준으로 실행한다.
4. 테스트
   - `publish:dev` 루트 script 존재 확인
   - dev 버전 문자열 포맷 테스트
   - staged manifest에서 두 패키지 버전과 CLI dependency 치환 확인
5. 완료 기준
   - `pnpm publish:dev`로 두 패키지를 같은 dev version으로 publish할 수 있다.
   - 작업 트리의 실제 `package.json` 버전은 바뀌지 않는다.
   - `pnpm verify` 통과

## 다음 작업: npm / bun package manager 지원
1. 문제
   - 현재 생성기는 `pnpm`과 `yarn`만 지원한다.
   - `npm create rn-miniapp`로 들어왔을 때는 선택 프롬프트가 뜨지만, 실제 생성 결과를 `npm`으로 유지하는 경로는 없다.
   - `bun create rn-miniapp`처럼 Bun 기반 scaffold 흐름도 현재는 사용할 수 없다.
2. 방향
   - `package-manager` adapter에 `npm`, `bun`을 추가한다.
   - 호출 package manager 추론도 `npm`, `bun`까지 확장한다.
   - package manager 선택 prompt는 제거하고, 호출한 command를 그대로 따른다.
     - 감지 실패 시 기본값으로 숨기지 않고 에러를 낸다.
   - root template와 workspace manifest는 manager별로 분기한다.
     - `pnpm`: `pnpm-workspace.yaml`
     - `yarn`/`npm`/`bun`: `package.json.workspaces`
   - root `package.json` scripts, lockfile/ignore 처리, finalize 단계도 manager-aware로 확장한다.
   - README와 CLI help, 테스트를 모두 새 선택지 기준으로 갱신한다.
3. 구현 메모
   - `npm`은 `npm create`, `npm exec`, `npx`, `npm --prefix` 계열 명령으로 맞춘다.
   - `bun`은 `bun create`, `bunx`, `bun add`, `bun --cwd` 계열 명령으로 맞춘다.
   - provider별 local script와 Firebase nested functions install 경로도 manager별 차이를 반영해야 한다.
4. 완료 기준
   - `--package-manager <pnpm|yarn|npm|bun>`이 동작한다.
   - `npm create rn-miniapp`는 `npm`, `bun create rn-miniapp`는 `bun`으로 자동 선택된다.
   - package manager 선택 prompt가 더 이상 뜨지 않는다.
   - 감지 실패 시 `--package-manager`를 명시하라는 에러가 난다.
   - 생성 결과 root manifest와 verify/build script가 manager별로 맞게 나온다.
   - `pnpm verify` 통과

## 다음 작업: CLI `--no-git` 옵션 추가
1. 문제
  - 현재는 새 스캐폴드가 항상 루트 `git init`까지 진행한다.
   - 외부 템플릿 소비나 임시 출력처럼 루트 저장소 초기화를 원하지 않는 경우에는 끌 수 있는 CLI 옵션이 필요하다.
2. 방향
   - create 흐름에 `--no-git` 옵션을 추가한다.
   - `--no-git`이면 루트 `git init` 단계를 건너뛴다.
   - 도움말, README, 생성 설정 요약에도 반영한다.
3. 완료 기준
   - `--no-git`이 parse/help/README에 노출된다.
   - create 흐름에서만 루트 `git init`을 생략할 수 있다.
   - `pnpm verify` 통과

## 다음 작업: 새 스캐폴드 루트에 git init 추가
1. 문제
   - 현재는 공식 scaffold와 템플릿 적용까지 끝나도 생성된 루트 모노레포에 `.git`이 자동으로 생기지 않는다.
   - 그래서 생성 직후 바로 변경 이력을 관리하거나 첫 커밋을 만들려면 사용자가 직접 `git init`을 해야 한다.
2. 방향
   - create 흐름에서만 루트에 `git init` 단계를 추가한다.
   - `--add`에는 넣지 않고, 새 모노레포를 만들 때만 동작하게 한다.
   - `--skip-install`과 무관하게 항상 루트 저장소가 초기화되도록 한다.
3. 완료 기준
   - 새 스캐폴드 결과물 루트에 `.git`이 생성된다.
   - 실행 순서 테스트가 `루트 git init` 단계를 포함한다.
   - `pnpm verify` 통과

## 다음 작업: 호출 package manager 기반 기본 선택
1. 문제
   - 현재는 `create-miniapp` 실행 시 package manager를 명시하지 않으면 항상 prompt로 고르거나 `--yes`일 때 `pnpm`으로 고정된다.
   - 하지만 `pnpm create rn-miniapp`로 들어왔으면 `pnpm`, `yarn create rn-miniapp`로 들어왔으면 `yarn`을 바로 쓰는 게 자연스럽다.
   - 반대로 `npm create rn-miniapp`에서는 `pnpm`/`yarn` 선택 프롬프트를 유지하는 편이 맞다.
2. 방향
   - `npm_config_user_agent`와 관련 env를 기준으로 호출한 package manager를 추론한다.
   - `pnpm`/`yarn`으로 추론되면 package manager prompt를 생략하고 그대로 사용한다.
   - `npm` 또는 미확인인 경우에만 기존 prompt를 유지한다.
3. 완료 기준
   - `pnpm create`면 `pnpm`, `yarn create`면 `yarn`이 자동 선택된다.
   - `npm create`면 package manager 선택 prompt가 유지된다.
   - `pnpm verify` 통과

## 다음 작업: README에 기능명세서 우선 흐름 추가
1. 문제
   - 현재 README는 생성 결과물과 provider 흐름은 설명하지만, 생성 직후 사용자가 어떤 순서로 작업을 시작하면 좋은지는 약하다.
2. 방향
   - 생성 후에는 먼저 `docs/product/기능명세서.md`를 작성하고, 그 명세를 기준으로 구현을 진행하는 흐름을 README에 명시한다.
3. 완료 기준
   - README에 생성 직후 추천 작업 순서가 추가된다.
   - `pnpm verify` 통과

## 다음 작업: patching/ast 디렉터리 정합성 정리
1. 문제
   - 방금 `patching/ast.ts`를 분해했지만, `patching/ast/index.ts`가 상위 디렉터리의 `granite.ts`, `backoffice.ts`를 다시 export하고 있다.
   - 즉 `patching/ast` 디렉터리 이름과 실제 파일 배치가 어긋나서 구조가 부자연스럽다.
2. 방향
   - AST 축 파일은 모두 `patching/ast/` 아래에 둔다.
   - `patching/ast/index.ts`는 같은 디렉터리 안의 파일만 re-export한다.
3. 작업
   - `patching/granite.ts` -> `patching/ast/granite.ts`
   - `patching/backoffice.ts` -> `patching/ast/backoffice.ts`
   - `patching/swc.ts` -> `patching/ast/shared.ts`
   - 관련 import 전부 갱신
4. 완료 기준
   - `patching/ast/index.ts`가 상위 디렉터리 파일을 가리키지 않는다.
   - `pnpm verify` 통과

## 다음 작업: patching/ast.ts 책임 분리
1. 문제
   - `packages/create-rn-miniapp/src/patching/ast.ts`가 1000줄이 넘고, SWC 유틸, Granite config patch, backoffice TSX patch, JSONC patch, package.json ordered patch가 한 파일에 섞여 있다.
   - 현재는 “AST 관련 파일”이라는 이름 아래 구현 축이 너무 넓어서, 특정 patch를 수정할 때도 unrelated helper를 계속 같이 열어야 한다.
2. 현재 섞여 있는 책임
   - SWC 공통 유틸
     - parse/print/identifier/member/call/object property helper
   - Granite config patch
     - `patchGraniteConfigSource`
     - `readGraniteConfigMetadata`
     - env plugin / AppsInToss brand / metro watchFolders
   - backoffice TSX patch
     - `patchBackofficeMainSource`
     - `patchBackofficeAppSource`
   - JSONC patch
     - `patchTsconfigModuleSource`
     - `patchWranglerConfigSource`
   - ordered JSON patch
     - `patchPackageJsonSource`
     - `patchRootPackageJsonSource`
3. 분리 방향
   - `patching/ast/shared.ts`
     - SWC node type alias
     - parse/print helper
     - identifier/member/call/object property 유틸
   - `patching/ast/granite.ts`
     - `patchGraniteConfigSource`
     - `readGraniteConfigMetadata`
     - Granite 전용 preamble / provider env config
   - `patching/ast/backoffice.ts`
     - `patchBackofficeMainSource`
     - `patchBackofficeAppSource`
   - `patching/jsonc.ts`
     - `patchTsconfigModuleSource`
     - `patchWranglerConfigSource`
   - `patching/package-json.ts`
     - ordered entry parser/upsert/remove/stringify
     - `patchPackageJsonSource`
     - `patchRootPackageJsonSource`
   - `patching/ast/index.ts`
     - 외부에서 쓰는 export만 얇게 재조합
4. 구현 원칙
   - `index.ts`만 barrel로 둔다.
   - `patching/index.ts`에서는 Granite/backoffice/jsonc/package-json 세부 구현 위치를 몰라도 되게 유지한다.
   - 테스트도 구현 옆으로 붙인다.
     - Granite metadata/patch 테스트
     - backoffice TSX patch 테스트
     - JSONC patch 테스트
     - package.json ordered patch 테스트
5. 순서
   - 1차: SWC shared helper 분리
   - 2차: Granite 전용 파일 분리
   - 3차: backoffice TSX patch 분리
   - 4차: JSONC / package.json patch 분리
   - 5차: AST 테스트도 파일 옆으로 이동
6. 완료 기준
   - `patching/ast.ts` 단일 거대 파일이 사라지거나, 최소한 orchestration용 `index.ts` 수준으로 얇아진다.
   - 각 patch 축이 파일 이름만 보고 역할을 알 수 있다.
   - `pnpm verify` 통과

## 다음 작업: 단위 테스트 코로케이션 정리
1. 문제
   - 최근 `src/providers`, `src/patching`, `src/scaffold`, `src/templates`로 구현을 분리했지만, 대응 테스트는 아직 `src` 루트에 남아 있다.
   - 구현과 테스트가 멀어져서 리팩터링 시 찾기 어렵다.
2. 방향
   - 폴더로 분리된 구현은 같은 디렉터리에 `*.test.ts`를 둔다.
   - 루트 전용 모듈(`cli`, `commands`, `layout`, `workspace-inspector`, `release`) 테스트는 그대로 유지한다.
3. 작업
   - provider provisioning 테스트를 각 provider 폴더로 이동
   - `patch.test.ts`, `scaffold.test.ts`, `templates.test.ts`를 해당 구현 폴더로 이동
   - import 경로와 테스트 실행 패턴이 그대로 동작하는지 확인
4. 완료 기준
   - 분리된 구현 폴더 옆에 대응 단위 테스트가 위치한다.
   - `pnpm verify` 통과

## 다음 작업: create-rn-miniapp src 루트 barrel 제거
1. 문제
   - 최근 구조 리팩터링으로 `src/providers`, `src/patching`, `src/scaffold`, `src/templates`를 만들었지만, 루트에 `export * from ...`만 남은 non-index 파일이 생겼다.
   - `src/ast.ts`, `src/patch.ts`, `src/scaffold.ts`, `src/server-provider.ts`, `src/*-provision.ts`, `src/templates.ts` 같은 파일은 실제 구현이 아니라 alias라서 구조를 다시 흐린다.
2. 방향
   - `index.ts`만 barrel로 허용한다.
   - 나머지 파일은 모두 직접 구현 경로를 import하도록 바꾸고 삭제한다.
3. 작업
   - 내부 import와 테스트 import를 실제 구현 경로로 전환
   - root non-index barrel 파일 삭제
   - `pnpm verify`로 회귀 확인
4. 완료 기준
   - `packages/create-rn-miniapp/src` 아래 non-index re-export file이 남지 않는다.
   - `pnpm verify` 통과

## 다음 작업: provider별 AGENTS.md 분기 계획
1. 문제
   - 생성 직후 가장 먼저 보는 문서는 root `AGENTS.md`인데, 현재 내용은 provider 차이를 거의 반영하지 못한다.
   - 특히 `supabase`, `cloudflare`, `firebase`는 `server` 워크스페이스의 역할, 운영 스크립트, 주의사항이 다르다.
   - 지금처럼 완전 공통 템플릿 하나만 쓰면 첫 진입 문서가 너무 일반적이고, 반대로 세 provider 설명을 다 넣으면 너무 길고 헷갈리기 쉽다.
2. 방향
   - 완전히 다른 `AGENTS.md` 3개를 유지하지 않고, root `AGENTS.md`에는 provider별 안내를 한두 줄만 추가한다.
   - 대신 provider-specific 설명은 `docs/engineering` 아래 별도 문서로 분리한다.
   - 즉 `AGENTS.md`는 여전히 “가장 먼저 보는 1페이지” 역할만 하고, provider별 차이는 링크 중심으로 안내한다.
3. 구현 구조 제안
   - `packages/scaffold-templates/base/AGENTS.md`는 공통 골격을 유지한다.
   - `docs/engineering`에 provider별 문서를 추가한다.
     - `server-provider-supabase.md`
     - `server-provider-cloudflare.md`
     - `server-provider-firebase.md`
   - root `AGENTS.md`에는 현재 선택된 provider에 맞는 한 줄 정도만 추가한다.
     - 예: `server는 Supabase workspace예요. 먼저 docs/engineering/server-provider-supabase.md 와 server/README.md 를 보세요.`
4. provider별로 들어갈 핵심 차이
   - `supabase`
     - `server`는 Supabase project 연결, SQL migration, Edge Functions 배포 workspace라고 명시
     - 먼저 볼 파일: `server/README.md`, `server/.env.local`
     - 우선 스크립트: `db:apply`, `functions:serve`, `functions:deploy`
     - frontend/backoffice는 `src/lib/supabase.ts`와 `supabase.functions.invoke()` 흐름을 쓴다고 안내
   - `cloudflare`
     - `server`는 Worker 배포 workspace라고 명시
     - 먼저 볼 파일: `server/wrangler.jsonc`, `server/README.md`, `server/.env.local`
     - 우선 스크립트: `dev`, `build`, `typecheck`, `deploy`
     - frontend/backoffice는 `API_BASE_URL` 기반 helper를 쓴다고 안내
   - `firebase`
     - `server`는 Functions 배포 workspace라고 명시
     - 먼저 볼 파일: `server/firebase.json`, `server/functions/src/index.ts`, `server/.env.local`, `server/README.md`
     - 우선 스크립트: `build`, `typecheck`, `deploy`, `logs`
     - frontend/backoffice는 Firebase Web SDK(`firebase.ts`, `firestore.ts`, `storage.ts`)를 쓴다고 안내
5. 문서 길이 제어 원칙
   - root `AGENTS.md`에는 provider-specific 문단을 길게 넣지 않는다.
   - 긴 배경 설명은 provider 문서로 보내고, `AGENTS.md`에는 “무엇을 먼저 볼지”만 남긴다.
   - provider 문서에는 “server가 무엇인지 / 먼저 볼 파일 / 먼저 쓸 명령 / frontend/backoffice 연결”만 남긴다.
   - 상세 운영 설명은 계속 `server/README.md`가 맡는다.
6. 테스트/검증
   - provider별 생성 결과에서 root `AGENTS.md`가 해당 provider 문구와 링크를 포함하는지 검증
   - provider 문서가 docs 템플릿으로 생성되는지 검증
   - `pnpm verify` 통과

## 현재 README 톤 정리
1. 루트 `README.md`, `packages/scaffold-templates/README.md`, provider별 `server/README.md` 문구를 Toss식 `~요` 체로 정리한다.
2. 사용자에게 직접 보이는 설명은 명령형보다 “이렇게 동작해요 / 이렇게 쓸 수 있어요 / 필요하면 이렇게 하면 돼요” 톤을 우선한다.
3. 완료 기준
   - 사용자-facing README 문장이 전반적으로 `~요` 체로 통일된다.
   - `pnpm verify` 통과

## 현재 Supabase Edge Functions 확장
1. `supabase` provider도 이제 `db + edge functions`를 함께 갖는 실제 `server` 워크스페이스로 동작한다.
2. 반영 내용
   - `server Supabase 초기화` 뒤에 기본 `api` Edge Function을 `supabase functions new api --workdir . --yes`로 scaffold 한다.
   - `server/package.json`에 `functions:serve`, `functions:deploy`를 추가한다.
   - `server/scripts/supabase-functions-deploy.mjs`가 `server/.env.local`의 `SUPABASE_PROJECT_REF`를 읽어 모든 로컬 Edge Function을 원격에 배포한다.
   - provisioning은 `link -> db push -> functions deploy` 순서로 이어진다.
   - `server/README.md`와 root `README.md`에 Edge Functions 구조와 `supabase.functions.invoke('api')` 사용 동선을 반영한다.
3. 유지한 원칙
   - Edge Functions scaffold는 공식 Supabase CLI(`supabase functions new`)를 그대로 사용한다.
   - frontend/backoffice의 기존 `@supabase/supabase-js` bootstrap은 유지하고, 1차에서는 별도 helper를 추가하지 않는다.
4. 완료 기준
   - `supabase` provider 생성 직후 `supabase/functions/api/index.ts`가 존재한다.
   - `server/package.json`만으로 로컬 serve와 원격 deploy를 다시 수행할 수 있다.
   - `pnpm verify` 통과

## 현재 Firebase 프로젝트 생성 복구 작업
1. `firebase projects:create <projectId>`는 Google Cloud project 생성까지 성공한 뒤, Firebase 리소스 연결 단계에서 비영(非0) 종료할 수 있다.
2. 이 경우 현재 CLI는 전체 생성 실패로 취급하고 중단하지만, 실제로는 `projects:addfirebase <projectId>`로 이어서 복구 가능한 케이스가 있다.
3. 재현 로그 기준 실패 패턴
   - `Creating Google Cloud Platform project` 성공
   - `Adding Firebase resources to Google Cloud Platform project` 실패
4. 대응 방향
   - 실패 메시지 분류 로직을 테스트로 추가
   - duplicate projectId 에러는 기존처럼 재입력
   - partial-create 에러는 `projects:addfirebase` 자동 복구 시도
   - captureOutput 에러 메시지에는 stdout/stderr를 모두 포함해 복구 판단에 필요한 문자열을 잃지 않게 한다.
5. 완료 기준
   - 위 partial-create 패턴에서 생성 흐름이 바로 죽지 않고 `projects:addfirebase`를 시도한다.
   - `pnpm verify` 통과

## 현재 Firebase addfirebase 실패 원인 분리 작업
1. `projects:addfirebase` 자동 복구를 붙였지만, 실제 사용자 계정에서는 이 단계도 실패할 수 있다.
2. 먼저 `firebase-debug.log`를 읽어 실패 원인이 권한/결제/프로젝트 상태인지, 우리가 추가로 복구할 수 있는 종류인지 구분한다.
3. 대응 방향
   - 자동 복구 가능한 케이스면 로직 추가
   - 자동 복구 불가능한 케이스면 raw 에러 대신 이유와 다음 조치를 TUI에 명시
   - 가능하면 `firebase-debug.log` 경로도 함께 안내
4. 완료 기준
   - 동일 실패에서 사용자가 `왜 안 되는지`를 바로 이해할 수 있다.
   - `pnpm verify` 통과

## 현재 Firebase Functions 배포 실패 원인 분리 작업
1. Firebase project 연결 이후 `firebase deploy --only functions`도 실제 계정 상태나 플랜, API 활성화 상태에 따라 실패할 수 있다.
2. 먼저 `firebase-debug.log` 기준으로 실패 유형을 분리한다.
   - Blaze 플랜 미가입
   - Cloud Build / Artifact Registry / Functions API 미활성
   - 권한 부족
3. 대응 방향
   - 자동 복구 가능한 케이스면 안내 또는 선행 명령 추가
   - 자동 복구가 어려운 케이스면 TUI에서 이유와 다음 조치를 명시
4. 완료 기준
   - Functions deploy 실패 시 raw 종료 대신 원인 중심 메시지가 나온다.
   - `pnpm verify` 통과

## 현재 Firebase Functions build service account 안내 보강 작업
1. 실제 Yarn Firebase 배포는 이제 source analysis와 업로드 단계까지 통과하지만, 원격 Cloud Build에서 `missing permission on the build service account`로 실패할 수 있다.
2. 이 단계는 로컬 PnP나 packageExtensions 문제가 아니라 Google Cloud IAM/조직 정책 문제이므로, CLI가 그 차이를 명확히 설명해야 한다.
3. 대응 방향
   - `firebase-debug.log` 기준으로 build service account 권한 부족/비활성 상태를 분리한다.
   - Cloud Build 콘솔 URL이 있으면 그대로 노출한다.
   - 공식 문서 기준으로 다음 조치를 안내한다.
     - custom build service account 사용
     - default Compute Engine service account에 `roles/cloudbuild.builds.builder` 부여
     - Cloud Build default service account 변경 가이드 확인
4. 완료 기준
   - 동일 실패에서 "로컬 Yarn 문제"가 아니라 "원격 IAM 문제"라는 점이 바로 드러난다.
   - `pnpm verify` 통과

## 현재 Firebase 오류 상세 로그 노출 보강 작업
1. Firebase Functions deploy 실패 시 현재 메시지는 요약은 되지만, 사용자가 실제 어떤 줄에서 실패했는지 바로 보기 어렵다.
2. 대응 방향
   - 원인 요약 아래에 raw CLI 에러 본문을 같이 붙인다.
   - `firebase-debug.log`가 있으면 마지막 핵심 몇 줄도 같이 노출한다.
   - 여전히 debug log 전체 경로는 유지해서 더 깊은 확인도 가능하게 한다.
3. 완료 기준
   - 사용자 메시지 하나만 보고도 실패 원인 문자열과 관련 로그 URL을 확인할 수 있다.
   - `pnpm verify` 통과

## 현재 Firebase Functions build output root ignore 보강 작업
1. Firebase provider는 `server/functions/lib` 빌드 산출물을 만들 수 있는데, 현재 루트 `biome check --write --unsafe`가 이 파일까지 검사해서 실패할 수 있다.
2. 이 산출물은 루트에서 관리할 대상이 아니라 Firebase functions workspace의 build artifact다.
3. 대응 방향
   - 공통 템플릿은 건드리지 않고 Firebase provider patch에서만 루트 `.gitignore`와 `biome.json` ignore에 `server/functions/lib`를 추가한다.
   - 회귀 테스트로 Firebase일 때만 ignore가 생기는지 고정한다.
4. 완료 기준
   - Firebase 스캐폴드 뒤 루트 biome가 `server/functions/lib` 때문에 깨지지 않는다.
   - `pnpm verify` 통과

## 현재 Firebase predeploy install 누락 수정 작업
1. Firebase provider의 `server/firebase.json`은 현재 `functions.predeploy`에서 `build`만 실행한다.
2. 실제 `firebase deploy --only functions`는 이 `predeploy`를 직접 호출하므로, `server/functions` 의존성이 아직 설치되지 않은 첫 배포에서는 `Cannot find module 'firebase-functions'`로 바로 실패할 수 있다.
3. 대응 방향
   - `firebase.json`의 `predeploy`를 package manager별 `install && build`로 바꾼다.
   - pnpm / yarn 둘 다 template 테스트로 고정한다.
4. 완료 기준
   - 첫 Firebase Functions 배포에서 predeploy가 `functions` install 이후 build를 수행한다.
   - `pnpm verify` 통과

## 현재 Firebase nested functions install 실패 원인 분리 작업
1. `firebase.json` predeploy를 `install && build`로 바꿨는데도, pnpm 기준으로는 `server/functions`에 `node_modules`가 생기지 않아 `firebase-functions` 해석이 계속 실패하고 있다.
2. 이 이슈는 `firebase-tools` 실행 경로와 별개로, nested `server/functions` package에 대한 package manager install 방식이 잘못됐을 가능성이 높다.
3. 대응 방향
   - 실제 생성물에서 `pnpm --dir server/functions install`과 유사 명령을 재현해 본다.
   - parent workspace 영향인지, pnpm nested package 제약인지, 실행 경로 문제인지 분리한다.
   - 원인에 따라 `predeploy`/`server` scripts를 `npx` 또는 다른 install strategy로 바꾼다.
4. 완료 기준
   - pnpm Firebase functions 경로에서 install 후 실제 dependency 해석이 가능하다.
   - `pnpm verify` 통과

## 현재 Firebase Blaze 플랜 게이트 작업
1. Firebase Functions 2nd gen 배포는 Blaze 플랜(활성 billing account)이 필요하므로, 새 Firebase 프로젝트를 만들거나 기존 프로젝트를 고른 직후 이를 확인해야 한다.
2. 사용자가 Spark 프로젝트를 골랐거나 billing account가 비활성이면, Firebase Web App 생성이나 Functions deploy로 넘어가면 안 된다.
3. 대응 방향
   - `gcloud billing projects describe <projectId> --format=json`로 `billingEnabled`를 확인한다.
   - `billingEnabled: false`면 Blaze 업그레이드 URL과 billing 확인 문서를 출력한다.
   - 사용자가 `확인했나요?`에서 다시 확인을 고르면 재조회하고, 여전히 false면 계속 그 자리에서 멈춘다.
   - `gcloud`가 없거나 권한이 없으면 설치/인증 안내와 함께 중단한다.
4. 완료 기준
   - Firebase project 선택/생성 뒤 Blaze 플랜이 아니면 다음 단계로 진행하지 않는다.
   - `pnpm verify` 통과

## 현재 gcloud auth 만료 자동 복구 작업
1. 로컬에 `gcloud`를 자동 설치해도, `billing projects describe`에서 `invalid_grant`나 만료된 토큰 때문에 바로 실패할 수 있다.
2. 이 경우 사용자가 PATH에 없는 `gcloud`를 직접 실행하려 하면 다시 막히므로, CLI 안에서 설치된 `gcloud` 경로로 `auth login`을 바로 이어서 태우는 게 맞다.
3. 대응 방향
   - `invalid_grant`, `Please run: gcloud auth login`, `gcloud config set account` 패턴을 auth refresh 오류로 분류
   - 설치된 `gcloud` binary로 `gcloud auth login` 실행
   - 성공 후 `billing projects describe` 재시도
4. 완료 기준
   - `invalid_grant`에서 CLI가 곧바로 죽지 않고 `gcloud auth login` 후 재확인한다.
   - `pnpm verify` 통과

## 현재 Firebase build service account IAM 자동 보정 작업
1. Blaze 플랜 확인은 사용자가 직접 해야 하지만, Firebase Functions deploy에 필요한 기본 build service account IAM role은 CLI에서 자동으로 맞출 수 있다.
2. 현재는 deploy 실패 후에야 문서 링크와 수동 명령을 안내하지만, 이 권한은 project 선택 직후 선행 보정하는 편이 더 자연스럽다.
3. 대응 방향
   - Blaze 확인 직후 `gcloud projects describe`로 project number를 조회한다.
   - default Compute Engine service account에 필요한 role이 있는지 `gcloud projects get-iam-policy`로 확인한다.
   - 누락 시 `gcloud projects add-iam-policy-binding`으로 자동 부여한다.
   - `invalid_grant` 같은 gcloud auth 만료는 기존처럼 자동 `gcloud auth login` 후 재시도한다.
4. 완료 기준
   - Firebase Functions deploy 전에 필요한 기본 IAM role이 자동으로 보정된다.
   - `pnpm verify` 통과

## 현재 Firebase pnpm Functions Framework 누락 수정 작업
1. Cloud Run functions build는 `pnpm-lock.yaml`가 있는 Node.js 함수 소스에서 `@google-cloud/functions-framework`를 명시 dependency로 요구한다.
2. 현재 Firebase functions 템플릿은 `firebase-admin`, `firebase-functions`만 넣고 있어, 원격 build에서 `pnpm add @google-cloud/functions-framework`를 요구하며 실패한다.
3. 대응 방향
   - Firebase functions package 템플릿에 `@google-cloud/functions-framework` dependency를 추가한다.
   - 템플릿 테스트로 고정한다.
4. 완료 기준
   - Firebase functions 배포에서 Functions Framework 누락 에러가 재발하지 않는다.
   - `pnpm verify` 통과

## 현재 Yarn Firebase CLI 실행 경로 수정 작업
1. Yarn PnP 환경에서 `yarn dlx firebase-tools ...`는 임시 dlx project 내부 PnP 제약 때문에 실패할 수 있다.
2. 재현 로그 기준 원인
   - `@apphosting/build tried to access yaml, but it isn't declared in its dependencies`
3. 대응 방향
   - Firebase provider용 CLI 실행은 Yarn일 때 `npx firebase-tools ...`로 우회한다.
   - 기존 package manager 선택과 무관하게, Firebase CLI 자체만 안정적인 실행 경로를 쓴다.
4. 완료 기준
   - Yarn 프로젝트에서 Firebase CLI 단계가 `yarn dlx firebase-tools` 대신 PnP 비의존 경로를 사용한다.
   - `pnpm verify` 통과

## 현재 Firebase Functions TypeScript lib check 완화 작업
1. Firebase Functions build는 third-party declaration file까지 검사할 필요가 없다.
2. 재현 로그 기준 현재 실패는 `@firebase/app-types/index.d.ts` 내부의 `@firebase/logger` 해석 문제다.
3. 작은 TypeScript 재현으로 `skipLibCheck: true`면 이 종류의 오류가 사라지는 것을 확인했다.
4. 대응 방향
   - Firebase functions 전용 `tsconfig.json`에 `skipLibCheck: true` 추가
   - 템플릿 테스트로 고정
5. 완료 기준
   - Yarn Firebase Functions build가 dependency `.d.ts` 때문에 멈추지 않는다.
   - `pnpm verify` 통과

## 현재 Yarn Firebase functions linker 조정 작업
1. Firebase CLI의 source analysis는 `functions` source directory에서 `firebase-functions` 실제 설치 위치를 찾으려는 경향이 있다.
2. Yarn PnP nested project는 build는 통과해도 deploy analysis에서 SDK 위치 탐색이 깨질 수 있다.
3. 대응 방향
   - `server/functions`가 Yarn일 때는 독립 nested project를 유지하되 `.yarnrc.yml`에 `nodeLinker: node-modules`를 둔다.
   - 루트는 그대로 PnP를 유지한다.
4. 완료 기준
   - Yarn Firebase functions source directory는 `node_modules` 기반으로 설치된다.
   - `pnpm verify` 통과

## 다음 provider 작업: Firebase 계획
1. `firebase`는 `frontend`/`backoffice`에 Firebase Web SDK 기본 bootstrap을 넣고, `server`는 Firebase Functions workspace로 두는 provider로 구현한다.
2. 이유
   - MiniApp에서도 결국 네트워크 계층은 `fetch`를 쓰므로 Firebase Web SDK를 쓰는 쪽이 기본 데이터 접근 모델과 더 잘 맞다.
   - RN용 Firebase 네이티브 SDK를 기본값으로 넣는 것보다 web SDK bootstrap이 더 가볍고 현재 Granite 정책에도 덜 부딪힌다.
   - Firebase provider의 가장 기본적인 클라이언트 연결면은 `app`, `firestore`, `storage`다.
   - 다만 서버측 권한 로직과 deploy 대상은 여전히 Firebase Functions workspace가 맡는다.
3. 1차 범위
   - `server-provider` registry에 `firebase` 추가
   - `create` / `--add` 흐름에서 Firebase project 선택/생성 IaC 추가
   - `server/`에 Firebase Functions workspace 생성
   - `frontend`/optional `backoffice`에 Firebase app / firestore / storage bootstrap 추가
   - `server/.env.local`에 Firebase project / region / credentials path 자리 추가
   - provider별 `server/README.md`에 Firebase용 운영 가이드 추가
4. 1차에서 의도적으로 제외
   - Firebase Auth 기본 bootstrap
   - Hosting 설정
   - Realtime Database bootstrap
   - Remote Config / Analytics 기본 bootstrap
5. 공식 CLI 기준
   - `firebase login`
   - `firebase projects:list --json`
   - `firebase projects:create <projectId>` 또는 기존 project 선택
   - `firebase init`으로 `server/`를 Firebase project directory로 초기화
   - `firebase deploy --only functions`
   - 필요 시 `firebase apps:create WEB` / `firebase apps:sdkconfig WEB`는 2차 검토
6. IaC 흐름
   - Firebase CLI 설치/로그인 상태 확인
   - 필요 시 `gcloud` 설치/로그인 확인
   - 기존 Firebase project 목록 조회
   - 기존 project 선택 또는 새 project 생성
   - 기존 function region 확인 또는 새 region 선택
   - `server/` Firebase workspace 생성 및 active project 연결
   - Functions deploy
   - Firebase Web app config를 확인할 수 있으면 `frontend/.env.local` / `backoffice/.env.local` 작성
   - `server/.env.local`에 `FIREBASE_PROJECT_ID`, `FIREBASE_FUNCTION_REGION`, `GOOGLE_APPLICATION_CREDENTIALS` 자리 작성
7. 서버 워크스페이스 형태
   - `functions/` TypeScript codebase
   - `firebase.json`
   - `.firebaserc`
   - 필요 최소한의 Firestore rules / indexes 파일은 2차 범위로 미룬다.
   - 루트 monorepo 원칙에 맞게 workspace 내부 lint/formatter 설정은 제거하거나 최소화한다.
8. `frontend` / `backoffice` bootstrap
   - Firebase Web SDK 중심 bootstrap을 쓴다.
   - `frontend`
     - Firebase env 타입 선언
     - `src/lib/firebase.ts`
     - `src/lib/firestore.ts`
     - `src/lib/storage.ts`
     - Granite env plugin patch
   - `backoffice`
     - Firebase env 타입 선언
     - `src/lib/firebase.ts`
     - `src/lib/firestore.ts`
     - `src/lib/storage.ts`
9. `server/.env.local`와 운영 스크립트
   - `FIREBASE_PROJECT_ID=`
   - `FIREBASE_FUNCTION_REGION=`
   - `GOOGLE_APPLICATION_CREDENTIALS=`
   - `deploy`: `firebase deploy --only functions`
   - `build`: functions TypeScript build
   - `emulators:start`: 필요 시 2차 범위
10. env 기본값
   - `frontend`
     - `MINIAPP_FIREBASE_API_KEY=`
     - `MINIAPP_FIREBASE_AUTH_DOMAIN=`
     - `MINIAPP_FIREBASE_PROJECT_ID=`
     - `MINIAPP_FIREBASE_STORAGE_BUCKET=`
     - `MINIAPP_FIREBASE_APP_ID=`
   - `backoffice`
     - `VITE_FIREBASE_API_KEY=`
     - `VITE_FIREBASE_AUTH_DOMAIN=`
     - `VITE_FIREBASE_PROJECT_ID=`
     - `VITE_FIREBASE_STORAGE_BUCKET=`
     - `VITE_FIREBASE_APP_ID=`
   - 필요하면 `MEASUREMENT_ID`는 2차 범위로 둔다.
11. 사용자 안내
   - `GOOGLE_APPLICATION_CREDENTIALS`가 비어 있으면 service account JSON 경로를 직접 넣으라고 마지막 note에 명시한다.
   - Firebase Web app config를 자동으로 못 얻으면 Firebase Console의 project settings / app config 경로를 안내한다.
12. `hot-updater` 참고 구현
   - `/Users/kimhyeongjeong/Desktop/code/hot-updater/plugins/firebase/iac/select.ts`
   - `/Users/kimhyeongjeong/Desktop/code/hot-updater/plugins/firebase/iac/index.ts`
   - project 선택/생성, region 선택, deploy, IAM 안내 흐름은 여기서 재사용 가능한 부분이 많다.
13. 구현 순서
   - `ServerProvider` 타입에 `firebase` 추가
   - CLI / help / tests에 `firebase` 선택지 추가
   - Firebase scaffold command 추가
   - Firebase provisioning module 추가
   - Firebase workspace patch + frontend/backoffice bootstrap 추가
   - README / tests 갱신
14. 테스트 범위
   - CLI가 `firebase` provider를 해석하는지 검증
   - command plan이 Firebase scaffold 단계를 넣는지 검증
   - provisioning finalizer가 Firebase web config를 env 파일에 쓰는지 검증
   - `server/.env.local`이 기존 `GOOGLE_APPLICATION_CREDENTIALS`를 보존하는지 검증
   - Firebase server patch가 README, scripts, cleanup을 적용하는지 검증
   - `frontend`/`backoffice` bootstrap이 `firebase/app`, `firestore`, `storage`를 바로 사용할 수 있는 구조인지 검증
15. 완료 기준
   - `create-miniapp --server-provider firebase`가 Functions 기반 server workspace와 Firebase app / firestore / storage bootstrap을 함께 제공한다.
   - `pnpm verify` 통과

## 현재 changeset / PR 설명 정리 작업
1. PR `#22`는 초기 Cloudflare provider 추가를 넘어서 provider별 IaC, env bootstrap, server README, root README 개편까지 포함하게 됐다.
2. 기존 changeset 한 줄 요약으로는 실제 변경 범위를 설명하지 못하므로, 사용자 관점 release note로 다시 쓴다.
3. PR 본문도 현재 구현 범위에 맞게 다시 정리한다.
   - provider adapter registry
   - Supabase / Cloudflare 인증 및 원격 리소스 선택/생성
   - frontend / backoffice / server env bootstrap
   - provider별 server README
   - root README 및 docs 컨텍스트 보강
4. 완료 기준
   - changeset이 두 패키지 patch 배포 범위를 자세히 설명한다.
   - PR 본문만 읽어도 현재 브랜치의 사용자 영향과 검증 범위를 이해할 수 있다.

## 현재 root README 포지셔닝 보강 작업
1. 루트 README의 첫 설명을 "MiniApp을 생성하는 CLI" 수준에서 끝내지 않고, Granite, `@apps-in-toss/framework`, TDS를 바로 활용할 수 있도록 컨텍스트를 patch하는 스캐폴딩 도구라는 점까지 드러낸다.
2. 공식 CLI 우선 원칙과 함께, 이 저장소가 실제로 덧입히는 가치가 무엇인지 README 앞부분에서 설명한다.
   - 루트 monorepo tooling
   - AI/engineering/product docs 컨텍스트
   - provider별 env/bootstrap patch
   - provider IaC 및 원격 리소스 연결
3. 생성 결과의 `docs/` 구조를 단순 나열이 아니라 용도 중심으로 설명한다.
   - `docs/ai`
   - `docs/engineering`
   - `docs/product`
4. Supabase/Cloudflare provider 설명에는 "server 생성"뿐 아니라 인증, 기존 리소스 선택, 새 리소스 생성, `.env.local` 작성까지 포함된 IaC 흐름이라는 점을 README에 명시한다.
5. 완료 기준
   - 루트 README만 읽어도 이 도구가 "공식 scaffold 위에 MiniApp 실행 컨텍스트와 provider IaC를 patch하는 도구"라는 점이 이해된다.
   - `pnpm verify` 통과
6. README 최상단에는 Cloudflare 생성/연결 흐름을 보여주는 GIF를 raw GitHub URL로 노출한다.

## 현재 provider 인증 스캐폴드 안정화 작업
1. `codex/server-provider-adapters-cloudflare` 브랜치 기준으로 Supabase 인증/프로비저닝 흐름을 Cloudflare provider 지원 위에 병합한다.
2. create 흐름의 실행 순서는 `frontend scaffold -> server scaffold -> provider provisioning -> optional backoffice scaffold -> patch/finalize`로 고정한다.
3. add 흐름의 실행 순서는 `optional server scaffold -> provider provisioning -> optional backoffice scaffold -> patch/finalize`로 고정한다.
4. provider 선택 뒤에는 `create|existing`를 따로 묻지 않고, 먼저 기존 리소스 목록을 가져온 다음 단일 선택 리스트로 보여준다.
5. 선택 리스트에는 기존 리소스들과 함께 `새로 만들기` 항목을 같이 넣는다.
6. `--server-project-mode`는 scripted override로만 유지하고, 인터랙티브 기본 흐름은 provider provisioning 단계의 단일 선택으로 처리한다.
7. Supabase CLI JSON 파싱은 `pnpm`/`yarn` 로그 노이즈가 섞여도 payload만 추출하도록 보강한다.
8. Supabase publishable key를 조회할 수 있으면 `create`/`existing`와 관계없이 `frontend/.env.local`과 optional `backoffice/.env.local`까지 자동 작성한다.
9. publishable key 조회에 실패한 경우에만 Supabase 대시보드 API 설정 URL과 `.env.local` 예시를 마지막 안내 메시지로 출력한다.
10. 자동 `.env.local` 작성이 들어간 기준으로 `frontend`/`backoffice` bootstrap에서 `.env.local.example` 생성은 제거한다.
11. 테스트 범위
   - create/add 실행 순서가 provider provisioning 위치를 보장하는지 검증
   - provider 선택 후 create/existing 추가 질문이 사라지는지 검증
   - Supabase 프로젝트 목록/생성 응답이 패키지 매니저 로그 노이즈가 있어도 파싱되는지 검증
12. 완료 기준
   - `pnpm verify` 통과
   - 변경사항을 PR `#22`에 올릴 수 있는 상태

## 현재 Supabase server 원격 운영 스크립트 작업
1. Supabase provider를 선택해 프로젝트를 연결한 경우 `server/.env.local`도 함께 세팅한다.
2. `server/.env.local`에는 적어도 `SUPABASE_PROJECT_REF`와 `SUPABASE_DB_PASSWORD` 자리를 유지한다.
3. 이미 `server/.env.local`이 있으면 사용자가 넣어둔 `SUPABASE_DB_PASSWORD`는 지우지 않고 보존한다.
4. `server/package.json`의 기본 SQL 반영 스크립트는 원격 기준 `db:apply`를 제공한다.
5. 원격 `db:apply`는 `server/.env.local`을 읽고 `supabase db push --linked --password ...`를 실행해야 한다.
6. 로컬용 명령은 필요할 때를 위해 별도 보조 스크립트로만 남기고, 기본 동선은 원격 push 기준으로 둔다.
7. `server/.env.local`의 `SUPABASE_DB_PASSWORD`가 비어 있으면 최종 안내 문구에서 사용자가 직접 채워 넣어야 한다는 점을 분명히 보여준다.
8. 테스트 범위
   - `applyServerPackageTemplate`가 Supabase 원격 `db:apply`와 helper 스크립트를 생성하는지 검증
   - `finalizeSupabaseProvisioning`가 `server/.env.local`을 만들고 기존 DB password를 보존하는지 검증
9. 완료 기준
   - `pnpm verify` 통과

## 현재 Cloudflare URL bootstrap 작업
1. Cloudflare provider도 원격 Worker 연결 흐름을 가진다.
   - `create`: 새 Worker를 배포하고 URL을 얻는다.
   - `existing`: 기존 Worker를 선택하고 URL을 얻는다.
2. Cloudflare는 `public key` 대신 배포된 `workers.dev` 기반 API URL을 `frontend/.env.local`과 optional `backoffice/.env.local`에 자동 작성한다.
3. 원격 URL 자동 작성이 의미 있으려면 local bootstrap도 같이 들어가야 한다.
   - `frontend`: `MINIAPP_API_BASE_URL` 타입 선언, Granite env plugin 주입, `src/lib/api.ts` 생성
   - `backoffice`: `VITE_API_BASE_URL` 타입 선언, `src/lib/api.ts` 생성
4. Cloudflare 원격 흐름은 `desktop/code/hot-updater/plugins/cloudflare/iac`의 Wrangler auth/account/subdomain 흐름을 참고한다.
   - Wrangler 로그인 상태 확인 및 필요 시 `wrangler login`
   - account 목록 조회 및 선택
   - existing일 때 Worker 목록 조회 및 선택
   - create일 때 Worker 이름 입력 후 deploy
   - account subdomain 조회 또는 필요 시 생성
   - script workers.dev subdomain 활성화
5. 테스트 범위
   - Cloudflare 선택 시 create/existing 연결 모드를 해석하는지 검증
   - Cloudflare bootstrap이 frontend/backoffice에 API env/client 파일을 생성하는지 검증
   - Cloudflare provisioning finalizer가 URL이 있을 때 `.env.local`을 쓰는지 검증
6. 완료 기준
   - `pnpm verify` 통과
   - Cloudflare provider도 생성 직후 frontend/backoffice에서 API base URL을 바로 쓸 수 있는 상태

## 현재 Cloudflare server 원격 운영 스크립트 작업
1. Cloudflare provider를 선택해 Worker를 연결한 경우 `server/.env.local`도 함께 세팅한다.
2. `server/.env.local`에는 적어도 `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_WORKER_NAME`, `CLOUDFLARE_D1_DATABASE_ID`, `CLOUDFLARE_R2_BUCKET_NAME` 같은 deploy 메타데이터 자리를 유지한다.
3. 이미 `server/.env.local`이 있으면 사용자가 넣어둔 `CLOUDFLARE_API_TOKEN` 같은 비밀값은 지우지 않고 보존한다.
4. `server/package.json`에는 원격 Worker 재배포용 기본 `deploy` 스크립트를 제공한다.
5. 원격 `deploy`는 `server/.env.local`을 읽고 `wrangler deploy --env-file ./.env.local --name ...`를 실행해야 한다.
6. 테스트 범위
   - `patchCloudflareServerWorkspace`가 원격 `deploy` 스크립트와 helper 파일을 생성하는지 검증
   - `finalizeCloudflareProvisioning`가 `server/.env.local`을 만들고 기존 API token을 보존하는지 검증
7. 완료 기준
   - `pnpm verify` 통과

## 현재 provider 인증 기반 스캐폴드 연동 작업
1. `--provision` 같은 별도 단계는 두지 않고, `server` provider를 생성/추가하는 `create`와 `--add` 흐름 안에서 인증과 원격 프로젝트 선택/생성을 함께 처리한다.
2. provider UX는 공통으로 맞춘다.
   - `server` provider 선택 후 기존 프로젝트 사용 / 새 프로젝트 생성 여부를 묻는다.
   - 기존 프로젝트를 쓰면 인증 후 프로젝트 목록을 띄워 선택한다.
   - 새 프로젝트를 만들면 provider 공식 CLI나 API를 통해 생성한다.
3. Supabase는 `desktop/code/hot-updater/plugins/supabase/iac` 흐름을 참고해 구현한다.
   - 로그인 상태 확인 및 필요 시 `supabase login`
   - 프로젝트 목록 조회 및 선택
   - 새 프로젝트 생성 후 재조회
   - API key 조회
   - local `supabase link`와 `db push`
   - `frontend`/optional `backoffice` env 파일 작성 또는 마지막 안내 메시지 출력
4. Cloudflare는 `desktop/code/hot-updater/plugins/cloudflare/iac` 흐름을 참고해 구현한다.
   - Wrangler OAuth 토큰 재사용 및 필요 시 `wrangler login`
   - account 목록 조회 및 선택
   - 필요 시 기존 Worker/R2/D1 선택 또는 새 리소스 생성
   - server workspace에 선택 결과를 반영한다.
5. 구조는 provider adapter에 provisioning lifecycle을 추가하는 방향으로 정리한다.
   - auth 확인
   - create/use-existing 선택
   - 원격 리소스 선택/생성
   - local workspace patch/link/env write
   - 최종 안내 메시지 생성
6. 테스트 범위
   - CLI가 provider provisioning 선택 입력을 해석하는지 검증
   - provider adapter가 create/add 시 provisioning 단계를 삽입하는지 검증
   - Supabase 기존/신규 프로젝트 선택 결과가 env/link 단계로 이어지는지 검증
   - Cloudflare 인증 토큰/계정 선택 결과가 Worker 설정 단계로 이어지는지 검증
7. 구현 순서
   - provider provisioning 타입/registry 추가
   - CLI 질문 흐름 확장
   - scaffold/add orchestration에 provisioning 실행 삽입
   - Supabase 구현
   - Cloudflare 구현
   - README와 테스트 갱신

## 현재 root workspace manifest 동적화 작업
1. 루트 workspace 등록은 고정 템플릿이 아니라 실제 생성된 workspace 목록 기준으로 계산한다.
2. 초기 생성 시점에는 `frontend`와 선택된 `server`/`backoffice`만 root manifest에 등록한다.
3. `--add`로 `server`나 `backoffice`를 나중에 추가할 때는 root manifest에도 해당 workspace를 함께 추가한다.
4. `yarn`은 root `package.json.workspaces`, `pnpm`은 `pnpm-workspace.yaml`을 각각 동적으로 맞춘다.
5. 테스트 범위
   - frontend-only 생성 시 root manifest에 `frontend`만 들어가는지 검증
   - 선택된 workspace만 root manifest에 들어가는지 검증
   - add mode에서 새 workspace 추가 후 root manifest가 갱신되는지 검증
6. 릴리스 후속 작업
   - `create-rn-miniapp`, `@create-rn-miniapp/scaffold-templates`를 같은 patch changeset에 넣어 함께 배포한다.

## 현재 server provider adapter + Cloudflare 작업
1. `supabase` 하드코딩 분기를 provider adapter registry로 추출한다.
2. `commands`, `scaffold`, `workspace-inspector`, `cli`는 provider registry를 source of truth로 쓰게 바꾼다.
3. `cloudflare` provider를 추가한다.
   - 공식 scaffold는 Cloudflare C3 비대화형 명령을 사용한다.
   - 초기 템플릿은 Worker only + TypeScript 기준으로 생성한다.
4. Cloudflare server workspace 후처리
   - root orchestration에 맞게 `build`, `typecheck` 스크립트를 보강한다.
   - workspace 내부의 `.gitignore`, `.prettierrc`, `.editorconfig`, `.vscode`, `AGENTS.md` 등 중복 하네스/툴링 파일은 제거한다.
   - `wrangler.jsonc`의 `$schema`는 local `node_modules` 경로 대신 remote pinned URL로 정규화한다.
5. Supabase provider는 기존 frontend/backoffice bootstrap 동작을 유지한다.
6. 테스트 범위
   - provider registry가 CLI 선택지와 명령 계획에 반영되는지 검증
   - `supabase`/`cloudflare` create/add command plan이 각각 맞는 CLI를 쓰는지 검증
   - workspace inspector가 기존 server provider를 marker file로 감지하는지 검증
   - Cloudflare server patch가 build/typecheck 스크립트와 cleanup을 적용하는지 검증
7. 릴리스 후속 작업
   - `create-rn-miniapp`, `@create-rn-miniapp/scaffold-templates`를 같은 patch changeset에 넣어 함께 배포한다.

## 목표
1. Granite miniapp, optional Supabase server, optional Vite backoffice를 공식 CLI로 생성한 뒤 필요한 수정만 자동으로 적용하는 CLI를 만든다.
2. 이 저장소는 생성 결과물 source template를 들고 있지 않고, 하네스/문서 템플릿만 유지한다.
3. 생성이 끝난 대상 워크스페이스에 generic `AGENTS.md`, `docs/ai/*`, `docs/product/기능명세서.md`를 넣어 에이전트 친화적인 상태를 만든다.

## 생성 결과 목표 구조
```text
frontend/
backoffice/
server/
docs/
AGENTS.md
package.json
nx.json
pnpm-workspace.yaml
```

## 도구 저장소 구조
```text
packages/create-rn-miniapp/
packages/scaffold-templates/
docs/
```

## 공식 CLI 기준
1. Granite / AppInToss
   - source of truth: AppInToss React Native 튜토리얼
   - `pnpm create granite-app`
   - `pnpm install`
   - `pnpm install @apps-in-toss/framework`
   - `pnpm ait init`
   - TDS React Native 패키지 설치
2. Vite
   - `pnpm create vite <name> --template react-ts`
3. Supabase
   - `supabase init`
   - 이후 `supabase link`, `supabase db push`, `supabase functions new <name>`

## AppInToss 튜토리얼 기준 고정 항목
1. 앱 이름은 kebab-case
2. `ait init`으로 `granite.config.ts` 생성
3. `appName`은 AppInToss 콘솔의 앱 이름과 동일
4. `appsInToss` plugin의 `brand.displayName`, `primaryColor`, `icon`, `permissions`는 patch 대상
5. 비게임 React Native miniapp은 TDS 사용을 기본값으로 둔다
6. `_app.tsx`는 `AppsInToss.registerApp(...)` 구조를 유지한다

## 핵심 판단
1. miniapp/server/backoffice의 source code는 template로 들고 있지 않는다.
2. 공식 CLI가 만든 결과물에만 후처리 patch를 적용한다.
3. template로 유지하는 것은 하네스 문서와 기본 운영 규칙뿐이다.
4. 따라서 대응 포인트는 "공식 CLI 호출부"와 "후처리 patch" 두 군데다.
5. frontend patch는 Granite 일반 예제가 아니라 AppInToss React Native 튜토리얼 결과물을 기준으로 잡는다.
6. 생성 결과물의 툴체인은 루트 `package manager + nx + biome` 기준으로 맞추고, 내부 워크스페이스는 lint/format 설정을 제거하거나 추가하지 않는다.

## 템플릿 범위
1. `packages/scaffold-templates/root/package.json`
2. `packages/scaffold-templates/root/pnpm-workspace.yaml`
3. `packages/scaffold-templates/root/pnpm.gitignore`
4. `packages/scaffold-templates/root/yarn.gitignore`
5. `packages/scaffold-templates/root/pnpm.biome.json`
6. `packages/scaffold-templates/root/yarn.biome.json`
7. `packages/scaffold-templates/root/nx.json`
8. `packages/scaffold-templates/root/*.project.json`
9. `packages/scaffold-templates/base/AGENTS.md`
10. `packages/scaffold-templates/base/docs/ai/Plan.md`
11. `packages/scaffold-templates/base/docs/ai/Status.md`
12. `packages/scaffold-templates/base/docs/ai/Implement.md`
13. `packages/scaffold-templates/base/docs/ai/Decisions.md`
14. `packages/scaffold-templates/base/docs/ai/Prompt.md`
15. `packages/scaffold-templates/base/docs/product/기능명세서.md`
16. Granite/TDS 참조 안내 문서

## CLI 책임
1. 입력 수집
   - `name`
   - `display-name`
   - `--with-server`
   - `--with-backoffice`
   - `--yes`
   - `--skip-install`
   - `--output-dir`
2. 공식 CLI 실행
   - `frontend/` AppInToss React Native 튜토리얼 순서대로 Granite scaffold
   - `frontend/`에서 `@apps-in-toss/framework` 설치
   - `frontend/`에서 `ait init` 실행
   - `frontend/`에서 TDS 설치/patch 적용
   - optional `server/` Supabase init
   - optional `backoffice/` Vite scaffold
3. 후처리
   - package name / appName / displayName patch
   - 필요한 패키지 설치/추가
   - `packages/scaffold-templates/root/*` 기반으로 root `package.json`, `pnpm-workspace.yaml`, `nx.json`, `biome.json` 생성
   - `packages/scaffold-templates/root/*.project.json` 기반으로 workspace `project.json` 생성
   - 내부 워크스페이스의 lint/formatter 관련 설정 제거
   - 하네스 문서 템플릿 복사

## 현재 구현 상태
1. `packages/create-rn-miniapp`
   - `yargs + @clack/prompts` 입력 수집 완료
   - `appName` 디렉터리 생성 후 그 안에서 스캐폴딩 시작
   - Granite/AppInToss/Supabase/Vite 공식 CLI orchestration 완료
2. `packages/scaffold-templates`
   - root monorepo 설정 템플릿 완료
   - `AGENTS.md`, `docs/ai/*`, `docs/product/기능명세서.md` overlay 완료
3. patch 단계
   - `frontend` AppInToss config patch 완료
   - `backoffice` lint/typecheck 정리 patch 완료
   - `server` wrapper package/project 생성 완료
   - 루트 `biome check --write --unsafe` 자동 실행 완료

## 현재 버그 수정 작업
1. 퍼블릭 npm 배포본에서 `@create-rn-miniapp/scaffold-templates`의 `root/.gitignore`가 tarball에 포함되지 않아 생성이 마지막 overlay 단계에서 실패한다.
2. 재현 절차
   - `pnpm dlx create-rn-miniapp --name smoke-miniapp --display-name "Smoke Miniapp" --yes --output-dir <tmp> --skip-install`
   - 기대 결과: root template overlay까지 완료되어 생성이 끝나야 한다.
   - 실제 결과: `ENOENT ... scaffold-templates/root/.gitignore`
3. 수정 방향
   - npm pack 결과에서도 유지되는 템플릿 파일명으로 변경한다.
   - root template copy 로직과 테스트를 함께 보강한다.
4. 릴리스 후속 작업
   - `create-rn-miniapp`, `@create-rn-miniapp/scaffold-templates` 둘 다 patch changeset을 추가한다.

## 현재 CLI UX 개선 작업
1. `yargs` 기반 CLI 옵션 파싱은 유지하고, 옵션으로 주어지지 않은 값만 `@clack/prompts` 기반 인터랙티브 입력으로 보완한다.
2. 누락된 값은 clack 프롬프트로 텍스트 입력 또는 선택 입력을 받는다.
   - 선택 입력은 Granite와 같은 clack 계열 UI로 렌더링한다.
3. CLI가 직접 출력하는 도움말, 오류, 진행 메시지는 한국어로 통일한다.
4. 테스트 범위
   - 옵션 파싱 단위 테스트
   - 빠진 값에 대해 인터랙티브 입력기로 위임되는지 검증
   - 기존 명령 계획/릴리스 테스트와 함께 `pnpm verify` 통과
5. 릴리스 후속 작업
   - `create-rn-miniapp`, `@create-rn-miniapp/scaffold-templates` 둘 다 patch changeset을 추가해 CLI UX 변경을 함께 배포한다.

## 현재 프롬프트 렌더러 정리 작업
1. 누락 옵션 입력에 쓰던 커스텀 `execa` 프롬프트 렌더러를 제거하고 `@clack/prompts` 기반으로 통일했다.
2. 텍스트 입력은 `@clack/prompts`의 `text`를 사용하고, 선택 입력은 Granite와 같은 clack 계열 UI로 맞춘다.
3. 기존 `yargs` 우선, 누락 값만 인터랙티브 fallback이라는 흐름은 유지한다.
4. 테스트 범위
   - 누락된 값이 clack 프롬프트에 위임되는지 검증
   - 도움말/옵션 해석 회귀가 없는지 검증
   - 커스텀 ANSI 프로그램 생성 함수 제거에 맞춰 단위 테스트를 정리
5. 완료 기준
   - 프롬프트 UI가 Granite 계열과 같은 clack 렌더링으로 동작한다.
   - 더 이상 `execa`에 의존한 프롬프트 렌더링 코드가 남아 있지 않다.
6. 추가 UX 보정
   - `displayName` 입력에는 기본 예시를 넣지 않고, 프롬프트 위에 `보여지는 이름이니 한글로 해주세요.` 안내를 노출한다.
   - `server` 제공자와 `backoffice` 포함 여부는 멀티 선택이 아니라 단일 선택 프롬프트를 사용한다.

## 현재 Supabase provider bootstrap 작업
1. `server` 생성 여부를 단순 boolean이 아니라 provider 개념으로 확장한다.
   - 현재 provider는 `supabase` 하나만 지원한다.
   - 기존 `--with-server` 옵션은 유지하고, provider가 명시되지 않으면 `supabase`로 연결한다.
2. 인터랙티브 입력에서는 향후 provider 확장을 염두에 두고 `server` 미생성 또는 `supabase` 선택으로 해석 가능한 구조를 만든다.
3. `supabase` provider가 선택되면 `frontend`와 optional `backoffice`에 Supabase bootstrap을 같이 생성한다.
   - `.env.local.example` 파일 생성
   - Supabase client 파일 생성
   - env 타입 선언 파일 생성
4. `frontend`는 `dotenv`, `@granite-js/plugin-env`, `@supabase/supabase-js`를 설치하고 Granite dev/build/runtime에서 env가 주입되도록 patch한다.
   - 기준 구현은 `bookMiniApp`의 `apps/miniapp/granite.config.ts` 흐름을 따른다.
5. `backoffice`는 Vite env 규칙에 맞춰 `@supabase/supabase-js`, env 타입 선언, client bootstrap만 추가한다.
6. 테스트 범위
   - CLI가 provider를 해석하고 기존 `--with-server` 호환을 유지하는지 검증
   - command plan이 `supabase init`를 provider 선택 시에만 넣는지 검증
   - patch가 frontend/backoffice에 Supabase env/client bootstrap 파일과 의존성을 넣는지 검증
7. 완료 기준
   - `pnpm verify` 통과
   - 실제 scaffold 결과물에서 `frontend`와 `backoffice`가 Supabase env/client bootstrap을 바로 사용할 수 있는 상태
8. 후속 안정화
   - `granite.config.ts`, `backoffice/src/main.tsx`, `backoffice/src/App.tsx`의 문자열 `replace` patch를 SWC AST 기반 수정으로 교체한다.
   - 포맷과 quote style이 달라도 patch가 유지되도록 테스트를 보강한다.
9. granite runtime 보강
   - `frontend/granite.config.ts`의 `defineConfig`에 `metro.watchFolders = [repoRoot]`를 SWC AST로 추가한다.
   - `const repoRoot = path.resolve(__dirname, '../..')`도 함께 주입해 monorepo 루트 watch가 유지되게 한다.

## 현재 tsconfig module 안정화 작업
1. Supabase bootstrap 여부와 관계없이 `frontend`와 `backoffice` 워크스페이스의 tsconfig에서 `compilerOptions.module`을 `esnext`로 맞춘다.
2. `import.meta`를 사용하는 생성 파일이 TypeScript `TS1343` 오류 없이 타입체크되도록 만든다.
3. 문자열 치환이 아니라 JSON AST 기반 patch로 적용한다.
4. 입력은 JSONC로 읽되, 출력은 Biome이 읽을 수 있는 순수 JSON으로 정규화한다.
5. 테스트 범위
   - `frontend/tsconfig.json`의 `module`이 `esnext`로 바뀌는지 검증
   - `backoffice/tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`의 `module`이 `esnext`로 바뀌는지 검증
6. 완료 기준
   - `pnpm verify` 통과
   - scaffold 결과물의 frontend/backoffice tsconfig가 `module: "esnext"`를 갖는다.
7. 릴리스 후속 작업
   - `create-rn-miniapp`와 `@create-rn-miniapp/scaffold-templates`를 같은 patch changeset에 넣어 함께 버전 업한다.

## 현재 README 및 scaffold 문서 재편 작업
1. 루트 `README.md`는 저장소 개발자 관점보다 생성기 사용자 관점으로 다시 쓴다.
2. `packages/scaffold-templates/base/AGENTS.md`는 생성 직후 가장 먼저 읽는 실행 안내서 역할만 남기고, 상세 규칙과 배경 설명은 하위 문서로 분리한다.
3. `docs/engineering/granite-ssot.md`, `docs/engineering/appsintoss-granite-api-index.md`, `docs/engineering/appsintoss-granite-full-api-index.md`, `AGENTS.md` 사이의 역할을 재정의해 중복을 제거한다.
4. 내용은 빠뜨리지 않되, 같은 규칙/링크/설명을 여러 파일에 반복하지 않도록 문서별 책임을 분리한다.
5. 검토 대상
   - `AGENTS.md`에서 제거 또는 축약 가능한 항목
   - `granite-rules.yml`은 별도 유지하지 않고 `granite-ssot.md`로 흡수한다.
   - 현재 문서 링크 구조가 처음 읽는 사용자/에이전트에게 혼란을 주는지 여부
6. 완료 기준
   - README만 봐도 설치/실행/옵션/주의사항을 이해할 수 있다.
   - AGENTS는 첫 진입용 체크리스트로 짧고 명확하다.
   - Granite/AppInToss 문서 3종은 각각 목적이 겹치지 않는다.
7. 검증
   - `pnpm verify`

## 현재 package manager 확장 작업
1. 생성 시작 시 `pnpm` 또는 `yarn`을 선택할 수 있게 하고, 이 선택이 전체 scaffold 흐름의 source of truth가 되게 만든다.
2. 기존 `pnpm` 전용 실행 플로우는 `PackageManagerAdapter` 같은 인터페이스로 추상화한다.
3. `yarn`은 같은 인터페이스를 구현하되, 생성 명령, 의존성 설치, `dlx`/`exec`, 루트 install, workspace 실행 명령을 모두 해당 adapter가 반환하게 한다.
4. 선택 순서
   - 인터랙티브에서는 package manager 선택을 가장 먼저 받는다.
   - 그 다음 `appName`, `displayName`, `server provider`, `backoffice` 여부 순으로 이어진다.
   - CLI 옵션으로도 `--package-manager <pnpm|yarn>`을 지원한다.
5. 추상화 대상
   - `packages/create-rn-miniapp/src/commands.ts`의 공식 CLI 실행 명령
   - `packages/create-rn-miniapp/src/scaffold.ts`의 루트 install / biome 실행 단계
   - `packages/create-rn-miniapp/src/templates.ts`의 root 템플릿 파일 선택
   - `packages/create-rn-miniapp/src/patch.ts`의 manager별 lockfile / workspace artifact 정리
   - `packages/scaffold-templates/root/*`의 root `package.json`, workspace 정의, Nx target command, server package scripts
   - CLI help / README / 문서 템플릿의 사용자 안내 문구
6. 설계 방향
   - `pnpm`과 `yarn`이 공통으로 필요한 동작은 adapter 메서드로 고정한다.
     - `install`
     - `add`
     - `exec`
     - `dlx`
     - `createGraniteApp`
     - `createViteApp`
     - `workspaceRun`
   - root 템플릿은 공통 파일과 manager 전용 파일로 나누거나, manager 토큰으로 조건부 생성한다.
   - `yarn`은 Berry + `nodeLinker: pnp`를 명시적으로 사용하는 기준으로 지원한다.
7. 우선 확인할 리스크
   - `yarn dlx`는 Yarn Berry 기준이라 classic 1.x를 지원할지 여부를 명확히 해야 한다.
   - `pnpm-workspace.yaml`은 Yarn에서 제거되어야 하고, 대신 root `package.json`의 `workspaces`와 `.yarnrc.yml`이 필요할 수 있다.
   - workspace 내부에서 생성되는 `pnpm-lock.yaml`, `yarn.lock` 등 manager별 잔여 lockfile 정리 정책이 달라진다.
   - README, AGENTS, generated docs의 `pnpm verify` 표현을 manager 선택과 어떻게 공존시킬지 기준이 필요하다.
8. yarn pnp 안정화
   - `yarn` + `nodeLinker: pnp`에서 Granite dev server가 막히지 않도록 `.yarnrc.yml`에 필요한 `packageExtensions`를 템플릿으로 제공한다.

## 현재 frontend env/codegen 정리 작업
1. `frontend/granite.config.ts` 코드젠 결과에 import 블록, env bootstrap 블록, `defineConfig` 사이 개행을 넣어 읽기 쉽게 만든다.
2. `frontend/src/lib/supabase.ts`는 `process.env` fallback을 제거하고 `import.meta.env`만 source of truth로 사용한다.
3. `frontend/granite.config.ts`에서 `process`, `__dirname`, `node:path`를 사용할 때 타입 오류가 나지 않도록 Node 타입 설정을 보강하되, 파일 상단 triple-slash reference는 넣지 않는다.
4. `frontend/tsconfig.json`은 `compilerOptions.module = "esnext"`를 유지하면서 `types`에 `node`를 포함하도록 JSON AST로 patch한다.
5. `frontend/package.json`에는 `@types/node`를 workspace devDependency로 보강한다.
6. 테스트 범위
   - `granite.config.ts` 출력에 triple-slash reference 없이 개행이 들어가는지 검증
   - `frontend/src/lib/supabase.ts`에서 `process.env`가 제거되는지 검증
   - `frontend/tsconfig.json`에 `types: ["node"]`가 추가되는지 검증
7. Yarn SDK 후처리
   - `yarn` 선택 시 root install 뒤에 `yarn dlx @yarnpkg/sdks base`를 실행해 editor SDK를 생성한다.
   - 이 단계는 `pnpm`에는 추가하지 않고, `skipInstall`일 때도 실행하지 않는다.
8. 저장소 메타데이터
   - 루트 `LICENSE.md`를 MIT 텍스트로 추가해 저장소와 배포 패키지의 라이선스 문서를 명시한다.
8. 테스트 범위
   - CLI가 `--package-manager`를 파싱하고, 프롬프트 첫 단계에서 선택을 받는지 검증

## 현재 package.json 구조 patch 정리 작업
1. `package.json` 계열은 문자열 치환 대신 공용 구조 patch helper로 통일한다.
2. `granite.config.ts`처럼 TS/TSX AST가 필요한 파일과 달리, `package.json`은 JSON 구조 patch로 처리한다.
3. 루트 `package.json`과 각 workspace `package.json`이 같은 helper를 사용하게 맞춘다.
4. workspace patch에서는 객체 parse는 읽기/판단용으로만 쓰고, 최종 파일 write는 구조 patch helper를 거친다.
5. 테스트 범위
   - root `package.json`의 packageManager/workspaces/script merge 회귀가 없는지 검증
   - frontend/backoffice package patch 후 기존 의존성이 유지되는지 검증

## 현재 add mode 작업
1. 목표
   - 이미 생성된 miniapp 모노레포에 `server`나 `backoffice`를 나중에 추가할 수 있는 CLI 흐름을 만든다.
   - 새 리포 생성과 달리, 기존 루트 설정과 문서를 다시 덮어쓰지 않고 필요한 워크스페이스만 증설한다.
2. 지원 범위
   - 대상은 이 CLI가 만든 루트 구조이거나 그와 호환되는 monorepo로 한정한다.
   - `frontend/`가 이미 존재해야 한다.
   - 이번 범위에서는 `server`와 `backoffice` 추가만 지원한다.
   - `frontend` 재생성이나 임의 루트 마이그레이션은 범위 밖으로 둔다.
3. CLI 형태
   - 기존 기본 동작은 그대로 새 워크스페이스 생성으로 유지한다.
   - 새 옵션 `--add`를 추가한다.
   - `--add`와 함께 `--root-dir`를 추가하고 기본값은 현재 디렉터리로 둔다.
   - `--add`에서 `--with-server`, `--server-provider`, `--with-backoffice`는 “없으면 추가” 의미로 재해석한다.
4. add mode 입력 수집
   - package manager는 root `package.json.packageManager`에서 자동 감지한다.
   - `appName`은 `frontend/granite.config.ts`의 `defineConfig.appName`에서 읽는다.
   - `displayName`은 `frontend/granite.config.ts`의 `appsInToss.brand.displayName`에서 읽고, 없을 때만 프롬프트 fallback을 둔다.
   - 현재 포함된 워크스페이스 상태를 감지해 이미 존재하는 선택지는 기본적으로 비활성화하거나 skip한다.
5. 구현 경계
   - `cli.ts`
     - `mode`, `rootDir` 파싱 추가
     - `add` mode 전용 질문 흐름 추가
   - `workspace-inspector.ts` 신규
     - 기존 루트의 package manager, appName, displayName, server/backoffice 존재 여부를 읽는다.
     - `granite.config.ts`는 SWC AST로 읽는다.
   - `commands.ts`
     - 기존 create plan과 별도로 add plan builder를 추가한다.
     - 선택한 워크스페이스만 공식 CLI로 생성한다.
   - `scaffold.ts`
     - create path와 add path를 분리한다.
     - add path는 `ensureEmptyDirectory()`를 사용하지 않는다.
     - root install / yarn sdk / biome 단계는 기존과 같은 finalize plan을 재사용한다.
   - `patch.ts`
     - `server` 추가 시 `frontend`에 Supabase bootstrap이 없으면 같이 보강한다.
     - 기존에 `server`가 있는 상태에서 `backoffice`를 추가하면 backoffice에도 Supabase bootstrap을 넣는다.
   - `templates.ts`
     - root 템플릿 전체 재적용은 하지 않는다.
     - 필요한 `project.json`, `server/package.json`만 additive로 생성한다.
6. 핵심 판단
   - `pnpm-workspace.yaml`과 Yarn `workspaces`는 이미 `frontend`, `server`, `backoffice`를 모두 포함하도록 생성되므로 add mode에서 root workspace manifest를 수정할 필요는 없다.
   - `nx.json`, `biome.json`, `docs/`, `AGENTS.md`는 add mode에서 기본적으로 건드리지 않는다.
   - add mode는 “새 워크스페이스 추가”이지 “전체 루트 재동기화”가 아니다.
7. 작업 순서
   - 기존 루트 검사기 추가
   - CLI mode 분기 추가
   - add command plan / 실행기 추가
   - server 추가 시 frontend bootstrap 보강
   - backoffice 추가 시 existing server provider 연동
   - 테스트와 README 갱신
8. 테스트 범위
   - CLI가 `--add`, `--root-dir`를 해석하는지 검증
   - 루트 검사기가 package manager, appName, displayName, 기존 workspace 상태를 읽는지 검증
   - add plan이 이미 존재하는 workspace는 건너뛰고, 빠진 workspace만 생성하는지 검증
   - temp fixture 기준으로 `frontend-only -> add server`, `frontend-only -> add backoffice`, `frontend+server -> add backoffice` 흐름 검증
9. 완료 기준
   - 기존 생성물 루트에서 `create-miniapp --add --with-server` 또는 `--with-backoffice`가 동작한다.
   - 이미 존재하는 workspace를 다시 생성하려고 하지 않는다.
   - `pnpm verify` 통과
   - command plan이 `pnpm`과 `yarn`에서 각각 다른 명령을 생성하는지 검증
   - root template 결과물이 manager별로 올바른 파일 집합과 명령 문자열을 가지는지 검증
   - patch 단계가 manager별 lockfile과 artifact를 올바르게 정리하는지 검증
9. 완료 기준
   - 사용자가 `pnpm` 또는 `yarn`을 선택해 실제 스캐폴딩을 끝낼 수 있다.
   - generated root가 선택한 manager 기준으로 install, verify, Nx orchestration을 수행한다.
   - 기존 `pnpm` 플로우는 회귀 없이 유지된다.
10. 후속 정리
   - `pnpm` 버전은 `10.32.1`, `yarn` 버전은 `4.13.0` 기준으로 맞춘다.
   - root `biome.json`과 `.gitignore`는 공통 파일이 아니라 manager별 템플릿으로 분리한다.
   - `.pnp.*`, `.yarn/**` ignore는 `yarn` 생성물에만 들어가고, `pnpm` 생성물에는 들어가지 않게 한다.
   - root `package.json` AST patch가 기존 `devDependencies`를 지우지 않도록 회귀 테스트와 함께 보정한다.
   - GitHub Actions의 `pnpm/action-setup`는 루트 `packageManager`를 source of truth로 삼도록 `version` 고정을 제거한다.
   - `nx.json`과 `project.json`의 `$schema`는 더 이상 `node_modules` 상대 경로를 쓰지 않고, editor가 바로 읽을 수 있는 remote schema URL을 사용한다.
   - `yarn pnp`에서 Granite dev server가 막히지 않도록 `.yarnrc.yml`에 필요한 `packageExtensions`를 템플릿으로 제공한다.

## 남은 작업
1. npm publish 준비
   - Changesets 설정
   - GitHub Actions verify / release workflow
   - 버전 전략
   - 릴리스 문서
   - first publish rehearsal
2. CLI UX 다듬기
   - 기본 brand 색상/아이콘/권한 입력 확장 여부 판단
   - `--skip-install` 사용성 정리
3. smoke test 자동화
   - temp dir 기반 end-to-end 테스트를 CI 친화적으로 돌리는 방법 정리

## 테스트 전략
1. name/path/token replacement 단위 테스트
2. temp directory에서 공식 CLI 실행 후 patch 결과 검증
3. 조합별 검증
   - `frontend only` ✅
   - `frontend + server + backoffice` ✅
4. 생성 결과 루트에서 `pnpm verify`가 동작하는지 확인 ✅

## 문서 템플릿 이관
1. `bookMiniApp`에서 전자책 도메인 특화 내용만 제외하고, MiniApp 공통 하네스 문서를 이 저장소 템플릿으로 이관한다.
2. `packages/scaffold-templates/base/AGENTS.md`에 Granite, `@apps-in-toss/framework`, TDS, TDD 기준을 명시한다.
3. `packages/scaffold-templates/base/docs/engineering/*`에 AppInToss/Granite/TDS 인덱스와 에이전트 운영 문서를 포함한다.
4. 생성 결과물은 문서만 복사하는 것이 아니라, 에이전트가 바로 참조할 수 있는 링크 구조를 유지해야 한다.

## 리스크
1. Granite CLI의 비대화식 지원 범위를 먼저 확인해야 한다.
2. `ait init` 결과 구조가 바뀌면 frontend patch 로직도 같이 조정해야 한다.
3. source template를 들고 있지 않으므로, patch 지점 선택이 불안정하면 오히려 유지보수가 어려워질 수 있다.
4. 공식 scaffold가 자체 lint/format 설정을 계속 바꿀 수 있으므로, 제거/patch 지점을 너무 하드코딩하면 유지비가 올라간다.

## DoD
1. 공식 CLI를 순서대로 실행하는 orchestration이 동작한다. ✅
2. 결과물에 `frontend`, `server`, `backoffice` 구조가 생성된다. ✅
3. 결과물에 generic `AGENTS.md`, `docs/ai/*`, `docs/product/기능명세서.md`가 복사된다. ✅
4. 결과물 루트에 선택한 package manager + `nx` + `biome`가 설정된다. ✅
5. 내부 워크스페이스는 자체 lint/format 도구 없이 루트 오케스트레이션만 사용한다. ✅
6. 생성 직후 루트 `pnpm verify`가 동작한다. ✅
7. 이 저장소 안에는 source scaffold template가 남아 있지 않다. ✅
8. 공개 패키지 릴리스용 Changesets 흐름이 설정된다.
9. PR 검증과 main 릴리스 자동화용 GitHub Actions가 설정된다.

## 현재 Cloudflare Wrangler auth 경로 회귀 수정
1. `wrangler login` 이후 인증 토큰을 찾지 못하는 회귀를 수정한다.
2. 실제 Wrangler 4.73.0이 쓰는 auth 저장 위치와 포맷을 로컬에서 확인한다.
3. `desktop/code/hot-updater/plugins/cloudflare/iac/getWranglerLoginAuthToken.ts` 구현을 참고해 현재 reader를 교체하거나 보강한다.
4. 테스트 범위
   - 새로운 Wrangler auth 파일 포맷을 읽을 수 있는지 검증
   - 기존 fallback 경로도 계속 읽을 수 있는지 검증
5. 완료 기준
   - `pnpm verify` 통과

## 현재 Cloudflare account verify 에러 안내 개선
1. Cloudflare deploy 실패 시 API code 10034(이메일 미인증)를 별도 메시지로 안내한다.
2. Wrangler stderr를 읽어 사용자가 바로 다음 액션을 알 수 있게 URL과 원인을 포함한다.
3. 테스트 범위
   - code 10034 또는 verify-email-address 문구가 있으면 사용자 친화 메시지로 바뀌는지 검증
4. 완료 기준
   - `pnpm verify` 통과

## 현재 Cloudflare workers.dev onboarding 순서 수정
1. Cloudflare Worker create 흐름에서 workers.dev subdomain 확보를 deploy 이전으로 옮긴다.
2. onboarding 미완료 에러는 별도 사용자 안내로 바꾼다.
3. 테스트 범위
   - workers.dev onboarding 경고 문구가 사용자 친화 메시지로 바뀌는지 검증
   - create 흐름이 deploy 전에 account subdomain을 확보하도록 순서를 고정하는지 검증
4. 완료 기준
   - `pnpm verify` 통과

## 현재 Cloudflare workers.dev false negative 복구
1. `wrangler deploy`가 workers.dev onboarding 에러를 반환하더라도, Cloudflare API에서 account subdomain과 Worker 존재가 확인되면 false negative로 간주하고 계속 진행한다.
2. 실제로 account subdomain이 없을 때만 onboarding 안내를 유지한다.
3. 테스트 범위
   - onboarding 에러 + subdomain 존재 + worker 존재면 복구되는지 검증
   - onboarding 에러라도 subdomain 또는 worker가 없으면 복구하지 않는지 검증
4. 완료 기준
   - `pnpm verify` 통과

## 현재 Cloudflare deploy script 정리
1. Cloudflare server `package.json`에서 중복인 `deploy:remote`를 제거하고 `deploy`만 남긴다.
2. 테스트 범위
   - Cloudflare server patch 결과에 `deploy`만 남는지 검증
3. 완료 기준
   - `pnpm verify` 통과

## 현재 Cloudflare API token 안내 보강
1. Cloudflare provision 완료 후 `server/.env.local`의 `CLOUDFLARE_API_TOKEN`이 비어 있으면 사용자가 직접 채워야 한다는 안내를 note에 포함한다.
2. 기존 token이 이미 있으면 불필요한 안내는 생략한다.
3. 테스트 범위
   - 성공 note에 token 입력 안내가 포함되는지 검증
   - 기존 token이 있으면 token 입력 안내가 생략되는지 검증
4. 완료 기준
   - `pnpm verify` 통과

## 현재 provider별 server README 추가
1. Supabase server와 Cloudflare server에 provider별 `README.md`를 patch 단계에서 생성한다.
2. README에는 디렉토리 구조, 주요 스크립트, frontend/backoffice 연결 방식을 포함한다.
3. 테스트 범위
   - Supabase server patch 결과에 README가 생성되고 핵심 스크립트/연결 설명이 포함되는지 검증
   - Cloudflare server patch 결과에 README가 생성되고 핵심 스크립트/연결 설명이 포함되는지 검증
4. 완료 기준
   - `pnpm verify` 통과

## 현재 Firebase projectId 중복 재시도
1. Firebase 새 프로젝트 생성 시 `projectId`가 이미 존재하면 흐름을 중단하지 않고 같은 세션에서 다시 입력받는다.
2. 중복 판별은 Firebase CLI stderr message를 구조적으로 분리해서 처리한다.
3. 테스트 범위
   - Firebase CLI error message에서 중복 projectId를 감지하는지 검증
   - 관련 사용자 안내 문구가 포함되는지 검증
4. 완료 기준
   - `pnpm verify` 통과

## 현재 backoffice React best practices 문서 추가
1. root `AGENTS.md`는 짧게 유지하고, backoffice React 작업용 상세 가이드는 `docs/engineering/backoffice-react-best-practices.md`로 분리한다.
2. 문서 내용은 Vercel `react-best-practices`를 참고하되, Next.js server 전용 규칙은 제외하고 현재 스택인 Vite + React + TypeScript backoffice 기준으로 재구성한다.
3. `AGENTS.md`에는 새 문서를 가리키는 한 줄 인덱스만 추가한다.
4. `docs/index.md`에도 새 engineering 문서 링크를 추가한다.
5. 테스트 범위
   - docs-only 변경으로 `pnpm verify` 통과
6. 완료 기준
   - 생성되는 `AGENTS.md`와 `docs/index.md`에서 새 문서를 찾을 수 있다.

## 현재 optional workspace 문서 동적 생성
1. `backoffice`와 `server provider` 관련 engineering 문서는 더 이상 `base` 공통 템플릿에 두지 않는다.
2. `packages/scaffold-templates/optional/*` 아래에 backoffice 및 provider별 문서를 둔다.
3. create 시에는 최종 선택된 workspace와 provider 기준으로 optional docs를 복사하고 `AGENTS.md`, `docs/index.md`를 동기화한다.
4. `--add` 시에도 기존 문서를 덮어쓰지 않고, 필요한 optional docs만 추가하고 `AGENTS.md`, `docs/index.md` 인덱스만 보강한다.
5. 이전 버전 생성물처럼 marker가 없는 `AGENTS.md`, `docs/index.md`도 `--add`에서 보강 가능해야 한다.
6. 테스트 범위
   - frontend only면 backoffice/provider 문서와 링크가 생기지 않는지 검증
   - backoffice 선택 시에만 backoffice 문서와 링크가 생기는지 검증
   - server provider별로 해당 문서와 링크만 생기는지 검증
   - marker가 없는 예전 문서에도 optional 링크를 삽입할 수 있는지 검증
7. 완료 기준
   - `pnpm verify` 통과

## 현재 non-index forwarding module 제거
1. `index.ts`를 제외한 source module은 다른 파일 export를 forwarding하지 않는다.
2. `templates/*`, `patching/*`의 facade 파일은 삭제하고 호출부가 실제 구현 파일(`runtime.ts` 등)을 직접 import 하도록 바꾼다.
3. 테스트 범위
   - non-`index.ts` 파일에 `export ... from`이 없는지 검증
   - non-`index.ts` pure forwarding facade module이 존재하면 실패하도록 검증
4. 완료 기준
   - `pnpm verify` 통과

## 현재 runtime monolith 실분리
1. `templates/runtime.ts`, `patching/runtime.ts` 같은 집합 구현 파일을 제거한다.
2. `templates/docs.ts`, `templates/root.ts`, `templates/server.ts`, `templates/filesystem.ts`, `templates/skills.ts`, `templates/types.ts`, `templates/trpc-entry.ts`, `patching/frontend.ts`, `patching/backoffice.ts`, `patching/server.ts`가 각자 구현을 직접 가진다.
3. 호출부는 re-export/facade를 거치지 않고 해당 구현 파일을 직접 import 한다.
4. 테스트 범위
   - `runtime.ts` 집합 구현 파일이 남아 있으면 실패
   - non-`index.ts` forwarding facade 금지 규칙 유지
5. 완료 기준
   - `pnpm verify` 통과

## 다음 작업: SSoT 파생 상태 감사

### 목표
- optional skills 전환 이후에도 skill/source/topology/docs가 single source of truth로 유지되는지 점검한다.
- 한 군데를 바꾸면 나머지가 파생돼야 하는데 중복 수정이 필요한 지점을 식별한다.
- 구현보다는 감사와 후속 정리 계획 수립이 목적이다.

## 다음 작업: AGENTS local skill 섹션 제거

### 목표
- generated `AGENTS.md`에서 `Installed Local Skills` 섹션을 제거한다.
- project-local skill 경로와 mirror 설명은 `AGENTS.md`가 아니라 표준 auto-discovery와 README/onboarding에 맡긴다.
- 제거 후 불필요해지는 helper, 조건 분기, 회귀 테스트를 같이 정리한다.
- 완료 기준
  - 관련 회귀 테스트 갱신
  - `pnpm verify` 통과

## 다음 작업: README optional skills 동적 렌더

### 목표
- generated `README.md`의 Optional agent skills 섹션은 현재 설치 상태를 반영한다.
- project-local skill이 이미 설치되어 있으면 추천/설치 예시 대신 실제 설치된 skill 목록을 보여준다.
- project-local skill이 없을 때만 추천 목록과 `skills add` 설치 예시를 보여준다.
- 완료 기준
  - 설치/미설치 두 상태에 대한 회귀 테스트 추가
  - `pnpm verify` 통과

## 다음 작업: frontend-policy 조건부 decouple

### 목표
- scaffold 시 project-local core skill이 실제로 설치된 경우에만 `frontend-policy`와 root `biome.json`이 skill-aware reference를 사용한다.
- core skill이 없으면 lint/verify/doc 문구는 skill path 대신 제품 규칙으로 직접 말한다.
  - UI: TDS를 먼저 쓴다.
  - route: Granite 규칙을 쓴다.
- 분기 기준과 문구는 `frontend-policy` 한 곳에서 파생되게 정리한다.
- 완료 기준
  - root biome 기본값은 skill-free
  - local core skill 설치 시 root biome/doc이 skill-aware로 전환
  - `pnpm verify` 통과
