// Thin facade for scaffold template entrypoints.
// Execution starts in scaffold/providers; this file only groups area modules.

export type {
  GeneratedWorkspaceHints,
  GeneratedWorkspaceOptions,
  TemplateTokens,
  WorkspaceName,
} from './runtime.js'
export {
  copyDirectory,
  ensureEmptyDirectory,
  pathExists,
  removePathIfExists,
  writeWorkspaceNpmrc,
} from './runtime.js'
export { applyDocsTemplates, resolveGeneratedWorkspaceOptions } from './runtime.js'
export { applyRootTemplates, renderRootVerifyScript, syncRootWorkspaceManifest } from './runtime.js'
export { syncGeneratedSkills } from './runtime.js'
export {
  applyFirebaseServerWorkspaceTemplate,
  applyServerPackageTemplate,
  applyWorkspaceProjectTemplate,
  FIREBASE_DEFAULT_FUNCTION_NAME,
  FIREBASE_DEFAULT_FUNCTION_REGION,
  getFirebaseWebSdkVersion,
  patchFirebaseFunctionRegion,
  patchFirebaseServerProjectId,
  SUPABASE_DEFAULT_FUNCTION_NAME,
} from './runtime.js'
export { applyTrpcWorkspaceTemplate } from './runtime.js'
