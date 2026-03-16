# @create-rn-miniapp/scaffold-templates

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

## 0.0.12

### Patch Changes

- 4d01199: Cloudflare server provisioning now guides users through selecting or creating a Worker, D1 database, and R2 bucket in one flow, then writes the resulting bindings and metadata back into the generated workspace.

  Cloudflare and Firebase server workspaces now include deploy scripts that can read auth and project metadata from `server/.env.local`, making repeat deploys easier after initial provisioning.

  Cloudflare provisioning notes now explain exactly where to create an API token, which template to start from, and where to paste the secret into `server/.env.local`.

  Firebase provisioning now retries Cloud Build default service account checks for up to five attempts with visible TUI progress after Blaze billing or Cloud Build setup, so newly created projects do not fail too early on eventual-consistency delays.

  Engineering docs, README copy, and user-facing TUI notes were updated together so the provisioning flow reads in the same softer `~요` tone across Cloudflare and Firebase.

## 0.0.11

### Patch Changes

- 610de24: Normalize generated `vitest` test scripts to `vitest run` so workspace tests finish in non-interactive Nx runs.

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

## 0.0.7

### Patch Changes

- 1e0fa08: Improve Yarn PnP scaffolds with package extensions and SDK generation, and clean up frontend Supabase env scaffolding to use `import.meta.env` with Node types configured via tsconfig.
- 1fb6443: Make root workspace manifests reflect only the workspaces that actually exist during initial scaffold and `--add`.
- 1a9a6d4: Add `--add` mode so existing workspaces can attach missing `server` and `backoffice` apps after the initial scaffold.

## 0.0.6

### Patch Changes

- 281bf88: Use remote Nx schema URLs instead of local node_modules-relative schema paths in the workspace and generated templates.

## 0.0.5

### Patch Changes

- 0e3bc72: feat: 하네스 문서 수정
- 0bcd9de: Add package manager selection with Yarn Berry support, manager-aware root templates, and updated generated docs.

## 0.0.4

### Patch Changes

- 0d72f3d: Improve interactive CLI prompting so missing options can be filled in Korean with arrow-key navigation, space-to-select, and enter-to-confirm behavior.
- b7cbe67: Normalize generated frontend and backoffice tsconfig files to plain JSON, set their `compilerOptions.module` to `esnext`, and keep the published template package version aligned with the CLI release.

## 0.0.3

### Patch Changes

- 1065057: Fix published scaffold template packaging so root `.gitignore` is included in the tarball and scaffold generation no longer fails during template overlay.

## 0.0.2

### Patch Changes

- 4725346: fix: dependencies

## 0.0.1

### Patch Changes

- bcbf09a: Initialize public release workflow with Changesets and prepare the first published versions of `create-rn-miniapp` and `@create-rn-miniapp/scaffold-templates`.
