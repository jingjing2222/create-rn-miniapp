import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveAddServerFlowState, resolveCreateTrpcEnabled } from './flow-state.js'

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
