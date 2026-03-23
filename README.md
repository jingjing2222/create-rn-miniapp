# create-rn-miniapp

![example](./example.gif)

`create-rn-miniapp`은 AppInToss MiniApp을 만들면서 필요하면 Supabase, Cloudflare, Firebase 같은 서버 인프라 SaaS도 바로 붙여줘요. 프로젝트 연결과 기본 env 반영까지 이어서, 생성 직후 바로 개발을 시작할 수 있게 문서와 optional agent skill 가이드까지 함께 준비해주는 CLI예요.

선택한 server provider 기준으로 프로젝트 생성/연결, 기본 원격 작업, frontend/backoffice `.env.local` 반영까지 이어줘요. 공식 scaffold 위에 필요한 운영 문서와 optional agent skill onboarding을 함께 준비해줘요. 그래서 앱을 만든 직후 "서버부터 다시 붙여야 하나?"를 줄이고, 바로 화면/API 작업으로 들어갈 수 있어요.

## 이런 경우에 잘 맞아요

- 서버 인프라 SaaS를 따로 세팅하지 않고, 생성 단계에서 바로 연동까지 끝내고 싶을 때
- 미니앱 개발에 필요한 스킬을 생성과 동시에 넣고 싶을 때
- frontend만이 아니라 optional `server`, `backoffice`까지 한 번에 시작하고 싶을 때

## 빠른 시작

대화형으로 생성:

```bash
npm create rn-miniapp
pnpm create rn-miniapp
yarn create rn-miniapp
bun create rn-miniapp
```

어떤 `create` 커맨드로 시작했는지에 따라 package manager가 자동으로 맞춰져요. 감지하지 못할 때만 `--package-manager`를 직접 넣으면 돼요.

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

생성이 끝나면 선택한 package manager로 한 번 확인해보면 돼요:

```bash
cd my-miniapp
pnpm verify
# 또는 yarn verify / npm run verify / bun run verify
```

## 생성하면 바로 준비돼요

- `frontend`는 Granite + `@apps-in-toss/framework` 기반으로 시작해요.
- 필요하면 `server`, `backoffice`도 같이 만들 수 있고, `server`는 선택한 SaaS provider 기준으로 바로 연결 흐름까지 이어져요.
- 루트에는 `AGENTS.md`, `CLAUDE.md`, `.github/copilot-instructions.md`, `docs/*`가 같이 들어가요.
- 루트 `verify`는 `nx`로 워크스페이스 작업 순서를 맞추고, `biome`으로 포맷과 lint 기준을 한 군데에서 관리해요.
- 그래서 생성 직후에도 루트에서 한 번에 검사 흐름을 맞출 수 있어요.

자세한 생성 구조와 운영 방식은 생성된 repo 문서를 보면 돼요.

## 생성한 다음엔 이렇게 보면 돼요

생성한 뒤에는 루트 `AGENTS.md`의 `Start Here`부터 보면 돼요.

그 흐름을 따라가면 지금 확인할 문서와 Skill이 자연스럽게 이어져요. 그래서 README에서 모든 작업 순서를 길게 외울 필요는 없어요.

<!-- generated:skills-strategy:start -->
## skills 전략
- `create-rn-miniapp`는 skill을 직접 관리하지 않고, 추천 skill과 설치 방법만 알려줘요.
- 실제 설치, 확인, 업데이트는 [`@vercel-labs/skills`](https://github.com/vercel-labs/skills) 표준 CLI로 바로 하면 돼요.
- 추천 목록에는 공식 `docs-search`, `project-validator`와 workspace overlay skill이 같이 들어가요.
- 이 저장소의 `skills/`는 scaffold/workspace 특화 overlay skill만 관리하고, 생성된 repo `README.md`가 추천 목록을 자동으로 보여줘요.

바로 설치할 수 있는 skill id와 용도는 이래요.

- `docs-search`: Apps-in-Toss / TDS 공식 문서 검색
- `project-validator`: AppInToss 프로젝트 구조 검증
- `granite-routing`: route / page / navigation 패턴
- `tds-ui`: TDS UI 선택과 form 패턴
- `backoffice-react`: backoffice React 작업
- `cloudflare-worker`: Cloudflare Worker 작업
- `supabase-project`: Supabase project 작업
- `firebase-functions`: Firebase Functions 작업
- `trpc-boundary`: tRPC boundary 변경

예를 들어 필요한 skill 하나를 바로 넣고 싶다면 이렇게 하면 돼요.

```bash
npx skills add toss/apps-in-toss-skills --skill docs-search --skill project-validator --copy
npx skills add jingjing2222/create-rn-miniapp --skill granite-routing --skill tds-ui --copy
```

설치 뒤에는 `npx skills list`, `npx skills check`, `npx skills update`만 기억하면 돼요.
<!-- generated:skills-strategy:end -->

## CLI 옵션은 `--help`로 확인해요

어떤 실행 방식이든 마지막에 `--help`를 붙이면 전체 옵션을 볼 수 있어요.

```bash
pnpm dlx create-rn-miniapp --help
```

처음엔 `package manager`, `server provider`, `backoffice`, `--add` 정도만 보면 충분해요.

필요할 때만 `--server-project-mode`, `--root-dir`, `--output-dir`, `--skip-install` 같은 세부 옵션까지 보면 돼요.

<!-- generated:server-provider:start -->
## server provider 고르기

- `supabase`: DB와 Functions를 같이 빠르게 시작하고 싶을 때
- `cloudflare`: edge runtime과 binding 중심으로 가고 싶을 때
- `firebase`: Functions, Firestore, Web SDK 흐름이 익숙할 때

상세 연결 순서와 운영 방식은 생성된 repo의 `server/README.md`와 루트 문서를 보면 돼요.
<!-- generated:server-provider:end -->

## 기존 워크스페이스에 나중에 붙이기

이미 만든 루트에서 빠진 workspace만 나중에 붙이고 싶다면 `--add`를 쓰면 돼요.

현재 디렉터리 기준:

```bash
create-miniapp --add --server-provider supabase
create-miniapp --add --with-backoffice
```

다른 경로의 기존 루트를 수정하려면:

```bash
create-miniapp --add --root-dir /path/to/existing-miniapp --server-provider cloudflare --with-backoffice
```

`--add`는 기존 워크스페이스 정보를 읽고, 아직 없는 workspace만 추가해줘요.

## 생성 기준

- `frontend`: [AppInToss React Native tutorial](https://developers-apps-in-toss.toss.im/tutorials/react-native.html)
- `server`: [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started), [Cloudflare C3](https://developers.cloudflare.com/workers/get-started/guide/), [Firebase CLI](https://firebase.google.com/docs/cli)
- `backoffice`: [Vite](https://vite.dev/guide/)
