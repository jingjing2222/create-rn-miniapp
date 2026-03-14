# create-rn-miniapp

![Cloudflare scaffold flow](https://raw.githubusercontent.com/jingjing2222/create-rn-miniapp/main/cloudflare.gif)

`create-rn-miniapp`은 AppInToss MiniApp용 모노레포를 만든 뒤, Granite, `@apps-in-toss/framework` API, TDS를 바로 활용할 수 있게 실행 컨텍스트를 patch해주는 스캐폴딩 CLI예요.

이 도구는 앱 소스 전체를 자체 템플릿으로 복제하지 않아요. Granite, AppInToss, Supabase, Cloudflare, Firebase, Vite의 공식 scaffold를 먼저 실행하고, 그 결과물 위에 MiniApp 운영에 필요한 컨텍스트만 덧입혀요.

- `frontend`: Granite + `@apps-in-toss/framework` 기반 MiniApp scaffold와 실행 컨텍스트를 함께 맞춰줘요.
- `server`: optional Supabase, Cloudflare, Firebase server 워크스페이스와 provider별 운영 스크립트/문서를 넣어줘요.
- `backoffice`: optional Vite + React + TypeScript workspace를 만들어요.
- 루트: 선택한 package manager + `nx` + `biome` 기준으로 monorepo 설정을 맞춰줘요.
- 문서: `AGENTS.md`, `docs/ai`, `docs/engineering`, `docs/product`를 함께 넣어 AI와 개발자가 바로 작업할 수 있는 컨텍스트를 제공해요.

## 이 도구가 실제로 추가하는 것

공식 scaffold만으로는 바로 안 보이는 부분을 이 CLI가 같이 보강해줘요.

- Granite MiniApp이 `@apps-in-toss/framework`와 함께 바로 동작하도록 `granite.config.ts`, env 주입, monorepo `watchFolders`를 patch해요.
- TDS, Granite, AppInToss API를 빠르게 탐색할 수 있게 engineering docs와 인덱스 문서를 넣어줘요.
- 루트 monorepo에 `nx`, `biome`, workspace manifest, `project.json`을 맞춰서 검증 흐름을 통일해요.
- provider를 선택하면 인증, 기존 리소스 선택 또는 신규 리소스 생성, local workspace 연결, `.env.local` 작성까지 이어지는 IaC 흐름을 제공해요.
- `server` 워크스페이스별 `README.md`를 생성해서 디렉터리 구조, 주요 스크립트, `frontend`/`backoffice` 연결 방식을 설명해줘요.

## 빠른 시작

대화형으로 생성:

```bash
npm create rn-miniapp
```

또는

```bash
pnpm create rn-miniapp
```

또는

```bash
yarn create rn-miniapp
```

- 또는

```bash
bun create rn-miniapp
```

- `npm create rn-miniapp`로 시작하면 package manager는 `npm`으로 바로 맞춰져요.
- `pnpm create rn-miniapp`로 시작하면 package manager는 `pnpm`으로 바로 맞춰져요.
- `yarn create rn-miniapp`로 시작하면 package manager는 `yarn`으로 바로 맞춰져요.
- `bun create rn-miniapp`로 시작하면 package manager는 `bun`으로 바로 맞춰져요.
- package manager를 고르는 별도 선택 프롬프트는 이제 뜨지 않아요.
- 호출한 package manager를 감지하지 못하면 기본값으로 진행하지 않고, `--package-manager`를 직접 넣으라고 에러를 보여줘요.

옵션으로 한 번에 생성:

```bash
pnpm dlx create-rn-miniapp \
  --package-manager yarn \
  --name my-miniapp \
  --display-name "내 미니앱" \
  --server-provider supabase \
  --with-backoffice
```

생성이 끝나면 선택한 package manager로 검증해보면 돼요:

```bash
cd my-miniapp
pnpm verify
# 또는 yarn verify / npm run verify / bun run verify
```

## 생성되는 구조

```text
<appName>/
  frontend/
  backoffice/    # optional
  server/        # optional
  docs/
  AGENTS.md
  package.json
  nx.json
  pnpm-workspace.yaml  # pnpm일 때만
  package-lock.json    # npm일 때
  bun.lock             # bun일 때
  .yarnrc.yml          # yarn일 때만
  biome.json
  tsconfig.base.json
```

`docs/`는 단순 샘플 문서가 아니라, 생성 직후부터 작업 기준을 맞추기 위한 컨텍스트 문서예요.

- `docs/ai`
  - `Plan.md`, `Status.md`, `Decisions.md`, `Implement.md`, `Prompt.md`
  - 작업 계획, 현재 상태, 구현 메모, 프롬프트 기준을 기록하는 문서예요.
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

생성이 끝나면 바로 구현부터 들어가기보다, 먼저 `docs/product/기능명세서.md`에 만들 기능을 정리해두는 걸 권장해요. 그다음 `docs/ai/Plan.md`와 `docs/ai/Implement.md`를 함께 보면서, 방금 적은 기능 명세를 기준으로 구현을 하나씩 이끌어가면 돼요.

## CLI 옵션

- `--package-manager <pnpm|yarn|npm|bun>`: 생성과 루트 monorepo에 사용할 package manager를 명시할 수 있어요.
- `--add`: 이미 생성된 워크스페이스에 빠진 `server`/`backoffice`를 추가할 수 있어요.
- `--name`: Granite `appName`이자 생성 디렉터리 이름이에요.
- `--display-name`: 사용자에게 보이는 앱 이름이에요.
- `--server-provider <supabase|cloudflare|firebase>`: `server` 제공자를 명시할 수 있어요.
- `--server-project-mode <create|existing>`: `server` 원격 리소스를 새로 만들지, 기존 것을 쓸지 지정할 수 있어요.
- `--with-backoffice`: `backoffice` 워크스페이스를 포함해요.
- `--root-dir <dir>`: `--add`에서 수정할 기존 모노레포 루트예요. 기본값은 현재 디렉터리예요.
- `--output-dir <dir>`: 생성할 모노레포의 상위 디렉터리예요.
- `--no-git`: 생성 완료 후 루트 `git init`을 생략해요.
- `--skip-install`: 마지막 루트 package manager install과 Biome 정리를 생략해요.
- `--yes`: 선택형 질문을 기본값으로 진행해요.
- `--help`: 도움말을 출력해요.
- `--version`: 버전을 출력해요.

옵션으로 주지 않은 값은 한국어 프롬프트로 이어져요. package manager는 호출한 create 커맨드를 그대로 따라가요. 그래서 `npm create`, `pnpm create`, `yarn create`, `bun create`로 시작했으면 각각 그 값을 바로 사용해요. create 경로를 감지하지 못하면 기본값으로 숨기지 않고, `--package-manager`를 직접 넣으라고 에러를 내요. `server-provider`를 주면 바로 해당 provider로 `server`를 만들고, 옵션으로 주지 않으면 인터랙티브에서 `생성 안 함 + provider 목록`을 보여줘요. `--yes`를 쓰면 원격 연결은 건너뛰고 로컬 scaffold만 진행해요.

## Provider IaC

`server` provider를 선택하면 이 CLI는 단순히 `server/` 폴더만 만들지 않아요. provider 공식 CLI 인증 상태를 확인하고, 기존 원격 리소스 목록을 불러온 뒤, 기존 것을 연결하거나 새로 만들 수 있게 이어줘요. 이 과정에서 local workspace patch, env 작성, 기본 운영 스크립트까지 함께 맞춰줘요.

- `supabase`: 프로젝트 목록 조회, 신규 프로젝트 생성, `supabase link`, `db push`, Edge Functions deploy, key 조회, `.env.local` 작성
- `cloudflare`: account/Worker 목록 조회, 신규 Worker 생성, deploy, URL 계산, `.env.local` 작성
- `firebase`: 프로젝트 목록 조회, 신규 프로젝트 생성, Web App 목록 조회, Functions deploy, Web SDK config 조회, `.env.local` 작성

즉 `server` provider는 단순 scaffold가 아니라 provider 연결과 초기 운영 설정까지 포함한 IaC 흐름이에요.

## Supabase를 같이 만들면

`server` provider로 `supabase`를 선택하면 `server/`뿐 아니라 `frontend`와 optional `backoffice`에도 바로 연결할 수 있는 기본 파일을 같이 만들어줘요.

`frontend`:
- `src/env.d.ts`
- `src/lib/supabase.ts`
- `granite.config.ts` env plugin 및 monorepo `watchFolders` patch

`backoffice`:
- `src/vite-env.d.ts`
- `src/lib/supabase.ts`

`server`:
- `.env.local`
- `README.md`
- `supabase/functions/api/index.ts`
- `package.json`의 원격 `db:apply`, `functions:serve`, `functions:deploy` 스크립트

Supabase를 선택하면 먼저 기존 프로젝트 목록을 보여주고, 마지막 항목에서 새 프로젝트 생성도 선택할 수 있어요.

- 기존 프로젝트를 고르면 해당 프로젝트로 `server`를 link/db push 한 뒤 기본 Edge Function까지 deploy 하고, publishable key를 조회할 수 있으면 `frontend/.env.local`과 optional `backoffice/.env.local`까지 자동으로 작성해줘요.
- 새 프로젝트 생성을 고르면 스캐폴드 중 Supabase CLI로 프로젝트를 만든 뒤 같은 방식으로 link/db push, Edge Functions deploy, `.env.local` 작성을 이어가요.
- publishable key를 자동으로 못 가져온 경우에만 마지막에 Supabase 대시보드 API 설정 URL과 `.env.local` 예시를 안내해줘요.
- `server/.env.local`에는 `SUPABASE_PROJECT_REF`와 `SUPABASE_DB_PASSWORD` 자리를 함께 만들어 두고, `server/package.json`의 `db:apply`와 `functions:deploy`는 이 파일을 읽어 원격 작업을 실행해요.
- 기본 Edge Function은 `supabase/functions/api/index.ts`에 생성되고, `frontend`와 `backoffice`에서는 각자의 `src/lib/supabase.ts` client로 `supabase.functions.invoke('api')`를 바로 쓸 수 있어요.
- 로컬 DB가 필요하면 `db:apply:local`, `db:reset`를 그대로 쓸 수 있지만 기본 동선은 원격 `db:apply` 기준이에요.
- `server/README.md`에는 `supabase/config.toml`, migrations, Edge Functions, 주요 스크립트, `frontend`/`backoffice` Supabase 연결 방식을 정리해둬요.

`pnpm`은 root에 `pnpm-workspace.yaml`을 만들고, `yarn`/`npm`/`bun`은 `package.json.workspaces`를 사용해요. `yarn`을 선택하면 root에 `.yarnrc.yml`도 같이 생성돼요.
루트 workspace 등록도 고정되지 않고, 실제로 생성된 `frontend`/`server`/`backoffice`만 포함돼요.

## Cloudflare를 같이 만들면

`--server-provider cloudflare`를 쓰면 Cloudflare C3의 Worker only + TypeScript scaffold를 `server/`에 생성해요.

`frontend`:
- `src/env.d.ts`
- `src/lib/api.ts`
- `granite.config.ts` env plugin 및 monorepo `watchFolders` patch

`backoffice`:
- `src/vite-env.d.ts`
- `src/lib/api.ts`

`server`:
- `.env.local`
- `README.md`
- `package.json`의 원격 `deploy` 스크립트

Cloudflare를 선택하면 account를 고른 뒤 기존 Worker 목록을 먼저 보여주고, 마지막 항목에서 새 Worker 생성도 선택할 수 있어요.

- 기존 Worker를 고르면 해당 Worker 기준으로 URL을 계산할 수 있을 때 `frontend/.env.local`과 optional `backoffice/.env.local`까지 자동으로 작성해줘요.
- 새 Worker 생성을 고르면 Wrangler 로그인과 account 선택 뒤 Worker를 배포하고, `workers.dev` URL을 계산할 수 있으면 같은 방식으로 `.env.local`까지 자동으로 작성해줘요.
- URL을 자동으로 확정하지 못한 경우에만 마지막에 `.env.local`에 넣을 값을 안내해줘요.
- `server/.env.local`에는 `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_WORKER_NAME`, `CLOUDFLARE_API_BASE_URL` 자리를 함께 만들어 두고, `server/package.json`의 `deploy`는 `wrangler.jsonc` 기준으로 원격 Worker를 다시 배포해요.
- `server/README.md`에는 `wrangler.jsonc`, generated Worker 타입 파일, 주요 스크립트, `frontend`/`backoffice` API base URL 연결 방식을 정리해둬요.

## Firebase를 같이 만들면

`--server-provider firebase`를 쓰면 Firebase Functions 기반 `server/` 워크스페이스를 만들고, `frontend`와 optional `backoffice`에는 Firebase Web SDK 기본 연결 파일을 생성해요.

`frontend`:
- `src/env.d.ts`
- `src/lib/firebase.ts`
- `src/lib/firestore.ts`
- `src/lib/storage.ts`
- `granite.config.ts` env plugin 및 monorepo `watchFolders` patch

`backoffice`:
- `src/vite-env.d.ts`
- `src/lib/firebase.ts`
- `src/lib/firestore.ts`
- `src/lib/storage.ts`

`server`:
- `.firebaserc`
- `firebase.json`
- `functions/`
- `.env.local`
- `README.md`
- `package.json`의 `deploy`, `build`, `typecheck`, `logs`

Firebase를 선택하면 프로젝트 목록을 먼저 보여주고, 마지막 항목에서 새 프로젝트 생성도 바로 선택할 수 있어요. 이후 해당 프로젝트의 Web App 목록도 보여주고, 기존 App을 고르거나 새 Web App을 생성할 수 있어요.

- Web SDK config를 조회할 수 있으면 `frontend/.env.local`과 optional `backoffice/.env.local`에 `FIREBASE_*` 값을 자동으로 써줘요.
- `server/.env.local`에는 `FIREBASE_PROJECT_ID`, `FIREBASE_FUNCTION_REGION`, `GOOGLE_APPLICATION_CREDENTIALS` 자리를 만들어둬요.
- `server/functions/src/index.ts`에는 기본 HTTP 함수 `api`를 생성하고, 선택한 region으로 맞춰줘요.
- `server/package.json`의 `deploy`는 `server/functions` 의존성을 설치한 뒤 `firebase-tools deploy --only functions`를 실행해요.
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

`--add`는 root `package.json.packageManager`와 `frontend/granite.config.ts`를 읽어 기존 워크스페이스 정보를 감지한 뒤, 아직 없는 워크스페이스만 추가하고 root workspace manifest도 함께 갱신해줘요.

## 생성 기준

- `frontend`: [AppInToss React Native tutorial](https://developers-apps-in-toss.toss.im/tutorials/react-native.html)
- `server`: [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started), [Cloudflare C3](https://developers.cloudflare.com/workers/get-started/guide/), [Firebase CLI](https://firebase.google.com/docs/cli)
- `backoffice`: [Vite](https://vite.dev/guide/)

이 저장소는 앱 소스 전체를 템플릿으로 들고 있지 않아요. 공식 scaffold 결과에 루트 설정, docs 컨텍스트, provider IaC, 필요한 patch만 적용해요.

## 로컬 개발

저장소에서 CLI를 직접 테스트하려면 이렇게 하면 돼요:

```bash
pnpm install
pnpm verify
pnpm --filter create-rn-miniapp exec tsx src/index.ts --help
```

실제 스캐폴딩 스모크 테스트는 이렇게 해볼 수 있어요:

```bash
pnpm --filter create-rn-miniapp exec tsx src/index.ts \
  --package-manager yarn \
  --name local-miniapp \
  --display-name "로컬 미니앱" \
  --server-provider cloudflare \
  --with-backoffice \
  --output-dir /tmp
```
