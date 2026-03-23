export const generatedWorkspaceLayout = ['frontend', 'backoffice', 'server'] as const

export type GeneratedWorkspaceSlot = (typeof generatedWorkspaceLayout)[number]

const APP_NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export function isValidAppName(value: string) {
  return APP_NAME_PATTERN.test(value.trim())
}

export function assertValidAppName(value: string) {
  const normalized = value.trim()

  if (!isValidAppName(normalized)) {
    throw new Error('appName은 kebab-case로 적어 주세요. 예: my-miniapp')
  }

  return normalized
}

export function toDefaultDisplayName(appName: string) {
  return appName
    .split('-')
    .filter(Boolean)
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(' ')
}
