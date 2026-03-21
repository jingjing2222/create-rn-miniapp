import type { ServerProvider } from './providers/index.js'

export type WorkspaceClientContract = {
  envFile: string
  envKeys: string[]
  defaultLinkFiles: string[]
  trpcLinkFiles?: string[]
}

export type ProviderClientContract = {
  serverEnvKeys: string[]
  frontend: WorkspaceClientContract
  backoffice: WorkspaceClientContract
}

export const PROVIDER_CLIENT_CONTRACTS: Record<ServerProvider, ProviderClientContract> = {
  cloudflare: {
    serverEnvKeys: [
      'CLOUDFLARE_ACCOUNT_ID',
      'CLOUDFLARE_WORKER_NAME',
      'CLOUDFLARE_D1_DATABASE_ID',
      'CLOUDFLARE_D1_DATABASE_NAME',
      'CLOUDFLARE_R2_BUCKET_NAME',
    ],
    frontend: {
      envFile: 'frontend/.env.local',
      envKeys: ['MINIAPP_API_BASE_URL'],
      defaultLinkFiles: ['frontend/src/env.d.ts', 'frontend/src/lib/api.ts'],
      trpcLinkFiles: [
        'frontend/src/env.d.ts',
        'frontend/src/lib/trpc.ts',
        'packages/contracts/package.json',
        'packages/app-router/package.json',
      ],
    },
    backoffice: {
      envFile: 'backoffice/.env.local',
      envKeys: ['VITE_API_BASE_URL'],
      defaultLinkFiles: ['backoffice/src/vite-env.d.ts', 'backoffice/src/lib/api.ts'],
      trpcLinkFiles: ['backoffice/src/vite-env.d.ts', 'backoffice/src/lib/trpc.ts'],
    },
  },
  supabase: {
    serverEnvKeys: ['SUPABASE_PROJECT_REF', 'SUPABASE_DB_PASSWORD', 'SUPABASE_ACCESS_TOKEN'],
    frontend: {
      envFile: 'frontend/.env.local',
      envKeys: ['MINIAPP_SUPABASE_URL', 'MINIAPP_SUPABASE_PUBLISHABLE_KEY'],
      defaultLinkFiles: ['frontend/src/env.d.ts', 'frontend/src/lib/supabase.ts'],
    },
    backoffice: {
      envFile: 'backoffice/.env.local',
      envKeys: ['VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY'],
      defaultLinkFiles: ['backoffice/src/vite-env.d.ts', 'backoffice/src/lib/supabase.ts'],
    },
  },
  firebase: {
    serverEnvKeys: ['FIREBASE_PROJECT_ID', 'FIREBASE_FUNCTION_REGION'],
    frontend: {
      envFile: 'frontend/.env.local',
      envKeys: [
        'MINIAPP_FIREBASE_API_KEY',
        'MINIAPP_FIREBASE_AUTH_DOMAIN',
        'MINIAPP_FIREBASE_PROJECT_ID',
        'MINIAPP_FIREBASE_STORAGE_BUCKET',
        'MINIAPP_FIREBASE_MESSAGING_SENDER_ID',
        'MINIAPP_FIREBASE_APP_ID',
        'MINIAPP_FIREBASE_MEASUREMENT_ID',
        'MINIAPP_FIREBASE_FUNCTION_REGION',
      ],
      defaultLinkFiles: [
        'frontend/src/env.d.ts',
        'frontend/src/lib/firebase.ts',
        'frontend/src/lib/firestore.ts',
        'frontend/src/lib/functions.ts',
        'frontend/src/lib/public-app-status.ts',
        'frontend/src/lib/storage.ts',
      ],
    },
    backoffice: {
      envFile: 'backoffice/.env.local',
      envKeys: [
        'VITE_FIREBASE_API_KEY',
        'VITE_FIREBASE_AUTH_DOMAIN',
        'VITE_FIREBASE_PROJECT_ID',
        'VITE_FIREBASE_STORAGE_BUCKET',
        'VITE_FIREBASE_MESSAGING_SENDER_ID',
        'VITE_FIREBASE_APP_ID',
        'VITE_FIREBASE_MEASUREMENT_ID',
      ],
      defaultLinkFiles: [
        'backoffice/src/vite-env.d.ts',
        'backoffice/src/lib/firebase.ts',
        'backoffice/src/lib/firestore.ts',
        'backoffice/src/lib/storage.ts',
      ],
    },
  },
}

export function getProviderClientContract(provider: ServerProvider) {
  return PROVIDER_CLIENT_CONTRACTS[provider]
}

export function resolveProviderClientLinkFiles(
  provider: ServerProvider,
  options: { trpc: boolean; backoffice: boolean },
) {
  const contract = getProviderClientContract(provider)
  const frontendFiles = [
    contract.frontend.envFile,
    ...(options.trpc
      ? (contract.frontend.trpcLinkFiles ?? contract.frontend.defaultLinkFiles)
      : contract.frontend.defaultLinkFiles),
  ]
  const backofficeFiles = options.backoffice
    ? [
        contract.backoffice.envFile,
        ...(options.trpc
          ? (contract.backoffice.trpcLinkFiles ?? contract.backoffice.defaultLinkFiles)
          : contract.backoffice.defaultLinkFiles),
      ]
    : []

  return [...frontendFiles, ...backofficeFiles]
}
