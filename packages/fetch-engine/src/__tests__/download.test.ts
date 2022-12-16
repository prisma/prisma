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
    await del(path.posix.join(dirname, '/**/prisma-fmt*'))
  })
  afterEach(() => {
    delete process.env.PRISMA_QUERY_ENGINE_BINARY
  })

  test('download all current engines', async () => {
    const baseDir = path.posix.join(dirname, 'all')

    const platform = await getPlatform()
    const queryEnginePath = path.join(baseDir, getBinaryName(BinaryType.queryEngine, platform))
    const introspectionEnginePath = path.join(baseDir, getBinaryName(BinaryType.introspectionEngine, platform))
    const migrationEnginePath = path.join(baseDir, getBinaryName(BinaryType.migrationEngine, platform))
    const prismaFmtPath = path.join(baseDir, getBinaryName(BinaryType.prismaFmt, platform))

    await download({
      binaries: {
        [BinaryType.libqueryEngine]: baseDir,
        [BinaryType.queryEngine]: baseDir,
        [BinaryType.introspectionEngine]: baseDir,
        [BinaryType.migrationEngine]: baseDir,
        [BinaryType.prismaFmt]: baseDir,
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
        "introspection-engine-darwin",
        "introspection-engine-darwin-arm64",
        "introspection-engine-debian-openssl-1.0.x",
        "introspection-engine-debian-openssl-1.1.x",
        "introspection-engine-debian-openssl-3.0.x",
        "introspection-engine-linux-arm64-openssl-1.0.x",
        "introspection-engine-linux-arm64-openssl-1.1.x",
        "introspection-engine-linux-arm64-openssl-3.0.x",
        "introspection-engine-linux-musl",
        "introspection-engine-linux-musl-openssl-3.0.x",
        "introspection-engine-rhel-openssl-1.0.x",
        "introspection-engine-rhel-openssl-1.1.x",
        "introspection-engine-rhel-openssl-3.0.x",
        "introspection-engine-windows.exe",
        "libquery_engine-darwin-arm64.dylib.node",
        "libquery_engine-darwin.dylib.node",
        "libquery_engine-debian-openssl-1.0.x.so.node",
        "libquery_engine-debian-openssl-1.1.x.so.node",
        "libquery_engine-debian-openssl-3.0.x.so.node",
        "libquery_engine-linux-arm64-openssl-1.0.x.so.node",
        "libquery_engine-linux-arm64-openssl-1.1.x.so.node",
        "libquery_engine-linux-arm64-openssl-3.0.x.so.node",
        "libquery_engine-linux-musl.so.node",
        "libquery_engine-linux-musl-openssl-3.0.x.so.node",
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
        "prisma-fmt-darwin",
        "prisma-fmt-darwin-arm64",
        "prisma-fmt-debian-openssl-1.0.x",
        "prisma-fmt-debian-openssl-1.1.x",
        "prisma-fmt-debian-openssl-3.0.x",
        "prisma-fmt-linux-arm64-openssl-1.0.x",
        "prisma-fmt-linux-arm64-openssl-1.1.x",
        "prisma-fmt-linux-arm64-openssl-3.0.x",
        "prisma-fmt-linux-musl",
        "prisma-fmt-linux-musl-openssl-3.0.x",
        "prisma-fmt-rhel-openssl-1.0.x",
        "prisma-fmt-rhel-openssl-1.1.x",
        "prisma-fmt-rhel-openssl-3.0.x",
        "prisma-fmt-windows.exe",
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
    expect(await getVersion(introspectionEnginePath, BinaryType.introspectionEngine)).toContain(CURRENT_ENGINES_HASH)
    expect(await getVersion(migrationEnginePath, BinaryType.migrationEngine)).toContain(CURRENT_ENGINES_HASH)
    expect(await getVersion(prismaFmtPath, BinaryType.prismaFmt)).toContain(CURRENT_ENGINES_HASH)
  })

  test('download all binaries & cache them', async () => {
    const baseDir = path.posix.join(dirname, 'all')

    const platform = await getPlatform()
    const queryEnginePath = path.join(baseDir, getBinaryName(BinaryType.queryEngine, platform))
    const introspectionEnginePath = path.join(baseDir, getBinaryName(BinaryType.introspectionEngine, platform))
    const migrationEnginePath = path.join(baseDir, getBinaryName(BinaryType.migrationEngine, platform))
    const prismaFmtPath = path.join(baseDir, getBinaryName(BinaryType.prismaFmt, platform))

    const before0 = Date.now()
    await download({
      binaries: {
        [BinaryType.libqueryEngine]: baseDir,
        [BinaryType.queryEngine]: baseDir,
        [BinaryType.introspectionEngine]: baseDir,
        [BinaryType.migrationEngine]: baseDir,
        [BinaryType.prismaFmt]: baseDir,
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
          "name": "introspection-engine-darwin",
          "size": 26609608,
        },
        {
          "name": "introspection-engine-darwin-arm64",
          "size": 24028642,
        },
        {
          "name": "introspection-engine-debian-openssl-1.0.x",
          "size": 35236632,
        },
        {
          "name": "introspection-engine-debian-openssl-1.1.x",
          "size": 32511968,
        },
        {
          "name": "introspection-engine-debian-openssl-3.0.x",
          "size": 32512264,
        },
        {
          "name": "introspection-engine-linux-arm64-openssl-1.0.x",
          "size": 32885344,
        },
        {
          "name": "introspection-engine-linux-arm64-openssl-1.1.x",
          "size": 33449624,
        },
        {
          "name": "introspection-engine-linux-arm64-openssl-3.0.x",
          "size": 35307720,
        },
        {
          "name": "introspection-engine-linux-musl",
          "size": 34365712,
        },
        {
          "name": "introspection-engine-linux-musl-openssl-3.0.x",
          "size": 20719976,
        },
        {
          "name": "introspection-engine-rhel-openssl-1.0.x",
          "size": 35211280,
        },
        {
          "name": "introspection-engine-rhel-openssl-1.1.x",
          "size": 32503168,
        },
        {
          "name": "introspection-engine-rhel-openssl-3.0.x",
          "size": 32503096,
        },
        {
          "name": "introspection-engine-windows.exe",
          "size": 21941248,
        },
        {
          "name": "libquery_engine-darwin-arm64.dylib.node",
          "size": 29651762,
        },
        {
          "name": "libquery_engine-darwin.dylib.node",
          "size": 32938944,
        },
        {
          "name": "libquery_engine-debian-openssl-1.0.x.so.node",
          "size": 43309920,
        },
        {
          "name": "libquery_engine-debian-openssl-1.1.x.so.node",
          "size": 40584936,
        },
        {
          "name": "libquery_engine-debian-openssl-3.0.x.so.node",
          "size": 40584984,
        },
        {
          "name": "libquery_engine-linux-arm64-openssl-1.0.x.so.node",
          "size": 40597496,
        },
        {
          "name": "libquery_engine-linux-arm64-openssl-1.1.x.so.node",
          "size": 41133176,
        },
        {
          "name": "libquery_engine-linux-arm64-openssl-3.0.x.so.node",
          "size": 43016432,
        },
        {
          "name": "libquery_engine-linux-musl.so.node",
          "size": 40477248,
        },
        {
          "name": "libquery_engine-linux-musl-openssl-3.0.x.so.node",
          "size": 26957176,
        },
        {
          "name": "libquery_engine-rhel-openssl-1.0.x.so.node",
          "size": 43286256,
        },
        {
          "name": "libquery_engine-rhel-openssl-1.1.x.so.node",
          "size": 40577600,
        },
        {
          "name": "libquery_engine-rhel-openssl-3.0.x.so.node",
          "size": 40577536,
        },
        {
          "name": "migration-engine-darwin",
          "size": 29286376,
        },
        {
          "name": "migration-engine-darwin-arm64",
          "size": 26356446,
        },
        {
          "name": "migration-engine-debian-openssl-1.0.x",
          "size": 35765488,
        },
        {
          "name": "migration-engine-debian-openssl-1.1.x",
          "size": 35727784,
        },
        {
          "name": "migration-engine-debian-openssl-3.0.x",
          "size": 35731752,
        },
        {
          "name": "migration-engine-linux-arm64-openssl-1.0.x",
          "size": 35527272,
        },
        {
          "name": "migration-engine-linux-arm64-openssl-1.1.x",
          "size": 36269640,
        },
        {
          "name": "migration-engine-linux-arm64-openssl-3.0.x",
          "size": 38110928,
        },
        {
          "name": "migration-engine-linux-musl",
          "size": 37455896,
        },
        {
          "name": "migration-engine-linux-musl-openssl-3.0.x",
          "size": 25641368,
        },
        {
          "name": "migration-engine-rhel-openssl-1.0.x",
          "size": 35736776,
        },
        {
          "name": "migration-engine-rhel-openssl-1.1.x",
          "size": 35722256,
        },
        {
          "name": "migration-engine-rhel-openssl-3.0.x",
          "size": 35722112,
        },
        {
          "name": "migration-engine-windows.exe",
          "size": 24539648,
        },
        {
          "name": "prisma-fmt-darwin",
          "size": 5094864,
        },
        {
          "name": "prisma-fmt-darwin-arm64",
          "size": 4686040,
        },
        {
          "name": "prisma-fmt-debian-openssl-1.0.x",
          "size": 9626600,
        },
        {
          "name": "prisma-fmt-debian-openssl-1.1.x",
          "size": 9626624,
        },
        {
          "name": "prisma-fmt-debian-openssl-3.0.x",
          "size": 9626624,
        },
        {
          "name": "prisma-fmt-linux-arm64-openssl-1.0.x",
          "size": 9480384,
        },
        {
          "name": "prisma-fmt-linux-arm64-openssl-1.1.x",
          "size": 9480384,
        },
        {
          "name": "prisma-fmt-linux-arm64-openssl-3.0.x",
          "size": 9480384,
        },
        {
          "name": "prisma-fmt-linux-musl",
          "size": 9215520,
        },
        {
          "name": "prisma-fmt-linux-musl-openssl-3.0.x",
          "size": 5128256,
        },
        {
          "name": "prisma-fmt-rhel-openssl-1.0.x",
          "size": 9626416,
        },
        {
          "name": "prisma-fmt-rhel-openssl-1.1.x",
          "size": 9626432,
        },
        {
          "name": "prisma-fmt-rhel-openssl-3.0.x",
          "size": 9626432,
        },
        {
          "name": "prisma-fmt-windows.exe",
          "size": 3916800,
        },
        {
          "name": "query-engine-darwin",
          "size": 39099592,
        },
        {
          "name": "query-engine-darwin-arm64",
          "size": 35321562,
        },
        {
          "name": "query-engine-debian-openssl-1.0.x",
          "size": 48143376,
        },
        {
          "name": "query-engine-debian-openssl-1.1.x",
          "size": 48111776,
        },
        {
          "name": "query-engine-debian-openssl-3.0.x",
          "size": 48111744,
        },
        {
          "name": "query-engine-linux-arm64-openssl-1.0.x",
          "size": 47139360,
        },
        {
          "name": "query-engine-linux-arm64-openssl-1.1.x",
          "size": 47909960,
        },
        {
          "name": "query-engine-linux-arm64-openssl-3.0.x",
          "size": 49738536,
        },
        {
          "name": "query-engine-linux-musl",
          "size": 49328568,
        },
        {
          "name": "query-engine-rhel-openssl-1.0.x",
          "size": 48114472,
        },
        {
          "name": "query-engine-rhel-openssl-1.1.x",
          "size": 48110848,
        },
        {
          "name": "query-engine-rhel-openssl-3.0.x",
          "size": 48110776,
        },
        {
          "name": "query-engine-windows.exe",
          "size": 34626048,
        },
        {
          "name": "query_engine-windows.dll.node",
          "size": 29770240,
        },
      ]
    `)

    expect(await getVersion(queryEnginePath, BinaryType.queryEngine)).toMatchInlineSnapshot(
      `"query-engine da41d2bb3406da22087b849f0e911199ba4fbf11"`,
    )
    expect(await getVersion(introspectionEnginePath, BinaryType.introspectionEngine)).toMatchInlineSnapshot(
      `"introspection-core da41d2bb3406da22087b849f0e911199ba4fbf11"`,
    )
    expect(await getVersion(migrationEnginePath, BinaryType.migrationEngine)).toMatchInlineSnapshot(
      `"migration-engine-cli da41d2bb3406da22087b849f0e911199ba4fbf11"`,
    )
    expect(await getVersion(prismaFmtPath, BinaryType.prismaFmt)).toMatchInlineSnapshot(
      `"prisma-fmt da41d2bb3406da22087b849f0e911199ba4fbf11"`,
    )

    //
    // Cache test 1
    // 1- We delete the artifacts locally but not from the cache folder
    // 2- We measure how much time it takes to call download
    //

    // Delete all artifacts
    const deletedEngines = await del(path.posix.join(baseDir, '/*engine*'))
    const deletedPrismafmt = await del(path.posix.join(baseDir, '/prisma-fmt*'))
    expect(deletedEngines.length).toBeGreaterThan(0)
    expect(deletedPrismafmt.length).toBeGreaterThan(0)

    const before = Date.now()
    await download({
      binaries: {
        'libquery-engine': baseDir,
        'query-engine': baseDir,
        'introspection-engine': baseDir,
        'migration-engine': baseDir,
        'prisma-fmt': baseDir,
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
        'introspection-engine': baseDir,
        'migration-engine': baseDir,
        'prisma-fmt': baseDir,
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
