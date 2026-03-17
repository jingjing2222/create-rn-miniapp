---
"create-rn-miniapp": patch
"@create-rn-miniapp/scaffold-templates": patch
---

Improve Firebase scaffolds so Firestore is ready to use after provisioning.

- enable the Firestore API and create the default database during Firebase provisioning
- generate Firestore rules, indexes, and seed files in the Firebase server workspace
- add a `firestore:seed` script and deploy Firestore config alongside Functions
- update generated Firebase README and provider docs to cover Firestore setup
