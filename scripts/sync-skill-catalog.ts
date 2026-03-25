import { readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  parseSkillFrontmatter,
  type SkillFrontmatter,
} from '../packages/create-rn-miniapp/src/skills/frontmatter.js'
import { renderSkillCatalogSource } from '../packages/create-rn-miniapp/src/skills/catalog-generator.js'

const repoRoot = fileURLToPath(new URL('..', import.meta.url))
const skillsRoot = path.join(repoRoot, 'skills')
const outputPath = path.join(repoRoot, 'packages/create-rn-miniapp/src/templates/skill-catalog.ts')

async function main() {
  const skillEntries = (await readdir(skillsRoot, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .sort((left, right) => left.name.localeCompare(right.name))

  const skills: SkillFrontmatter[] = []

  for (const entry of skillEntries) {
    const skillPath = path.join(skillsRoot, entry.name, 'SKILL.md')
    const source = await readFile(skillPath, 'utf8').catch(() => null)

    if (!source) {
      continue
    }

    skills.push(parseSkillFrontmatter(source, entry.name))
  }

  skills.sort((left, right) => left.order - right.order || left.id.localeCompare(right.id))

  const nextSource = renderSkillCatalogSource(skills)

  await writeFile(outputPath, nextSource, 'utf8')
}

main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
