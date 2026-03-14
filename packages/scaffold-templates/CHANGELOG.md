# @create-rn-miniapp/scaffold-templates

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
