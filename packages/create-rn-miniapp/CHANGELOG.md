# create-rn-miniapp

## 0.1.3

### Patch Changes

- ddf3137: skill 관련 source of truth를 다시 정리했어요.

  이제 skill 이름/라벨은 root `skills/*/SKILL.md` frontmatter에서 파생되고, frontend policy shared reference도 code-owned renderer 기준으로 재생성돼요. README, 설치 명령, 테스트 기대값도 같은 source를 보도록 맞춰서 skill 목록이나 repo slug를 바꿔도 여러 파일을 수동으로 같이 고칠 필요를 줄였어요.

- 139fa79: frontend policy를 optional skill 설치 상태와 분리했어요.

  이제 생성된 workspace의 `biome.json`과 `docs/engineering/frontend-policy.md`는 local skill 설치 여부와 무관하게 항상 같은 TDS/Granite 규칙을 사용해요. optional skill은 lint 정책을 바꾸지 않고 README onboarding에만 영향을 줘요.

- Updated dependencies [139fa79]
  - @create-rn-miniapp/scaffold-templates@0.1.3

## 0.1.2

### Patch Changes

- 1715a13: optional skills 전략을 `@vercel-labs/skills` 표준 CLI 중심으로 단순화했습니다.

  - canonical skill source를 workspace package가 아니라 repo root `skills/` plain directory로 정리했습니다.
  - generated repo는 skill을 기본 포함하지 않고, optional install guide와 `npx skills ...` 표준 흐름만 안내하도록 바꿨습니다.
  - skill 설치 상태 판별, frontend policy reference, generated README/contract 문구가 실제 project-local skill 경로에서 파생되도록 SSoT를 정리했습니다.

- Updated dependencies [1715a13]
  - @create-rn-miniapp/scaffold-templates@0.1.2

## 0.1.1

### Patch Changes

- 33355b2: `tds-ui`를 self-contained decision skill로 다시 정리하고, generated catalog/anomaly/reference/rules를 패키지 안에서 닫아 공개 문서와 실제 export 차이를 일관되게 다루도록 맞췄습니다.

  또한 generated repo의 `.agents/skills/tds-ui`가 오래된 snapshot이면 최신 package/docs를 다시 읽어 `catalog.json`, `anomalies.json`, `catalog.md`, `AGENTS.md`, `metadata.json`을 자동으로 갱신하는 self-refresh hook을 추가했습니다. refresh는 malformed output만 막고, 네트워크나 파싱 실패가 나면 warning만 남기고 기존 snapshot으로 계속 진행합니다.

  `create-rn-miniapp`은 이 refresh hook과 회귀 테스트를 생성물에 함께 복사하도록 갱신했고, 현재 npm dist-tag 상태에서는 `latest`가 아직 `1.x`일 때만 `@toss/tds-react-native@2.0.2`를 예외로 선택하고 `latest`가 `2.x` 이상이면 그대로 최신 버전을 따르도록 맞췄습니다.

  이번 변경 묶음은 생성물 안내 계약과 skill scaffold 결과를 같이 맞추기 위해 `@create-rn-miniapp/scaffold-templates`도 함께 patch로 올립니다.

- 908ace4: skill taxonomy를 새 canonical 이름 체계로 정리하고 생성물의 skill mirror가 같은 구조를 따르도록 맞췄습니다.

  server provider skill에서 instance state와 원격 변경 절차를 분리하고, generated repo의 scaffold 상태를 `server/.create-rn-miniapp/state.json`과 `server/README.md`가 소유하도록 정리했습니다.

  또한 `--add` 실행 시 기존 server scaffold state를 보존하도록 보강했고, Remote Ops 및 다음 명령 안내가 shared script metadata를 기준으로 일관되게 파생되도록 중복을 제거했습니다.

- Updated dependencies [33355b2]
- Updated dependencies [908ace4]
  - @create-rn-miniapp/scaffold-templates@0.1.1
  - @create-rn-miniapp/agent-skills@0.1.1

