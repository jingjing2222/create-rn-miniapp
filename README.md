# create-rn-miniapp

![example](https://raw.githubusercontent.com/jingjing2222/create-rn-miniapp/main/example.gif)

`create-rn-miniapp`은 AppInToss MiniApp용 모노레포를 만든 뒤, 에이전트가 Granite, `@apps-in-toss/framework` API, TDS를 바로 활용할 수 있게 실행 컨텍스트를 patch해주는 스캐폴딩 CLI예요.

이 도구는 앱 소스 전체를 자체 템플릿으로 복제하지 않아요. Granite, AppInToss, Supabase, Cloudflare, Firebase, Vite의 공식 scaffold를 먼저 실행하고, 그 결과물 위에 MiniApp 운영에 필요한 컨텍스트만 덧입혀요.

생성된 repo는 lint와 `verify`로도 TDS와 Granite 기준 쪽으로 계속 유도해요. 이건 단순 취향 강제가 아니라, 에이전트가 작업하다가 컨텍스트를 놓치고 `react-native` 기본 UI나 우회 경로로 새는 걸 초반부터 막기 위한 룰이에요.

- `frontend`: Granite + `@apps-in-toss/framework` 기반 MiniApp scaffold와 실행 컨텍스트를 함께 맞춰줘요.
- `server`: optional Supabase, Cloudflare, Firebase server 워크스페이스와 provider별 운영 스크립트/문서를 넣어줘요.
- `backoffice`: optional Vite + React + TypeScript workspace를 만들어요.
- 루트: 선택한 package manager + `nx` + `biome` 기준으로 monorepo 설정을 맞춰줘요.
- 문서: `AGENTS.md`, `docs/ai`, `docs/engineering`, `docs/product`를 함께 넣어 AI와 개발자가 바로 작업할 수 있는 컨텍스트를 제공해요.

## 이 도구가 실제로 추가하는 것

공식 scaffold만으로는 바로 안 보이는 부분을 이 CLI가 같이 보강해줘요.

- Granite MiniApp이 `@apps-in-toss/framework`와 함께 바로 동작하도록 `granite.config.ts`, `scaffold.preset.ts`, env 주입, monorepo `watchFolders`를 patch해요.
- TDS, Granite, AppInToss API를 빠르게 탐색할 수 있게 engineering docs와 인덱스 문서를 넣어줘요.
- 루트 monorepo에 `nx`, `biome`, workspace manifest, `project.json`을 맞춰서 검증 흐름을 통일해요.
- provider를 선택하면 인증, 기존 리소스 선택 또는 신규 리소스 생성, local workspace 연결, `.env.local` 작성까지 이어지는 IaC 흐름을 제공해요.
- Cloudflare에 tRPC를 같이 고르면 `packages/contracts`를 boundary schema SSOT로, `packages/app-router`를 route shape와 `AppRouter` SSOT로 만들고, `frontend`/`backoffice`는 상대 경로 대신 shared type만 가져오게 맞춰줘요.
- `server` 워크스페이스별 `README.md`를 생성해서 디렉터리 구조, 주요 스크립트, `frontend`/`backoffice` 연결 방식을 설명해줘요.

## 빠른 시작

대화형으로 생성:

```bash
npm create rn-miniapp
pnpm create rn-miniapp
yarn create rn-miniapp
bun create rn-miniapp
```

어떤 `create` 커맨드로 시작했는지에 따라 package manager가 자동으로 맞춰져요. 별도 선택 프롬프트는 없고, 호출한 package manager를 감지하지 못할 때만 `--package-manager`를 직접 넣으라고 안내해요.

옵션으로 한 번에 생성:

```bash
pnpm dlx create-rn-miniapp \
  --package-manager yarn \
  --name my-miniapp \
  --display-name "내 미니앱" \
  --server-provider cloudflare \
  --trpc \
  --with-backoffice
```

생성이 끝나면 실제 repo root에서 검증해보면 돼요.

- single-root라면 `cd my-miniapp` 뒤에 `pnpm verify`를 실행해요.
- `--worktree`라면 `cd my-miniapp/main` 뒤에 `pnpm verify`를 실행해요.
- package manager가 다르면 `yarn verify`, `npm run verify`, `bun run verify`로 바꿔서 실행해요.

기본 생성 결과는 single-root예요. 다만 `--worktree`를 고르거나 마지막 질문에서 worktree를 선택하면 local 구조를 control root로 만들어 줘요.

- root에 `.gitdata/`, local stub `AGENTS.md`, `.claude/CLAUDE.md`, `README.md`를 만들어요.
- 실제 기본 checkout은 `main/`에 두고, 새 작업용 worktree는 control root 바로 아래 sibling으로 만들게 유도해요.
- `main/`에는 scaffold baseline commit을 먼저 만들어 둬서 표준 `git -C main worktree add ... main` 명령이 바로 동작해요.
- `.gitdata/hooks/post-merge`에 merged된 clean worktree를 정리하는 hook을 설치해요.

기본값은 worktree 미사용이에요. 마지막 git 단계 직전에 `에이전트가 worktree를 사용하게 할까요? (멀티 에이전트 환경에 유리합니다)`라고 한 번 더 물어봐요. `--worktree`를 주면 그 질문 없이 바로 활성화되고, `--no-git`이면 이 단계는 건너뛰어요.

이 repo를 AI/멀티-agent용 control root 구조로 운영해야해요. plain clone 대신 빈 디렉토리에서 아래 순서로 시작해요.

```bash
mkdir my-miniapp
cd my-miniapp
git clone --separate-git-dir=.gitdata <repo-url> main
node main/scripts/worktree/bootstrap-control-root.mjs
```

이렇게 시작하면 clone-visible repo 내용은 그대로 유지하면서 local control root만 `.gitdata/ + main/ + sibling worktree` 구조로 맞출 수 있어요.

## 생성되는 구조

single-root 기본값은 이렇습니다.

```text
<appName>/
  frontend/
  packages/contracts/   # optional (cloudflare + trpc)
  packages/app-router/  # optional (cloudflare + trpc)
  backoffice/           # optional
  server/               # optional
  docs/
  AGENTS.md
  package.json
  nx.json
  biome.json
```

`--worktree`를 활성화했다면 구조가 이렇게 바뀌어요.

```text
<appName>/
  .gitdata/
  AGENTS.md            # local control-root stub
  .claude/CLAUDE.md    # local control-root stub
  README.md            # local control-root stub
  main/
    frontend/
    packages/contracts/   # optional
    packages/app-router/  # optional
    backoffice/           # optional
    server/               # optional
    docs/
    AGENTS.md
    README.md
    package.json
    nx.json
    biome.json
  feat-login/
```

- 새 작업은 control root에서 `git -C main worktree add -b <branch-name> ../<branch-name> main`으로 시작해요.
- 브랜치명에는 `/`를 쓰지 않고 1-depth kebab-case만 써요. 예: `feat-login`.
- worktree는 control root 바로 아래 sibling path에 만들어요.
- `main/`에는 scaffold baseline commit이 이미 있어서 이 명령을 바로 실행할 수 있어요.
- 구현, 커밋, 푸시, PR 생성은 새 worktree 안에서 진행해요.
- `main/` checkout 최신화는 보통 control root에서 `git -C main pull --ff-only`를 권장해요. 이 표준 경로로 갱신하면 main에 반영된 clean worktree는 post-merge hook으로 같이 정리돼요.
- 자세한 규칙은 생성된 repo의 `main/docs/engineering/worktree-workflow.md`를 보면 돼요.

`docs/`는 단순 샘플 문서가 아니라, 생성 직후부터 작업 기준을 맞추기 위한 컨텍스트 문서예요.

- `docs/ai`
  - `Plan.md`, `Status.md`, `Decisions.md`, `Prompt.md`
  - 작업 계획, 현재 상태, 결정사항, 프롬프트 기준을 기록하는 문서예요.
- `docs/engineering`
  - `granite-ssot.md`
  - `appsintoss-granite-api-index.md`
  - `appsintoss-granite-full-api-index.md`
  - `tds-react-native-index.md`
  - 기타 MiniApp 운영 규칙과 참고 문서를 담고 있어요.
- `docs/product`
  - `기능명세서.md`
  - 기능 요구사항과 제품 맥락을 정리하는 시작점이에요.

즉 이 저장소가 만드는 건 단순 폴더 구조가 아니라, MiniApp이 Granite, `@apps-in-toss/framework`, TDS를 원활하게 사용할 수 있도록 문서와 설정까지 포함한 작업 컨텍스트예요.

생성이 끝나면 바로 구현부터 들어가기보다, 먼저 `docs/product/기능명세서.md`에 만들 기능을 정리해두는 걸 권장해요. 그다음 `docs/ai/Plan.md`로 구현 순서를 세우고, 진행하면서 `docs/ai/Status.md`와 `docs/ai/Decisions.md`를 갱신해가면 돼요.

## CLI 옵션

- `--package-manager <pnpm|yarn|npm|bun>`: 생성과 루트 monorepo에 사용할 package manager를 명시할 수 있어요.
- `--add`: 이미 생성된 워크스페이스에 빠진 `server`/`backoffice`를 추가할 수 있어요.
- `--name`: Granite `appName`이자 생성 디렉터리 이름이에요.
- `--display-name`: 사용자에게 보이는 앱 이름이에요.
- `--server-provider <supabase|cloudflare|firebase>`: `server` 제공자를 명시할 수 있어요.
- `--server-project-mode <create|existing>`: `server` 원격 리소스를 새로 만들지, 기존 것을 쓸지 지정할 수 있어요.
- `--trpc`: `cloudflare` 위에 optional tRPC overlay를 같이 만들어요.
- `--with-backoffice`: `backoffice` 워크스페이스를 포함해요.
- `--root-dir <dir>`: `--add`에서 수정할 기존 모노레포 루트예요. 기본값은 현재 디렉터리예요.
- `--output-dir <dir>`: 생성할 모노레포의 상위 디렉터리예요.
- `--no-git`: 생성 완료 후 루트 `git init`을 생략해요.
- `--worktree`: control root 아래 `main/` 기본 checkout과 sibling worktree 운영 구조를 활성화해요.
- `--skip-install`: 마지막 루트 package manager install과 Biome 정리를 생략해요.
- `--yes`: 선택형 질문을 기본값으로 진행해요.
- `--help`: 도움말을 출력해요.
- `--version`: 버전을 출력해요.

옵션으로 주지 않은 값은 한국어 프롬프트로 이어져요. package manager는 호출한 create 커맨드를 그대로 따라가요. 그래서 `npm create`, `pnpm create`, `yarn create`, `bun create`로 시작했으면 각각 그 값을 바로 사용해요. create 경로를 감지하지 못하면 기본값으로 숨기지 않고, `--package-manager`를 직접 넣으라고 에러를 내요. `server-provider`를 주면 바로 해당 provider로 `server`를 만들고, 옵션으로 주지 않으면 인터랙티브에서 `생성 안 함 + provider 목록`을 보여줘요. `--yes`를 쓰면 원격 연결은 건너뛰고 로컬 scaffold만 진행해요.

## Provider IaC

`server` provider를 선택하면 이 CLI는 단순히 `server/` 폴더만 만들지 않아요. provider 공식 CLI 인증 상태를 확인하고, 기존 원격 리소스 목록을 불러온 뒤, 기존 것을 연결하거나 새로 만들 수 있게 이어줘요. 이 과정에서 local workspace patch, env 작성, 기본 운영 스크립트까지 함께 맞춰줘요.

- `supabase`: 프로젝트 목록 조회, 신규 프로젝트 생성, `supabase link`, `db push`, Edge Functions deploy, key 조회, `.env.local` 작성
- `cloudflare`: account/Worker 목록 조회, 신규 Worker 생성, D1/R2 연결, deploy, URL 계산, `.env.local` 작성
- `firebase`: 프로젝트 목록 조회, 신규 프로젝트 생성, Web App 목록 조회, Firestore API와 `(default)` database 준비, Functions + Firestore 리소스 deploy, Web SDK config 조회, deploy auth `.env.local` 작성

`cloudflare`를 고르면 tRPC도 같이 이어줄지 물어봐요. tRPC를 고르면 `packages/contracts`가 boundary schema와 type의 source of truth가 되고, `packages/app-router`가 router와 `AppRouter` 타입의 source of truth가 돼요. `frontend`/`backoffice`는 `src/lib/trpc.ts`를 통해 그 타입만 가져와요.

즉 `server` provider는 단순 scaffold가 아니라 provider 연결과 초기 운영 설정까지 포함한 IaC 흐름이에요.

## Provider 공통 생성

`server`를 생성하게 선택하면 `server/`뿐 아니라 `frontend`와 optional `backoffice`에도 provider 연결에 필요한 공통 기본 파일을 같이 만들어줘요.

`frontend`:
- `.env.local`
- `src/env.d.ts`
- `granite.config.ts` / `scaffold.preset.ts` patch와 monorepo `watchFolders` 연결

`backoffice`:
- `.env.local`
- `src/vite-env.d.ts`

provider별 client/bootstrap 파일은 각 provider 섹션에서 따로 설명해요.

## Supabase를 같이 만들면

아래 파일을 추가로 생성해요.

`server`:
- `.env.local`
- `README.md`
- `supabase/functions/api/index.ts`
- `package.json`의 원격 `db:apply`, `functions:serve`, `functions:deploy` 스크립트

Supabase를 선택하면 먼저 기존 프로젝트 목록을 보여주고, 마지막 항목에서 새 프로젝트 생성도 선택할 수 있어요.

- 기존 프로젝트를 고르면 먼저 원격에 있는 내용을 초기화할지 물어봐요.
- 기존 프로젝트에서 초기화를 건너뛰면 해당 프로젝트로 `server`만 link 하고, 필요할 때 `server`에서 `db:apply`, `functions:deploy`를 직접 실행하면 돼요.
- 기존 프로젝트에서 초기화할게요를 고르면 `db push`와 기본 Edge Function deploy까지 이어가요.
- 새 프로젝트 생성을 고르면 스캐폴드 중 Supabase CLI로 프로젝트를 만든 뒤 `link`, `db push`, Edge Functions deploy, `.env.local` 작성을 이어가요.
- publishable key를 자동으로 못 가져온 경우에만 마지막에 Supabase 대시보드 API 설정 URL과 `.env.local` 예시를 안내해줘요.
- `server/.env.local`에는 `SUPABASE_PROJECT_REF`와 `SUPABASE_DB_PASSWORD` 자리를 함께 만들어 두고, `server/package.json`의 `db:apply`와 `functions:deploy`는 이 파일을 읽어 원격 작업을 실행해요.
- 기본 Edge Function은 `supabase/functions/api/index.ts`에 생성되고, `frontend`와 `backoffice`에서는 각자의 `src/lib/supabase.ts` client로 `supabase.functions.invoke('api')`를 바로 쓸 수 있어요.
- 로컬 DB가 필요하면 `db:apply:local`, `db:reset`를 그대로 쓸 수 있지만 기본 동선은 원격 `db:apply` 기준이에요.
- `server/README.md`에는 `supabase/config.toml`, migrations, Edge Functions, 주요 스크립트, `frontend`/`backoffice` Supabase 연결 방식을 정리해둬요.

## Cloudflare를 같이 만들면

`--server-provider cloudflare`를 쓰면 Cloudflare C3 기반 `server/` 워크스페이스를 만들고, Worker deploy와 함께 D1 database, R2 bucket 연결까지 같이 맞춰줘요.

`server`:
- `.env.local`
- `README.md`
- `package.json`의 원격 `deploy` 스크립트

tRPC를 같이 고르면:
- `packages/contracts/`
- `packages/app-router/`
- `server/src/trpc/context.ts`
- `frontend/src/lib/trpc.ts`
- `backoffice/src/lib/trpc.ts`

Cloudflare를 선택하면 account를 고른 뒤 기존 Worker 목록을 먼저 보여주고, 마지막 항목에서 새 Worker 생성도 선택할 수 있어요.

- 기존 Worker를 고르면 먼저 원격에 있는 내용을 초기화할지 물어봐요.
- 기존 Worker에서 초기화를 건너뛰면 기존 D1/R2만 연결하고, 배포나 `workers.dev` 활성화는 자동으로 하지 않아요.
- 기존 Worker에서 초기화할게요를 고르면 Worker 재배포와 `workers.dev` 활성화까지 이어가요.
- 새 Worker 생성을 고르면 Wrangler 로그인과 account 선택 뒤 Worker를 배포하고, D1 database와 R2 bucket도 기존 것을 고르거나 새로 만들 수 있어요. `workers.dev` URL을 계산할 수 있으면 같은 방식으로 `.env.local`까지 자동으로 작성해줘요.
- URL을 자동으로 확정하지 못한 경우에만 마지막에 `.env.local`에 넣을 값을 안내해줘요.
- `server/.env.local`에는 `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_WORKER_NAME`, `CLOUDFLARE_D1_DATABASE_ID`, `CLOUDFLARE_D1_DATABASE_NAME`, `CLOUDFLARE_R2_BUCKET_NAME`, `CLOUDFLARE_API_TOKEN` 자리를 함께 만들어 두고, `server/package.json`의 `deploy`는 이 파일을 읽어 원격 Worker를 다시 배포해요.
- `server/wrangler.jsonc`에는 `DB` D1 binding과 `STORAGE` R2 binding을 같이 맞춰줘요.
- plain mode면 `frontend/src/lib/api.ts`, `backoffice/src/lib/api.ts`를 기준으로 Worker를 호출해요.
- tRPC를 같이 고르면 `packages/contracts`가 boundary schema SSOT가 되고, `packages/app-router`가 canonical router가 돼요. Worker runtime은 `@workspace/app-router`를 직접 import해서 같은 router를 바로 써요. 이 경우 client 기본 진입점도 `src/lib/trpc.ts`예요.
- `server/README.md`에는 `wrangler.jsonc`, generated Worker 타입 파일, 주요 스크립트, `frontend`/`backoffice` API base URL 연결 방식을 정리해둬요.

## Firebase를 같이 만들면

`--server-provider firebase`를 쓰면 Firebase Functions 기반 `server/` 워크스페이스를 만들고, `frontend`와 optional `backoffice`에는 Firebase Web SDK 기본 연결 파일을 생성해요.

`server`:
- `.firebaserc`
- `firebase.json`
- `functions/`
- `.env.local`
- `README.md`
- `package.json`의 `deploy`, `build`, `typecheck`, `logs`

Firebase를 선택하면 프로젝트 목록을 먼저 보여주고, 마지막 항목에서 새 프로젝트 생성도 바로 선택할 수 있어요. 이후 해당 프로젝트의 Web App 목록도 보여주고, 기존 App을 고르거나 새 Web App을 생성할 수 있어요.

- 기존 프로젝트를 고르면 먼저 원격에 있는 내용을 초기화할지 물어봐요.
- 기존 프로젝트에서 초기화를 건너뛰어도 Blaze와 build IAM 확인은 먼저 하고, 기존 Web App과 연결값만 정리한 뒤 Firestore 준비와 Functions/Firestore 배포는 자동으로 하지 않아요.
- 기존 프로젝트에서 초기화할게요를 고르면 Firestore 준비와 Functions/Firestore 배포까지 이어가요.
- Web SDK config를 조회할 수 있으면 `frontend/.env.local`과 optional `backoffice/.env.local`에 `FIREBASE_*` 값을 자동으로 써줘요.
- `server/.env.local`에는 `FIREBASE_PROJECT_ID`, `FIREBASE_FUNCTION_REGION`, `FIREBASE_TOKEN`, `GOOGLE_APPLICATION_CREDENTIALS` 자리를 만들어둬요.
- Firestore API와 `(default)` Firestore database도 같이 준비해요.
- `server/functions/src/index.ts`에는 기본 HTTP 함수 `api`를 생성하고, 선택한 region으로 맞춰줘요.
- `server/firestore.rules`, `server/firestore.indexes.json`, `server/scripts/firebase-ensure-firestore.mjs`, `server/functions/src/public-status.ts`, `server/functions/src/seed-public-status.ts`도 같이 만들어서 Firestore bootstrap 흐름을 바로 이어갈 수 있게 해줘요.
- `server/package.json`의 `deploy`는 `server/functions` 의존성을 설치한 뒤 `server/.env.local`의 auth 값을 읽어 `firebase-tools deploy --only functions,firestore:rules,firestore:indexes`를 실행해요.
- `server/package.json`의 `setup:public-status`는 Firestore 준비, rules/indexes 배포, 기본 status 문서 seed를 한 번에 실행해요.
- `frontend/src/lib/public-app-status.ts`는 Firestore direct read를 먼저 시도하고, 권한 오류면 `getPublicStatus` callable function으로 fallback 해요.
- `frontend/scaffold.preset.ts`는 `process.cwd()` 기준으로 `.env.local`을 읽어 `ait build`가 `.granite` 아래에서 실행돼도 같은 Firebase env를 주입하고, `granite.config.ts`는 그 scaffold preset만 얇게 연결해요.
- `server/README.md`에는 Functions 구조, 주요 스크립트, `frontend`/`backoffice` Firebase 연결 방식을 정리해둬요.

## 기존 워크스페이스에 추가하기

이미 생성된 루트에서 `server`나 `backoffice`만 나중에 붙이고 싶으면 `--add`를 쓰면 돼요.

현재 디렉터리 기준:

```bash
create-miniapp --add --server-provider supabase
create-miniapp --add --with-backoffice
```

다른 경로의 기존 루트를 수정하려면:

```bash
create-miniapp --add --root-dir /path/to/existing-miniapp --server-provider cloudflare --with-backoffice
```

표준 입력은 repo root예요. 다만 worktree checkout 경로를 넘겨도 CLI가 실제 repo root를 찾아서 반영해줘요.

`--add`는 root `package.json.packageManager`와 `frontend/granite.config.ts`를 읽어 기존 워크스페이스 정보를 감지한 뒤, 아직 없는 워크스페이스만 추가하고 root workspace manifest도 함께 갱신해줘요.

## 생성 기준

- `frontend`: [AppInToss React Native tutorial](https://developers-apps-in-toss.toss.im/tutorials/react-native.html)
- `server`: [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started), [Cloudflare C3](https://developers.cloudflare.com/workers/get-started/guide/), [Firebase CLI](https://firebase.google.com/docs/cli)
- `backoffice`: [Vite](https://vite.dev/guide/)
