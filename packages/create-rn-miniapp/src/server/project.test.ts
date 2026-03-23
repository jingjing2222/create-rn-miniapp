import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildServerScaffoldState,
  resolveFinalRemoteInitializationState,
  resolveFinalServerScaffoldState,
  resolveRequestedRemoteInitializationState,
} from './project.js'

test('resolveRequestedRemoteInitializationState derives initial remote initialization from mode and skip flag', () => {
  assert.equal(
    resolveRequestedRemoteInitializationState({
      serverProjectMode: 'create',
      skipServerProvisioning: false,
    }),
    'applied',
  )
  assert.equal(
    resolveRequestedRemoteInitializationState({
      serverProjectMode: 'existing',
      skipServerProvisioning: false,
    }),
    'skipped',
  )
  assert.equal(
    resolveRequestedRemoteInitializationState({
      serverProjectMode: null,
      skipServerProvisioning: false,
    }),
    'not-run',
  )
})

test('resolveFinalRemoteInitializationState keeps provider-specific finalize rules in one helper', () => {
  assert.equal(
    resolveFinalRemoteInitializationState({
      serverProvider: 'supabase',
      initialServerState: buildServerScaffoldState({
        serverProvider: 'supabase',
        serverProjectMode: 'existing',
        remoteInitialization: 'skipped',
        trpc: false,
        backoffice: false,
      }),
      provisionedSupabaseProject: {
        didApplyRemoteDb: false,
        didDeployEdgeFunctions: false,
      },
      provisionedCloudflareWorker: null,
      provisionedFirebaseProject: null,
    }),
    'skipped',
  )

  assert.equal(
    resolveFinalRemoteInitializationState({
      serverProvider: 'cloudflare',
      initialServerState: buildServerScaffoldState({
        serverProvider: 'cloudflare',
        serverProjectMode: 'existing',
        remoteInitialization: 'skipped',
        trpc: true,
        backoffice: false,
      }),
      provisionedSupabaseProject: null,
      provisionedCloudflareWorker: {
        didInitializeRemoteContent: true,
      },
      provisionedFirebaseProject: null,
    }),
    'applied',
  )

  assert.equal(
    resolveFinalRemoteInitializationState({
      serverProvider: 'firebase',
      initialServerState: buildServerScaffoldState({
        serverProvider: 'firebase',
        serverProjectMode: 'existing',
        remoteInitialization: 'skipped',
        trpc: false,
        backoffice: false,
      }),
      provisionedSupabaseProject: null,
      provisionedCloudflareWorker: null,
      provisionedFirebaseProject: null,
    }),
    'skipped',
  )
})

test('resolveFinalServerScaffoldState assembles final scaffold state in one helper', () => {
  assert.deepEqual(
    resolveFinalServerScaffoldState({
      serverProvider: 'cloudflare',
      initialServerState: buildServerScaffoldState({
        serverProvider: 'cloudflare',
        serverProjectMode: 'existing',
        remoteInitialization: 'skipped',
        trpc: true,
        backoffice: false,
      }),
      fallbackServerProjectMode: 'create',
      fallbackTrpc: true,
      fallbackBackoffice: true,
      provisionedSupabaseProject: null,
      provisionedCloudflareWorker: {
        didInitializeRemoteContent: true,
        mode: 'create',
      },
      provisionedFirebaseProject: null,
    }),
    {
      serverProvider: 'cloudflare',
      serverProjectMode: 'create',
      remoteInitialization: 'applied',
      trpc: true,
      backoffice: false,
    },
  )

  assert.deepEqual(
    resolveFinalServerScaffoldState({
      serverProvider: 'firebase',
      initialServerState: null,
      fallbackServerProjectMode: 'existing',
      fallbackTrpc: false,
      fallbackBackoffice: true,
      provisionedSupabaseProject: null,
      provisionedCloudflareWorker: null,
      provisionedFirebaseProject: null,
    }),
    {
      serverProvider: 'firebase',
      serverProjectMode: 'existing',
      remoteInitialization: 'not-run',
      trpc: false,
      backoffice: true,
    },
  )
})