## 0.1.0

### Minor Changes

- 04c5d45: `create-rn-miniapp` 스캐폴드 기본 구조를 skill 중심 계약/문서 체계로 재편했습니다.

  `@create-rn-miniapp/scaffold-templates`는 `AGENTS.md`, `CLAUDE.md`, `.github/copilot-instructions.md`, dynamic docs, root verify/scripts 구성을 새 scaffold 구조에 맞게 갱신했습니다.

  `@create-rn-miniapp/agent-skills`를 새 canonical skill source로 추가하고, 생성 시 `.agents/skills`와 `.claude/skills` mirror를 함께 만들도록 정리했습니다.

  `--add` 이후에도 실제 workspace 상태를 기준으로 문서와 optional skill이 다시 렌더되도록 generator 구조를 리팩토링했습니다.

### Patch Changes

- Updated dependencies [04c5d45]
  - @create-rn-miniapp/scaffold-templates@0.1.0
  - @create-rn-miniapp/agent-skills@0.1.0

## 0.0.26

### Patch Changes

- chore: version bump to 0.0.26
- Updated dependencies
  - @create-rn-miniapp/scaffold-templates@0.0.26

## 0.0.25

### Patch Changes

- revert: control-root 기반 --worktree scaffold 되돌림
- Updated dependencies
  - @create-rn-miniapp/scaffold-templates@0.0.25

## 0.0.24

### Patch Changes

- 072c6f8: 기존 원격 프로젝트 연결 경로의 후속 보정을 반영합니다.

  - Firebase 기존 프로젝트에서 원격 초기화를 건너뛰어도 Blaze 확인과 build IAM 권한 준비는 계속 진행합니다.
  - Supabase 기존 프로젝트에서 원격 초기화를 건너뛴 뒤에도 generated root Biome과 server 스크립트가 깨지지 않도록 보정합니다.

- Updated dependencies [072c6f8]
  - @create-rn-miniapp/scaffold-templates@0.0.24

## 0.0.23

### Patch Changes

- fe51d66: 기존 원격 리소스에 연결할 때 초기화 여부를 provider별로 먼저 고르게 바꿨습니다.

  - Supabase, Firebase, Cloudflare에서 기존 원격 리소스를 고르면 `원격에 있는 내용을 초기화할까요?`를 먼저 물어봅니다.
  - 초기화를 건너뛰면 기존 리소스와 메타데이터만 연결하고, DB 반영이나 Functions/Worker 배포 같은 원격 변경은 자동으로 하지 않습니다.
  - 마지막 안내, 생성되는 `server/README.md`, provider 운영 문서도 같은 분기 기준으로 다시 정리했습니다.

- Updated dependencies [fe51d66]
  - @create-rn-miniapp/scaffold-templates@0.0.23

## 0.0.22

### Patch Changes

- 9503926: Granite 하네스 문서와 MiniApp API 인덱스를 공식 개발자센터 기준으로 다시 정리했습니다.

  TDS React Native 인덱스도 실제 패키지 export와 공개 문서를 비교하는 방식으로 보강했습니다.

  frontend 구현 동선이 `AGENTS.md`와 하네스 실행가이드를 통해 참고 문서까지 자연스럽게 이어지도록 정리했습니다.

- Updated dependencies [9503926]
  - @create-rn-miniapp/scaffold-templates@0.0.22

## 0.0.21

### Patch Changes

- fb8d872: Improve Firebase scaffolds and workspace React alignment.

  - enable the Firestore API and create the default database during Firebase provisioning
  - generate Firestore-ready server bootstrap files and deploy Firestore rules and indexes alongside Functions
  - add Firebase frontend Granite crypto shims and resolver aliases so `ait build` works with Firebase SDK crypto imports
  - align backoffice React and React type packages to the frontend versions to avoid hoist mismatches
  - clarify that shared tRPC workspaces are Cloudflare-only in the README

