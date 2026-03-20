// Thin facade for workspace patch entrypoints.
// Execution starts in scaffold/providers; this file only groups area modules.

export {
  ensureFrontendCloudflareBootstrap,
  ensureFrontendFirebaseBootstrap,
  ensureFrontendSupabaseBootstrap,
  patchFrontendWorkspace,
} from './frontend.js'
export {
  ensureBackofficeCloudflareBootstrap,
  ensureBackofficeFirebaseBootstrap,
  ensureBackofficeSupabaseBootstrap,
  patchBackofficeWorkspace,
} from './backoffice.js'
export {
  createRootPackageName,
  patchCloudflareServerWorkspace,
  patchFirebaseServerWorkspace,
  patchSupabaseServerWorkspace,
} from './server.js'
