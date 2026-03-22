import assert from 'node:assert/strict'
import test from 'node:test'
import { getPackageManagerAdapter } from './package-manager.js'
import {
  renderServerReadmeScriptLines,
  renderServerRemoteOpsCommands,
  type ServerScriptCatalogEntry,
} from './server-script-catalog.js'

const DEPLOY_ENTRY: ServerScriptCatalogEntry = {
  name: 'deploy',
  command: 'node ./scripts/deploy.mjs',
  readmeDescription: '원격 배포를 실행해요.',
  remoteOp: true,
}

test('pnpm package script invocation uses explicit run semantics for deploy', () => {
  assert.equal(getPackageManagerAdapter('pnpm').runScript('deploy'), 'pnpm run deploy')
})

test('server README script lines derive invocation from the package manager adapter', () => {
  assert.deepEqual(renderServerReadmeScriptLines([DEPLOY_ENTRY], 'pnpm'), [
    '- `cd server && pnpm run deploy`: 원격 배포를 실행해요.',
  ])
})

test('server remote ops commands derive invocation from the package manager adapter', () => {
  assert.deepEqual(renderServerRemoteOpsCommands([DEPLOY_ENTRY], 'pnpm'), [
    'cd server && pnpm run deploy',
  ])
})
