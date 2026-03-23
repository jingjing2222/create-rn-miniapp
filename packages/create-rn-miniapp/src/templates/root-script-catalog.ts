import { getPackageManagerAdapter, type PackageManager } from '../runtime/package-manager.js'
import type { TemplateReplacementTokens } from './filesystem.js'

export const FRONTEND_POLICY_CHECK_SCRIPT_NAME = 'frontend:policy:check'

export const FRONTEND_POLICY_CHECK_SCRIPT_COMMAND = 'node ./scripts/verify-frontend-routes.mjs'

export const FRONTEND_POLICY_CHECK_COMMAND_TOKEN = '{{frontendPolicyCheckCommand}}'

export const ROOT_VERIFY_STEP_SCRIPT_NAMES = [
  'format:check',
  'lint',
  'typecheck',
  'test',
  FRONTEND_POLICY_CHECK_SCRIPT_NAME,
] as const

export function resolveRootHelperScriptCommands(packageManager: PackageManager) {
  const adapter = getPackageManagerAdapter(packageManager)

  return {
    frontendPolicyCheck: adapter.runScript(FRONTEND_POLICY_CHECK_SCRIPT_NAME),
  }
}

export function createRootHelperScriptExtraTokens(
  packageManager: PackageManager,
): TemplateReplacementTokens {
  const commands = resolveRootHelperScriptCommands(packageManager)

  return {
    [FRONTEND_POLICY_CHECK_COMMAND_TOKEN]: commands.frontendPolicyCheck,
  }
}
