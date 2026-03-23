import assert from 'node:assert/strict'
import test from 'node:test'
import {
  renderProcessEnvLoaderScriptLines,
  renderTypedEnvReaderScriptLines,
} from './server/env-loader-script.js'

test('renderProcessEnvLoaderScriptLines emits a parseEnv-based process env loader', () => {
  assert.deepEqual(renderProcessEnvLoaderScriptLines(), [
    "import { parseEnv } from 'node:util'",
    '',
    'function loadLocalEnv(filePath) {',
    '  if (!existsSync(filePath)) {',
    '    return',
    '  }',
    '',
    "  const env = parseEnv(readFileSync(filePath, 'utf8'))",
    '',
    '  for (const [key, value] of Object.entries(env)) {',
    '    if (process.env[key] === undefined) {',
    '      process.env[key] = value',
    '    }',
    '  }',
    '}',
    '',
  ])
})

test('renderTypedEnvReaderScriptLines emits a typed parseEnv reader', () => {
  assert.deepEqual(renderTypedEnvReaderScriptLines(), [
    "import { parseEnv } from 'node:util'",
    '',
    'function loadLocalEnv(filePath: string): Record<string, string> {',
    "  const env = parseEnv(readFileSync(filePath, 'utf8'))",
    '  return Object.fromEntries(',
    "    Object.entries(env).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),",
    '  )',
    '}',
    '',
  ])
})
