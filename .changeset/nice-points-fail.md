---
'create-rn-miniapp': patch
'@create-rn-miniapp/scaffold-templates': patch
---

Normalize generated frontend and backoffice tsconfig files to plain JSON, set their `compilerOptions.module` to `esnext`, and keep the published template package version aligned with the CLI release.
