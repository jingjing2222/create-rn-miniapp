---
"create-rn-miniapp": patch
"@create-rn-miniapp/scaffold-templates": patch
---

Improve the generated frontend starter and guardrails.

- move frontend native/UI guardrails into generated Biome rules and keep Granite `$param` routes in verify
- replace the frontend starter animation with the Marketing Lottie asset and wire it through `@granite-js/native/lottie-react-native`
- refresh generated starter pages, Granite config repo root handling, and README guidance about TDS/Granite guardrails
