const ROOT_PACKAGE_IMPORT_PATH = '@toss/tds-react-native'
const DYNAMIC_CAVEAT_PREFIXES = [
  'docs slug alias:',
  'docs-backed but import path differs from the package root export',
  'export-only / docs-missing:',
  'dir-only-weak:',
]
const ROOT_EXPORT_GAP_NOTE =
  'Docs leaf exists, but the package root export path differs from other components.'
const EXPORT_ONLY_NOTE =
  'Export-only / docs-missing. Gate recommendation and provide a doc-backed fallback.'
const DIR_ONLY_WEAK_NOTE =
  'Component dir exists, but root export and public docs evidence are both weak. Block by default.'

function stripDynamicCaveats(knownCaveats) {
  return knownCaveats.filter(
    (caveat) => !DYNAMIC_CAVEAT_PREFIXES.some((prefix) => caveat.startsWith(prefix)),
  )
}

function resolveDocPage(entry, docsPages) {
  const docsByFullSlug = new Map(docsPages.map((page) => [page.docsSlug.toLowerCase(), page]))
  const docsByLeafSlug = new Map(docsPages.map((page) => [page.leafSlug.toLowerCase(), page]))
  const candidates = [entry.name, entry.docsSlug].filter(Boolean)

  for (const candidate of candidates) {
    const normalizedCandidate = candidate.toLowerCase()

    if (docsByFullSlug.has(normalizedCandidate)) {
      return docsByFullSlug.get(normalizedCandidate)
    }

    if (docsByLeafSlug.has(normalizedCandidate)) {
      return docsByLeafSlug.get(normalizedCandidate)
    }
  }

  return null
}

function resolveStateModel(entry, docPage) {
  if (!docPage || docPage.propNames.length === 0) {
    return entry.stateModel
  }

  const propNames = new Set(docPage.propNames)

  if (propNames.has('checked') && propNames.has('onCheckedChange')) {
    return {
      controlled: ['checked', 'onCheckedChange'],
      uncontrolled: propNames.has('defaultChecked') ? ['defaultChecked'] : [],
    }
  }

  if (propNames.has('value') && propNames.has('onValueChange')) {
    return {
      controlled: ['value', 'onValueChange'],
      uncontrolled: propNames.has('defaultValue') ? ['defaultValue'] : [],
    }
  }

  if (propNames.has('value') && (propNames.has('onChange') || propNames.has('onChangeText'))) {
    return {
      controlled: ['value', 'onChange'],
      uncontrolled: propNames.has('defaultValue') ? ['defaultValue'] : [],
    }
  }

  return entry.stateModel
}

function resolveRootImportPath(entry, rootExported) {
  if (rootExported) {
    return ROOT_PACKAGE_IMPORT_PATH
  }

  return entry.rootImportPath === ROOT_PACKAGE_IMPORT_PATH ? '' : entry.rootImportPath
}

function resolveSelectionStatus(entry, facts) {
  if (facts.docsStatus === 'public-docs' && facts.rootExported) {
    return 'doc-backed'
  }

  if (
    facts.docsStatus === 'public-docs' &&
    !facts.rootExported &&
    facts.rootImportPath.length > 0
  ) {
    return 'export-gap'
  }

  if (facts.rootExported && facts.docsStatus === 'no-public-docs') {
    return 'export-only'
  }

  if (
    entry.cluster === 'blocked-by-default' ||
    (facts.componentDirExists && !facts.rootExported && facts.docsStatus === 'no-public-docs')
  ) {
    return 'blocked'
  }

  return entry.selectionStatus
}

