function fail(message) {
  throw new Error(`refresh contract validation failed: ${message}`)
}

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function assertPlainObject(value, label) {
  if (!isPlainObject(value)) {
    fail(`${label} must be an object`)
  }
}

function assertString(value, label) {
  if (typeof value !== 'string' || value.length === 0) {
    fail(`${label} must be a non-empty string`)
  }
}

function assertBoolean(value, label) {
  if (typeof value !== 'boolean') {
    fail(`${label} must be a boolean`)
  }
}

function assertNumber(value, label) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    fail(`${label} must be a number`)
  }
}

function assertStringArray(value, label) {
  if (!Array.isArray(value)) {
    fail(`${label} must be an array`)
  }

  value.forEach((item, index) => {
    if (typeof item !== 'string' || item.length === 0) {
      fail(`${label}[${index}] must be a non-empty string`)
    }
  })
}

function assertExactKeys(actual, expectedKeys, label) {
  const actualKeys = Object.keys(actual).sort()
  const normalizedExpectedKeys = [...expectedKeys].sort()

  if (JSON.stringify(actualKeys) !== JSON.stringify(normalizedExpectedKeys)) {
    fail(
      `${label} keys changed. expected ${normalizedExpectedKeys.join(', ')}, received ${actualKeys.join(', ')}`,
    )
  }
}

function assertDeepEqual(actual, expected, label) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    fail(`${label} changed unexpectedly`)
  }
}

function assertAllowedValue(value, allowedValues, label) {
  if (!allowedValues.includes(value)) {
    fail(`${label} must be one of ${allowedValues.join(', ')}`)
  }
}

function normalizeUrlPath(url) {
  try {
    return new URL(url).pathname.replace(/\/+$/g, '/')
  } catch {
    fail(`invalid URL in ${url}`)
  }
}

function assertOptionalString(value, label) {
  if (typeof value !== 'string') {
    fail(`${label} must be a string`)
  }
}

function assertNullableDocFields(docsStatus, docsSlug, docUrl, label) {
  if (docsStatus === 'public-docs') {
    assertString(docsSlug, `${label}.docsSlug`)
    assertString(docUrl, `${label}.docUrl`)
    normalizeUrlPath(docUrl)
    return
  }

  if (docsSlug !== null || docUrl !== null) {
    fail(`${label}.docsSlug and ${label}.docUrl must be null when docsStatus is no-public-docs`)
  }
}

function assertCatalogStateModel(actual, label) {
  assertPlainObject(actual, label)
  assertExactKeys(actual, ['controlled', 'uncontrolled'], label)
  assertStringArray(actual.controlled, `${label}.controlled`)
  assertStringArray(actual.uncontrolled, `${label}.uncontrolled`)
}

function assertSelectionStatusConsistency(entry, label) {
  if (
    entry.selectionStatus === 'doc-backed' &&
    (!entry.rootExported || entry.docsStatus !== 'public-docs')
  ) {
    fail(`${label}.selectionStatus is inconsistent with docs/root export facts`)
  }

  if (
    entry.selectionStatus === 'export-gap' &&
    (entry.rootExported || entry.docsStatus !== 'public-docs' || entry.rootImportPath.length === 0)
  ) {
    fail(`${label}.selectionStatus is inconsistent with export-gap facts`)
  }

  if (
    entry.selectionStatus === 'export-only' &&
    (!entry.rootExported || entry.docsStatus !== 'no-public-docs')
  ) {
    fail(`${label}.selectionStatus is inconsistent with export-only facts`)
  }
}

function assertCatalogEntry(actual, expected, metadata, index) {
  const label = `catalog[${index}]`
  assertPlainObject(actual, label)
  assertExactKeys(actual, Object.keys(expected), label)

  assertDeepEqual(actual.name, expected.name, `${label}.name`)
  assertDeepEqual(actual.cluster, expected.cluster, `${label}.cluster`)
  assertDeepEqual(actual.useWhen, expected.useWhen, `${label}.useWhen`)
  assertDeepEqual(actual.avoidWhen, expected.avoidWhen, `${label}.avoidWhen`)

  assertAllowedValue(
    actual.selectionStatus,
    ['doc-backed', 'export-gap', 'export-only', 'blocked'],
    `${label}.selectionStatus`,
  )
  assertBoolean(actual.rootExported, `${label}.rootExported`)
  assertBoolean(actual.componentDirExists, `${label}.componentDirExists`)
  assertOptionalString(actual.rootImportPath, `${label}.rootImportPath`)
  assertAllowedValue(actual.docsStatus, ['public-docs', 'no-public-docs'], `${label}.docsStatus`)
  assertNullableDocFields(actual.docsStatus, actual.docsSlug, actual.docUrl, label)
  assertCatalogStateModel(actual.stateModel, `${label}.stateModel`)
  assertStringArray(actual.knownCaveats, `${label}.knownCaveats`)
  assertString(actual.packageVersion, `${label}.packageVersion`)
  assertString(actual.lastVerifiedAt, `${label}.lastVerifiedAt`)

  if (actual.packageVersion !== metadata.package.version) {
    fail(`${label}.packageVersion must match metadata.package.version`)
  }

  if (actual.lastVerifiedAt !== metadata.lastVerifiedAt) {
    fail(`${label}.lastVerifiedAt must match metadata.lastVerifiedAt`)
  }

  assertSelectionStatusConsistency(actual, label)
}

