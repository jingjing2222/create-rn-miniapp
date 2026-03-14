# create-rn-miniapp

`create-rn-miniapp`은 AppInToss MiniApp용 모노레포를 한 번에 생성하는 CLI입니다.

- `frontend`: Granite + `@apps-in-toss/framework` 기반 MiniApp
- `server`: optional Supabase 또는 Cloudflare workspace
- `backoffice`: optional Vite + React + TypeScript workspace
- 루트: 선택한 package manager + `nx` + `biome` 기준 monorepo 설정과 하네스 문서

## 빠른 시작

대화형으로 생성:

```bash
pnpm create rn-miniapp
```

또는

```bash
yarn create rn-miniapp
```

옵션으로 한 번에 생성:

```bash
pnpm dlx create-rn-miniapp \
  --package-manager yarn \
  --name my-miniapp \
  --display-name "내 미니앱" \
  --server-provider supabase \
  --with-backoffice
```

생성이 끝나면 선택한 package manager로 검증합니다:

```bash
cd my-miniapp
pnpm verify
# 또는 yarn verify
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
  .yarnrc.yml          # yarn일 때만
  biome.json
  tsconfig.base.json
```

## CLI 옵션

- `--package-manager <pnpm|yarn>`: 생성과 루트 monorepo에 사용할 package manager
- `--add`: 이미 생성된 워크스페이스에 빠진 `server`/`backoffice` 추가
- `--name`: Granite `appName`이자 생성 디렉터리 이름
- `--display-name`: 사용자에게 보이는 앱 이름
- `--with-server`: `server` 워크스페이스 포함. 호환성 기본값은 `supabase`입니다.
- `--server-provider <supabase|cloudflare>`: `server` 제공자 명시
- `--server-project-mode <create|existing>`: `server` 원격 리소스를 새로 만들지, 기존 것을 쓸지 지정
- `--with-backoffice`: `backoffice` 워크스페이스 포함
- `--root-dir <dir>`: `--add`에서 수정할 기존 모노레포 루트. 기본값은 현재 디렉터리
- `--output-dir <dir>`: 생성할 모노레포의 상위 디렉터리
- `--skip-install`: 마지막 루트 package manager install과 Biome 정리를 생략
- `--yes`: 선택형 질문을 기본값으로 진행
- `--help`: 도움말 출력
- `--version`: 버전 출력

옵션으로 주지 않은 값은 한국어 프롬프트로 이어지며, package manager 선택이 가장 먼저 나옵니다. `server-provider`를 선택하면 provider의 기존 원격 리소스 목록을 먼저 보여주고, 마지막 항목에서 새로 만들기도 바로 선택할 수 있습니다. `--yes`를 쓰면 원격 연결은 건너뛰고 로컬 scaffold만 진행합니다.

## Supabase를 같이 만들면

`--with-server` 또는 `--server-provider supabase`를 쓰면 `server/`뿐 아니라 `frontend`와 optional `backoffice`에도 바로 연결할 수 있는 기본 파일을 생성합니다.

`frontend`:
- `src/env.d.ts`
- `src/lib/supabase.ts`
- `granite.config.ts` env plugin 및 monorepo `watchFolders` patch

`backoffice`:
- `src/vite-env.d.ts`
- `src/lib/supabase.ts`

`server`:
- `.env.local`
- `package.json`의 원격 `db:apply` 스크립트

Supabase를 선택하면 먼저 기존 프로젝트 목록을 보여주고, 마지막 항목에서 새 프로젝트 생성도 선택할 수 있습니다.

