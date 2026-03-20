// Thin facade for workspace patch entrypoints.
// Execution starts in scaffold/providers; this file only groups area modules.

export {
  ensureFrontendCloudflareBootstrap,
  ensureFrontendFirebaseBootstrap,
  ensureFrontendSupabaseBootstrap,
  patchFrontendWorkspace,
} from './runtime.js'
export {
  ensureBackofficeCloudflareBootstrap,
  ensureBackofficeFirebaseBootstrap,
  ensureBackofficeSupabaseBootstrap,
  patchBackofficeWorkspace,
} from './runtime.js'
export {
  createRootPackageName,
  patchCloudflareServerWorkspace,
  patchFirebaseServerWorkspace,
  patchSupabaseServerWorkspace,
} from './runtime.js'
