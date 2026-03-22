import { cp, mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import yargs from 'yargs'
import { createTemplateTokens, resolveRootWorkspaces } from './scaffold/helpers.js'
import { applyDocsTemplates } from './templates/docs.js'
import { pathExists } from './templates/filesystem.js'
import { applyRootTemplates } from './templates/root.js'
import { readSkillsManifest, syncGeneratedSkills } from './templates/skills.js'
import { getSkillDefinition, type SkillId } from './templates/skill-catalog.js'
import { inspectWorkspace } from './workspace-inspector.js'

const IGNORED_DIFF_ENTRY_NAMES = new Set([
  '.git',
  '.nx',
  'node_modules',
  'dist',
  'coverage',
  '.DS_Store',
])

export type SkillsCommandName = 'sync' | 'diff' | 'upgrade'

export type ParsedSkillsCommandArgs = {
  command: SkillsCommandName
  rootDir: string
  to?: string
}

type DiffResult = {
  hasChanges: boolean
  report: string
}

function assertSkillsCommandName(value: string | undefined): SkillsCommandName {
  if (value === 'sync' || value === 'diff' || value === 'upgrade') {
    return value
  }

  throw new Error('`create-miniapp skills <sync|diff|upgrade>` 형식으로 실행해 주세요.')
}

async function listWorkspaceFiles(rootDir: string, currentDir = ''): Promise<string[]> {
  const absoluteDir = currentDir ? path.join(rootDir, currentDir) : rootDir
  const entries = await readdir(absoluteDir, { withFileTypes: true })
  const files: string[] = []

  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    if (IGNORED_DIFF_ENTRY_NAMES.has(entry.name)) {
      continue
    }

    const relativePath = currentDir ? path.join(currentDir, entry.name) : entry.name
    const normalizedRelativePath = relativePath.split(path.sep).join('/')

    if (entry.isDirectory()) {
      files.push(...(await listWorkspaceFiles(rootDir, relativePath)))
      continue
    }

    files.push(normalizedRelativePath)
  }

  return files
}

async function copyWorkspaceForDiff(sourceRoot: string, targetRoot: string) {
  await cp(sourceRoot, targetRoot, {
    recursive: true,
    filter(sourcePath) {
      return !IGNORED_DIFF_ENTRY_NAMES.has(path.basename(sourcePath))
    },
  })
}

function buildDiffReport(options: { leftFiles: string[]; rightFiles: string[] }) {
  const reportLines: string[] = []
  const leftSet = new Set(options.leftFiles)
  const rightSet = new Set(options.rightFiles)

  for (const filePath of options.leftFiles) {
    if (!rightSet.has(filePath)) {
      reportLines.push(`- ${filePath}`)
    }
  }

  for (const filePath of options.rightFiles) {
    if (!leftSet.has(filePath)) {
      reportLines.push(`+ ${filePath}`)
    }
  }

  return reportLines
}

async function appendModifiedFiles(
  reportLines: string[],
  options: {
    leftRoot: string
    rightRoot: string
    files: string[]
  },
) {
  for (const filePath of options.files) {
    const [leftSource, rightSource] = await Promise.all([
      readFile(path.join(options.leftRoot, filePath)),
      readFile(path.join(options.rightRoot, filePath)),
    ])

    if (!leftSource.equals(rightSource)) {
      reportLines.push(`M ${filePath}`)
    }
  }
}

async function validateManualSkillIds(rootDir: string) {
  const manifest = await readSkillsManifest(rootDir)

  if (!manifest) {
    return
  }

  for (const manualSkillId of manifest.manualExtraSkills) {
    try {
      getSkillDefinition(manualSkillId as SkillId)
    } catch {
      throw new Error(
        `manifest가 현재 catalog에 없는 manual skill id를 가리킵니다: ${manualSkillId}`,
      )
    }
  }
}

export async function parseSkillsCommandArgs(rawArgs: string[], cwd = process.cwd()) {
  const argv = await yargs(rawArgs)
    .help(false)
    .version(false)
    .exitProcess(false)
    .strictOptions()
    .fail(() => {
      throw new Error('skills 명령 옵션을 읽지 못했어요.')
    })
    .option('root-dir', {
      type: 'string',
      default: cwd,
      describe: '대상 miniapp root',
    })
    .option('to', {
      type: 'string',
      describe: 'upgrade target version',
    })
    .parse()

  return {
    command: assertSkillsCommandName(String(argv._[0] ?? '')),
    rootDir: path.resolve(String(argv.rootDir)),
    to: argv.to ? String(argv.to) : undefined,
  } satisfies ParsedSkillsCommandArgs
}

export async function syncSkillsWorkspace(rootDir: string) {
  const inspection = await inspectWorkspace(rootDir)
  const tokens = createTemplateTokens({
    appName: inspection.appName,
    displayName: inspection.displayName,
    packageManager: inspection.packageManager,
  })
  const workspaces = await resolveRootWorkspaces(rootDir)

  await applyRootTemplates(rootDir, tokens, workspaces)
  await syncGeneratedSkills(rootDir, tokens, {
    serverProvider: inspection.serverProvider,
  })
  await applyDocsTemplates(rootDir, tokens, {
    serverProvider: inspection.serverProvider,
  })
}

export async function diffSkillsWorkspace(rootDir: string): Promise<DiffResult> {
  const tempParent = await mkdtemp(path.join(os.tmpdir(), 'create-rn-miniapp-skills-diff-'))
  const tempRoot = path.join(tempParent, 'workspace')

  try {
    await copyWorkspaceForDiff(rootDir, tempRoot)
    await syncSkillsWorkspace(tempRoot)

    const [currentFiles, syncedFiles] = await Promise.all([
      listWorkspaceFiles(rootDir),
      listWorkspaceFiles(tempRoot),
    ])
    const reportLines = buildDiffReport({
      leftFiles: currentFiles,
      rightFiles: syncedFiles,
    })
    const sharedFiles = currentFiles.filter((filePath) => syncedFiles.includes(filePath))

    await appendModifiedFiles(reportLines, {
      leftRoot: rootDir,
      rightRoot: tempRoot,
      files: sharedFiles,
    })

    return {
      hasChanges: reportLines.length > 0,
      report:
        reportLines.length > 0
          ? reportLines.join('\n')
          : 'skills sync 결과와 현재 workspace가 같습니다.',
    }
  } finally {
    await rm(tempParent, { recursive: true, force: true })
  }
}

export async function upgradeSkillsWorkspace(rootDir: string, _to: string) {
  await validateManualSkillIds(rootDir)
  await syncSkillsWorkspace(rootDir)
}

export async function runSkillsCommand(rawArgs: string[]) {
  const args = await parseSkillsCommandArgs(rawArgs)

  if (!(await pathExists(args.rootDir))) {
    throw new Error(`rootDir를 찾지 못했어요: ${args.rootDir}`)
  }

  if (args.command === 'sync') {
    await syncSkillsWorkspace(args.rootDir)
    return
  }

  if (args.command === 'diff') {
    const diff = await diffSkillsWorkspace(args.rootDir)

    console.log(diff.report)

    if (diff.hasChanges) {
      process.exitCode = 1
    }

    return
  }

  await upgradeSkillsWorkspace(args.rootDir, args.to ?? 'latest')
}
