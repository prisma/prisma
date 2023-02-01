import { enginesVersion } from '@prisma/engines-version'
import { getPlatform } from '@prisma/get-platform'
import del from 'del'
import fs from 'fs'
import path from 'path'
import stripAnsi from 'strip-ansi'

import { cleanupCache } from '../cleanupCache'
import { BinaryType, download, getBinaryName, getVersion } from '../download'
import { getFiles } from './__utils__/getFiles'

const CURRENT_ENGINES_HASH = enginesVersion
console.debug({ CURRENT_ENGINES_HASH })
const FIXED_ENGINES_HASH = 'c9e863f2d8de6fa0c4bcd609df078ea2dde3c2b2'
const dirname = process.platform === 'win32' ? __dirname.split(path.sep).join('/') : __dirname

// Network can be slow, especially for macOS in CI.
jest.setTimeout(300_000)
jest.retryTimes(3)

describe('download', () => {
  beforeEach(async () => {
    // completely clean up the cache and keep nothing
    await cleanupCache(0)
    // Make sure to not mix forward and backward slashes in the path
    // or del glob pattern would not work on Windows
    await del(path.posix.join(dirname, '/**/*engine*'))
  })
  afterEach(() => {
    delete process.env.PRISMA_QUERY_ENGINE_BINARY
  })

  test('download all current engines', async () => {
    const baseDir = path.posix.join(dirname, 'all')

    const platform = await getPlatform()
    const queryEnginePath = path.join(baseDir, getBinaryName(BinaryType.queryEngine, platform))
    const migrationEnginePath = path.join(baseDir, getBinaryName(BinaryType.migrationEngine, platform))

    await download({
      binaries: {
        [BinaryType.libqueryEngine]: baseDir,
        [BinaryType.queryEngine]: baseDir,
        [BinaryType.migrationEngine]: baseDir,
      },
      binaryTargets: [
        'darwin',
        'darwin-arm64',
        'debian-openssl-1.0.x',
        'debian-openssl-1.1.x',
        'debian-openssl-3.0.x',
        'linux-arm64-openssl-1.0.x',
        'linux-arm64-openssl-1.1.x',
        'linux-arm64-openssl-3.0.x',
        'rhel-openssl-1.0.x',
        'rhel-openssl-1.1.x',
        'rhel-openssl-3.0.x',
        'windows',
        'linux-musl',
        'linux-musl-openssl-3.0.x',
      ],
      version: CURRENT_ENGINES_HASH,
    })

    const files = getFiles(baseDir).map((f) => f.name)
    expect(files).toMatchInlineSnapshot(`
      [
        ".gitkeep",
        "libquery_engine-darwin-arm64.dylib.node",
        "libquery_engine-darwin.dylib.node",
        "libquery_engine-debian-openssl-1.0.x.so.node",
        "libquery_engine-debian-openssl-1.1.x.so.node",
        "libquery_engine-debian-openssl-3.0.x.so.node",
        "libquery_engine-linux-arm64-openssl-1.0.x.so.node",
        "libquery_engine-linux-arm64-openssl-1.1.x.so.node",
        "libquery_engine-linux-arm64-openssl-3.0.x.so.node",
        "libquery_engine-linux-musl-openssl-3.0.x.so.node",
        "libquery_engine-linux-musl.so.node",
        "libquery_engine-rhel-openssl-1.0.x.so.node",
        "libquery_engine-rhel-openssl-1.1.x.so.node",
        "libquery_engine-rhel-openssl-3.0.x.so.node",
        "migration-engine-darwin",
        "migration-engine-darwin-arm64",
        "migration-engine-debian-openssl-1.0.x",
        "migration-engine-debian-openssl-1.1.x",
        "migration-engine-debian-openssl-3.0.x",
        "migration-engine-linux-arm64-openssl-1.0.x",
        "migration-engine-linux-arm64-openssl-1.1.x",
        "migration-engine-linux-arm64-openssl-3.0.x",
        "migration-engine-linux-musl",
        "migration-engine-linux-musl-openssl-3.0.x",
        "migration-engine-rhel-openssl-1.0.x",
        "migration-engine-rhel-openssl-1.1.x",
        "migration-engine-rhel-openssl-3.0.x",
        "migration-engine-windows.exe",
        "query-engine-darwin",
        "query-engine-darwin-arm64",
        "query-engine-debian-openssl-1.0.x",
        "query-engine-debian-openssl-1.1.x",
        "query-engine-debian-openssl-3.0.x",
        "query-engine-linux-arm64-openssl-1.0.x",
        "query-engine-linux-arm64-openssl-1.1.x",
        "query-engine-linux-arm64-openssl-3.0.x",
        "query-engine-linux-musl",
        "query-engine-linux-musl-openssl-3.0.x",
        "query-engine-rhel-openssl-1.0.x",
        "query-engine-rhel-openssl-1.1.x",
        "query-engine-rhel-openssl-3.0.x",
        "query-engine-windows.exe",
        "query_engine-windows.dll.node",
      ]
    `)

    // Check that all engines hashes are the same
    expect(await getVersion(queryEnginePath, BinaryType.queryEngine)).toContain(CURRENT_ENGINES_HASH)
    expect(await getVersion(migrationEnginePath, BinaryType.migrationEngine)).toContain(CURRENT_ENGINES_HASH)
  })

  test('download all binaries & cache them', async () => {
    const baseDir = path.posix.join(dirname, 'all')

    const platform = await getPlatform()
    const queryEnginePath = path.join(baseDir, getBinaryName(BinaryType.queryEngine, platform))
    const migrationEnginePath = path.join(baseDir, getBinaryName(BinaryType.migrationEngine, platform))

    const before0 = Date.now()
    await download({
      binaries: {
        [BinaryType.libqueryEngine]: baseDir,
        [BinaryType.queryEngine]: baseDir,
        [BinaryType.migrationEngine]: baseDir,
      },
      binaryTargets: [
        'darwin',
        'darwin-arm64',
        'debian-openssl-1.0.x',
        'debian-openssl-1.1.x',
        'debian-openssl-3.0.x',
        'linux-arm64-openssl-1.0.x',
        'linux-arm64-openssl-1.1.x',
        'linux-arm64-openssl-3.0.x',
        'rhel-openssl-1.0.x',
        'rhel-openssl-1.1.x',
        'rhel-openssl-3.0.x',
        'windows',
        'linux-musl',
        'linux-musl-openssl-3.0.x',
      ],
      version: FIXED_ENGINES_HASH,
    })
    const after0 = Date.now()
    const timeInMsToDownloadAll = after0 - before0
    console.debug(
      `1 - No Cache: first time, download everything.
It took ${timeInMsToDownloadAll}ms to execute download() for all binaryTargets.`,
    )

    const files = getFiles(baseDir)
    expect(files).toMatchInlineSnapshot(`
      [
        {
          "name": ".gitkeep",
          "size": 0,
        },
        {
          "name": "libquery_engine-darwin-arm64.dylib.node",
          "size": 19285688,
        },
        {
          "name": "libquery_engine-darwin.dylib.node",
          "size": 21450240,
        },
        {
          "name": "libquery_engine-debian-openssl-1.0.x.so.node",
          "size": 23250280,
        },
        {
          "name": "libquery_engine-debian-openssl-1.1.x.so.node",
          "size": 20766448,
        },
        {
          "name": "libquery_engine-debian-openssl-3.0.x.so.node",
          "size": 20766448,
        },
        {
          "name": "libquery_engine-linux-arm64-openssl-1.0.x.so.node",
          "size": 19526248,
        },
        {
          "name": "libquery_engine-linux-arm64-openssl-1.1.x.so.node",
          "size": 20041176,
        },
        {
          "name": "libquery_engine-linux-arm64-openssl-3.0.x.so.node",
          "size": 21575768,
        },
        {
          "name": "libquery_engine-linux-musl-openssl-3.0.x.so.node",
          "size": 21138888,
        },
        {
          "name": "libquery_engine-linux-musl.so.node",
          "size": 21122504,
        },
        {
          "name": "libquery_engine-rhel-openssl-1.0.x.so.node",
          "size": 23478728,
        },
        {
          "name": "libquery_engine-rhel-openssl-1.1.x.so.node",
          "size": 21016088,
        },
        {
          "name": "libquery_engine-rhel-openssl-3.0.x.so.node",
          "size": 21040664,
        },
        {
          "name": "migration-engine-darwin",
          "size": 26542544,
        },
        {
          "name": "migration-engine-darwin-arm64",
          "size": 24046718,
        },
        {
          "name": "migration-engine-debian-openssl-1.0.x",
          "size": 28153152,
        },
        {
          "name": "migration-engine-debian-openssl-1.1.x",
          "size": 25411808,
        },
        {
          "name": "migration-engine-debian-openssl-3.0.x",
          "size": 25411880,
        },
        {
          "name": "migration-engine-linux-arm64-openssl-1.0.x",
          "size": 25645104,
        },
        {
          "name": "migration-engine-linux-arm64-openssl-1.1.x",
          "size": 26195904,
        },
        {
          "name": "migration-engine-linux-arm64-openssl-3.0.x",
          "size": 28050304,
        },
        {
          "name": "migration-engine-linux-musl",
          "size": 25961744,
        },
        {
          "name": "migration-engine-linux-musl-openssl-3.0.x",
          "size": 25640328,
        },
        {
          "name": "migration-engine-rhel-openssl-1.0.x",
          "size": 28387888,
        },
        {
          "name": "migration-engine-rhel-openssl-1.1.x",
          "size": 25679616,
        },
        {
          "name": "migration-engine-rhel-openssl-3.0.x",
          "size": 25679664,
        },
        {
          "name": "migration-engine-windows.exe",
          "size": 23651328,
        },
        {
          "name": "query-engine-darwin",
          "size": 24036112,
        },
        {
          "name": "query-engine-darwin-arm64",
          "size": 21624800,
        },
        {
          "name": "query-engine-debian-openssl-1.0.x",
          "size": 23717192,
        },
        {
          "name": "query-engine-debian-openssl-1.1.x",
          "size": 23704840,
        },
        {
          "name": "query-engine-debian-openssl-3.0.x",
          "size": 23704840,
        },
        {
          "name": "query-engine-linux-arm64-openssl-1.0.x",
          "size": 21868000,
        },
        {
          "name": "query-engine-linux-arm64-openssl-1.1.x",
          "size": 22508552,
        },
        {
          "name": "query-engine-linux-arm64-openssl-3.0.x",
          "size": 24039056,
        },
        {
          "name": "query-engine-linux-musl",
          "size": 23991192,
        },
        {
          "name": "query-engine-linux-musl-openssl-3.0.x",
          "size": 24007520,
        },
        {
          "name": "query-engine-rhel-openssl-1.0.x",
          "size": 23884872,
        },
        {
          "name": "query-engine-rhel-openssl-1.1.x",
          "size": 23884872,
        },
        {
          "name": "query-engine-rhel-openssl-3.0.x",
          "size": 23909448,
        },
        {
          "name": "query-engine-windows.exe",
          "size": 28748288,
        },
        {
          "name": "query_engine-windows.dll.node",
          "size": 25548800,
        },
      ]
    `)

    expect(await getVersion(queryEnginePath, BinaryType.queryEngine)).toMatchInlineSnapshot(
      `"query-engine c9e863f2d8de6fa0c4bcd609df078ea2dde3c2b2"`,
    )
    expect(await getVersion(migrationEnginePath, BinaryType.migrationEngine)).toMatchInlineSnapshot(
      `"migration-engine-cli c9e863f2d8de6fa0c4bcd609df078ea2dde3c2b2"`,
    )

    //
    // Cache test 1
    // 1- We delete the artifacts locally but not from the cache folder
    // 2- We measure how much time it takes to call download
    //

    // Delete all artifacts
    const deletedEngines = await del(path.posix.join(baseDir, '/*engine*'))
    expect(deletedEngines.length).toBeGreaterThan(0)

    const before = Date.now()
    await download({
      binaries: {
        'libquery-engine': baseDir,
        'query-engine': baseDir,
        'migration-engine': baseDir,
      },
      binaryTargets: [
        'darwin',
        'darwin-arm64',
        'debian-openssl-1.0.x',
        'debian-openssl-1.1.x',
        'debian-openssl-3.0.x',
        'linux-arm64-openssl-1.0.x',
        'linux-arm64-openssl-1.1.x',
        'linux-arm64-openssl-3.0.x',
        'rhel-openssl-1.0.x',
        'rhel-openssl-1.1.x',
        'rhel-openssl-3.0.x',
        'windows',
        'linux-musl',
        'linux-musl-openssl-3.0.x',
      ],
      version: FIXED_ENGINES_HASH,
    })
    const after = Date.now()
    const timeInMsToDownloadAllFromCache1 = after - before
    console.debug(
      `2 - With cache1: We deleted the engines locally but not from the cache folder.
It took ${timeInMsToDownloadAllFromCache1}ms to execute download() for all binaryTargets.`,
    )

    //
    // Cache test 1
    // 1- We keep all artifacts from previous download
    // 2- We measure how much time it takes to call download
    //
    const before2 = Date.now()
    await download({
      binaries: {
        'libquery-engine': baseDir,
        'query-engine': baseDir,
        'migration-engine': baseDir,
      },
      binaryTargets: [
        'darwin',
        'darwin-arm64',
        'debian-openssl-1.0.x',
        'debian-openssl-1.1.x',
        'debian-openssl-3.0.x',
        'linux-arm64-openssl-1.0.x',
        'linux-arm64-openssl-1.1.x',
        'linux-arm64-openssl-3.0.x',
        'rhel-openssl-1.0.x',
        'rhel-openssl-1.1.x',
        'rhel-openssl-3.0.x',
        'windows',
        'linux-musl',
        'linux-musl-openssl-3.0.x',
      ],
      version: FIXED_ENGINES_HASH,
    })
    const after2 = Date.now()
    const timeInMsToDownloadAllFromCache2 = after2 - before2
    console.debug(
      `3 - With cache2: Engines were already present
It took ${timeInMsToDownloadAllFromCache2}ms to execute download() for all binaryTargets.`,
    )

    // This is a rather high number to avoid flakiness in CI
    expect(timeInMsToDownloadAllFromCache1).toBeLessThan(100_000)
    expect(timeInMsToDownloadAllFromCache2).toBeLessThan(100_000)

    // Using cache should be faster
    expect(timeInMsToDownloadAllFromCache1).toBeLessThan(timeInMsToDownloadAll)
    expect(timeInMsToDownloadAllFromCache2).toBeLessThan(timeInMsToDownloadAll)
  })

  test('auto heal corrupt engine binary', async () => {
    const platform = await getPlatform()
    const baseDir = path.posix.join(dirname, 'corruption')
    const targetPath = path.join(baseDir, getBinaryName('query-engine', platform))
    if (fs.existsSync(targetPath)) {
      try {
        fs.unlinkSync(targetPath)
      } catch (e) {
        console.error(e)
      }
    }

    await download({
      binaries: {
        'query-engine': baseDir,
      },
      version: CURRENT_ENGINES_HASH,
    })

    fs.writeFileSync(targetPath, 'incorrect-binary')

    // please heal it
    await download({
      binaries: {
        'query-engine': baseDir,
      },
      version: CURRENT_ENGINES_HASH,
    })

    expect(fs.existsSync(targetPath)).toBe(true)

    expect(await getVersion(targetPath, BinaryType.queryEngine)).not.toBe(undefined)
  })

  test('handle nonexistent "binaryTarget"', async () => {
    await expect(
      download({
        binaries: {
          'query-engine': __dirname,
        },
        binaryTargets: ['darwin', 'marvin'] as any, // eslint-disable-line @typescript-eslint/no-explicit-any
        version: CURRENT_ENGINES_HASH,
      }),
    ).rejects.toThrowErrorMatchingInlineSnapshot(
      `"Unknown binaryTarget marvin and no custom engine files were provided"`,
    )
  })

  test('handle nonexistent "binaryTarget" with missing custom engine binary', async () => {
    expect.assertions(1)
    process.env.PRISMA_QUERY_ENGINE_BINARY = '../query-engine'
    try {
      await download({
        binaries: {
          'query-engine': __dirname,
        },
        binaryTargets: ['darwin', 'marvin'] as any, // eslint-disable-line @typescript-eslint/no-explicit-any
        version: CURRENT_ENGINES_HASH,
      })
    } catch (err: any) {
      expect(stripAnsi(err.message)).toMatchInlineSnapshot(
        `"Env var PRISMA_QUERY_ENGINE_BINARY is provided but provided path ../query-engine can't be resolved."`,
      )
    }
  })

  test('handle nonexistent "binaryTarget" with custom engine binary', async () => {
    const e = await download({
      binaries: {
        'query-engine': __dirname,
      },
      version: CURRENT_ENGINES_HASH,
    })
    const dummyPath = e['query-engine']![Object.keys(e['query-engine']!)[0]]!
    const targetPath = path.join(
      __dirname,
      // @ts-ignore
      getBinaryName('query-engine', 'marvin'),
    )
    fs.copyFileSync(dummyPath, targetPath)
    process.env.PRISMA_QUERY_ENGINE_BINARY = targetPath

    const testResult = await download({
      binaries: {
        'query-engine': path.join(__dirname, 'all'),
      },
      binaryTargets: ['marvin'] as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      version: CURRENT_ENGINES_HASH,
    })
    expect(testResult['query-engine']!['marvin']).toEqual(targetPath)
  })
})
