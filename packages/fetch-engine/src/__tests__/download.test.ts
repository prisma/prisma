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
const FIXED_ENGINES_HASH = 'eac182fd33c63959a61946df56831625a9a39627'
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
        'linux-musl-arm64-openssl-1.1.x',
        'linux-musl-arm64-openssl-3.0.x',
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
        "libquery_engine-linux-musl-arm64-openssl-1.1.x.so.node",
        "libquery_engine-linux-musl-arm64-openssl-3.0.x.so.node",
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
        "migration-engine-linux-musl-arm64-openssl-1.1.x",
        "migration-engine-linux-musl-arm64-openssl-3.0.x",
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
        "query-engine-linux-musl-arm64-openssl-1.1.x",
        "query-engine-linux-musl-arm64-openssl-3.0.x",
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
        'linux-musl-arm64-openssl-1.1.x',
        'linux-musl-arm64-openssl-3.0.x',
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
          "size": 14628824,
        },
        {
          "name": "libquery_engine-darwin.dylib.node",
          "size": 15859568,
        },
        {
          "name": "libquery_engine-debian-openssl-1.0.x.so.node",
          "size": 17573416,
        },
        {
          "name": "libquery_engine-debian-openssl-1.1.x.so.node",
          "size": 15085488,
        },
        {
          "name": "libquery_engine-debian-openssl-3.0.x.so.node",
          "size": 15085488,
        },
        {
          "name": "libquery_engine-linux-arm64-openssl-1.0.x.so.node",
          "size": 14626896,
        },
        {
          "name": "libquery_engine-linux-arm64-openssl-1.1.x.so.node",
          "size": 15363048,
        },
        {
          "name": "libquery_engine-linux-arm64-openssl-3.0.x.so.node",
          "size": 16701064,
        },
        {
          "name": "libquery_engine-linux-musl-arm64-openssl-1.1.x.so.node",
          "size": 15637680,
        },
        {
          "name": "libquery_engine-linux-musl-arm64-openssl-3.0.x.so.node",
          "size": 17053440,
        },
        {
          "name": "libquery_engine-linux-musl-openssl-3.0.x.so.node",
          "size": 14491240,
        },
        {
          "name": "libquery_engine-linux-musl.so.node",
          "size": 14253768,
        },
        {
          "name": "libquery_engine-rhel-openssl-1.0.x.so.node",
          "size": 16966120,
        },
        {
          "name": "libquery_engine-rhel-openssl-1.1.x.so.node",
          "size": 14491176,
        },
        {
          "name": "libquery_engine-rhel-openssl-3.0.x.so.node",
          "size": 14491176,
        },
        {
          "name": "migration-engine-darwin",
          "size": 20612160,
        },
        {
          "name": "migration-engine-darwin-arm64",
          "size": 19343790,
        },
        {
          "name": "migration-engine-debian-openssl-1.0.x",
          "size": 23349992,
        },
        {
          "name": "migration-engine-debian-openssl-1.1.x",
          "size": 20624928,
        },
        {
          "name": "migration-engine-debian-openssl-3.0.x",
          "size": 20625584,
        },
        {
          "name": "migration-engine-linux-arm64-openssl-1.0.x",
          "size": 20646448,
        },
        {
          "name": "migration-engine-linux-arm64-openssl-1.1.x",
          "size": 21398992,
        },
        {
          "name": "migration-engine-linux-arm64-openssl-3.0.x",
          "size": 23066416,
        },
        {
          "name": "migration-engine-linux-musl",
          "size": 18296712,
        },
        {
          "name": "migration-engine-linux-musl-arm64-openssl-1.1.x",
          "size": 21728944,
        },
        {
          "name": "migration-engine-linux-musl-arm64-openssl-3.0.x",
          "size": 23458736,
        },
        {
          "name": "migration-engine-linux-musl-openssl-3.0.x",
          "size": 18473608,
        },
        {
          "name": "migration-engine-rhel-openssl-1.0.x",
          "size": 21289336,
        },
        {
          "name": "migration-engine-rhel-openssl-1.1.x",
          "size": 18580240,
        },
        {
          "name": "migration-engine-rhel-openssl-3.0.x",
          "size": 18589496,
        },
        {
          "name": "migration-engine-windows.exe",
          "size": 14989312,
        },
        {
          "name": "query-engine-darwin",
          "size": 17823816,
        },
        {
          "name": "query-engine-darwin-arm64",
          "size": 16556192,
        },
        {
          "name": "query-engine-debian-openssl-1.0.x",
          "size": 17525064,
        },
        {
          "name": "query-engine-debian-openssl-1.1.x",
          "size": 17512712,
        },
        {
          "name": "query-engine-debian-openssl-3.0.x",
          "size": 17512712,
        },
        {
          "name": "query-engine-linux-arm64-openssl-1.0.x",
          "size": 16518944,
        },
        {
          "name": "query-engine-linux-arm64-openssl-1.1.x",
          "size": 17360248,
        },
        {
          "name": "query-engine-linux-arm64-openssl-3.0.x",
          "size": 18694176,
        },
        {
          "name": "query-engine-linux-musl",
          "size": 16484312,
        },
        {
          "name": "query-engine-linux-musl-arm64-openssl-1.1.x",
          "size": 17622504,
        },
        {
          "name": "query-engine-linux-musl-arm64-openssl-3.0.x",
          "size": 19038264,
        },
        {
          "name": "query-engine-linux-musl-openssl-3.0.x",
          "size": 16689072,
        },
        {
          "name": "query-engine-rhel-openssl-1.0.x",
          "size": 16705464,
        },
        {
          "name": "query-engine-rhel-openssl-1.1.x",
          "size": 16705464,
        },
        {
          "name": "query-engine-rhel-openssl-3.0.x",
          "size": 16705464,
        },
        {
          "name": "query-engine-windows.exe",
          "size": 19318272,
        },
        {
          "name": "query_engine-windows.dll.node",
          "size": 16984064,
        },
      ]
    `)

    expect(await getVersion(queryEnginePath, BinaryType.queryEngine)).toMatchInlineSnapshot(
      `"query-engine eac182fd33c63959a61946df56831625a9a39627"`,
    )
    expect(await getVersion(migrationEnginePath, BinaryType.migrationEngine)).toMatchInlineSnapshot(
      `"migration-engine-cli eac182fd33c63959a61946df56831625a9a39627"`,
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
        'linux-musl-arm64-openssl-1.1.x',
        'linux-musl-arm64-openssl-3.0.x',
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
        'linux-musl-arm64-openssl-1.1.x',
        'linux-musl-arm64-openssl-3.0.x',
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
      version: FIXED_ENGINES_HASH,
    })

    fs.writeFileSync(targetPath, 'incorrect-binary')

    // please heal it
    await download({
      binaries: {
        'query-engine': baseDir,
      },
      version: FIXED_ENGINES_HASH,
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
        version: FIXED_ENGINES_HASH,
        binaryTargets: ['darwin', 'marvin'] as any, // eslint-disable-line @typescript-eslint/no-explicit-any
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
        version: FIXED_ENGINES_HASH,
        binaryTargets: ['darwin', 'marvin'] as any, // eslint-disable-line @typescript-eslint/no-explicit-any
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
    })
    expect(testResult['query-engine']!['marvin']).toEqual(targetPath)
  })
})
