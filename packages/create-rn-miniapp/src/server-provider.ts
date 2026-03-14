export const SERVER_PROVIDERS = ['supabase'] as const

export type ServerProvider = (typeof SERVER_PROVIDERS)[number]