function validateCatalog(baselineCatalog, catalog, metadata) {
  if (!Array.isArray(baselineCatalog) || !Array.isArray(catalog)) {
    fail('catalog must stay an array')
  }

  if (catalog.length !== baselineCatalog.length) {
    fail(`catalog length changed. expected ${baselineCatalog.length}, received ${catalog.length}`)
  }

  catalog.forEach((entry, index) => {
    assertCatalogEntry(entry, baselineCatalog[index], metadata, index)
  })
}

function assertAnomalyEntry(actual, expected, type, index) {
  const label = `anomalies.${type}[${index}]`
  assertPlainObject(actual, label)
  assertExactKeys(actual, Object.keys(expected), label)
  assertString(actual.name, `${label}.name`)

  if ('docsSlug' in actual) {
    assertString(actual.docsSlug, `${label}.docsSlug`)
  }

  if ('rootImportPath' in actual) {
    assertOptionalString(actual.rootImportPath, `${label}.rootImportPath`)
  }

  if ('docUrl' in actual) {
    assertString(actual.docUrl, `${label}.docUrl`)
    normalizeUrlPath(actual.docUrl)
  }

  if ('note' in actual) {
    assertString(actual.note, `${label}.note`)
  }
}

function validateAnomalies(baselineAnomalies, anomalies) {
  assertPlainObject(baselineAnomalies, 'baseline anomalies')
  assertPlainObject(anomalies, 'anomalies')
  assertExactKeys(anomalies, Object.keys(baselineAnomalies), 'anomalies')

  for (const [type, baselineEntries] of Object.entries(baselineAnomalies)) {
    const nextEntries = anomalies[type]

    if (!Array.isArray(baselineEntries) || !Array.isArray(nextEntries)) {
      fail(`anomalies.${type} must stay an array`)
    }

    nextEntries.forEach((entry, index) => {
      assertAnomalyEntry(entry, baselineEntries[0] ?? entry, type, index)
    })
  }
}

function validateMetadata(previousMetadata, metadata) {
  assertPlainObject(previousMetadata, 'baseline metadata')
  assertPlainObject(metadata, 'metadata')
  assertExactKeys(metadata, Object.keys(previousMetadata), 'metadata')

  for (const [key, baselineValue] of Object.entries(previousMetadata)) {
    const value = metadata[key]

    if (key === 'lastVerifiedAt') {
      assertString(value, 'metadata.lastVerifiedAt')
      continue
    }

    if (key === 'package') {
      assertPlainObject(value, 'metadata.package')
      assertExactKeys(value, Object.keys(baselineValue), 'metadata.package')
      assertString(value.name, 'metadata.package.name')
      assertString(value.version, 'metadata.package.version')
      if (value.name !== baselineValue.name) {
        fail('metadata.package.name changed unexpectedly')
      }
      continue
    }

    if (key === 'refreshPolicy') {
      assertPlainObject(value, 'metadata.refreshPolicy')
      assertExactKeys(value, Object.keys(baselineValue), 'metadata.refreshPolicy')
      assertNumber(value.maxAgeDays, 'metadata.refreshPolicy.maxAgeDays')
      assertString(value.strategy, 'metadata.refreshPolicy.strategy')
      continue
    }

    if (key === 'notes') {
      assertStringArray(value, 'metadata.notes')
      continue
    }

    if (Array.isArray(baselineValue)) {
      assertStringArray(value, `metadata.${key}`)
    } else if (typeof baselineValue === 'string') {
      assertString(value, `metadata.${key}`)
    } else if (isPlainObject(baselineValue)) {
      assertPlainObject(value, `metadata.${key}`)
      assertExactKeys(value, Object.keys(baselineValue), `metadata.${key}`)
    }

    if (key !== 'package') {
      assertDeepEqual(value, baselineValue, `metadata.${key}`)
    }
  }
}

export function validateRefreshArtifacts(options) {
  const { baselineCatalog, baselineAnomalies, previousMetadata, catalog, anomalies, metadata } =
    options

  validateMetadata(previousMetadata, metadata)
  validateCatalog(baselineCatalog, catalog, metadata)
  validateAnomalies(baselineAnomalies, anomalies)
}
