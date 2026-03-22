# create-rn-miniapp

![example](./example.gif)

`create-rn-miniapp`은 AppInToss MiniApp을 만들고, 생성 직후부터 바로 작업을 시작할 수 있게 문서와 optional agent skill 가이드까지 함께 준비해주는 CLI예요.

공식 scaffold 위에 필요한 운영 문서와 optional agent skill onboarding을 함께 준비해줘요. 그래서 앱을 만든 직후 "이제 어디부터 보면 되지?"를 줄여줘요.

## 이런 경우에 잘 맞아요

- 공식 scaffold는 유지하고, 팀이 바로 쓸 작업 문맥만 얹고 싶을 때
- MiniApp에서 자주 쓰는 agent skill을 나중에 표준 CLI로 붙일 수 있으면 좋을 때
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
- 필요하면 `server`, `backoffice`도 같이 만들 수 있어요.
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
- 이 저장소의 `skills/`에는 MiniApp 작업에 맞춘 skill source가 들어 있고, 생성된 repo `README.md`가 추천 목록을 자동으로 보여줘요.

예를 들어 필요한 skill 하나를 바로 넣고 싶다면 이렇게 하면 돼요.

```bash
npx skills add jingjing2222/create-rn-miniapp --skill miniapp-capabilities --copy
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
