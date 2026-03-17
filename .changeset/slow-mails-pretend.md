---
"create-rn-miniapp": patch
---

Refine generated Granite config scaffolding.

- split generated frontend Granite helper logic into `scaffold.preset.ts`
- keep `granite.config.ts` thin while preserving visible `plugin-env` usage
- move provider env bindings and Firebase resolver helpers behind scaffold-specific exports
