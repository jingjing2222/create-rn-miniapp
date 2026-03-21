import path from 'node:path'
import { spawnSync } from 'node:child_process'
import {
  isStale,
  logWarning,
  mirrorCanonicalSkill,
  readJsonFile,
  resolveSkillContext,
  resolveToday,
} from './lib/io.mjs'

async function main() {
  const context = resolveSkillContext(import.meta.url)
  const metadataPath = path.join(
    context.isClaudeMirror ? context.canonicalSkillRoot : context.skillRoot,
    'metadata.json',
  )
  const metadata = await readJsonFile(metadataPath)
  const today = resolveToday(process.env)
  const maxAgeDays = Number(
    process.env.TDS_UI_REFRESH_MAX_AGE_DAYS ?? metadata.refreshPolicy?.maxAgeDays ?? 7,
  )

  if (!isStale(metadata.lastVerifiedAt, today, maxAgeDays)) {
    return
  }

  const refreshScriptPath = path.join(
    context.isClaudeMirror ? context.canonicalSkillRoot : context.skillRoot,
    'scripts',
    'refresh-catalog.mjs',
  )
  const result = spawnSync(process.execPath, [refreshScriptPath], {
    cwd: context.repoRoot ?? context.skillRoot,
    env: context.isClaudeMirror
      ? {
          ...process.env,
          TDS_UI_REFRESH_SKIP_MIRROR_SYNC: '1',
        }
      : process.env,
    stdio: 'inherit',
  })

  if (!result.error && (result.status ?? 1) === 0 && context.isClaudeMirror) {
    try {
      await mirrorCanonicalSkill(context)
    } catch (error) {
      logWarning('mirror sync failed; continuing with existing snapshot.', error)
    }
  }

  if (result.error || (result.status ?? 1) !== 0) {
    logWarning('refresh failed; continuing with existing snapshot.', result.error ?? result.status)
  }
}

try {
  await main()
} catch (error) {
  logWarning('freshness check failed; continuing with existing snapshot.', error)
}

process.exit(0)
