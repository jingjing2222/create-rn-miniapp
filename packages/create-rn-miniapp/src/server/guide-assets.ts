function createOptionalServerAssetPaths(
  templateDir: 'server-cloudflare' | 'server-firebase' | 'server-supabase',
  fileNames: readonly string[],
) {
  return fileNames.map((fileName) => `optional/${templateDir}/assets/${fileName}`)
}

export const SUPABASE_ACCESS_TOKEN_GUIDE_ASSET_FILENAMES = [
  'supabase-access-token-guide1.png',
  'supabase-access-token-guide2.png',
] as const

export const CLOUDFLARE_TOKEN_GUIDE_ASSET_FILENAMES = [
  'cloudflare-api-token-guide.png',
  'cloudflare-api-token-guide.jpg',
  'cloudflare-api-token-guide.jpeg',
  'cloudflare-api-token-guide.webp',
  'cloudflare-api-token-guide.gif',
] as const

export const FIREBASE_LOGIN_CI_GUIDE_ASSET_FILENAMES = ['firebase-login-ci-guide.png'] as const

export const FIREBASE_SERVICE_ACCOUNT_GUIDE_ASSET_FILENAMES = [
  'firebase-service-account-guide1.png',
  'firebase-service-account-guide2.png',
] as const

export const SUPABASE_ACCESS_TOKEN_GUIDE_ASSET_CANDIDATES = createOptionalServerAssetPaths(
  'server-supabase',
  SUPABASE_ACCESS_TOKEN_GUIDE_ASSET_FILENAMES,
)

export const CLOUDFLARE_TOKEN_GUIDE_ASSET_CANDIDATES = createOptionalServerAssetPaths(
  'server-cloudflare',
  CLOUDFLARE_TOKEN_GUIDE_ASSET_FILENAMES,
)

export const FIREBASE_LOGIN_CI_GUIDE_ASSET_CANDIDATES = createOptionalServerAssetPaths(
  'server-firebase',
  FIREBASE_LOGIN_CI_GUIDE_ASSET_FILENAMES,
)

export const FIREBASE_SERVICE_ACCOUNT_GUIDE_ASSET_CANDIDATES = createOptionalServerAssetPaths(
  'server-firebase',
  FIREBASE_SERVICE_ACCOUNT_GUIDE_ASSET_FILENAMES,
)