- 기존 프로젝트를 고르면 해당 프로젝트로 `server`를 link/db push 하고, publishable key를 조회할 수 있으면 `frontend/.env.local`과 optional `backoffice/.env.local`까지 자동으로 작성합니다.
- 새 프로젝트 생성을 고르면 스캐폴드 중 Supabase CLI로 프로젝트를 만든 뒤 같은 방식으로 link/db push 와 `.env.local` 작성을 이어갑니다.
- publishable key를 자동으로 못 가져온 경우에만 마지막에 Supabase 대시보드 API 설정 URL과 `.env.local` 예시를 안내합니다.
- `server/.env.local`에는 `SUPABASE_PROJECT_REF`와 `SUPABASE_DB_PASSWORD` 자리를 함께 만들어 두고, `server/package.json`의 `db:apply`는 이 파일을 읽어 원격 `supabase db push`를 실행합니다.
- 로컬 DB가 필요하면 `db:apply:local`, `db:reset`를 그대로 사용할 수 있지만 기본 동선은 원격 `db:apply` 기준입니다.

`yarn`을 선택하면 root에는 `.yarnrc.yml`과 `package.json.workspaces`가 생성되고, `pnpm-workspace.yaml`은 생성되지 않습니다.
루트 workspace 등록도 고정되지 않고, 실제로 생성된 `frontend`/`server`/`backoffice`만 포함됩니다.

## Cloudflare를 같이 만들면

`--server-provider cloudflare`를 쓰면 Cloudflare C3의 Worker only + TypeScript scaffold를 `server/`에 생성합니다.

`frontend`:
- `src/env.d.ts`
- `src/lib/api.ts`
- `granite.config.ts` env plugin 및 monorepo `watchFolders` patch

`backoffice`:
- `src/vite-env.d.ts`
- `src/lib/api.ts`

Cloudflare를 선택하면 account를 고른 뒤 기존 Worker 목록을 먼저 보여주고, 마지막 항목에서 새 Worker 생성도 선택할 수 있습니다.

- 기존 Worker를 고르면 해당 Worker 기준으로 URL을 계산할 수 있을 때 `frontend/.env.local`과 optional `backoffice/.env.local`까지 자동으로 작성합니다.
- 새 Worker 생성을 고르면 Wrangler 로그인과 account 선택 뒤 Worker를 배포하고, `workers.dev` URL을 계산할 수 있으면 같은 방식으로 `.env.local`까지 자동으로 작성합니다.
- URL을 자동으로 확정하지 못한 경우에만 마지막에 `.env.local`에 넣을 값을 안내합니다.

## 기존 워크스페이스에 추가하기

이미 생성된 루트에서 `server`나 `backoffice`만 나중에 붙이고 싶으면 `--add`를 사용합니다.

현재 디렉터리 기준:

```bash
create-miniapp --add --with-server
create-miniapp --add --with-backoffice
```

다른 경로의 기존 루트를 수정하려면:

```bash
create-miniapp --add --root-dir /path/to/existing-miniapp --with-server --with-backoffice
```

`--add`는 root `package.json.packageManager`와 `frontend/granite.config.ts`를 읽어 기존 워크스페이스 정보를 감지한 뒤, 아직 없는 워크스페이스만 추가하고 root workspace manifest도 함께 갱신합니다.

## 생성 기준

- `frontend`: [AppInToss React Native tutorial](https://developers-apps-in-toss.toss.im/tutorials/react-native.html)
- `server`: [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started), [Cloudflare C3](https://developers.cloudflare.com/workers/get-started/guide/)
- `backoffice`: [Vite](https://vite.dev/guide/)

이 저장소는 앱 소스 전체를 템플릿으로 들고 있지 않습니다. 공식 scaffold 결과에 루트 설정, 문서, 필요한 patch만 적용합니다.

## 로컬 개발

저장소에서 CLI를 직접 테스트하려면:

```bash
pnpm install
pnpm verify
pnpm --filter create-rn-miniapp exec tsx src/index.ts --help
```

실제 스캐폴딩 스모크 테스트:

```bash
pnpm --filter create-rn-miniapp exec tsx src/index.ts \
  --package-manager yarn \
  --name local-miniapp \
  --display-name "로컬 미니앱" \
  --server-provider cloudflare \
  --with-backoffice \
  --output-dir /tmp
```
