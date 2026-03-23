import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildServerScaffoldState,
  resolveFinalRemoteInitializationState,
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
