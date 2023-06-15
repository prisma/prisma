import { enginesVersion } from '@prisma/engines-version'
import { getPlatform, Platform } from '@prisma/get-platform'
import del from 'del'
import fs from 'fs'
import type { Response } from 'node-fetch'
import _mockFetch from 'node-fetch'
import path from 'path'
import stripAnsi from 'strip-ansi'

import { cleanupCache } from '../cleanupCache'
import { BinaryType, download, getBinaryName, getVersion } from '../download'
import { getFiles } from './__utils__/getFiles'

const testIf = (condition: boolean) => (condition ? test : test.skip)

jest.mock('node-fetch', () => jest.fn())
const actualFetch: typeof import('node-fetch').default = jest.requireActual('node-fetch')
const mockFetch = _mockFetch as any as jest.Mock<ReturnType<typeof actualFetch>, Parameters<typeof actualFetch>>

const CURRENT_ENGINES_HASH = enginesVersion
console.debug({ CURRENT_ENGINES_HASH })
const FIXED_ENGINES_HASH = 'eac182fd33c63959a61946df56831625a9a39627'
const dirname = process.platform === 'win32' ? __dirname.split(path.sep).join('/') : __dirname

// Network can be slow, especially for macOS in CI.
jest.setTimeout(300_000)
jest.retryTimes(3)

