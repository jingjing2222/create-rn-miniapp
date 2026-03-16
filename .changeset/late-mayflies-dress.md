---
'create-rn-miniapp': patch
'@create-rn-miniapp/scaffold-templates': patch
---

Improve generated Cloudflare server guidance and simplify the generated root TypeScript setup.

- stop generating a root `tsconfig.base.json` in scaffolded workspaces and remove related root template references
- add clearer Cloudflare token guidance to the generated TUI notes and `server/README.md`
- copy the Cloudflare token guide image into generated Cloudflare server workspaces and render it in the generated README when available
- clarify README coverage for generated `.env.local` files and Cloudflare Worker + D1 + R2 provisioning