- e0106dd: Refine generated Granite config scaffolding.

  - split generated frontend Granite helper logic into `scaffold.preset.ts`
  - keep `granite.config.ts` thin while preserving visible `plugin-env` usage
  - move provider env bindings and Firebase resolver helpers behind scaffold-specific exports

- Updated dependencies [fb8d872]
  - @create-rn-miniapp/scaffold-templates@0.0.21

## 0.0.20

### Patch Changes

- 98c4fe5: Refine the Supabase server scaffold path.

  - remove Supabase from the supported tRPC provider set and keep `--trpc` Cloudflare-only
  - replace the Supabase server `typecheck` placeholder with a real Edge Function entrypoint check that runs `deno check`
  - update generated Supabase docs and READMEs to match the provider-native workflow

- cec93f4: Avoid re-selecting a freshly created Supabase project by polling for the new project ref before continuing.
- Updated dependencies [98c4fe5]
- Updated dependencies [cec93f4]
  - @create-rn-miniapp/scaffold-templates@0.0.20

## 0.0.19

### Patch Changes

- 29d24d9: chore: typo
- 62f4c6b: Build generated tRPC shared packages with `tsdown` and expose both ESM and CJS exports.
- Updated dependencies [29d24d9]
- Updated dependencies [62f4c6b]
  - @create-rn-miniapp/scaffold-templates@0.0.19

## 0.0.18

### Patch Changes

- e8ece25: Improve the generated frontend starter and guardrails.

  - move frontend native/UI guardrails into generated Biome rules and keep Granite `$param` routes in verify
  - replace the frontend starter animation with the Marketing Lottie asset and wire it through `@granite-js/native/lottie-react-native`
  - refresh generated starter pages, Granite config repo root handling, and README guidance about TDS/Granite guardrails

- Updated dependencies [e8ece25]
  - @create-rn-miniapp/scaffold-templates@0.0.18

## 0.0.17

### Patch Changes

- 3d635f7: Upgrade generated frontend guardrails to Biome 2 and improve policy guidance.

  - upgrade repo and generated workspaces to `@biomejs/biome@^2.4.7`
  - move native module, AsyncStorage, and RN primitive restrictions into generated Biome lint rules
  - keep Granite `$param` route validation in a dedicated verify script
  - include engineering doc paths in generated lint and verify error messages

- Updated dependencies [3d635f7]
  - @create-rn-miniapp/scaffold-templates@0.0.17

## 0.0.16

### Patch Changes

- Fix Cloudflare server env scaffolding so the public Worker URL is no longer written to `server/.env.local`.

  - Keep the public Worker URL in frontend and backoffice env files only
  - Preserve Cloudflare deploy metadata in `server/.env.local` without `CLOUDFLARE_API_BASE_URL`
  - Remove legacy `CLOUDFLARE_API_BASE_URL` entries on subsequent server env writes

- Updated dependencies
  - @create-rn-miniapp/scaffold-templates@0.0.16

## 0.0.15

### Patch Changes

- 06338fc: Refactor the optional tRPC overlay to separate shared contracts from the shared router package.

  - Replace the single `packages/trpc` workspace with `packages/contracts` and `packages/app-router`
  - Wire Supabase and Cloudflare tRPC scaffolds to the new shared package layout
  - Rewrite generated README and engineering docs so API schema and `AppRouter` responsibilities stay clear

- 40d4236: Add the tRPC boundary type rule to generated AGENTS files only when tRPC is scaffolded.

  - Inject Golden Rule 8 into `AGENTS.md` only for repos that include `packages/trpc`
  - Keep non-tRPC repos free of the extra boundary type rule
  - Cover both marker-based and legacy AGENTS patching paths in template tests

- Updated dependencies [06338fc]
- Updated dependencies [40d4236]
  - @create-rn-miniapp/scaffold-templates@0.0.15

## 0.0.14

### Patch Changes

- 5db058d: Finish the generated frontend TypeScript config for tRPC overlays.

  - Add `moduleResolution: "bundler"` and `noEmit: true` alongside `allowImportingTsExtensions`
  - Keep the fix scoped to `supabase` and `cloudflare` frontends when tRPC is enabled
  - Cover the full tsconfig combination in patching tests