function resolveKnownCaveats(entry, facts) {
  const caveats = stripDynamicCaveats(entry.knownCaveats)

  if (facts.docsStatus === 'public-docs' && facts.docsSlug && facts.docsSlug !== entry.name) {
    caveats.push(`docs slug alias: \`${entry.name}\` -> \`${facts.docsSlug}\``)
  }

  if (
    facts.docsStatus === 'public-docs' &&
    !facts.rootExported &&
    facts.rootImportPath.length > 0
  ) {
    caveats.push('docs-backed but import path differs from the package root export')
  }

  if (facts.rootExported && facts.docsStatus === 'no-public-docs') {
    caveats.push('export-only / docs-missing: provide a doc-backed fallback')
  }

  if (facts.componentDirExists && !facts.rootExported && facts.docsStatus === 'no-public-docs') {
    caveats.push('dir-only-weak: do not recommend by default')
  }

  return caveats
}

export function buildCatalog(options) {
  const { baselineCatalog, docsPages, latestVersion, packageFacts, today } = options

  return baselineCatalog.map((entry) => {
    const docPage = resolveDocPage(entry, docsPages)
    const rootExported = packageFacts.rootComponentModules.has(entry.name)
    const componentDirExists = packageFacts.componentDirs.has(entry.name)
    const rootImportPath = resolveRootImportPath(entry, rootExported)
    const docsStatus = docPage ? 'public-docs' : 'no-public-docs'
    const docsSlug = docPage?.docsSlug ?? null
    const docUrl = docPage?.docUrl ?? null
    const stateModel = resolveStateModel(entry, docPage)
    const selectionStatus = resolveSelectionStatus(entry, {
      componentDirExists,
      docsStatus,
      rootExported,
      rootImportPath,
    })

    return {
      ...entry,
      selectionStatus,
      rootExported,
      componentDirExists,
      rootImportPath,
      docsStatus,
      docsSlug,
      docUrl,
      stateModel,
      knownCaveats: resolveKnownCaveats(entry, {
        componentDirExists,
        docsSlug,
        docsStatus,
        rootExported,
        rootImportPath,
      }),
      packageVersion: latestVersion,
      lastVerifiedAt: today,
    }
  })
}

export function buildAnomalies(catalog) {
  return {
    'docs-slug-alias': catalog
      .filter(
        (entry) =>
          entry.docsStatus === 'public-docs' && entry.docsSlug && entry.docsSlug !== entry.name,
      )
      .map((entry) => ({
        name: entry.name,
        docsSlug: entry.docsSlug,
        docUrl: entry.docUrl,
        note: `Docs slug mismatch. Keep the component name \`${entry.name}\`, but link to the ${
          entry.docsSlug.split('/').pop() ?? entry.docsSlug
        } docs leaf.`,
      })),
    'root-export-gap': catalog
      .filter((entry) => entry.selectionStatus === 'export-gap')
      .map((entry) => ({
        name: entry.name,
        rootImportPath: entry.rootImportPath,
        docUrl: entry.docUrl,
        note: ROOT_EXPORT_GAP_NOTE,
      })),
    'root-export-no-public-docs': catalog
      .filter((entry) => entry.selectionStatus === 'export-only')
      .map((entry) => ({
        name: entry.name,
        note: EXPORT_ONLY_NOTE,
      })),
    'dir-only-weak': catalog
      .filter(
        (entry) =>
          entry.componentDirExists && !entry.rootExported && entry.docsStatus === 'no-public-docs',
      )
      .map((entry) => ({
        name: entry.name,
        note: DIR_ONLY_WEAK_NOTE,
      })),
  }
}

export function buildMetadata(previousMetadata, options) {
  const { latestVersion, today } = options

  return {
    ...previousMetadata,
    package: {
      ...previousMetadata.package,
      version: latestVersion,
    },
    lastVerifiedAt: today,
    refreshPolicy: {
      maxAgeDays: 7,
      strategy: 'auto-refresh-latest',
    },
    notes: [
      'Refresh prefers @toss/tds-react-native@2.0.2 only while the npm latest dist-tag still points at 1.x.',
      'If auto refresh fails, continue with the last committed snapshot.',
    ],
  }
}
