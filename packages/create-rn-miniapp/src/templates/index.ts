// Thin facade for scaffold template entrypoints.
// Execution starts in scaffold/providers; this file only groups area modules.

export type {
  GeneratedWorkspaceHints,
  GeneratedWorkspaceOptions,
  TemplateTokens,
  WorkspaceName,
} from './types.js'
export {
  copyDirectory,
  ensureEmptyDirectory,
  pathExists,
  removePathIfExists,
  writeWorkspaceNpmrc,
} from './filesystem.js'
export { resolveGeneratedWorkspaceOptions } from './generated-workspace.js'
export { applyDocsTemplates } from './docs.js'
export { applyRootTemplates, renderRootVerifyScript, syncRootWorkspaceManifest } from './root.js'
export { syncGeneratedSkills } from './skills.js'
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
} from './server.js'
export { applyTrpcWorkspaceTemplate } from './trpc.js'
