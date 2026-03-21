# create-rn-miniapp

![example](https://raw.githubusercontent.com/jingjing2222/create-rn-miniapp/main/example.gif)

`create-rn-miniapp`은 AppInToss MiniApp용 모노레포를 만든 뒤, 공식 scaffold 위에 `AGENTS.md`, `CLAUDE.md`, `docs/*`, `.agents/skills`, `.claude/skills`를 자동으로 만들어줘요.

그래서 생성 직후부터 에이전트와 사람이 같은 문서와 Skill을 보면서 바로 작업을 시작할 수 있어요. 단순 폴더 생성기가 아니라, 문서와 Skill까지 한 번에 갖춘 실행 기반을 만들어주는 스캐폴딩 CLI예요.

이 도구는 앱 소스 전체를 자체 템플릿으로 복제하지 않아요. Granite, AppInToss, Supabase, Cloudflare, Firebase, Vite의 공식 scaffold를 먼저 실행하고, 그 결과물 위에 MiniApp 운영에 필요한 컨텍스트만 덧입혀요.

생성된 repo는 lint와 `verify`로도 TDS와 Granite 기준 쪽으로 계속 유도해요. 이건 단순 취향 강제가 아니라, 에이전트가 작업하다가 컨텍스트를 놓치고 `react-native` 기본 UI나 우회 경로로 새는 걸 초반부터 막기 위한 룰이에요.

- `frontend`: Granite + `@apps-in-toss/framework` 기반 MiniApp scaffold와 작업 기반을 함께 맞춰줘요.
- `server`: optional Supabase, Cloudflare, Firebase server 워크스페이스와 provider별 운영 문서를 넣어줘요.
- `backoffice`: optional Vite + React + TypeScript workspace를 만들어요.
- 루트: 선택한 package manager + `nx` + `biome` 기준으로 monorepo 설정을 맞춰줘요.
- 문서/Skill: `AGENTS.md`, `CLAUDE.md`, `.github/copilot-instructions.md`, `.agents/skills`, `.claude/skills`, `docs/*`를 함께 넣어 AI와 개발자가 바로 작업할 수 있는 기반을 제공해요.

## 이 도구가 실제로 추가하는 것

공식 scaffold만으로는 바로 안 보이는 부분을 이 CLI가 같이 보강해줘요.

- Granite MiniApp이 `@apps-in-toss/framework`와 함께 바로 동작하도록 config, env 주입, monorepo 연동을 patch해요.
- TDS, Granite, AppInToss API를 바로 찾고 따라갈 수 있게 작업 문서와 Skill을 함께 만들어줘요.
- 루트 monorepo에 `nx`, `biome`, workspace manifest, `project.json`을 맞춰서 검증 흐름을 통일해요.
- provider를 선택하면 인증, 기존 리소스 선택 또는 신규 리소스 생성, local workspace 연결까지 이어지는 IaC 흐름을 제공해요.
- Cloudflare에 tRPC를 같이 고르면 shared boundary package와 router package를 기준으로 client workspace가 타입 경계를 공유하게 맞춰줘요.
- 각 생성물은 루트 계약 문서와 workspace 문서를 기준으로 다시 렌더돼서, optional workspace 조합이나 `--add` 이후 상태도 문서와 Skill에 반영돼요.

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

생성이 끝나면 선택한 package manager로 검증해보면 돼요:

```bash
cd my-miniapp
pnpm verify
# 또는 yarn verify / npm run verify / bun run verify
```

## 생성물 계약

이 CLI가 만드는 건 단순 폴더 뼈대가 아니라, MiniApp이 Granite, `@apps-in-toss/framework`, TDS 기준으로 바로 작업될 수 있게 문서, Skill, 검증 흐름까지 포함한 실행 기반이에요.

- 생성물 루트에는 `AGENTS.md`, `CLAUDE.md`, `.github/copilot-instructions.md`, `docs/*`, `.agents/skills`, `.claude/skills`가 함께 들어가요.
- optional workspace를 선택하면 해당 workspace와 맞는 문서/Skill 라우팅도 같이 다시 계산돼요.
- `.claude/skills`는 scaffold 시점에 `.agents/skills`에서 자동으로 생성되는 mirror예요.

정확한 생성 구조와 provider별 세부 파일/스크립트/env 키는 생성된 repo 문서를 기준으로 보면 돼요.

생성이 끝나면 생성물 루트 `AGENTS.md`의 `Start Here` 순서를 먼저 따라가세요. 그 흐름대로 `docs/ai/*`, `docs/index.md`, `docs/product/기능명세서.md`를 확인한 뒤, 해당 작업에 맞는 `.agents/skills/*`를 선택해서 구현을 이끌어가면 돼요.

현재 Skill 이름, 라벨, docs path, optional 선택 기준은 `packages/create-rn-miniapp/src/templates/skill-catalog.ts`가 소유해요.

- generated `.agents/skills`와 `.claude/skills`는 이 catalog에서 같이 렌더돼요.
- `.claude/skills`는 이 기준 이름을 그대로 mirror해요.

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
- `--skip-install`: 마지막 루트 package manager install과 Biome 정리를 생략해요.
- `--yes`: 선택형 질문을 기본값으로 진행해요.
- `--help`: 도움말을 출력해요.
- `--version`: 버전을 출력해요.

옵션으로 주지 않은 값은 한국어 프롬프트로 이어져요. package manager는 호출한 create 커맨드를 그대로 따라가요. 그래서 `npm create`, `pnpm create`, `yarn create`, `bun create`로 시작했으면 각각 그 값을 바로 사용해요. create 경로를 감지하지 못하면 기본값으로 숨기지 않고, `--package-manager`를 직접 넣으라고 에러를 내요. `server-provider`를 주면 바로 해당 provider로 `server`를 만들고, 옵션으로 주지 않으면 인터랙티브에서 `생성 안 함 + provider 목록`을 보여줘요. `--yes`를 쓰면 원격 연결은 건너뛰고 로컬 scaffold만 진행해요.

## Provider IaC

`server` provider를 선택하면 이 CLI는 provider 공식 CLI 인증 상태를 확인하고, 기존 원격 리소스를 연결하거나 새로 만드는 흐름까지 이어줘요. local workspace patch, 연결 문서, 검증 흐름도 같이 맞춰서 단순 폴더 생성으로 끝내지 않아요.

- `supabase`: 프로젝트 연결과 기본 DB / Functions 운영 동선을 맞춰줘요.
- `cloudflare`: Worker와 storage/binding 연결 흐름을 맞춰주고, 필요하면 tRPC boundary까지 같이 올려줘요.
- `firebase`: Functions / Firestore / Web SDK 연결 흐름을 초기 상태부터 이어갈 수 있게 맞춰줘요.

`cloudflare`를 고르면 tRPC overlay도 같이 이어줄지 물어봐요. tRPC를 고르면 shared boundary package와 router package를 기준으로 client workspace는 그 타입만 가져가도록 맞춰줘요.

provider별 세부 생성물과 운영 순서는 생성된 `server/README.md`, 루트 `AGENTS.md`, `docs/index.md`를 기준으로 보면 됩니다.

provider가 있는 생성물은 `server/.create-rn-miniapp/state.json`도 같이 만들어서 `serverProvider`, `serverProjectMode`, `remoteInitialization`, `trpc`, `backoffice` 상태를 기록해요. 원격 명령 전에는 이 파일과 `server/README.md`를 먼저 보면 됩니다.

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
