export const SERVER_PROVIDER_METADATA = {
  supabase: {
    label: 'Supabase',
    readmeDescription: 'DB와 Functions를 같이 빠르게 시작하고 싶을 때',
  },
  cloudflare: {
    label: 'Cloudflare Workers',
    readmeDescription: 'edge runtime과 binding 중심으로 가고 싶을 때',
  },
  firebase: {
    label: 'Firebase',
    readmeDescription: 'Functions, Firestore, Web SDK 흐름이 익숙할 때',
  },
} as const

export type ServerProvider = keyof typeof SERVER_PROVIDER_METADATA

export const SERVER_PROVIDERS = Object.keys(SERVER_PROVIDER_METADATA) as ServerProvider[]

export const SERVER_PROVIDER_OPTIONS = SERVER_PROVIDERS.map((provider) => ({
  value: provider,
  label: SERVER_PROVIDER_METADATA[provider].label,
}))
