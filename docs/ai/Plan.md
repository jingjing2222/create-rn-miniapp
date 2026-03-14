## 작업명
`create-miniapp` 오케스트레이션 CLI 구현

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
2. `server/.env.local`에는 적어도 `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_WORKER_NAME`, `CLOUDFLARE_API_BASE_URL` 자리를 유지한다.
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
8. `packages/scaffold-templates/root/tsconfig.base.json`
9. `packages/scaffold-templates/root/*.project.json`
10. `packages/scaffold-templates/base/AGENTS.md`
11. `packages/scaffold-templates/base/docs/ai/Plan.md`
12. `packages/scaffold-templates/base/docs/ai/Status.md`
13. `packages/scaffold-templates/base/docs/ai/Implement.md`
14. `packages/scaffold-templates/base/docs/ai/Decisions.md`
15. `packages/scaffold-templates/base/docs/ai/Prompt.md`
16. `packages/scaffold-templates/base/docs/product/기능명세서.md`
17. Granite/TDS 참조 안내 문서

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
   - `packages/scaffold-templates/root/*` 기반으로 root `package.json`, `pnpm-workspace.yaml`, `nx.json`, `biome.json`, `tsconfig.base.json` 생성
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
   - `nx.json`, `biome.json`, `tsconfig.base.json`, `docs/`, `AGENTS.md`는 add mode에서 기본적으로 건드리지 않는다.
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
