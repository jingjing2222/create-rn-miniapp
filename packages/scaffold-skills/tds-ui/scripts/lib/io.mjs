import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { cp, readFile, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export function resolveSkillContext(scriptUrl) {
  const scriptPath = fileURLToPath(scriptUrl)
  const scriptsRoot = path.dirname(scriptPath)
  const skillRoot = path.resolve(scriptsRoot, '..')
  const normalizedSkillRoot = skillRoot.split(path.sep).join('/')
  const isClaudeMirror = normalizedSkillRoot.includes('/.claude/skills/tds-ui')
  const isCanonicalGenerated = normalizedSkillRoot.includes('/.agents/skills/tds-ui')
  const repoRoot =
    isClaudeMirror || isCanonicalGenerated ? path.resolve(skillRoot, '..', '..', '..') : null

  return {
    skillRoot,
    repoRoot,
    isClaudeMirror,
    isCanonicalGenerated,
    canonicalSkillRoot:
      isClaudeMirror && repoRoot ? path.join(repoRoot, '.agents', 'skills', 'tds-ui') : skillRoot,
  }
}

export function redirectToCanonicalIfNeeded(context, scriptName) {
  if (!context.isClaudeMirror || !context.repoRoot) {
    return null
  }

  const canonicalScriptPath = path.join(context.canonicalSkillRoot, 'scripts', scriptName)
  if (!existsSync(canonicalScriptPath)) {
    return null
  }

  const result = spawnSync(process.execPath, [canonicalScriptPath], {
    cwd: context.repoRoot,
    env: process.env,
    stdio: 'inherit',
  })

  if (result.error) {
    throw result.error
  }

  return result.status ?? 1
}

export async function readJsonFile(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'))
}

export async function writeJsonFile(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

export async function writeTextFile(filePath, value) {
  await writeFile(filePath, `${value}\n`, 'utf8')
}

export async function fetchText(url) {
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`failed to fetch ${url}: ${response.status}`)
  }

  return response.text()
}

export async function fetchJson(url) {
  return JSON.parse(await fetchText(url))
}

export function resolveToday(env = process.env) {
  if (env.TDS_UI_REFRESH_TODAY) {
    return env.TDS_UI_REFRESH_TODAY
  }

  return new Date().toISOString().slice(0, 10)
}

export function isStale(lastVerifiedAt, today, maxAgeDays) {
  const lastTimestamp = Date.parse(`${lastVerifiedAt}T00:00:00Z`)
  const todayTimestamp = Date.parse(`${today}T00:00:00Z`)

  if (!Number.isFinite(lastTimestamp) || !Number.isFinite(todayTimestamp)) {
    return true
  }

  const elapsedDays = Math.floor((todayTimestamp - lastTimestamp) / 86_400_000)
  return elapsedDays >= maxAgeDays
}

export function logWarning(message, error) {
  const suffix = error instanceof Error ? ` ${error.message}` : error ? ` ${String(error)}` : ''
  console.warn(`[tds-ui] ${message}${suffix}`)
}

function detectBiomeCommand(repoRoot) {
  const localBiomePath = path.join(repoRoot, 'node_modules', '.bin', 'biome')
  if (existsSync(localBiomePath)) {
    return {
      command: localBiomePath,
      args: ['format', '--write'],
    }
  }

  const packageJsonPath = path.join(repoRoot, 'package.json')
  if (!existsSync(packageJsonPath)) {
    return null
  }

  try {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'))
    const packageManager =
      typeof packageJson.packageManager === 'string' ? packageJson.packageManager.split('@')[0] : ''

    switch (packageManager) {
      case 'pnpm':
        return { command: 'pnpm', args: ['exec', 'biome', 'format', '--write'] }
      case 'yarn':
        return { command: 'yarn', args: ['exec', 'biome', 'format', '--write'] }
      case 'npm':
        return { command: 'npm', args: ['exec', '--', 'biome', 'format', '--write'] }
      case 'bun':
        return { command: 'bunx', args: ['biome', 'format', '--write'] }
      default:
        return null
    }
  } catch {
    return null
  }
}

export async function formatFilesIfPossible(context, filePaths) {
  const repoRoot = context.repoRoot ?? path.resolve(context.skillRoot, '..', '..', '..')
  const biomeCommand = detectBiomeCommand(repoRoot)

  if (!biomeCommand) {
    return
  }

  const result = spawnSync(biomeCommand.command, [...biomeCommand.args, ...filePaths], {
    cwd: repoRoot,
    stdio: 'ignore',
  })

  if (result.error || (result.status ?? 1) !== 0) {
    logWarning('biome format skipped after refresh.', result.error ?? result.status)
  }
}

export async function syncClaudeMirror(context) {
  if (!context.isCanonicalGenerated || !context.repoRoot) {
    return
  }

  const syncScriptPath = path.join(context.repoRoot, 'scripts', 'sync-skills.mjs')
  if (!existsSync(syncScriptPath)) {
    return
  }

  const result = spawnSync(process.execPath, [syncScriptPath], {
    cwd: context.repoRoot,
    env: process.env,
    stdio: 'inherit',
  })

  if ((result.status ?? 1) !== 0) {
    logWarning('skills sync failed after refresh.')
  }
}

export async function mirrorCanonicalSkill(context) {
  if (!context.isClaudeMirror) {
    return
  }

  for (const entry of await readdir(context.canonicalSkillRoot, { withFileTypes: true })) {
    await cp(
      path.join(context.canonicalSkillRoot, entry.name),
      path.join(context.skillRoot, entry.name),
      {
        force: true,
        recursive: true,
      },
    )
  }
}
