import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import {
  buildWranglerLoginArgs,
  buildCloudflareWorkersDevUrl,
  buildCloudflareProvisionExecutionOrder,
  canRecoverCloudflareDeployFailure,
  finalizeCloudflareProvisioning,
  formatCloudflareDeployFailureMessage,
  formatCloudflareR2EnableMessage,
  formatCloudflareManualSetupNote,
  getWranglerConfigCandidates,
  isCloudflareAuthenticationErrorMessage,
  isCloudflareR2DisabledErrorMessage,
  parseWranglerAuthTokenOutput,
  parseWranglerAuthSource,
  writeCloudflareServerLocalEnvFile,
  writeCloudflareLocalEnvFiles,
} from './provision.js'

test('buildCloudflareWorkersDevUrl builds a workers.dev URL from worker and account subdomain', () => {
  assert.equal(
    buildCloudflareWorkersDevUrl('ebook-miniapp', 'team-ebook'),
    'https://ebook-miniapp.team-ebook.workers.dev',
  )
})

test('getWranglerConfigCandidates includes the macOS preferences path', () => {
  const candidates = getWranglerConfigCandidates({
    homeDir: '/Users/tester',
    xdgConfigHome: '/Users/tester/.config',
  })

  assert.deepEqual(candidates, [
    '/Users/tester/.wrangler/config/default.toml',
    '/Users/tester/.config/.wrangler/config/default.toml',
    '/Users/tester/Library/Application Support/.wrangler/config/default.toml',
    '/Users/tester/Library/Preferences/.wrangler/config/default.toml',
  ])
})

test('buildWranglerLoginArgs requests the default Wrangler scope set', () => {
  assert.deepEqual(buildWranglerLoginArgs(), ['login'])
})

test('parseWranglerAuthSource reads quoted values from TOML without regex scraping', () => {
  assert.deepEqual(
    parseWranglerAuthSource(
      [
        'oauth_token = "token-value" # inline comment',
        "expiration_time = '2026-03-22T00:00:00.000Z'",
        '',
      ].join('\n'),
    ),
    {
      oauthToken: 'token-value',
      expirationTime: '2026-03-22T00:00:00.000Z',
    },
  )
})

test('parseWranglerAuthTokenOutput prefers structured wrangler auth token output over config scraping', () => {
  assert.deepEqual(
    parseWranglerAuthTokenOutput({
      stdout: '{"type":"oauth","token":"token-value"}',
      stderr: '',
    }),
    {
      oauthToken: 'token-value',
      expirationTime: null,
    },
  )
})

test('isCloudflareAuthenticationErrorMessage detects Cloudflare auth failures', () => {
  assert.equal(isCloudflareAuthenticationErrorMessage('Authentication error'), true)
  assert.equal(
    isCloudflareAuthenticationErrorMessage(
      'failed: Invalid access token while requesting Cloudflare API',
    ),
    true,
  )
  assert.equal(isCloudflareAuthenticationErrorMessage('workers.dev onboarding required'), false)
})

test('isCloudflareR2DisabledErrorMessage detects R2 dashboard enablement failures', () => {
  assert.equal(
    isCloudflareR2DisabledErrorMessage('Please enable R2 through the Cloudflare Dashboard.'),
    true,
  )
  assert.equal(isCloudflareR2DisabledErrorMessage('Cloudflare API authentication error'), false)
})

test('formatCloudflareR2EnableMessage includes the dashboard URL and retry guidance', () => {
  const message = formatCloudflareR2EnableMessage('account-123')

  assert.match(message, /R2를 먼저 켜야/)
  assert.match(message, /https:\/\/dash\.cloudflare\.com\/account-123\/r2\/overview/)
  assert.match(message, /다시 확인/)
})

test('buildCloudflareProvisionExecutionOrder ensures workers.dev onboarding before deploy', () => {
  assert.deepEqual(buildCloudflareProvisionExecutionOrder('create'), [
    'ensure-account-subdomain',
    'deploy-worker',
    'enable-worker-subdomain',
  ])
  assert.deepEqual(buildCloudflareProvisionExecutionOrder('existing'), [])
  assert.deepEqual(buildCloudflareProvisionExecutionOrder('existing', true), [
    'ensure-account-subdomain',
    'deploy-worker',
    'enable-worker-subdomain',
  ])
  assert.deepEqual(buildCloudflareProvisionExecutionOrder('existing', false), [])
})

test('formatCloudflareDeployFailureMessage rewrites email verification failures', () => {
  const message = formatCloudflareDeployFailureMessage(
    [
      'Cloudflare Worker deploy 단계가 실패했습니다. (pnpm dlx wrangler deploy --name test)',
      '[ERROR] You need to verify your email address to use Workers. [code: 10034]',
    ].join('\n'),
  )

  assert.match(message, /Cloudflare 계정 이메일 인증이 필요/)
  assert.match(message, /verify-email-address/)
  assert.doesNotMatch(message, /^Cloudflare Worker deploy 단계가 실패했습니다/m)
})

