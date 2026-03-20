import { readFile, readdir, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const canonicalSkillsDir = path.join(workspaceRoot, '.agents', 'skills')
const claudeSkillsDir = path.join(workspaceRoot, '.claude', 'skills')

async function listFiles(rootDir, currentDir = rootDir) {
  const entries = await readdir(currentDir, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const absolutePath = path.join(currentDir, entry.name)

    if (entry.isDirectory()) {
      files.push(...(await listFiles(rootDir, absolutePath)))
      continue
    }

    files.push(path.relative(rootDir, absolutePath))
  }

  return files.sort()
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
  await assertExists(claudeSkillsDir, 'claude mirror')

  const canonicalFiles = await listFiles(canonicalSkillsDir)
  const mirrorFiles = await listFiles(claudeSkillsDir)

  const missingInMirror = canonicalFiles.filter((file) => !mirrorFiles.includes(file))
  const extraInMirror = mirrorFiles.filter((file) => !canonicalFiles.includes(file))
  const changedFiles = []

  for (const file of canonicalFiles) {
    if (!mirrorFiles.includes(file)) {
      continue
    }

    const [canonicalSource, mirrorSource] = await Promise.all([
      readFile(path.join(canonicalSkillsDir, file)),
      readFile(path.join(claudeSkillsDir, file)),
    ])

    if (!canonicalSource.equals(mirrorSource)) {
      changedFiles.push(file)
    }
  }

  if (missingInMirror.length === 0 && extraInMirror.length === 0 && changedFiles.length === 0) {
    return
  }

  const messages = ['Skill mirror가 canonical source와 일치하지 않습니다.']

  if (missingInMirror.length > 0) {
    messages.push(`- mirror에 없는 파일: ${missingInMirror.join(', ')}`)
  }

  if (extraInMirror.length > 0) {
    messages.push(`- mirror에만 있는 파일: ${extraInMirror.join(', ')}`)
  }

  if (changedFiles.length > 0) {
    messages.push(`- 내용이 다른 파일: ${changedFiles.join(', ')}`)
  }

  messages.push('`{{skillsSyncCommand}}`로 mirror를 다시 동기화하세요.')

  throw new Error(messages.join('\n'))
}

await main()
