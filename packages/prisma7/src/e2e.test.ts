import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { afterAll, expect, test } from 'vitest'

const packageRoot = path.join(__dirname, '..')
const packagesRoot = path.resolve(packageRoot, '..')
const temporaryDirectories: string[] = []

function makeTemporaryDirectory(): string {
  const directory = mkdtempSync(path.join(tmpdir(), 'prisma7-e2e-'))
  temporaryDirectories.push(directory)
  return directory
}

function linkWorkspacePackage(nodeModules: string, packageName: string, packageDirectory: string): void {
  const link = path.join(nodeModules, ...packageName.split('/'))
  mkdirSync(path.dirname(link), { recursive: true })
  symlinkSync(packageDirectory, link, 'junction')
}

function run(command: string, args: string[], cwd: string) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8' })
  expect(result.error).toBeUndefined()
  expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0)
  return result
}

afterAll(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('runs a generated client from a project configured through prisma7', () => {
  const project = makeTemporaryDirectory()
  const nodeModules = path.join(project, 'node_modules')
  const config = path.join(project, 'prisma.config.ts')
  const schema = path.join(project, 'project-models', 'non-default.prisma')
  const wrapper = path.join(nodeModules, 'prisma7', 'build', 'prisma7.js')

  linkWorkspacePackage(nodeModules, 'prisma7', packageRoot)
  linkWorkspacePackage(nodeModules, '@prisma/client', path.join(packagesRoot, 'client'))
  linkWorkspacePackage(nodeModules, '@prisma/client-runtime-utils', path.join(packagesRoot, 'client-runtime-utils'))
  linkWorkspacePackage(nodeModules, '@prisma/adapter-better-sqlite3', path.join(packagesRoot, 'adapter-better-sqlite3'))

  mkdirSync(path.dirname(schema), { recursive: true })
  writeFileSync(
    config,
    [
      "import { defineConfig, type PrismaConfig } from 'prisma7/config'",
      '',
      'const config: PrismaConfig = {',
      "  schema: 'project-models/non-default.prisma',",
      "  datasource: { url: 'file:./compatibility.db' },",
      '}',
      '',
      'export default defineConfig(config)',
    ].join('\n'),
  )
  writeFileSync(
    schema,
    [
      'generator client {',
      '  provider = "prisma-client"',
      '  output = "../generated/compatibility-client"',
      '  moduleFormat = "cjs"',
      '}',
      '',
      'datasource db {',
      '  provider = "sqlite"',
      '}',
      '',
      'model Note {',
      '  id    Int    @id @default(autoincrement())',
      '  value String',
      '}',
    ].join('\n'),
  )
  writeFileSync(
    path.join(project, 'config-consumer.ts'),
    [
      "import config from './prisma.config'",
      "import { defineConfig, type PrismaConfig } from 'prisma7/config'",
      '',
      'const checkedConfig: PrismaConfig = config',
      'void defineConfig(checkedConfig)',
    ].join('\n'),
  )

  run(
    process.execPath,
    [
      require.resolve('typescript/bin/tsc'),
      '--noEmit',
      '--module',
      'node16',
      '--moduleResolution',
      'node16',
      '--target',
      'es2022',
      path.join(project, 'config-consumer.ts'),
    ],
    project,
  )

  run(process.execPath, [wrapper, '--version'], project)
  run(process.execPath, [wrapper, 'generate'], project)

  writeFileSync(
    path.join(project, 'smoke.ts'),
    [
      "import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'",
      "import { PrismaClient } from './generated/compatibility-client/client'",
      '',
      'const client = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: "file:./compatibility.db" }) })',
      '',
      'async function main() {',
      '  try {',
      '    await client.$executeRawUnsafe(',
      "      'CREATE TABLE Note (id INTEGER PRIMARY KEY AUTOINCREMENT, value TEXT NOT NULL)'",
      '    )',
      "    await client.note.create({ data: { value: 'generated through prisma7' } })",
      '    const note = await client.note.findUniqueOrThrow({ where: { id: 1 } })',
      "    if (note.value !== 'generated through prisma7') throw new Error('Unexpected generated client result')",
      '  } finally {',
      '    await client.$disconnect()',
      '  }',
      '}',
      '',
      'main().catch((error) => {',
      '  console.error(error)',
      '  process.exitCode = 1',
      '})',
    ].join('\n'),
  )

  run(process.execPath, [require.resolve('tsx/cli'), path.join(project, 'smoke.ts')], project)
})
