import { spawnSync } from 'node:child_process'
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { expect, test } from 'vitest'

const rootDir = process.cwd()
const prisma7Bin = path.join(rootDir, 'node_modules', '.bin', 'prisma7')
const ansiPattern = new RegExp(String.raw`\u001B\[[0-9;]*m`, 'g')

type CommandOutput = {
  stderr: string
  stdout: string
}

type VersionProjection = {
  json: {
    clientVersion: unknown
    distributionKey: 'prisma7'
    distributionVersion: unknown
    hasPrismaKey: boolean
    metadataKeys: string[]
  }
  text: {
    clientLabel: '@prisma/client'
    clientVersion: string
    distributionLabel: 'prisma7'
    distributionVersion: string
    hasPrismaLabel: boolean
    metadataLabels: string[]
    stderr: string
  }
}

function normalizeText(text: string, replacements: ReadonlyArray<readonly [string, string]>): string {
  let normalized = text.replace(/\r\n/g, '\n').replace(ansiPattern, '').trimEnd()

  for (const [from, to] of replacements) {
    normalized = normalized.split(from).join(to)
  }

  return normalized
}

function normalizeValue(value: unknown, replacements: ReadonlyArray<readonly [string, string]>): unknown {
  if (typeof value === 'string') {
    return normalizeText(value, replacements)
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeValue(item, replacements))
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, normalizeValue(entry, replacements)]))
  }

  return value
}

function getVersionRows(stdout: string): Map<string, string> {
  return new Map(
    stdout
      .split('\n')
      .map((line) => line.match(/^(?<label>.+?)\s+:\s+(?<value>.*)$/)?.groups)
      .filter((groups): groups is { label: string; value: string } => groups !== undefined)
      .map(({ label, value }) => [label, value]),
  )
}

function projectVersion(versionText: CommandOutput, versionJson: Record<string, unknown>): VersionProjection {
  const rows = getVersionRows(versionText.stdout)

  return {
    json: {
      clientVersion: versionJson['@prisma/client'],
      distributionKey: 'prisma7',
      distributionVersion: versionJson.prisma7,
      hasPrismaKey: Object.hasOwn(versionJson, 'prisma'),
      metadataKeys: Object.keys(versionJson)
        .filter((key) => key !== '@prisma/client' && key !== 'prisma7')
        .sort(),
    },
    text: {
      clientLabel: '@prisma/client',
      clientVersion: rows.get('@prisma/client') ?? '',
      distributionLabel: 'prisma7',
      distributionVersion: rows.get('prisma7') ?? '',
      hasPrismaLabel: rows.has('prisma'),
      metadataLabels: [...rows.keys()].filter((label) => label !== '@prisma/client' && label !== 'prisma7'),
      stderr: versionText.stderr,
    },
  }
}

function run(command: string, args: string[], cwd = rootDir): CommandOutput {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    env: {
      ...process.env,
      NO_COLOR: '1',
    },
  })

  expect(
    result.status,
    `${command} ${args.join(' ')} failed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
  ).toBe(0)

  return {
    stdout: result.stdout,
    stderr: result.stderr,
  }
}

test('prisma7 snapshots real CLI-owned identity surfaces and keeps the packed smoke green', async () => {
  const initProjectDir = await mkdtemp(path.join(os.tmpdir(), 'prisma7-init-'))
  const replacements = [
    [rootDir, '<cwd>'],
    [initProjectDir, '<init-project>'],
    [prisma7Bin, '<prisma7-bin>'],
  ] as const

  try {
    await writeFile(path.join(initProjectDir, 'package.json'), '{"private":true}\n')

    const topLevelHelp = run('pnpm', ['exec', 'prisma7', '--help'])
    const delegatedHelp = run('pnpm', ['exec', 'prisma7', 'validate', '--help'])
    const versionText = run('pnpm', ['exec', 'prisma7', '--version'])
    const versionJson = JSON.parse(run('pnpm', ['exec', 'prisma7', '--version', '--json']).stdout) as Record<
      string,
      unknown
    >
    const completionZsh = run('pnpm', ['exec', 'prisma7', 'complete', 'zsh'])
    const init = run(prisma7Bin, ['init', '--datasource-provider', 'postgresql', '--no-skills'], initProjectDir)

    const initFiles = (await readdir(initProjectDir)).sort()
    const prismaFiles = (await readdir(path.join(initProjectDir, 'prisma'))).sort()
    const prismaConfig = await readFile(path.join(initProjectDir, 'prisma.config.ts'), 'utf8')
    const env = await readFile(path.join(initProjectDir, '.env'), 'utf8')

    expect(
      normalizeValue(
        {
          completion: completionZsh,
          help: {
            delegated: delegatedHelp,
            topLevel: topLevelHelp,
          },
          init: {
            env,
            files: initFiles,
            prismaConfig,
            prismaFiles,
            stdout: init.stdout,
            stderr: init.stderr,
          },
          version: projectVersion(versionText, versionJson),
        },
        replacements,
      ),
    ).toMatchSnapshot()

    run('pnpm', ['exec', 'tsc', '--noEmit'])
    run('pnpm', ['exec', 'prisma7', 'generate'])
    run('pnpm', ['exec', 'prisma7', 'db', 'push', '--force-reset'])
    run('pnpm', [
      'exec',
      'tsc',
      '--noEmit',
      '--module',
      'node16',
      '--moduleResolution',
      'node16',
      '--target',
      'es2022',
      'smoke.ts',
    ])
    run('tsx', ['smoke.ts'])
  } finally {
    await rm(initProjectDir, { recursive: true, force: true })
  }
}, 120_000)
