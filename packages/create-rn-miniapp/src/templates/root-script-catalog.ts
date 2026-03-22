import { getPackageManagerAdapter, type PackageManager } from '../package-manager.js'
import type { TemplateReplacementTokens } from './filesystem.js'

export const FRONTEND_POLICY_CHECK_SCRIPT_NAME = 'frontend:policy:check'
export const SKILLS_MIRROR_SCRIPT_NAME = 'skills:mirror'
export const SKILLS_SYNC_SCRIPT_NAME = 'skills:sync'
export const SKILLS_CHECK_SCRIPT_NAME = 'skills:check'
export const SKILLS_DIFF_SCRIPT_NAME = 'skills:diff'
export const SKILLS_UPGRADE_SCRIPT_NAME = 'skills:upgrade'

export const FRONTEND_POLICY_CHECK_SCRIPT_COMMAND = 'node ./scripts/verify-frontend-routes.mjs'
export const SKILLS_MIRROR_SCRIPT_COMMAND = 'node ./scripts/mirror-skills.mjs'
export const SKILLS_SYNC_SCRIPT_COMMAND = 'node ./scripts/sync-skills.mjs'
export const SKILLS_CHECK_SCRIPT_COMMAND = 'node ./scripts/check-skills.mjs'
export const SKILLS_DIFF_SCRIPT_COMMAND = 'node ./scripts/diff-skills.mjs'
export const SKILLS_UPGRADE_SCRIPT_COMMAND = 'node ./scripts/upgrade-skills.mjs'

export const FRONTEND_POLICY_CHECK_COMMAND_TOKEN = '{{frontendPolicyCheckCommand}}'
export const SKILLS_MIRROR_COMMAND_TOKEN = '{{skillsMirrorCommand}}'
export const SKILLS_SYNC_COMMAND_TOKEN = '{{skillsSyncCommand}}'
export const SKILLS_CHECK_COMMAND_TOKEN = '{{skillsCheckCommand}}'

export const ROOT_VERIFY_STEP_SCRIPT_NAMES = [
  'format:check',
  'lint',
  'typecheck',
  'test',
  FRONTEND_POLICY_CHECK_SCRIPT_NAME,
  SKILLS_CHECK_SCRIPT_NAME,
] as const

export function resolveRootHelperScriptCommands(packageManager: PackageManager) {
  const adapter = getPackageManagerAdapter(packageManager)

  return {
    frontendPolicyCheck: adapter.runScript(FRONTEND_POLICY_CHECK_SCRIPT_NAME),
    skillsMirror: adapter.runScript(SKILLS_MIRROR_SCRIPT_NAME),
    skillsSync: adapter.runScript(SKILLS_SYNC_SCRIPT_NAME),
    skillsCheck: adapter.runScript(SKILLS_CHECK_SCRIPT_NAME),
  }
}

export function createRootHelperScriptExtraTokens(
  packageManager: PackageManager,
): TemplateReplacementTokens {
  const commands = resolveRootHelperScriptCommands(packageManager)

  return {
    [FRONTEND_POLICY_CHECK_COMMAND_TOKEN]: commands.frontendPolicyCheck,
    [SKILLS_MIRROR_COMMAND_TOKEN]: commands.skillsMirror,
    [SKILLS_SYNC_COMMAND_TOKEN]: commands.skillsSync,
    [SKILLS_CHECK_COMMAND_TOKEN]: commands.skillsCheck,
  }
}
