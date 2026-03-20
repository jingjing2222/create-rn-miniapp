import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { formatDevPublishVersion, prepareDevPublishPackageJsons } from './release/dev-publish.js'

const repoRoot = path.resolve(import.meta.dirname, '../../..')

test('version-packages formats workspace after changeset bump', () => {
  const packageJsonPath = path.join(repoRoot, 'package.json')
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) as {
    scripts?: Record<string, string>
  }

  assert.equal(packageJson.scripts?.['version-packages'], 'changeset version && pnpm format')
  assert.equal(
    packageJson.scripts?.['publish:dev'],
    'pnpm exec tsx packages/create-rn-miniapp/src/release/dev-publish.ts',
  )
})

test('formatDevPublishVersion renders a timestamped prerelease version', () => {
  assert.equal(
    formatDevPublishVersion(new Date('2026-03-15T09:08:07.000Z')),
    '0.0.0-dev.20260315090807',
  )
})

test('prepareDevPublishPackageJsons rewrites both publish manifests to the same dev version', () => {
  const prepared = prepareDevPublishPackageJsons({
    version: '0.0.0-dev.20260315090807',
    cliPackageJson: {
      name: 'create-rn-miniapp',
      version: '0.0.9',
      dependencies: {
        '@create-rn-miniapp/scaffold-templates': 'workspace:*',
        yargs: '^18.0.0',
      },
    },
    templatesPackageJson: {
      name: '@create-rn-miniapp/scaffold-templates',
      version: '0.0.9',
    },
  })

  assert.equal(prepared.cliPackageJson.version, '0.0.0-dev.20260315090807')
  assert.equal(prepared.templatesPackageJson.version, '0.0.0-dev.20260315090807')
  assert.equal(
    prepared.cliPackageJson.dependencies?.['@create-rn-miniapp/scaffold-templates'],
    '0.0.0-dev.20260315090807',
  )
  assert.equal(prepared.cliPackageJson.dependencies?.yargs, '^18.0.0')
})

test('published package names match the released npm packages', () => {
  const cliPackageJson = JSON.parse(
    fs.readFileSync(path.join(repoRoot, 'packages/create-rn-miniapp/package.json'), 'utf8'),
  ) as {
    name: string
    dependencies?: Record<string, string>
  }
  const templatesPackageJson = JSON.parse(
    fs.readFileSync(path.join(repoRoot, 'packages/scaffold-templates/package.json'), 'utf8'),
  ) as {
    name: string
  }

  assert.equal(cliPackageJson.name, 'create-rn-miniapp')
  assert.equal(
    cliPackageJson.dependencies?.['@create-rn-miniapp/scaffold-templates'],
    'workspace:*',
  )
  assert.equal(templatesPackageJson.name, '@create-rn-miniapp/scaffold-templates')
})

test('workspace project schema does not depend on local node_modules paths', () => {
  const projectJson = JSON.parse(
    fs.readFileSync(path.join(repoRoot, 'packages/create-rn-miniapp/project.json'), 'utf8'),
  ) as {
    $schema?: string
  }

  assert.equal(
    projectJson.$schema,
    'https://raw.githubusercontent.com/nrwl/nx/master/packages/nx/schemas/project-schema.json',
  )
})

test('changeset files keep valid frontmatter delimiters', () => {
  const changesetRoot = path.join(repoRoot, '.changeset')
  const changesetFiles = fs
    .readdirSync(changesetRoot)
    .filter((fileName) => fileName.endsWith('.md') && fileName !== 'README.md')
    .sort()

  for (const fileName of changesetFiles) {
    const source = fs.readFileSync(path.join(changesetRoot, fileName), 'utf8')
    assert.equal(
      source.startsWith('---\n') || source.startsWith('---\r\n'),
      true,
      `${fileName} must start with a YAML frontmatter delimiter`,
    )
  }
})

test('scaffold templates tarball keeps the root gitignore template', () => {
  const packJson = execFileSync('npm', ['pack', '--dry-run', '--json'], {
    cwd: path.join(repoRoot, 'packages/scaffold-templates'),
    encoding: 'utf8',
  })
  const [packResult] = JSON.parse(packJson) as Array<{
    files: Array<{ path: string }>
  }>

  assert.ok(packResult)
  assert.equal(
    packResult.files.some((file) => file.path === 'root/pnpm.gitignore'),
    true,
  )
  assert.equal(
    packResult.files.some((file) => file.path === 'root/yarn.gitignore'),
    true,
  )
  assert.equal(
    packResult.files.some((file) => file.path === 'root/pnpm.biome.json'),
    true,
  )
  assert.equal(
    packResult.files.some((file) => file.path === 'root/yarn.biome.json'),
    true,
  )
  assert.equal(
    packResult.files.some((file) => file.path === 'root/npm.gitignore'),
    true,
  )
  assert.equal(
    packResult.files.some((file) => file.path === 'root/npm.biome.json'),
    true,
  )
  assert.equal(
    packResult.files.some((file) => file.path === 'root/bun.gitignore'),
    true,
  )
  assert.equal(
    packResult.files.some((file) => file.path === 'root/bun.biome.json'),
    true,
  )
  assert.equal(
    packResult.files.some((file) => file.path === 'root/yarnrc.yml'),
    true,
  )
  assert.equal(
    packResult.files.some((file) => file.path === 'root/tsconfig.base.json'),
    false,
  )
  assert.equal(
    packResult.files.some(
      (file) =>
        file.path === 'optional/backoffice/docs/engineering/backoffice-react-best-practices.md',
    ),
    true,
  )
  assert.equal(
    packResult.files.some(
      (file) =>
        file.path === 'optional/server-supabase/docs/engineering/server-provider-supabase.md',
    ),
    true,
  )
  assert.equal(
    packResult.files.some(
      (file) => file.path === 'optional/worktree/scripts/worktree/post-merge-cleanup.sh',
    ),
    true,
  )
})

test('README describes worktree as a control-root bootstrap workflow', () => {
  const readme = fs.readFileSync(path.join(repoRoot, 'README.md'), 'utf8')
  const workflow = fs.readFileSync(
    path.join(
      repoRoot,
      'packages/scaffold-templates/optional/worktree/docs/engineering/worktree-workflow.md',
    ),
    'utf8',
  )

  assert.match(readme, /control root/)
  assert.match(readme, /single-root라면 `cd my-miniapp` 뒤에 `pnpm verify`/)
  assert.match(readme, /`--worktree`라면 `cd my-miniapp\/main` 뒤에 `pnpm verify`/)
  assert.match(readme, /mkdir my-miniapp/)
  assert.match(readme, /cd my-miniapp/)
  assert.match(readme, /git clone --separate-git-dir=\.gitdata <repo-url> main/)
  assert.match(readme, /node main\/scripts\/worktree\/bootstrap-control-root\.mjs/)
  assert.match(readme, /\.gitdata\//)
  assert.match(readme, /main\//)
  assert.match(readme, /git -C main worktree add -b <branch-name> \.\.\/<branch-name> main/)
  assert.match(readme, /에이전트가 worktree를 사용하게 할까요\?/)
  assert.match(readme, /브랜치명에는 `\/`를 쓰지 않고 1-depth kebab-case/)
  assert.doesNotMatch(readme, /bootstrap이 끝나면 local control root에는/)
  assert.doesNotMatch(readme, /Implement\.md/)
  assert.match(workflow, /plain clone 상태라면 README bootstrap/)
  assert.match(workflow, /git -C main worktree add -b <branch-name> \.\.\/<branch-name> main/)
  assert.match(workflow, /control root 바로 아래 sibling으로/)
})
