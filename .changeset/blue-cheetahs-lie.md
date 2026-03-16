---
"create-rn-miniapp": patch
"@create-rn-miniapp/scaffold-templates": patch
---

Upgrade generated frontend guardrails to Biome 2 and improve policy guidance.

- upgrade repo and generated workspaces to `@biomejs/biome@^2.4.7`
- move native module, AsyncStorage, and RN primitive restrictions into generated Biome lint rules
- keep Granite `$param` route validation in a dedicated verify script
- include engineering doc paths in generated lint and verify error messages
