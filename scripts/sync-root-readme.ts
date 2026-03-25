import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { syncRootReadmeManagedSections } from '../packages/create-rn-miniapp/src/docs/root-readme.js'

const repoRoot = fileURLToPath(new URL('..', import.meta.url))
const readmePath = path.join(repoRoot, 'README.md')

async function main() {
  const currentReadme = await readFile(readmePath, 'utf8')
  const nextReadme = syncRootReadmeManagedSections(currentReadme)

  if (nextReadme !== currentReadme) {
    await writeFile(readmePath, nextReadme, 'utf8')
  }
}

main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
