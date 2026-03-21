import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { buildAnomalies, buildCatalog, buildMetadata } from './lib/builders.mjs'
import { fetchDocsFacts, fetchLatestPackageVersion, fetchPackageFacts } from './lib/external.mjs'
import {
  formatFilesIfPossible,
  logWarning,
  mirrorCanonicalSkill,
  readJsonFile,
  resolveSkillContext,
  resolveToday,
  syncClaudeMirror,
  writeJsonFile,
  writeTextFile,
} from './lib/io.mjs'
import { renderAgentsMarkdown, renderCatalogProjection } from './lib/render.mjs'
import { validateRefreshArtifacts } from './lib/validate.mjs'

async function main() {
  const context = resolveSkillContext(import.meta.url)

  if (context.isClaudeMirror) {
    const canonicalRefreshScriptPath = path.join(
      context.canonicalSkillRoot,
      'scripts',
      'refresh-catalog.mjs',
    )
    const result = spawnSync(process.execPath, [canonicalRefreshScriptPath], {
      cwd: context.repoRoot ?? context.skillRoot,
      env: {
        ...process.env,
        TDS_UI_REFRESH_SKIP_MIRROR_SYNC: '1',
      },
      stdio: 'inherit',
    })

    if ((result.status ?? 1) === 0) {
      try {
        await mirrorCanonicalSkill(context)
      } catch (error) {
        logWarning('mirror sync failed after delegated refresh.', error)
      }
    } else {
      logWarning(
        'delegated refresh failed; continuing with existing snapshot.',
        result.error ?? result.status,
      )
    }

    return
  }

  const metadataPath = path.join(context.skillRoot, 'metadata.json')
  const catalogPath = path.join(context.skillRoot, 'generated', 'catalog.json')
  const anomaliesPath = path.join(context.skillRoot, 'generated', 'anomalies.json')
  const catalogMarkdownPath = path.join(context.skillRoot, 'generated', 'catalog.md')
  const agentsPath = path.join(context.skillRoot, 'AGENTS.md')

  const baselineCatalog = await readJsonFile(catalogPath)
  const baselineAnomalies = await readJsonFile(anomaliesPath)
  const previousMetadata = await readJsonFile(metadataPath)
  const latestVersion = await fetchLatestPackageVersion(process.env)
  const packageFacts = await fetchPackageFacts({
    env: process.env,
    version: latestVersion,
  })
  const docsPages = await fetchDocsFacts(process.env)
  const today = resolveToday(process.env)

  const catalog = buildCatalog({
    baselineCatalog,
    docsPages,
    latestVersion,
    packageFacts,
    today,
  })
  const anomalies = buildAnomalies(catalog)
  const metadata = buildMetadata(previousMetadata, {
    latestVersion,
    today,
  })

  validateRefreshArtifacts({
    baselineCatalog,
    baselineAnomalies,
    previousMetadata,
    catalog,
    anomalies,
    metadata,
  })

  await writeJsonFile(catalogPath, catalog)
  await writeJsonFile(anomaliesPath, anomalies)
  await writeTextFile(
    catalogMarkdownPath,
    renderCatalogProjection(catalog, {
      packageVersion: metadata.package.version,
      lastVerifiedAt: metadata.lastVerifiedAt,
    }),
  )
  await writeTextFile(agentsPath, renderAgentsMarkdown())
  await writeJsonFile(metadataPath, metadata)
  await formatFilesIfPossible(context, [catalogPath, anomaliesPath, metadataPath])

  if (process.env.TDS_UI_REFRESH_SKIP_MIRROR_SYNC !== '1') {
    try {
      await syncClaudeMirror(context)
    } catch (error) {
      logWarning('skills sync failed after refresh.', error)
    }
  }
}

try {
  await main()
} catch (error) {
  logWarning('refresh failed; continuing with existing snapshot.', error)
}

process.exit(0)
