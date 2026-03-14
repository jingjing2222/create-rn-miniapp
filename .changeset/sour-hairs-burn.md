---
'create-rn-miniapp': patch
'@create-rn-miniapp/scaffold-templates': patch
---

Improve Firebase provider scaffolding and provisioning reliability across pnpm and yarn workspaces.

This patch:

- adds Firebase project provisioning during scaffold and `--add`, including existing-project selection, project creation recovery, Blaze billing checks, automatic `gcloud` install/auth recovery, and build service account IAM bootstrapping
- scaffolds a Firebase Functions-based `server` workspace plus Firebase Web SDK bootstrap for `frontend` and optional `backoffice`
- hardens Firebase Functions templates for monorepo package managers by installing nested dependencies correctly, isolating yarn functions installs, and adding `@google-cloud/functions-framework`
- improves Firebase deploy failure output with clearer cause summaries, Cloud Build links, and debug log tails so remote IAM and billing issues are easier to diagnose
- documents the generated Firebase `server` workspace and updates the root README to better explain the provider-based scaffold behavior
