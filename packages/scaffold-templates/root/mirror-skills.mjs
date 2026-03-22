import { cp, mkdir, rm, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const canonicalSkillsDir = path.join(workspaceRoot, '.agents', 'skills')
const claudeSkillsDir = path.join(workspaceRoot, '.claude', 'skills')

async function ensureDirectory(targetPath) {
  await mkdir(targetPath, { recursive: true })
}

async function assertExists(targetPath, label) {
  try {
    await stat(targetPath)
  } catch {
    throw new Error(`${label} 경로가 없습니다: ${targetPath}`)
  }
}

async function main() {
  await assertExists(canonicalSkillsDir, 'canonical skills')
  await ensureDirectory(path.dirname(claudeSkillsDir))
  await rm(claudeSkillsDir, { recursive: true, force: true })
  await cp(canonicalSkillsDir, claudeSkillsDir, { recursive: true })
}

await main()
