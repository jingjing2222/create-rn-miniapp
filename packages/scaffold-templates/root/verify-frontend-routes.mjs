import { readFile, readdir, stat } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const FRONTEND_ROOT = path.resolve(process.cwd(), 'frontend')
const FRONTEND_ENTRY_ROOT = path.join(FRONTEND_ROOT, 'pages')
const FRONTEND_SOURCE_ROOT = path.join(FRONTEND_ROOT, 'src')
const FRONTEND_SOURCE_PAGES_ROOT = path.join(FRONTEND_SOURCE_ROOT, 'pages')
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.mts', '.cts'])
const ROUTE_DYNAMIC_SEGMENT_DOLLAR_RULE_ID = 'route-dynamic-segment-dollar'
const FILENAME_DOLLAR_PATTERN_RULE_ID = 'filename-dollar-pattern'
const ROUTE_DYNAMIC_SEGMENT_DOLLAR_REGEX = /\/\$[a-zA-Z][a-zA-Z0-9_]*/g
const FILENAME_DOLLAR_PATTERN_REGEX =
  /(?:^|[\\/])(?:\$[a-zA-Z][a-zA-Z0-9_]*\.[^.]+|[^\\/]+\.\$[a-zA-Z][a-zA-Z0-9_]*)/
const GRANITE_ROUTE_DOC_PATH = 'docs/engineering/granite-ssot.md'

async function pathExists(targetPath) {
  try {
    await stat(targetPath)
    return true
  } catch {
    return false
  }
}

async function listSourceFiles(rootDir) {
  const files = []

  if (!(await pathExists(rootDir))) {
    return files
  }

  const entries = await readdir(rootDir, { withFileTypes: true })

  for (const entry of entries) {
    const entryPath = path.join(rootDir, entry.name)

    if (entry.isDirectory()) {
      files.push(...(await listSourceFiles(entryPath)))
      continue
    }

    if (SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
      files.push(entryPath)
    }
  }

  return files
}

function formatPathForDisplay(filePath) {
  return path.relative(process.cwd(), filePath)
}

async function main() {
  const errors = []
  const fileRoots = [FRONTEND_ENTRY_ROOT, FRONTEND_SOURCE_ROOT]
  const files = []

  for (const rootDir of fileRoots) {
    files.push(...(await listSourceFiles(rootDir)))
  }

  const uniqueFiles = [...new Set(files)]

  for (const filePath of uniqueFiles) {
    const displayPath = formatPathForDisplay(filePath)

    if (
      filePath.startsWith(FRONTEND_ENTRY_ROOT) ||
      filePath.startsWith(FRONTEND_SOURCE_PAGES_ROOT)
    ) {
      const filenameMatch = displayPath.match(FILENAME_DOLLAR_PATTERN_REGEX)

      if (filenameMatch) {
        errors.push(
          `${displayPath}: ${FILENAME_DOLLAR_PATTERN_RULE_ID} - 파일명에 $param 세그먼트를 쓰면 안 돼요. 대신 '/book-detail'이나 '/book/:bookId'처럼 Granite가 이해하는 경로 기준으로 바꿔 주세요. 자세한 기준은 \`${GRANITE_ROUTE_DOC_PATH}\`를 봐 주세요.`,
        )
      }
    }

    const source = await readFile(filePath, 'utf8')

    for (const match of source.matchAll(ROUTE_DYNAMIC_SEGMENT_DOLLAR_REGEX)) {
      const matchedValue = match[0]
      errors.push(
        `${displayPath}: ${ROUTE_DYNAMIC_SEGMENT_DOLLAR_RULE_ID} - "${matchedValue}" 같은 $param 라우트는 쓰면 안 돼요. 대신 '/book-detail', '/book/:bookId', validateParams 조합으로 바꿔 주세요. 자세한 기준은 \`${GRANITE_ROUTE_DOC_PATH}\`를 봐 주세요.`,
      )
    }
  }

  if (errors.length === 0) {
    process.exit(0)
  }

  const normalizedErrors = [...new Set(errors)].sort((left, right) => left.localeCompare(right))

  console.error('[frontend policy] frontend 라우트에서 $param 패턴을 찾았어요.')
  for (const error of normalizedErrors) {
    console.error(`- ${error}`)
  }
  console.error(
    `- MiniApp 라우트에서는 $param 대신 Granite가 지원하는 '/book/:bookId'나 \`createRoute(... validateParams ...)\` 조합을 써 주세요. 자세한 기준은 \`${GRANITE_ROUTE_DOC_PATH}\`를 봐 주세요.`,
  )
  process.exit(1)
}

await main()
