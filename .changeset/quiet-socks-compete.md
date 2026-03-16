---
"create-rn-miniapp": patch
"@create-rn-miniapp/scaffold-templates": patch
---

Add the tRPC boundary type rule to generated AGENTS files only when tRPC is scaffolded.

- Inject Golden Rule 8 into `AGENTS.md` only for repos that include `packages/trpc`
- Keep non-tRPC repos free of the extra boundary type rule
- Cover both marker-based and legacy AGENTS patching paths in template tests
