import assert from 'node:assert/strict'
import test from 'node:test'
import {
  resolveAddServerFlowState,
  resolveAddServerState,
  resolveCreateTrpcEnabled,
} from './flow-state.js'

test('resolveCreateTrpcEnabled only enables trpc for cloudflare server workspaces', () => {
  assert.equal(resolveCreateTrpcEnabled({ serverProvider: 'cloudflare', withTrpc: true }), true)
  assert.equal(resolveCreateTrpcEnabled({ serverProvider: 'firebase', withTrpc: true }), false)
  assert.equal(resolveCreateTrpcEnabled({ serverProvider: 'supabase', withTrpc: true }), false)
  assert.equal(resolveCreateTrpcEnabled({ serverProvider: null, withTrpc: true }), false)
})

test('resolveAddServerFlowState keeps active provider precedence in one place', () => {
  assert.deepEqual(
    resolveAddServerFlowState({
      existingServerProvider: 'cloudflare',
      requestedServerProvider: null,
      withServer: false,
      withTrpc: true,
    }),
    {
      activeServerProvider: 'cloudflare',
      patchServerProvider: 'cloudflare',
      finalServerProvider: 'cloudflare',
      trpcEnabled: true,
    },
  )

  assert.deepEqual(
    resolveAddServerFlowState({
      existingServerProvider: null,
      requestedServerProvider: 'firebase',
      withServer: true,
      withTrpc: true,
    }),
    {
      activeServerProvider: 'firebase',
      patchServerProvider: 'firebase',
      finalServerProvider: 'firebase',
      trpcEnabled: false,
    },
  )
})

test('resolveAddServerState derives flow state and initial scaffold state from one resolver', () => {
  assert.deepEqual(
    resolveAddServerState({
      existingServerProvider: 'cloudflare',
      existingServerScaffoldState: {
        serverProvider: 'cloudflare',
        serverProjectMode: 'existing',
        remoteInitialization: 'skipped',
        trpc: false,
        backoffice: false,
      },
      existingHasBackoffice: true,
      existingHasTrpc: false,
      requestedServerProvider: null,
      requestedServerProjectMode: 'create',
      skipServerProvisioning: false,
      withServer: false,
      withTrpc: true,
      withBackoffice: false,
    }),
    {
      serverFlowState: {
        activeServerProvider: 'cloudflare',
        patchServerProvider: 'cloudflare',
        finalServerProvider: 'cloudflare',
        trpcEnabled: true,
      },
      initialServerState: {
        serverProvider: 'cloudflare',
        serverProjectMode: 'existing',
        remoteInitialization: 'skipped',
        trpc: true,
        backoffice: true,
      },
    },
  )

  assert.deepEqual(
    resolveAddServerState({
      existingServerProvider: null,
      existingServerScaffoldState: null,
      existingHasBackoffice: false,
      existingHasTrpc: false,
      requestedServerProvider: 'firebase',
      requestedServerProjectMode: 'create',
      skipServerProvisioning: false,
      withServer: true,
      withTrpc: true,
      withBackoffice: true,
    }),
    {
      serverFlowState: {
        activeServerProvider: 'firebase',
        patchServerProvider: 'firebase',
        finalServerProvider: 'firebase',
        trpcEnabled: false,
      },
      initialServerState: {
        serverProvider: 'firebase',
        serverProjectMode: 'create',
        remoteInitialization: 'applied',
        trpc: false,
        backoffice: true,
      },
    },
  )
})
