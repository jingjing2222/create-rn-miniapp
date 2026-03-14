---
'create-rn-miniapp': patch
'@create-rn-miniapp/scaffold-templates': patch
---

Improve package manager defaults and git initialization during interactive
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