- Updated dependencies [5db058d]
  - @create-rn-miniapp/scaffold-templates@0.0.14

## 0.0.13

### Patch Changes

- c20302b: Improve provider auth guidance for Supabase and Firebase.

  - Add clearer Supabase and Firebase deploy auth guidance to generated notes and `server/README.md`
  - Add `SUPABASE_ACCESS_TOKEN` to generated `server/.env.local` so non-interactive redeploy setup is visible
  - Copy Supabase and Firebase auth guide screenshots into generated server workspaces when those providers are selected

- 61252ef: Add an optional tRPC overlay for Supabase and Cloudflare server providers.

  - Prompt for optional tRPC setup when `supabase` or `cloudflare` is selected, and support the same flow with `--trpc`
  - Generate a shared `packages/trpc` workspace so clients import `AppRouter` types from a workspace package instead of reaching into `server` with relative paths
  - Wire Cloudflare Workers to import `@workspace/trpc` directly at runtime and connect Supabase Edge Functions through function-local `deno.json` import aliases instead of a sync step
  - Generate provider-specific `src/lib/trpc.ts` clients for `frontend` and `backoffice`
  - When tRPC is enabled, let Granite frontend workspaces typecheck shared source exports by enabling `allowImportingTsExtensions`
  - When Cloudflare tRPC is enabled, treat `src/lib/trpc.ts` as the primary client and avoid generating `src/lib/api.ts`; in `--add --trpc`, ask whether existing Cloudflare API helpers should be removed
  - Generate Cloudflare `wrangler.vitest.jsonc` and `vitest.config.mts` so Worker tests use local D1/R2 bindings instead of deploy-time remote bindings
  - Only add tRPC API source-of-truth guidance to generated `AGENTS.md` and `server/README.md` when tRPC is actually scaffolded
  - Normalize generated root workspace manifests to use `packages/*` so future shared packages can be added without changing the root workspace shape
  - Update generated server guides and root README to explain the new tRPC workspace and provider-specific behavior

- 485b298: Improve generated Cloudflare server guidance and simplify the generated root TypeScript setup.

  - stop generating a root `tsconfig.base.json` in scaffolded workspaces and remove related root template references
  - add clearer Cloudflare token guidance to the generated TUI notes and `server/README.md`
  - copy the Cloudflare token guide image into generated Cloudflare server workspaces and render it in the generated README when available
  - clarify README coverage for generated `.env.local` files and Cloudflare Worker + D1 + R2 provisioning

- Updated dependencies [c20302b]
- Updated dependencies [61252ef]
- Updated dependencies [485b298]
  - @create-rn-miniapp/scaffold-templates@0.0.13

## 0.0.12

### Patch Changes

- 4d01199: Cloudflare server provisioning now guides users through selecting or creating a Worker, D1 database, and R2 bucket in one flow, then writes the resulting bindings and metadata back into the generated workspace.

  Cloudflare and Firebase server workspaces now include deploy scripts that can read auth and project metadata from `server/.env.local`, making repeat deploys easier after initial provisioning.

  Cloudflare provisioning notes now explain exactly where to create an API token, which template to start from, and where to paste the secret into `server/.env.local`.

  Firebase provisioning now retries Cloud Build default service account checks for up to five attempts with visible TUI progress after Blaze billing or Cloud Build setup, so newly created projects do not fail too early on eventual-consistency delays.

  Engineering docs, README copy, and user-facing TUI notes were updated together so the provisioning flow reads in the same softer `~요` tone across Cloudflare and Firebase.

- Updated dependencies [4d01199]
  - @create-rn-miniapp/scaffold-templates@0.0.12

## 0.0.11

### Patch Changes

- 610de24: Normalize generated `vitest` test scripts to `vitest run` so workspace tests finish in non-interactive Nx runs.
- Updated dependencies [610de24]
  - @create-rn-miniapp/scaffold-templates@0.0.11

