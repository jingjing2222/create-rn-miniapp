import { fetchJson, fetchText } from './io.mjs'

const DEFAULT_REGISTRY_URL = 'https://registry.npmjs.org/@toss%2Ftds-react-native'
const DEFAULT_UNPKG_BASE_URL = 'https://unpkg.com'
const DEFAULT_DOCS_SEED_URL =
  'https://tossmini-docs.toss.im/tds-react-native/components/text-field/'
const PREFERRED_TDS_VERSION = '2.0.2'

function parseMajorVersion(version) {
  if (typeof version !== 'string' || version.length === 0) {
    return null
  }

  const major = Number.parseInt(version.split('.')[0] ?? '', 10)
  return Number.isInteger(major) ? major : null
}

function extractDocsSlug(docUrl) {
  const pathname = new URL(docUrl).pathname
  const marker = '/tds-react-native/components/'
  const markerIndex = pathname.indexOf(marker)

  if (markerIndex === -1) {
    return null
  }

  return pathname.slice(markerIndex + marker.length).replace(/\/+$/g, '')
}

function extractDocsUrls(html, seedUrl) {
  const urls = new Set([new URL(seedUrl).href])

  for (const match of html.matchAll(/href="([^"]*tds-react-native\/components\/[^"]*)"/g)) {
    urls.add(new URL(match[1], seedUrl).href)
  }

  return [...urls].sort((left, right) => left.localeCompare(right))
}

function parseNextData(html) {
  const match = html.match(
    /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/,
  )

  if (!match) {
    return []
  }

  const parsed = JSON.parse(match[1])
  return parsed?.props?.pageProps?.ssg?.tsDoc ?? []
}

function extractPropNames(tsDocSections) {
  const propNames = new Set()

  for (const section of tsDocSections) {
    for (const item of section?.items ?? []) {
      if (typeof item?.name === 'string' && item.name.length > 0) {
        propNames.add(item.name)
      }
    }
  }

  return [...propNames]
}

function extractComponentDirs(meta) {
  const componentDirs = new Set()

  for (const file of meta.files ?? []) {
    const match = typeof file?.path === 'string' ? file.path.match(/\/components\/([^/]+)\//) : null
    if (match?.[1]) {
      componentDirs.add(match[1])
    }
  }

  return componentDirs
}

function extractRootExports(indexSource) {
  const rootComponentModules = new Set()

  for (const match of indexSource.matchAll(/require\("\.\/components\/([^"]+)"\)/g)) {
    rootComponentModules.add(match[1])
  }

  return rootComponentModules
}

export async function fetchLatestPackageVersion(env = process.env) {
  const registryMetadata = await fetchJson(env.TDS_UI_REFRESH_REGISTRY_URL ?? DEFAULT_REGISTRY_URL)
  const distTags = registryMetadata?.['dist-tags'] ?? {}
  const versions = registryMetadata?.versions ?? {}
  const latestVersion = distTags.latest
  const preferredVersionAvailable =
    distTags.next === PREFERRED_TDS_VERSION || typeof versions?.[PREFERRED_TDS_VERSION] === 'object'
  const latestMajorVersion = parseMajorVersion(latestVersion)

  if (latestMajorVersion !== null && latestMajorVersion >= 2) {
    return latestVersion
  }

  if (preferredVersionAvailable) {
    return PREFERRED_TDS_VERSION
  }

  if (typeof latestVersion !== 'string' || latestVersion.length === 0) {
    throw new Error('latest package version is missing from the npm registry payload')
  }

  return latestVersion
}

export async function fetchPackageFacts(options) {
  const { env = process.env, version } = options
  const baseUrl = env.TDS_UI_REFRESH_UNPKG_BASE_URL ?? DEFAULT_UNPKG_BASE_URL
  const componentMetaUrl = `${baseUrl}/@toss/tds-react-native@${version}/dist/cjs/components/?meta`
  const indexUrl = `${baseUrl}/@toss/tds-react-native@${version}/dist/cjs/index.js`

  const componentMeta = await fetchJson(componentMetaUrl)
  const indexSource = await fetchText(indexUrl)

  return {
    componentDirs: extractComponentDirs(componentMeta),
    rootComponentModules: extractRootExports(indexSource),
  }
}

export async function fetchDocsFacts(env = process.env) {
  const seedUrl = env.TDS_UI_REFRESH_DOCS_SEED_URL ?? DEFAULT_DOCS_SEED_URL
  const seedHtml = await fetchText(seedUrl)
  const pageUrls = extractDocsUrls(seedHtml, seedUrl)
  const docsPages = []

  for (const pageUrl of pageUrls) {
    const html = pageUrl === seedUrl ? seedHtml : await fetchText(pageUrl)
    const docsSlug = extractDocsSlug(pageUrl)

    if (!docsSlug) {
      continue
    }

    docsPages.push({
      docsSlug,
      docUrl: pageUrl,
      leafSlug: docsSlug.split('/').pop() ?? docsSlug,
      propNames: extractPropNames(parseNextData(html)),
    })
  }

  return docsPages
}
