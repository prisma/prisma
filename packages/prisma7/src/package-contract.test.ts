import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { gunzipSync } from 'node:zlib'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

type PackedManifest = {
  version: string
  dependencies: { prisma: string }
  exports: Record<string, unknown>
  files: string[]
}

const packageRoot = path.join(__dirname, '..')
const temporaryDirectories: string[] = []
let tarball: string

function readPackedManifest(contents: string): PackedManifest {
  const manifest: unknown = JSON.parse(contents)
  if (typeof manifest !== 'object' || manifest === null) {
    throw new Error('Invalid packed prisma7 manifest')
  }

  const record = manifest as Record<string, unknown>
  const dependencies = record.dependencies
  if (
    typeof record.version !== 'string' ||
    typeof dependencies !== 'object' ||
    dependencies === null ||
    typeof (dependencies as Record<string, unknown>).prisma !== 'string' ||
    typeof record.exports !== 'object' ||
    record.exports === null ||
    !Array.isArray(record.files)
  ) {
    throw new Error('Invalid packed prisma7 manifest')
  }

  return manifest as PackedManifest
}

function makeTemporaryDirectory(prefix: string): string {
  const directory = mkdtempSync(path.join(tmpdir(), prefix))
  temporaryDirectories.push(directory)
  return directory
}

function readTarballEntries(tarball: string): Map<string, Buffer> {
  const archive = gunzipSync(readFileSync(tarball))
  const entries = new Map<string, Buffer>()

  for (let offset = 0; offset < archive.length; ) {
    const name = archive
      .subarray(offset, offset + 100)
      .toString('utf8')
      .replace(/\0.*$/, '')
    if (name === '') break

    const size = Number.parseInt(
      archive
        .subarray(offset + 124, offset + 136)
        .toString('utf8')
        .trim(),
      8,
    )
    const type = archive[offset + 156]
    const contentsStart = offset + 512

    if (type === 0 || type === 48) {
      entries.set(name, archive.subarray(contentsStart, contentsStart + size))
    }

    offset = contentsStart + Math.ceil(size / 512) * 512
  }

  return entries
}