## 0.0.10

### Patch Changes

- d33c640: Add npm and bun package manager support to the generator and detect the invoking package manager automatically for `npm create`, `pnpm create`, `yarn create`, and `bun create`.

  Improve Firebase provisioning by automating more Google Cloud setup steps, handling Cloud Build API and default build service account detection, and making Firebase Functions scaffolding work more reliably across package managers.

  Generate npm-specific `.npmrc` files for root and workspace packages so npm installs and Firebase Functions nested installs can consistently use `legacy-peer-deps` without command-specific flags.

  Add `publish:dev` support for timestamped prerelease publishes and update generated provider docs and README guidance to match the new package manager and provisioning flows.

- 5fefa4d: Stop generating an unused `resolveOptionalMiniappEnv()` helper in
  `frontend/granite.config.ts` for providers that only need required env values.

  Supabase and Cloudflare scaffolds now emit a cleaner Granite config, while
  Firebase keeps the optional helper for `MINIAPP_FIREBASE_MEASUREMENT_ID`.

- Updated dependencies [d33c640]
- Updated dependencies [5fefa4d]
  - @create-rn-miniapp/scaffold-templates@0.0.10

## 0.0.9

### Patch Changes

- 25f6076: Improve package manager defaults and git initialization during interactive
  scaffolding.

  `pnpm create rn-miniapp` now defaults to `pnpm` and `yarn create rn-miniapp`
  now defaults to `yarn` without showing the package manager prompt first.
  `npm create rn-miniapp` keeps the existing package manager selection prompt so
  users can choose between `pnpm` and `yarn`.

  Add a `--no-git` option so scaffolded workspaces can skip the root `git init`
  step when users want to manage repository initialization themselves.

  Update the root README to explain the invocation-based package manager behavior,
  the new `--no-git` option, and the matching `npm`, `pnpm`, and `yarn` create
  commands.

- Updated dependencies [25f6076]
  - @create-rn-miniapp/scaffold-templates@0.0.9

## 0.0.8

### Patch Changes

- 097e827: Add provider-based server provisioning for Supabase and Cloudflare during scaffold and `--add` flows.

  This patch:

  - keeps server scaffolding behind provider adapters so `supabase` and `cloudflare` can each own their CLI flow, workspace patching, and follow-up bootstrap behavior
  - adds Cloudflare Workers support through C3, normalizes Wrangler schema references to remote URLs, and cleans up generated workspace tooling to fit the root monorepo setup
  - runs provider IaC as part of scaffolding by listing existing remote projects/workers, allowing direct selection or creation, and then writing local env files when values can be resolved automatically
  - writes provider-specific `server/README.md` files so generated workspaces explain their directory structure, scripts, and how they connect to `frontend` and `backoffice`
  - improves generated README/docs context so new MiniApps clearly explain the Granite, `@apps-in-toss/framework`, TDS, and provider setup that this tool patches on top of the official scaffolds

- d0fce6a: Add Supabase Edge Functions to the Supabase server provider flow and soften user-facing README tone.

  This patch:

  - scaffolds a default Supabase Edge Function (`api`) right after `supabase init`
  - adds `functions:serve` and `functions:deploy` scripts to the generated Supabase `server` workspace
  - updates Supabase provisioning to run `link -> db push -> functions deploy` and keeps `server/.env.local` ready for both remote database pushes and function deploys
  - expands generated Supabase server documentation so the workspace explains migrations, Edge Functions, and how `frontend` and optional `backoffice` can call `supabase.functions.invoke('api')`
  - rewrites root and package README copy into a softer Toss-style `~요` tone for user-facing guidance

