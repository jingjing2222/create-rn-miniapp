---
"create-rn-miniapp": patch
"@create-rn-miniapp/scaffold-templates": patch
---

Improve Firebase scaffolds and workspace React alignment.

- enable the Firestore API and create the default database during Firebase provisioning
- generate Firestore-ready server bootstrap files and deploy Firestore rules and indexes alongside Functions
- add Firebase frontend Granite crypto shims and resolver aliases so `ait build` works with Firebase SDK crypto imports
- align backoffice React and React type packages to the frontend versions to avoid hoist mismatches
- clarify that shared tRPC workspaces are Cloudflare-only in the README