describe('download', () => {
  const baseDirAll = path.posix.join(dirname, 'all')
  const baseDirCorruption = path.posix.join(dirname, 'corruption')
  const baseDirChecksum = path.posix.join(dirname, 'checksum')
  const baseDirBinaryTarget = path.posix.join(dirname, 'binaryTarget')
  let platform: Platform

  beforeEach(async () => {
    mockFetch.mockReset().mockImplementation(actualFetch)
    // completely clean up the cache and keep nothing
    await cleanupCache(0)
    platform = await getPlatform()
  })

  describe('all engines', () => {
    beforeEach(async () => {
      // Make sure to not mix forward and backward slashes in the path
      // or del glob pattern would not work on Windows
      await del(path.posix.join(baseDirAll, '*engine*'))
      await del(path.posix.join(baseDirCorruption, '*engine*'))
    })

    test('download all current engines', async () => {
      const platform = await getPlatform()
      const queryEnginePath = path.join(baseDirAll, getBinaryName(BinaryType.QueryEngineBinary, platform))
      const migrationEnginePath = path.join(baseDirAll, getBinaryName(BinaryType.MigrationEngineBinary, platform))

      await download({
        binaries: {
          [BinaryType.QueryEngineLibrary]: baseDirAll,
          [BinaryType.QueryEngineBinary]: baseDirAll,
          [BinaryType.MigrationEngineBinary]: baseDirAll,
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

      const files = getFiles(baseDirAll).map((f) => f.name)
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
      expect(await getVersion(queryEnginePath, BinaryType.QueryEngineBinary)).toContain(CURRENT_ENGINES_HASH)
      expect(await getVersion(migrationEnginePath, BinaryType.MigrationEngineBinary)).toContain(CURRENT_ENGINES_HASH)
    })

    test('download all engines & cache them', async () => {
      const queryEnginePath = path.join(baseDirAll, getBinaryName(BinaryType.QueryEngineBinary, platform))
      const migrationEnginePath = path.join(baseDirAll, getBinaryName(BinaryType.MigrationEngineBinary, platform))

      const before0 = Date.now()
      await download({
        binaries: {
          [BinaryType.QueryEngineLibrary]: baseDirAll,
          [BinaryType.QueryEngineBinary]: baseDirAll,
          [BinaryType.MigrationEngineBinary]: baseDirAll,
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

      const files = getFiles(baseDirAll)
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

      expect(await getVersion(queryEnginePath, BinaryType.QueryEngineBinary)).toMatchInlineSnapshot(
        `"query-engine eac182fd33c63959a61946df56831625a9a39627"`,
      )
      expect(await getVersion(migrationEnginePath, BinaryType.MigrationEngineBinary)).toMatchInlineSnapshot(
        `"migration-engine-cli eac182fd33c63959a61946df56831625a9a39627"`,
      )

      //
      // Cache test 1
      // 1- We delete the artifacts locally but not from the cache folder
      // 2- We measure how much time it takes to call download
      //

      // Delete all artifacts
      const deletedEngines = await del(path.posix.join(baseDirAll, '/*engine*'))
      expect(deletedEngines.length).toBeGreaterThan(0)

      const before = Date.now()
      await download({
        binaries: {
          'libquery-engine': baseDirAll,
          'query-engine': baseDirAll,
          'migration-engine': baseDirAll,
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
          'libquery-engine': baseDirAll,
          'query-engine': baseDirAll,
          'migration-engine': baseDirAll,
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
      const targetPath = path.join(baseDirCorruption, getBinaryName('query-engine', platform))
      if (fs.existsSync(targetPath)) {
        try {
          fs.unlinkSync(targetPath)
        } catch (e) {
          console.error(e)
        }
      }

      await download({
        binaries: {
          'query-engine': baseDirCorruption,
        },
        version: FIXED_ENGINES_HASH,
      })

      fs.writeFileSync(targetPath, 'incorrect-binary')

      // please heal it
      await download({
        binaries: {
          'query-engine': baseDirCorruption,
        },
        version: FIXED_ENGINES_HASH,
      })

      expect(fs.existsSync(targetPath)).toBe(true)

      expect(await getVersion(targetPath, BinaryType.QueryEngineBinary)).not.toBe(undefined)
    })
  })

  describe('binaryTarget', () => {
    beforeEach(async () => {
      // Make sure to not mix forward and backward slashes in the path
      // or del glob pattern would not work on Windows
      await del(path.posix.join(baseDirBinaryTarget, '*engine*'))
    })

    afterEach(() => {
      delete process.env.PRISMA_QUERY_ENGINE_BINARY
    })

    test('handle nonexistent "binaryTarget"', async () => {
      await expect(
        download({
          binaries: {
            'query-engine': baseDirBinaryTarget,
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
            'query-engine': baseDirBinaryTarget,
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
          'query-engine': baseDirBinaryTarget,
        },
        version: FIXED_ENGINES_HASH,
      })
      const dummyPath = e['query-engine']![Object.keys(e['query-engine']!)[0]]!
      const targetPath = path.join(
        baseDirBinaryTarget,
        // @ts-ignore
        getBinaryName('query-engine', 'marvin'),
      )
      fs.copyFileSync(dummyPath, targetPath)
      process.env.PRISMA_QUERY_ENGINE_BINARY = targetPath

      const testResult = await download({
        binaries: {
          'query-engine': baseDirBinaryTarget,
        },
        version: FIXED_ENGINES_HASH,
        binaryTargets: ['marvin'] as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      })
      expect(testResult['query-engine']!['marvin']).toEqual(targetPath)
    })
  })

  describe('env.PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1', () => {
    beforeAll(() => {
      process.env.PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING = '1'
    })

    afterAll(() => {
      delete process.env.PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING
    })

    beforeEach(async () => {
      // Make sure to not mix forward and backward slashes in the path
      // or del glob pattern would not work on Windows
      await del(path.posix.join(baseDirChecksum, '*engine*'))
    })

    test('if checksum downloads and matches, does not throw', async () => {
      const queryEnginePath = path.join(baseDirChecksum, getBinaryName(BinaryType.QueryEngineLibrary, platform))

      await expect(
        download({
          binaries: {
            [BinaryType.QueryEngineLibrary]: baseDirChecksum,
          },
          binaryTargets: [platform],
          version: CURRENT_ENGINES_HASH,
        }),
      ).resolves.toStrictEqual({
        'libquery-engine': {
          [platform]: queryEnginePath,
        },
      })

      const files = getFiles(baseDirChecksum).map((f) => f.name)
      expect(files.filter((name) => !name.startsWith('.'))).toEqual([path.basename(queryEnginePath)])
      expect(await getVersion(queryEnginePath, BinaryType.QueryEngineLibrary)).toContain(CURRENT_ENGINES_HASH)
    })

    // This tests is skipped on Windows because it errors out with
    // EPERM: operation not permitted, unlink 'D:\a\prisma\prisma\packages\fetch-engine\src\__tests__\checksum\query_engine-windows.dll.node'
    // TODO: Fix this test on Windows one day
    testIf(process.platform !== 'win32')("if checksum downloads but doesn't match, throws", async () => {
      mockFetch.mockImplementation((url, opts) => {
        if (String(url).endsWith('.sha256')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            statusText: 'OK',
            text: () =>
              Promise.resolve(`1deadbeef2deadbeef3deadbeef4deadbeef5deadbeef6deadbeef7deadbeef8  query-engine.gz\n`),
          } as Response)
        }
        return actualFetch(url, opts)
      })

      await expect(
        download({
          binaries: {
            [BinaryType.QueryEngineLibrary]: baseDirChecksum,
          },
          binaryTargets: [platform],
          version: CURRENT_ENGINES_HASH,
        }),
      ).rejects.toThrow(/^sha256 checksum of .+ \(zipped\) should be .+ but is .+$/)
    })

    // This tests is skipped on Windows because it errors out with
    // EPERM: operation not permitted, unlink 'D:\a\prisma\prisma\packages\fetch-engine\src\__tests__\checksum\query_engine-windows.dll.node'
    // TODO: Fix this test on Windows one day
    testIf(process.platform !== 'win32')('if checksum download fails, logs warning but does not throw', async () => {
      mockFetch.mockImplementation((url, opts) => {
        if (String(url).endsWith('.sha256')) {
          return Promise.resolve({
            ok: false,
            status: 404,
            statusText: 'Not Found',
          } as any as Response)
        }
        return actualFetch(url, opts)
      })

      const queryEnginePath = path.join(baseDirChecksum, getBinaryName(BinaryType.QueryEngineLibrary, platform))

      await expect(
        download({
          binaries: {
            [BinaryType.QueryEngineLibrary]: baseDirChecksum,
          },
          binaryTargets: [platform],
          version: CURRENT_ENGINES_HASH,
        }),
      ).resolves.toStrictEqual({
        'libquery-engine': {
          [platform]: queryEnginePath,
        },
      })

      const files = getFiles(baseDirChecksum).map((f) => f.name)
      expect(files.filter((name) => !name.startsWith('.'))).toEqual([path.basename(queryEnginePath)])
      expect(await getVersion(queryEnginePath, BinaryType.QueryEngineLibrary)).toContain(CURRENT_ENGINES_HASH)
    })
  })
})