- 99a4709: Improve Firebase provider scaffolding and provisioning reliability across pnpm and yarn workspaces.

  This patch:

  - adds Firebase project provisioning during scaffold and `--add`, including existing-project selection, project creation recovery, Blaze billing checks, automatic `gcloud` install/auth recovery, and build service account IAM bootstrapping
  - scaffolds a Firebase Functions-based `server` workspace plus Firebase Web SDK bootstrap for `frontend` and optional `backoffice`
  - hardens Firebase Functions templates for monorepo package managers by installing nested dependencies correctly, isolating yarn functions installs, and adding `@google-cloud/functions-framework`
  - improves Firebase deploy failure output with clearer cause summaries, Cloud Build links, and debug log tails so remote IAM and billing issues are easier to diagnose
  - documents the generated Firebase `server` workspace and updates the root README to better explain the provider-based scaffold behavior

- bde177c: Improve the generated workspace docs so optional guidance only shows up when that workspace actually exists.

  Generated apps now add backoffice React guidance and server-provider engineering docs only when `backoffice` or a specific `server` provider is selected, instead of always shipping those references in the base template.

  Refactor the `create-rn-miniapp` source tree to reduce oversized root files by moving provider, patching, scaffold, and template logic into dedicated directories, colocating their tests, and removing non-`index` barrel files.

- Updated dependencies [097e827]
- Updated dependencies [d0fce6a]
- Updated dependencies [99a4709]
- Updated dependencies [bde177c]
  - @create-rn-miniapp/scaffold-templates@0.0.8

## 0.0.7

### Patch Changes

- 1e0fa08: Improve Yarn PnP scaffolds with package extensions and SDK generation, and clean up frontend Supabase env scaffolding to use `import.meta.env` with Node types configured via tsconfig.
- 1fb6443: Make root workspace manifests reflect only the workspaces that actually exist during initial scaffold and `--add`.
- 1a9a6d4: Add `--add` mode so existing workspaces can attach missing `server` and `backoffice` apps after the initial scaffold.
- Updated dependencies [1e0fa08]
- Updated dependencies [1fb6443]
- Updated dependencies [1a9a6d4]
  - @create-rn-miniapp/scaffold-templates@0.0.7

## 0.0.6

### Patch Changes

- 281bf88: Use remote Nx schema URLs instead of local node_modules-relative schema paths in the workspace and generated templates.
- Updated dependencies [281bf88]
  - @create-rn-miniapp/scaffold-templates@0.0.6

## 0.0.5

### Patch Changes

- 0e3bc72: feat: 하네스 문서 수정
- 0bcd9de: Add package manager selection with Yarn Berry support, manager-aware root templates, and updated generated docs.
- Updated dependencies [0e3bc72]
- Updated dependencies [0bcd9de]
  - @create-rn-miniapp/scaffold-templates@0.0.5

## 0.0.4

### Patch Changes

- b7cbe67: Add Supabase-aware frontend and backoffice bootstrap files during scaffold, migrate source patching to SWC AST transforms, and ensure Granite watches the monorepo root via `metro.watchFolders`.
- 0d72f3d: Improve interactive CLI prompting so missing options can be filled in Korean with arrow-key navigation, space-to-select, and enter-to-confirm behavior.
- b7cbe67: Normalize generated frontend and backoffice tsconfig files to plain JSON, set their `compilerOptions.module` to `esnext`, and keep the published template package version aligned with the CLI release.
- Updated dependencies [0d72f3d]
- Updated dependencies [b7cbe67]
  - @create-rn-miniapp/scaffold-templates@0.0.4

## 0.0.3

### Patch Changes

- 1065057: Fix published scaffold template packaging so root `.gitignore` is included in the tarball and scaffold generation no longer fails during template overlay.
- Updated dependencies [1065057]
  - @create-rn-miniapp/scaffold-templates@0.0.3

## 0.0.2

### Patch Changes

- 4725346: fix: dependencies
- Updated dependencies [4725346]
  - @create-rn-miniapp/scaffold-templates@0.0.2

## 0.0.1

### Patch Changes

- bcbf09a: Initialize public release workflow with Changesets and prepare the first published versions of `create-rn-miniapp` and `@create-rn-miniapp/scaffold-templates`.
- Updated dependencies [bcbf09a]
  - @create-rn-miniapp/scaffold-templates@0.0.1
