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
const FIXED_ENGINES_HASH = 'b20ead4d3ab9e78ac112966e242ded703f4a052c'
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

      await download({
        binaries: {
          [BinaryType.QueryEngineBinary]: baseDirAll,
          [BinaryType.MigrationEngineBinary]: baseDirAll,
        },
        binaryTargets: ['linux-static-x64', 'linux-static-arm64'],
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
          "migration-engine-linux-static-arm64",
          "migration-engine-linux-static-x64",
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
          "query-engine-linux-static-arm64",
          "query-engine-linux-static-x64",
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

      await download({
        binaries: {
          [BinaryType.QueryEngineBinary]: baseDirAll,
          [BinaryType.MigrationEngineBinary]: baseDirAll,
        },
        binaryTargets: ['linux-static-x64', 'linux-static-arm64'],
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
            "size": 14779048,
          },
          {
            "name": "libquery_engine-darwin.dylib.node",
            "size": 15943376,
          },
          {
            "name": "libquery_engine-debian-openssl-1.0.x.so.node",
            "size": 17137832,
          },
          {
            "name": "libquery_engine-debian-openssl-1.1.x.so.node",
            "size": 14662888,
          },
          {
            "name": "libquery_engine-debian-openssl-3.0.x.so.node",
            "size": 14662888,
          },
          {
            "name": "libquery_engine-linux-arm64-openssl-1.0.x.so.node",
            "size": 14798608,
          },
          {
            "name": "libquery_engine-linux-arm64-openssl-1.1.x.so.node",
            "size": 15522472,
          },
          {
            "name": "libquery_engine-linux-arm64-openssl-3.0.x.so.node",
            "size": 16860488,
          },
          {
            "name": "libquery_engine-linux-musl-arm64-openssl-1.1.x.so.node",
            "size": 15809376,
          },
          {
            "name": "libquery_engine-linux-musl-arm64-openssl-3.0.x.so.node",
            "size": 17229232,
          },
          {
            "name": "libquery_engine-linux-musl-openssl-3.0.x.so.node",
            "size": 14654760,
          },
          {
            "name": "libquery_engine-linux-musl.so.node",
            "size": 14511464,
          },
          {
            "name": "libquery_engine-rhel-openssl-1.0.x.so.node",
            "size": 17137832,
          },
          {
            "name": "libquery_engine-rhel-openssl-1.1.x.so.node",
            "size": 14662888,
          },
          {
            "name": "libquery_engine-rhel-openssl-3.0.x.so.node",
            "size": 14662888,
          },
          {
            "name": "migration-engine-darwin",
            "size": 21373456,
          },
          {
            "name": "migration-engine-darwin-arm64",
            "size": 20102638,
          },
          {
            "name": "migration-engine-debian-openssl-1.0.x",
            "size": 22144168,
          },
          {
            "name": "migration-engine-debian-openssl-1.1.x",
            "size": 19440080,
          },
          {
            "name": "migration-engine-debian-openssl-3.0.x",
            "size": 19441160,
          },
          {
            "name": "migration-engine-linux-arm64-openssl-1.0.x",
            "size": 21458768,
          },
          {
            "name": "migration-engine-linux-arm64-openssl-1.1.x",
            "size": 22211472,
          },
          {
            "name": "migration-engine-linux-arm64-openssl-3.0.x",
            "size": 23883344,
          },
          {
            "name": "migration-engine-linux-musl",
            "size": 19058352,
          },
          {
            "name": "migration-engine-linux-musl-arm64-openssl-1.1.x",
            "size": 22553584,
          },
          {
            "name": "migration-engine-linux-musl-arm64-openssl-3.0.x",
            "size": 24279432,
          },
          {
            "name": "migration-engine-linux-musl-openssl-3.0.x",
            "size": 19348096,
          },
          {
            "name": "migration-engine-linux-static-arm64",
            "size": 21218896,
          },
          {
            "name": "migration-engine-linux-static-x64",
            "size": 22324992,
          },
          {
            "name": "migration-engine-rhel-openssl-1.0.x",
            "size": 22144168,
          },
          {
            "name": "migration-engine-rhel-openssl-1.1.x",
            "size": 19440080,
          },
          {
            "name": "migration-engine-rhel-openssl-3.0.x",
            "size": 19441160,
          },
          {
            "name": "migration-engine-windows.exe",
            "size": 15780864,
          },
          {
            "name": "query-engine-darwin",
            "size": 17840936,
          },
          {
            "name": "query-engine-darwin-arm64",
            "size": 16655984,
          },
          {
            "name": "query-engine-debian-openssl-1.0.x",
            "size": 19287104,
          },
          {
            "name": "query-engine-debian-openssl-1.1.x",
            "size": 16808072,
          },
          {
            "name": "query-engine-debian-openssl-3.0.x",
            "size": 16808072,
          },
          {
            "name": "query-engine-linux-arm64-openssl-1.0.x",
            "size": 16722600,
          },
          {
            "name": "query-engine-linux-arm64-openssl-1.1.x",
            "size": 17462856,
          },
          {
            "name": "query-engine-linux-arm64-openssl-3.0.x",
            "size": 18788592,
          },
          {
            "name": "query-engine-linux-musl",
            "size": 16664640,
          },
          {
            "name": "query-engine-linux-musl-arm64-openssl-1.1.x",
            "size": 17708728,
          },
          {
            "name": "query-engine-linux-musl-arm64-openssl-3.0.x",
            "size": 19120392,
          },
          {
            "name": "query-engine-linux-musl-openssl-3.0.x",
            "size": 16775312,
          },
          {
            "name": "query-engine-linux-static-arm64",
            "size": 15984368,
          },
          {
            "name": "query-engine-linux-static-x64",
            "size": 19274912,
          },
          {
            "name": "query-engine-rhel-openssl-1.0.x",
            "size": 19287104,
          },
          {
            "name": "query-engine-rhel-openssl-1.1.x",
            "size": 16808072,
          },
          {
            "name": "query-engine-rhel-openssl-3.0.x",
            "size": 16808072,
          },
          {
            "name": "query-engine-windows.exe",
            "size": 19483648,
          },
          {
            "name": "query_engine-windows.dll.node",
            "size": 17259520,
          },
        ]
      `)

      expect(await getVersion(queryEnginePath, BinaryType.QueryEngineBinary)).toMatchInlineSnapshot(
        `"query-engine b20ead4d3ab9e78ac112966e242ded703f4a052c"`,
      )
      expect(await getVersion(migrationEnginePath, BinaryType.MigrationEngineBinary)).toMatchInlineSnapshot(
        `"schema-engine-cli b20ead4d3ab9e78ac112966e242ded703f4a052c"`,
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

      await download({
        binaries: {
          [BinaryType.QueryEngineBinary]: baseDirAll,
          [BinaryType.MigrationEngineBinary]: baseDirAll,
        },
        binaryTargets: ['linux-static-x64', 'linux-static-arm64'],
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

      await download({
        binaries: {
          [BinaryType.QueryEngineBinary]: baseDirAll,
          [BinaryType.MigrationEngineBinary]: baseDirAll,
        },
        binaryTargets: ['linux-static-x64', 'linux-static-arm64'],
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
        version: CURRENT_ENGINES_HASH,
      })

      fs.writeFileSync(targetPath, 'incorrect-binary')

      // please heal it
      await download({
        binaries: {
          'query-engine': baseDirCorruption,
        },
        version: CURRENT_ENGINES_HASH,
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
          version: CURRENT_ENGINES_HASH,
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
          version: CURRENT_ENGINES_HASH,
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
        version: CURRENT_ENGINES_HASH,
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
        version: CURRENT_ENGINES_HASH,
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
