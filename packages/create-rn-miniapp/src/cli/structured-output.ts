import { stripVTControlCharacters } from 'node:util'
import type { CommandOutput } from '../runtime/commands.js'

const YARN_STDOUT_LOG_PATTERN = /^(?:➤\s+)?YN\d{4}:/u
const ANSI_ESCAPE = String.fromCharCode(0x1b)
const ANSI_BEL = String.fromCharCode(0x07)
const OSC_HYPERLINK_PATTERN = new RegExp(
  `${ANSI_ESCAPE}\\]8;;[\\s\\S]*?(?:${ANSI_BEL}|${ANSI_ESCAPE}\\\\)[\\s\\S]*?${ANSI_ESCAPE}\\]8;;(?:${ANSI_BEL}|${ANSI_ESCAPE}\\\\)`,
  'g',
)
const OSC_SEQUENCE_PATTERN = new RegExp(
  `${ANSI_ESCAPE}\\][\\s\\S]*?(?:${ANSI_BEL}|${ANSI_ESCAPE}\\\\)`,
  'g',
)

function stripCliStructuredOutput(source: string) {
  return source.replace(OSC_HYPERLINK_PATTERN, '').replace(OSC_SEQUENCE_PATTERN, '')
}

function stripPackageManagerStdoutPrelude(source: string) {
  const lines = source.split('\n')
  let index = 0

  while (index < lines.length && YARN_STDOUT_LOG_PATTERN.test(lines[index] ?? '')) {
    index += 1
  }

  while (index < lines.length && (lines[index]?.trim().length ?? 0) === 0) {
    index += 1
  }

  const candidate = lines.slice(index).join('\n').trim()

  if (candidate.startsWith('{') || candidate.startsWith('[')) {
    return candidate
  }

  return source
}

export function extractJsonPayload<T>(output: Pick<CommandOutput, 'stdout' | 'stderr'>) {
  const cleanedStdout = stripCliStructuredOutput(output.stdout)
  const fullStdout = cleanedStdout
    .split(/\r?\n/)
    .map((line) => stripVTControlCharacters(line).trimEnd())
    .filter((line) => line.trim().length > 0)
    .join('\n')
    .trim()
  const parseCandidates = [fullStdout, stripPackageManagerStdoutPrelude(fullStdout)].filter(
    (candidate, index, array) => candidate.length > 0 && array.indexOf(candidate) === index,
  )

  for (const candidate of parseCandidates) {
    try {
      return JSON.parse(candidate) as T
    } catch {}
  }

  throw new Error('JSON 결과를 해석하지 못했습니다.')
}