function extractTarball(tarball: string, destination: string): void {
  for (const [name, contents] of readTarballEntries(tarball)) {
    const relativePath = name.replace(/^package\//, '')
    const outputPath = path.resolve(destination, relativePath)
    if (!outputPath.startsWith(`${destination}${path.sep}`)) {
      throw new Error(`Unexpected tarball path: ${name}`)
    }
    mkdirSync(path.dirname(outputPath), { recursive: true })
    writeFileSync(outputPath, contents)
  }
}

function writePrismaPackage(directory: string, version: string, source: string): void {
  mkdirSync(directory, { recursive: true })
  writeFileSync(
    path.join(directory, 'package.json'),
    JSON.stringify({
      name: 'prisma',
      version,
      exports: {
        '.': './index.js',
        './config': './config.js',
        './package.json': './package.json',
      },
    }),
  )
  writeFileSync(path.join(directory, 'index.js'), `module.exports = { source: '${source}' }`)
  writeFileSync(path.join(directory, 'index.d.ts'), 'export type PrismaConfig = { source?: string }')
  writeFileSync(
    path.join(directory, 'config.js'),
    `exports.defineConfig = (config) => ({ ...config, source: '${source}' }); exports.env = (name) => '${source}:' + name`,
  )
  writeFileSync(
    path.join(directory, 'config.d.ts'),
    [
      "import type { PrismaConfig } from './index.js'",
      "export type { PrismaConfig } from './index.js'",
      'export type PrismaConfigInternal = { source?: string }',
      'export declare function defineConfig(config: PrismaConfig): PrismaConfig',
      'export declare function env(name: string): string',
    ].join('\n'),
  )
}

function packPrisma7() {
  const packDirectory = makeTemporaryDirectory('prisma7-pack-')
  const result = spawnSync('pnpm', ['pack', '--pack-destination', packDirectory], {
    cwd: packageRoot,
    encoding: 'utf8',
  })

  expect(result.status).toBe(0)

  const tarball = readdirSync(packDirectory).find((filename) => filename.endsWith('.tgz'))
  expect(tarball).toBeDefined()

  return path.join(packDirectory, tarball!)
}

beforeAll(() => {
  tarball = packPrisma7()
})

afterAll(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

const hasForwardingTypes =
  existsSync(path.join(packageRoot, 'index.d.ts')) && existsSync(path.join(packageRoot, 'config.d.ts'))

describe('prisma7 package contract', () => {
  it('packs only wrapper files and an exact Prisma dependency', () => {
    const entries = readTarballEntries(tarball)
    const packageJson = readPackedManifest(entries.get('package/package.json')!.toString('utf8'))

    expect(packageJson.dependencies.prisma).toBe(packageJson.version)
    expect(packageJson.exports).toEqual(
      expect.objectContaining({ '.': expect.any(Object), './config': expect.any(Object) }),
    )
    expect(packageJson.files).toEqual(['build', 'index.js', 'index.d.ts', 'config.js', 'config.d.ts'])
    const allowedFiles = new Set([
      'package/LICENSE',
      'package/package.json',
      'package/build/index.js',
      'package/index.js',
      'package/index.d.ts',
      'package/config.js',
      'package/config.d.ts',
    ])

    expect([...entries.keys()]).toEqual(
      expect.arrayContaining(['package/build/index.js', 'package/index.js', 'package/config.js']),
    )
    expect([...entries.keys()].every((file) => allowedFiles.has(file))).toBe(true)
  })

  it('uses the wrapper dependency for config forwarding beside a different root Prisma', () => {
    const fixture = makeTemporaryDirectory('prisma7-side-by-side-')
    const nodeModules = path.join(fixture, 'node_modules')
    const wrapperDirectory = path.join(nodeModules, 'prisma7')

    extractTarball(tarball, wrapperDirectory)
    const packedManifest = readPackedManifest(readFileSync(path.join(wrapperDirectory, 'package.json'), 'utf8'))
    writePrismaPackage(path.join(nodeModules, 'prisma'), '8.0.0', 'root-prisma-8')
    writePrismaPackage(
      path.join(wrapperDirectory, 'node_modules', 'prisma'),
      packedManifest.dependencies.prisma,
      'wrapper-prisma-7',
    )

    const requireFromFixture = createRequire(path.join(fixture, 'consumer.js'))
    const requireFromWrapper = createRequire(path.join(wrapperDirectory, 'config.js'))
    const wrapperManifest = requireFromFixture('prisma7/package.json')

    expect(requireFromFixture('prisma')).toEqual({ source: 'root-prisma-8' })
    expect(requireFromFixture('prisma7')).toEqual({})
    expect(requireFromFixture('prisma7/config').defineConfig({})).toEqual({ source: 'wrapper-prisma-7' })
    expect(requireFromFixture('prisma7/config').env('DATABASE_URL')).toBe('wrapper-prisma-7:DATABASE_URL')
    expect(wrapperManifest.dependencies.prisma).toBe(wrapperManifest.version)
    expect(requireFromWrapper.resolve('prisma/package.json')).not.toBe(
      requireFromFixture.resolve('prisma/package.json'),
    )
  })

  it.skipIf(!hasForwardingTypes)('typechecks root and config imports from the packed package', () => {
    const fixture = makeTemporaryDirectory('prisma7-types-')
    const nodeModules = path.join(fixture, 'node_modules')
    const wrapperDirectory = path.join(nodeModules, 'prisma7')

    extractTarball(tarball, wrapperDirectory)
    const packedManifest = readPackedManifest(readFileSync(path.join(wrapperDirectory, 'package.json'), 'utf8'))
    writePrismaPackage(
      path.join(wrapperDirectory, 'node_modules', 'prisma'),
      packedManifest.dependencies.prisma,
      'wrapper-prisma-7',
    )

    const consumer = path.join(fixture, 'consumer.ts')
    writeFileSync(
      consumer,
      [
        "import type { PrismaConfig as RootPrismaConfig } from 'prisma7'",
        "import { defineConfig, env, type PrismaConfig as ConfigPrismaConfig, type PrismaConfigInternal } from 'prisma7/config'",
        'type Equal<Left, Right> = (<Value>() => Value extends Left ? 1 : 2) extends <Value>() => Value extends Right ? 1 : 2 ? true : false',
        'type Assert<Value extends true> = Value',
        'type RootAndConfigTypesMatch = Assert<Equal<RootPrismaConfig, ConfigPrismaConfig>>',
        'type ForwardedTypes = [RootAndConfigTypesMatch, PrismaConfigInternal]',
        'const config: RootPrismaConfig = defineConfig({})',
        'void config',
        'void env',
        'void (undefined as ForwardedTypes | undefined)',
      ].join('\n'),
    )

    const result = spawnSync(
      process.execPath,
      [
        require.resolve('typescript/bin/tsc'),
        '--noEmit',
        '--module',
        'node16',
        '--moduleResolution',
        'node16',
        consumer,
      ],
      {
        cwd: fixture,
        encoding: 'utf8',
      },
    )

    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0)
    expect(result.stderr).toBe('')
  })
})
