import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import {
  buildSkillsInstallCommands,
  hasInstalledProjectSkills,
  listInstalledProjectSkillEntries,
  listInstalledProjectSkills,
  normalizeSelectedSkillIds,
  resolveLocalSourceSkillIds,
  renderInstalledSkillsSummary,
  renderSkillsAddCommand,
  resolveRecommendedSkillIds,
  syncInstalledSkillArtifacts,
} from './skills/install.js'
import {
  APPS_IN_TOSS_SKILLS_SOURCE_REPO,
  SKILLS_LIST_COMMAND,
  SKILLS_SOURCE_REPO,
} from './skills/contract.js'

function escapeRegExp(source: string) {
  return source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

test('normalizeSelectedSkillIds keeps known ids and removes duplicates', () => {
  assert.deepEqual(normalizeSelectedSkillIds(['tds-ui', 'cloudflare-worker', 'tds-ui']), [
    'tds-ui',
    'cloudflare-worker',
  ])
})

test('resolveRecommendedSkillIds returns a flat recommended list for the current topology', () => {
  assert.deepEqual(
    resolveRecommendedSkillIds({
      serverProvider: 'cloudflare',
      hasBackoffice: true,
      hasTrpc: true,
    }),
    [
      'docs-search',
      'project-validator',
      'granite-routing',
      'tds-ui',
      'backoffice-react',
      'cloudflare-worker',
      'trpc-boundary',
    ],
  )
})

test('renderSkillsAddCommand produces the standard npx skills command', () => {
  const expectedCommand = [
    ['npx', 'skills', 'add', APPS_IN_TOSS_SKILLS_SOURCE_REPO]
      .concat(['--skill', 'docs-search', '--skill', 'project-validator'])
      .concat(['--copy'])
      .join(' '),
    ['npx', 'skills', 'add', SKILLS_SOURCE_REPO]
      .concat(['--skill', 'granite-routing', '--skill', 'tds-ui'])
      .concat(['--copy'])
      .join(' '),
  ].join('\n')

  assert.equal(
    renderSkillsAddCommand(['docs-search', 'project-validator', 'granite-routing', 'tds-ui']),
    expectedCommand,
  )
})

test('skills source repo slug is derived from the published package repository', async () => {
  const packageJson = JSON.parse(
    await readFile(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf8'),
  ) as {
    repository?: { url?: string }
  }
  const skillsContractSource = await readFile(
    fileURLToPath(new URL('./skills/contract.ts', import.meta.url)),
    'utf8',
  )

  assert.equal(
    SKILLS_SOURCE_REPO,
    packageJson.repository?.url
      ?.replace(/^git\+/, '')
      .replace(/^https:\/\/github\.com\//, '')
      .replace(/\.git$/, ''),
  )
  assert.equal(
    packageJson.repository?.url,
    'git+https://github.com/jingjing2222/create-rn-miniapp.git',
  )
  assert.doesNotMatch(
    skillsContractSource,
    new RegExp(escapeRegExp(`export const SKILLS_SOURCE_REPO = '${SKILLS_SOURCE_REPO}'`)),
  )
})

test('renderInstalledSkillsSummary renders discovered project-local skill paths', () => {
  assert.equal(
    renderInstalledSkillsSummary([
      { id: 'tds-ui', skillsRoot: 'skills' },
      { id: 'granite-routing', skillsRoot: '.agents/skills' },
    ]),
    [
      'project-local skills를 설치했어요.',
      '- granite-routing: `.agents/skills/granite-routing`',
      '- tds-ui: `skills/tds-ui`',
      `필요하면 \`${SKILLS_LIST_COMMAND}\`로 다시 확인해 주세요.`,
    ].join('\n'),
  )
})

test('buildSkillsInstallCommands groups selected skills by source repo and uses the local repo source in development', async () => {
  const targetRoot = '/tmp/ebook-miniapp'
  const commands = await buildSkillsInstallCommands({
    packageManager: 'pnpm',
    targetRoot,
    skillIds: ['docs-search', 'project-validator', 'granite-routing', 'tds-ui'],
  })

  assert.deepEqual(commands, [
    {
      cwd: targetRoot,
      command: 'pnpm',
      args: [
        'dlx',
        'skills@1.4.5',
        'add',
        APPS_IN_TOSS_SKILLS_SOURCE_REPO,
        '--skill',
        'docs-search',
        '--skill',
        'project-validator',
        '--copy',
        '-y',
      ],
      label: '추천 agent skills 설치하기',
    },
    {
      cwd: targetRoot,
      command: 'pnpm',
      args: [
        'dlx',
        'skills@1.4.5',
        'add',
        path.resolve(import.meta.dirname, '../../..'),
        '--skill',
        'granite-routing',
        '--skill',
        'tds-ui',
        '--copy',
        '-y',
      ],
      label: '추천 agent skills 설치하기',
    },
  ])
})

test('resolveLocalSourceSkillIds returns only skills backed by the local checkout', async () => {
  assert.deepEqual(
    await resolveLocalSourceSkillIds([
      'docs-search',
      'project-validator',
      'granite-routing',
      'tds-ui',
    ]),
    ['granite-routing', 'tds-ui'],
  )
})

test('project-local skill detection derives installed skills from the standard project skill directories', async (t) => {
  const targetRoot = await mkdtemp(path.join(os.tmpdir(), 'create-rn-miniapp-skills-install-'))

  t.after(async () => {
    await rm(targetRoot, { recursive: true, force: true })
  })

  await mkdir(path.join(targetRoot, '.agents', 'skills'), { recursive: true })
  await mkdir(path.join(targetRoot, '.claude', 'skills'), { recursive: true })
  await mkdir(path.join(targetRoot, 'skills', 'tds-ui'), { recursive: true })
  await writeFile(path.join(targetRoot, '.agents', 'skills', 'README.md'), 'not a skill\n', 'utf8')
  await writeFile(path.join(targetRoot, '.claude', 'skills', 'notes.txt'), 'mirror note\n', 'utf8')
  await writeFile(path.join(targetRoot, 'skills', 'tds-ui', 'SKILL.md'), '# TDS\n', 'utf8')

  assert.equal(await hasInstalledProjectSkills(targetRoot), true)
  assert.deepEqual(await listInstalledProjectSkills(targetRoot), ['tds-ui'])
  assert.deepEqual(await listInstalledProjectSkillEntries(targetRoot), [
    { id: 'tds-ui', skillsRoot: 'skills' },
  ])
})

test('syncInstalledSkillArtifacts downloads declared llms mirrors for an installed tds-ui skill', async (t) => {
  const targetRoot = await mkdtemp(path.join(os.tmpdir(), 'create-rn-miniapp-skill-mirror-'))

  t.after(async () => {
    await rm(targetRoot, { recursive: true, force: true })
  })

  const skillRoot = path.join(targetRoot, 'skills', 'tds-ui')
  const llmsIndexUrl = 'https://tossmini-docs.toss.im/tds-react-native/llms.txt'
  const llmsFullUrl = 'https://tossmini-docs.toss.im/tds-react-native/llms-full.txt'

  await mkdir(skillRoot, { recursive: true })
  await writeFile(path.join(skillRoot, 'SKILL.md'), '# TDS\n', 'utf8')
  await writeFile(
    path.join(skillRoot, 'metadata.json'),
    `${JSON.stringify(
      {
        upstreamSources: [llmsIndexUrl, llmsFullUrl],
        installMirrors: {
          [llmsIndexUrl]: 'generated/llms.txt',
          [llmsFullUrl]: 'generated/llms-full.txt',
        },
      },
      null,
      2,
    )}\n`,
    'utf8',
  )

  const requestedUrls: string[] = []

  await syncInstalledSkillArtifacts(targetRoot, {
    fetchImpl: async (url) => {
      requestedUrls.push(url.toString())

      return {
        ok: true,
        status: 200,
        text: async () => `downloaded:${url.toString()}`,
      } as Response
    },
  })

  assert.deepEqual(requestedUrls, [llmsIndexUrl, llmsFullUrl])
  assert.equal(
    await readFile(path.join(skillRoot, 'generated', 'llms.txt'), 'utf8'),
    `downloaded:${llmsIndexUrl}`,
  )
  assert.equal(
    await readFile(path.join(skillRoot, 'generated', 'llms-full.txt'), 'utf8'),
    `downloaded:${llmsFullUrl}`,
  )
})

test('syncInstalledSkillArtifacts tolerates download failures for locally sourced tds-ui installs', async (t) => {
  const targetRoot = await mkdtemp(path.join(os.tmpdir(), 'create-rn-miniapp-skill-mirror-'))

  t.after(async () => {
    await rm(targetRoot, { recursive: true, force: true })
  })

  const skillRoot = path.join(targetRoot, 'skills', 'tds-ui')
  const llmsIndexUrl = 'https://tossmini-docs.toss.im/tds-react-native/llms.txt'

  await mkdir(skillRoot, { recursive: true })
  await writeFile(path.join(skillRoot, 'SKILL.md'), '# TDS\n', 'utf8')
  await writeFile(
    path.join(skillRoot, 'metadata.json'),
    `${JSON.stringify(
      {
        upstreamSources: [llmsIndexUrl],
        installMirrors: {
          [llmsIndexUrl]: 'generated/llms.txt',
        },
      },
      null,
      2,
    )}\n`,
    'utf8',
  )

  await assert.doesNotReject(
    syncInstalledSkillArtifacts(targetRoot, {
      fetchImpl: async () => {
        throw new Error('network down')
      },
      allowDownloadFailureSkillIds: ['tds-ui'],
    }),
  )

  await assert.rejects(readFile(path.join(skillRoot, 'generated', 'llms.txt'), 'utf8'), {
    code: 'ENOENT',
  })
})

test('syncInstalledSkillArtifacts syncs llms mirrors into every installed tds-ui root', async (t) => {
  const targetRoot = await mkdtemp(path.join(os.tmpdir(), 'create-rn-miniapp-skill-mirror-'))

  t.after(async () => {
    await rm(targetRoot, { recursive: true, force: true })
  })

  const llmsIndexUrl = 'https://tossmini-docs.toss.im/tds-react-native/llms.txt'
  const llmsFullUrl = 'https://tossmini-docs.toss.im/tds-react-native/llms-full.txt'
  const requestedUrls: string[] = []

  for (const skillsRoot of ['.agents/skills', '.claude/skills']) {
    const skillRoot = path.join(targetRoot, skillsRoot, 'tds-ui')

    await mkdir(skillRoot, { recursive: true })
    await writeFile(path.join(skillRoot, 'SKILL.md'), '# TDS\n', 'utf8')
    await writeFile(
      path.join(skillRoot, 'metadata.json'),
      `${JSON.stringify(
        {
          upstreamSources: [llmsIndexUrl, llmsFullUrl],
          installMirrors: {
            [llmsIndexUrl]: 'generated/llms.txt',
            [llmsFullUrl]: 'generated/llms-full.txt',
          },
        },
        null,
        2,
      )}\n`,
      'utf8',
    )
  }

  await syncInstalledSkillArtifacts(targetRoot, {
    fetchImpl: async (url) => {
      requestedUrls.push(url.toString())

      return {
        ok: true,
        status: 200,
        text: async () => `downloaded:${url.toString()}`,
      } as Response
    },
  })

  assert.deepEqual(requestedUrls, [llmsIndexUrl, llmsFullUrl, llmsIndexUrl, llmsFullUrl])

  for (const skillsRoot of ['.agents/skills', '.claude/skills']) {
    const generatedRoot = path.join(targetRoot, skillsRoot, 'tds-ui', 'generated')

    assert.equal(
      await readFile(path.join(generatedRoot, 'llms.txt'), 'utf8'),
      `downloaded:${llmsIndexUrl}`,
    )
    assert.equal(
      await readFile(path.join(generatedRoot, 'llms-full.txt'), 'utf8'),
      `downloaded:${llmsFullUrl}`,
    )
  }
})

test('syncInstalledSkillArtifacts fails when a tds-ui llms mirror download does not succeed', async (t) => {
  const targetRoot = await mkdtemp(path.join(os.tmpdir(), 'create-rn-miniapp-skill-mirror-'))

  t.after(async () => {
    await rm(targetRoot, { recursive: true, force: true })
  })

  const skillRoot = path.join(targetRoot, 'skills', 'tds-ui')
  const llmsIndexUrl = 'https://tossmini-docs.toss.im/tds-react-native/llms.txt'

  await mkdir(skillRoot, { recursive: true })
  await writeFile(path.join(skillRoot, 'SKILL.md'), '# TDS\n', 'utf8')
  await writeFile(
    path.join(skillRoot, 'metadata.json'),
    `${JSON.stringify(
      {
        upstreamSources: [llmsIndexUrl],
        installMirrors: {
          [llmsIndexUrl]: 'generated/llms.txt',
        },
      },
      null,
      2,
    )}\n`,
    'utf8',
  )

  await assert.rejects(
    syncInstalledSkillArtifacts(targetRoot, {
      fetchImpl: async () => {
        return {
          ok: false,
          status: 503,
          text: async () => 'service unavailable',
        } as Response
      },
    }),
    /tds-ui llms mirror를 다운로드하지 못했어요/,
  )
})

test('syncInstalledSkillArtifacts rejects mirror paths that escape the skill root with parent traversal', async (t) => {
  const targetRoot = await mkdtemp(path.join(os.tmpdir(), 'create-rn-miniapp-skill-mirror-'))

  t.after(async () => {
    await rm(targetRoot, { recursive: true, force: true })
  })

  const skillRoot = path.join(targetRoot, 'skills', 'tds-ui')
  const llmsIndexUrl = 'https://tossmini-docs.toss.im/tds-react-native/llms.txt'
  const requestedUrls: string[] = []

  await mkdir(skillRoot, { recursive: true })
  await writeFile(path.join(skillRoot, 'SKILL.md'), '# TDS\n', 'utf8')
  await writeFile(
    path.join(skillRoot, 'metadata.json'),
    `${JSON.stringify(
      {
        upstreamSources: [llmsIndexUrl],
        installMirrors: {
          [llmsIndexUrl]: '../../package.json',
        },
      },
      null,
      2,
    )}\n`,
    'utf8',
  )

  await assert.rejects(
    syncInstalledSkillArtifacts(targetRoot, {
      fetchImpl: async (url) => {
        requestedUrls.push(url.toString())

        return {
          ok: true,
          status: 200,
          text: async () => 'should-not-download',
        } as Response
      },
    }),
    /tds-ui metadata\.installMirrors 경로가 skill root 밖을 가리켜요/,
  )

  assert.deepEqual(requestedUrls, [])
})

test('syncInstalledSkillArtifacts rejects mirror paths that use absolute targets', async (t) => {
  const targetRoot = await mkdtemp(path.join(os.tmpdir(), 'create-rn-miniapp-skill-mirror-'))

  t.after(async () => {
    await rm(targetRoot, { recursive: true, force: true })
  })

  const skillRoot = path.join(targetRoot, 'skills', 'tds-ui')
  const llmsIndexUrl = 'https://tossmini-docs.toss.im/tds-react-native/llms.txt'
  const requestedUrls: string[] = []

  await mkdir(skillRoot, { recursive: true })
  await writeFile(path.join(skillRoot, 'SKILL.md'), '# TDS\n', 'utf8')
  await writeFile(
    path.join(skillRoot, 'metadata.json'),
    `${JSON.stringify(
      {
        upstreamSources: [llmsIndexUrl],
        installMirrors: {
          [llmsIndexUrl]: '/tmp/tds-ui-escape.txt',
        },
      },
      null,
      2,
    )}\n`,
    'utf8',
  )

  await assert.rejects(
    syncInstalledSkillArtifacts(targetRoot, {
      fetchImpl: async (url) => {
        requestedUrls.push(url.toString())

        return {
          ok: true,
          status: 200,
          text: async () => 'should-not-download',
        } as Response
      },
    }),
    /tds-ui metadata\.installMirrors 경로가 skill root 밖을 가리켜요/,
  )

  assert.deepEqual(requestedUrls, [])
})
