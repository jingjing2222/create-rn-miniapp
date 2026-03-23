export function renderProcessEnvLoaderScriptLines() {
  return [
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
  ]
}

export function renderTypedEnvReaderScriptLines() {
  return [
    "import { parseEnv } from 'node:util'",
    '',
    'function loadLocalEnv(filePath: string): Record<string, string> {',
    "  const env = parseEnv(readFileSync(filePath, 'utf8'))",
    '  return Object.fromEntries(',
    "    Object.entries(env).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),",
    '  )',
    '}',
    '',
  ]
}