test('formatCloudflareDeployFailureMessage rewrites workers.dev onboarding failures', () => {
  const message = formatCloudflareDeployFailureMessage(
    [
      'Cloudflare Worker deploy 단계가 실패했습니다. (pnpm dlx wrangler deploy --name test)',
      '▲ [WARNING] You need to register a workers.dev subdomain before publishing to workers.dev',
      '✘ [ERROR] You can either deploy your worker to one or more routes by specifying them in your wrangler.jsonc file, or register a workers.dev subdomain here:',
      'https://dash.cloudflare.com/8a7d055ca2315a89a707e037910a4428/workers/onboarding',
    ].join('\n'),
  )

  assert.match(message, /workers\.dev 서브도메인 등록이 필요/)
  assert.match(message, /workers\/onboarding/)
  assert.doesNotMatch(message, /^Cloudflare Worker deploy 단계가 실패했습니다/m)
})

test('canRecoverCloudflareDeployFailure returns true for workers.dev false negatives', () => {
  assert.equal(
    canRecoverCloudflareDeployFailure({
      message: [
        'Cloudflare Worker deploy 단계가 실패했습니다. (pnpm dlx wrangler deploy --name test)',
        '▲ [WARNING] You need to register a workers.dev subdomain before publishing to workers.dev',
      ].join('\n'),
      accountSubdomain: 'hj-jingjing2222',
      workerName: 'test',
      workerNames: ['test'],
    }),
    true,
  )
})

test('canRecoverCloudflareDeployFailure returns false when worker or subdomain cannot be confirmed', () => {
  const message = [
    'Cloudflare Worker deploy 단계가 실패했습니다. (pnpm dlx wrangler deploy --name test)',
    '▲ [WARNING] You need to register a workers.dev subdomain before publishing to workers.dev',
  ].join('\n')

  assert.equal(
    canRecoverCloudflareDeployFailure({
      message,
      accountSubdomain: null,
      workerName: 'test',
      workerNames: ['test'],
    }),
    false,
  )
  assert.equal(
    canRecoverCloudflareDeployFailure({
      message,
      accountSubdomain: 'hj-jingjing2222',
      workerName: 'test',
      workerNames: ['other-worker'],
    }),
    false,
  )
})

