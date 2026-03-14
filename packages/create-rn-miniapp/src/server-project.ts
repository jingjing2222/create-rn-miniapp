export const SERVER_PROJECT_MODES = ['create', 'existing'] as const

export type ServerProjectMode = (typeof SERVER_PROJECT_MODES)[number]

export type ProvisioningNote = {
  title: string
  body: string
}
