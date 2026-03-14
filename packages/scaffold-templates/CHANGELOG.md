# @create-rn-miniapp/scaffold-templates

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