test('formatCloudflareManualSetupNote includes frontend and backoffice env guidance', () => {
  const note = formatCloudflareManualSetupNote({
    targetRoot: '/tmp/ebook-miniapp',
    hasBackoffice: true,
    accountId: 'account-123',
    workerName: 'ebook-miniapp',
    d1DatabaseId: 'database-123',
    d1DatabaseName: 'ebook-db',
    r2BucketName: 'ebook-storage',
  })

  assert.equal(note.title, 'Cloudflare API URL을 이렇게 넣어 주세요')
  assert.match(note.body, /frontend\/\.env\.local/)
  assert.match(note.body, /backoffice\/\.env\.local/)
  assert.match(note.body, /server\/\.env\.local/)
  assert.match(note.body, /CLOUDFLARE_D1_DATABASE_ID=database-123/)
  assert.match(note.body, /CLOUDFLARE_R2_BUCKET_NAME=ebook-storage/)
  assert.match(note.body, /MINIAPP_API_BASE_URL=<배포된 Worker URL>/)
  assert.match(note.body, /VITE_API_BASE_URL=<배포된 Worker URL>/)
  assert.match(note.body, /## Cloudflare API token/)
  assert.match(note.body, /CLOUDFLARE_API_TOKEN=/)
  assert.match(note.body, /Edit Cloudflare Workers/)
  assert.match(note.body, /Workers Scripts > Write/)
  assert.match(note.body, /D1 > Write/)
  assert.match(note.body, /Workers R2 Storage > Write/)
  assert.match(note.body, /dash\.cloudflare\.com\/profile\/api-tokens/)
  assert.match(
    note.body,
    /developers\.cloudflare\.com\/fundamentals\/api\/get-started\/create-token/,
  )
  assert.match(note.body, /CLOUDFLARE_API_TOKEN=.*뒤에 붙여 넣으면 돼요/)
})

test('writeCloudflareLocalEnvFiles writes frontend and backoffice .env.local files', async () => {
  const targetRoot = await mkdtemp(path.join(os.tmpdir(), 'create-rn-miniapp-cloudflare-'))

  try {
    await writeCloudflareLocalEnvFiles({
      targetRoot,
      hasBackoffice: true,
      apiBaseUrl: 'https://ebook-miniapp.team-ebook.workers.dev',
    })

    const frontendEnv = await readFile(path.join(targetRoot, 'frontend', '.env.local'), 'utf8')
    const backofficeEnv = await readFile(path.join(targetRoot, 'backoffice', '.env.local'), 'utf8')

    assert.equal(
      frontendEnv,
      ['MINIAPP_API_BASE_URL=https://ebook-miniapp.team-ebook.workers.dev', ''].join('\n'),
    )
    assert.equal(
      backofficeEnv,
      ['VITE_API_BASE_URL=https://ebook-miniapp.team-ebook.workers.dev', ''].join('\n'),
    )
  } finally {
    await rm(targetRoot, { recursive: true, force: true })
  }
})

test('writeCloudflareServerLocalEnvFile creates server env file and preserves an existing API token', async () => {
  const targetRoot = await mkdtemp(path.join(os.tmpdir(), 'create-rn-miniapp-cloudflare-server-'))

  try {
    await writeCloudflareServerLocalEnvFile({
      targetRoot,
      accountId: 'account-123',
      workerName: 'ebook-miniapp',
      d1DatabaseId: 'database-123',
      d1DatabaseName: 'ebook-db',
      r2BucketName: 'ebook-storage',
    })

    const initialServerEnv = await readFile(path.join(targetRoot, 'server', '.env.local'), 'utf8')

    assert.equal(
      initialServerEnv,
      [
        '# Cloudflare Worker metadata for this workspace.',
        'CLOUDFLARE_ACCOUNT_ID=account-123',
        'CLOUDFLARE_WORKER_NAME=ebook-miniapp',
        'CLOUDFLARE_D1_DATABASE_ID=database-123',
        'CLOUDFLARE_D1_DATABASE_NAME=ebook-db',
        'CLOUDFLARE_R2_BUCKET_NAME=ebook-storage',
        'CLOUDFLARE_API_TOKEN=',
        '',
      ].join('\n'),
    )

    await writeFile(
      path.join(targetRoot, 'server', '.env.local'),
      [
        '# Cloudflare Worker metadata for this workspace.',
        'CLOUDFLARE_ACCOUNT_ID=old-account',
        'CLOUDFLARE_WORKER_NAME=old-worker',
        'CLOUDFLARE_API_BASE_URL=https://old-worker.old-subdomain.workers.dev',
        'CLOUDFLARE_D1_DATABASE_ID=old-db-id',
        'CLOUDFLARE_D1_DATABASE_NAME=old-db',
        'CLOUDFLARE_R2_BUCKET_NAME=old-storage',
        'CLOUDFLARE_API_TOKEN=secret-token',
        'EXTRA=value',
        '',
      ].join('\n'),
      'utf8',
    )

    await writeCloudflareServerLocalEnvFile({
      targetRoot,
      accountId: 'next-account',
      workerName: 'next-worker',
      d1DatabaseId: 'next-db-id',
      d1DatabaseName: 'next-db',
      r2BucketName: 'next-storage',
    })

    const updatedServerEnv = await readFile(path.join(targetRoot, 'server', '.env.local'), 'utf8')

    assert.match(updatedServerEnv, /^CLOUDFLARE_ACCOUNT_ID=next-account$/m)
    assert.match(updatedServerEnv, /^CLOUDFLARE_WORKER_NAME=next-worker$/m)
    assert.doesNotMatch(updatedServerEnv, /^CLOUDFLARE_API_BASE_URL=/m)
    assert.match(updatedServerEnv, /^CLOUDFLARE_D1_DATABASE_ID=next-db-id$/m)
    assert.match(updatedServerEnv, /^CLOUDFLARE_D1_DATABASE_NAME=next-db$/m)
    assert.match(updatedServerEnv, /^CLOUDFLARE_R2_BUCKET_NAME=next-storage$/m)
    assert.match(updatedServerEnv, /^CLOUDFLARE_API_TOKEN=secret-token$/m)
    assert.match(updatedServerEnv, /^EXTRA=value$/m)
  } finally {
    await rm(targetRoot, { recursive: true, force: true })
  }
})

test('finalizeCloudflareProvisioning writes env files when api base url is available', async () => {
  const targetRoot = await mkdtemp(path.join(os.tmpdir(), 'create-rn-miniapp-cloudflare-finalize-'))

  try {
    const notes = await finalizeCloudflareProvisioning({
      targetRoot,
      provisionedWorker: {
        accountId: 'account-123',
        workerName: 'ebook-miniapp',
        apiBaseUrl: 'https://ebook-miniapp.team-ebook.workers.dev',
        d1DatabaseId: 'database-123',
        d1DatabaseName: 'ebook-db',
        r2BucketName: 'ebook-storage',
        mode: 'existing',
        didInitializeRemoteContent: true,
      },
    })

    const frontendEnv = await readFile(path.join(targetRoot, 'frontend', '.env.local'), 'utf8')
    const serverEnv = await readFile(path.join(targetRoot, 'server', '.env.local'), 'utf8')

    assert.equal(
      frontendEnv,
      ['MINIAPP_API_BASE_URL=https://ebook-miniapp.team-ebook.workers.dev', ''].join('\n'),
    )
    assert.match(serverEnv, /^CLOUDFLARE_ACCOUNT_ID=account-123$/m)
    assert.match(serverEnv, /^CLOUDFLARE_WORKER_NAME=ebook-miniapp$/m)
    assert.match(serverEnv, /^CLOUDFLARE_D1_DATABASE_ID=database-123$/m)
    assert.match(serverEnv, /^CLOUDFLARE_R2_BUCKET_NAME=ebook-storage$/m)
    assert.equal(notes[0]?.title, 'Cloudflare API URL을 적어뒀어요')
    assert.match(notes[0]?.body ?? '', /server\/\.env\.local/)
    assert.match(notes[0]?.body ?? '', /deploy/)
    assert.match(notes[0]?.body ?? '', /D1/)
    assert.match(notes[0]?.body ?? '', /R2/)
    assert.match(notes[0]?.body ?? '', /## Cloudflare API token/)
    assert.match(notes[0]?.body ?? '', /CLOUDFLARE_API_TOKEN=/)
    assert.match(notes[0]?.body ?? '', /Edit Cloudflare Workers/)
    assert.match(notes[0]?.body ?? '', /Workers Scripts > Write/)
    assert.match(notes[0]?.body ?? '', /dash\.cloudflare\.com\/profile\/api-tokens/)
    assert.match(
      notes[0]?.body ?? '',
      /developers\.cloudflare\.com\/workers\/wrangler\/migration\/v1-to-v2\/wrangler-legacy\/authentication/,
    )
  } finally {
    await rm(targetRoot, { recursive: true, force: true })
  }
})

test('finalizeCloudflareProvisioning skips token guidance when server api token already exists', async () => {
  const targetRoot = await mkdtemp(path.join(os.tmpdir(), 'create-rn-miniapp-cloudflare-token-'))

  try {
    await mkdir(path.join(targetRoot, 'server'), { recursive: true })
    await writeFile(
      path.join(targetRoot, 'server', '.env.local'),
      [
        '# Cloudflare Worker metadata for this workspace.',
        'CLOUDFLARE_D1_DATABASE_ID=database-123',
        'CLOUDFLARE_D1_DATABASE_NAME=ebook-db',
        'CLOUDFLARE_R2_BUCKET_NAME=ebook-storage',
        'CLOUDFLARE_API_TOKEN=already-set-token',
        '',
      ].join('\n'),
      'utf8',
    )

    const notes = await finalizeCloudflareProvisioning({
      targetRoot,
      provisionedWorker: {
        accountId: 'account-123',
        workerName: 'ebook-miniapp',
        apiBaseUrl: 'https://ebook-miniapp.team-ebook.workers.dev',
        d1DatabaseId: 'database-123',
        d1DatabaseName: 'ebook-db',
        r2BucketName: 'ebook-storage',
        mode: 'existing',
        didInitializeRemoteContent: true,
      },
    })

    assert.doesNotMatch(notes[0]?.body ?? '', /Edit Cloudflare Workers/)
  } finally {
    await rm(targetRoot, { recursive: true, force: true })
  }
})

test('finalizeCloudflareProvisioning falls back to manual setup guidance when api url is unavailable', async () => {
  const targetRoot = await mkdtemp(path.join(os.tmpdir(), 'create-rn-miniapp-cloudflare-manual-'))

  try {
    const notes = await finalizeCloudflareProvisioning({
      targetRoot,
      provisionedWorker: {
        accountId: 'account-123',
        workerName: 'ebook-miniapp',
        apiBaseUrl: null,
        d1DatabaseId: 'database-123',
        d1DatabaseName: 'ebook-db',
        r2BucketName: 'ebook-storage',
        mode: 'existing',
        didInitializeRemoteContent: false,
      },
    })

    const serverEnv = await readFile(path.join(targetRoot, 'server', '.env.local'), 'utf8')

    assert.equal(notes[0]?.title, 'Cloudflare API URL을 이렇게 넣어 주세요')
    assert.match(notes[0]?.body ?? '', /ebook-miniapp/)
    assert.match(notes[0]?.body ?? '', /frontend\/\.env\.local/)
    assert.match(notes[0]?.body ?? '', /server\/\.env\.local/)
    assert.match(serverEnv, /^CLOUDFLARE_ACCOUNT_ID=account-123$/m)
    assert.match(serverEnv, /^CLOUDFLARE_D1_DATABASE_ID=database-123$/m)
  } finally {
    await rm(targetRoot, { recursive: true, force: true })
  }
})
