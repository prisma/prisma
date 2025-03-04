import { enginesVersion } from '@prisma/engines-version'
import { type BinaryTarget, getBinaryTargetForCurrentPlatform } from '@prisma/get-platform'
import del from 'del'
import fs from 'node:fs'
import type { Response } from 'node-fetch'
import { default as _mockFetch } from 'node-fetch'
import path from 'node:path'
import stripAnsi from 'strip-ansi'
import timeoutSignal from 'timeout-signal'

import { BinaryType } from '../BinaryType'
import { cleanupCache } from '../cleanupCache'
import { download, getBinaryName, getVersion } from '../download'
import { getFiles } from './__utils__/getFiles'

const testIf = (condition: boolean) => (condition ? test : test.skip)

jest.mock('node-fetch', () => jest.fn())
const actualFetch: typeof import('node-fetch').default = jest.requireActual('node-fetch').default
const mockFetch = _mockFetch as jest.MockedFunction<typeof actualFetch>

const CURRENT_ENGINES_HASH = enginesVersion
console.debug({ CURRENT_ENGINES_HASH })
const FIXED_ENGINES_HASH = 'bb8e7aae27ce478f586df41260253876ccb5b390'
const dirname = process.platform === 'win32' ? __dirname.split(path.sep).join('/') : __dirname

// Network can be slow, especially for macOS in CI.
jest.setTimeout(300_000)
jest.retryTimes(3)

const describeIf = (condition: boolean) => (condition ? describe : describe.skip)
const usesCustomEngines =
  process.env.PRISMA_QUERY_ENGINE_LIBRARY ||
  process.env.PRISMA_QUERY_ENGINE_BINARY ||
  process.env.PRISMA_SCHEMA_ENGINE_BINARY

describeIf(!usesCustomEngines)('download', () => {
  const baseDirAll = path.posix.join(dirname, 'all')
  const baseDirCorruption = path.posix.join(dirname, 'corruption')
  const baseDirChecksum = path.posix.join(dirname, 'checksum')
  const baseDirBinaryTarget = path.posix.join(dirname, 'binaryTarget')
  let binaryTarget: BinaryTarget

  beforeEach(async () => {
    mockFetch.mockReset().mockImplementation(actualFetch)
    // completely clean up the cache and keep nothing
    await cleanupCache(0)
    binaryTarget = await getBinaryTargetForCurrentPlatform()
  })

  describe('all engines', () => {
    beforeEach(async () => {
      // Make sure to not mix forward and backward slashes in the path
      // or del glob pattern would not work on Windows
      await del(path.posix.join(baseDirAll, '*engine*'))
      await del(path.posix.join(baseDirCorruption, '*engine*'))
    })

    test('download all current engines', async () => {
      const binaryTarget = await getBinaryTargetForCurrentPlatform()
      const queryEnginePath = path.join(baseDirAll, getBinaryName(BinaryType.QueryEngineBinary, binaryTarget))
      const schemaEnginePath = path.join(baseDirAll, getBinaryName(BinaryType.SchemaEngineBinary, binaryTarget))

      await download({
        binaries: {
          [BinaryType.QueryEngineLibrary]: baseDirAll,
          [BinaryType.QueryEngineBinary]: baseDirAll,
          [BinaryType.SchemaEngineBinary]: baseDirAll,
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
          [BinaryType.SchemaEngineBinary]: baseDirAll,
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
          "schema-engine-darwin",
          "schema-engine-darwin-arm64",
          "schema-engine-debian-openssl-1.0.x",
          "schema-engine-debian-openssl-1.1.x",
          "schema-engine-debian-openssl-3.0.x",
          "schema-engine-linux-arm64-openssl-1.0.x",
          "schema-engine-linux-arm64-openssl-1.1.x",
          "schema-engine-linux-arm64-openssl-3.0.x",
          "schema-engine-linux-musl",
          "schema-engine-linux-musl-arm64-openssl-1.1.x",
          "schema-engine-linux-musl-arm64-openssl-3.0.x",
          "schema-engine-linux-musl-openssl-3.0.x",
          "schema-engine-linux-static-arm64",
          "schema-engine-linux-static-x64",
          "schema-engine-rhel-openssl-1.0.x",
          "schema-engine-rhel-openssl-1.1.x",
          "schema-engine-rhel-openssl-3.0.x",
          "schema-engine-windows.exe",
        ]
      `)

      // Check that all engines hashes are the same
      expect(await getVersion(queryEnginePath, BinaryType.QueryEngineBinary)).toContain(CURRENT_ENGINES_HASH)
      expect(await getVersion(schemaEnginePath, BinaryType.SchemaEngineBinary)).toContain(CURRENT_ENGINES_HASH)
    })

    test('download all engines & cache them', async () => {
      const queryEnginePath = path.join(baseDirAll, getBinaryName(BinaryType.QueryEngineBinary, binaryTarget))
      const schemaEnginePath = path.join(baseDirAll, getBinaryName(BinaryType.SchemaEngineBinary, binaryTarget))

      const before0 = Math.round(performance.now())
      await download({
        binaries: {
          [BinaryType.QueryEngineLibrary]: baseDirAll,
          [BinaryType.QueryEngineBinary]: baseDirAll,
          [BinaryType.SchemaEngineBinary]: baseDirAll,
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
          [BinaryType.SchemaEngineBinary]: baseDirAll,
        },
        binaryTargets: ['linux-static-x64', 'linux-static-arm64'],
        version: FIXED_ENGINES_HASH,
      })

      const after0 = Math.round(performance.now())
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
            "size": 14795656,
          },
          {
            "name": "libquery_engine-darwin.dylib.node",
            "size": 15943464,
          },
          {
            "name": "libquery_engine-debian-openssl-1.0.x.so.node",
            "size": 17137992,
          },
          {
            "name": "libquery_engine-debian-openssl-1.1.x.so.node",
            "size": 14667144,
          },
          {
            "name": "libquery_engine-debian-openssl-3.0.x.so.node",
            "size": 14671240,
          },
          {
            "name": "libquery_engine-linux-arm64-openssl-1.0.x.so.node",
            "size": 14806960,
          },
          {
            "name": "libquery_engine-linux-arm64-openssl-1.1.x.so.node",
            "size": 15543112,
          },
          {
            "name": "libquery_engine-linux-arm64-openssl-3.0.x.so.node",
            "size": 16856552,
          },
          {
            "name": "libquery_engine-linux-musl-arm64-openssl-1.1.x.so.node",
            "size": 15821840,
          },
          {
            "name": "libquery_engine-linux-musl-arm64-openssl-3.0.x.so.node",
            "size": 17233504,
          },
          {
            "name": "libquery_engine-linux-musl-openssl-3.0.x.so.node",
            "size": 14659016,
          },
          {
            "name": "libquery_engine-linux-musl.so.node",
            "size": 14519848,
          },
          {
            "name": "libquery_engine-rhel-openssl-1.0.x.so.node",
            "size": 17137992,
          },
          {
            "name": "libquery_engine-rhel-openssl-1.1.x.so.node",
            "size": 14667144,
          },
          {
            "name": "libquery_engine-rhel-openssl-3.0.x.so.node",
            "size": 14671240,
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
            "size": 19278912,
          },
          {
            "name": "query-engine-debian-openssl-1.1.x",
            "size": 16799880,
          },
          {
            "name": "query-engine-debian-openssl-3.0.x",
            "size": 16799880,
          },
          {
            "name": "query-engine-linux-arm64-openssl-1.0.x",
            "size": 16714408,
          },
          {
            "name": "query-engine-linux-arm64-openssl-1.1.x",
            "size": 17450568,
          },
          {
            "name": "query-engine-linux-arm64-openssl-3.0.x",
            "size": 18776304,
          },
          {
            "name": "query-engine-linux-musl",
            "size": 16652352,
          },
          {
            "name": "query-engine-linux-musl-arm64-openssl-1.1.x",
            "size": 17704632,
          },
          {
            "name": "query-engine-linux-musl-arm64-openssl-3.0.x",
            "size": 19116296,
          },
          {
            "name": "query-engine-linux-musl-openssl-3.0.x",
            "size": 16767120,
          },
          {
            "name": "query-engine-linux-static-arm64",
            "size": 15976176,
          },
          {
            "name": "query-engine-linux-static-x64",
            "size": 19270816,
          },
          {
            "name": "query-engine-rhel-openssl-1.0.x",
            "size": 19278912,
          },
          {
            "name": "query-engine-rhel-openssl-1.1.x",
            "size": 16799880,
          },
          {
            "name": "query-engine-rhel-openssl-3.0.x",
            "size": 16799880,
          },
          {
            "name": "query-engine-windows.exe",
            "size": 19473408,
          },
          {
            "name": "query_engine-windows.dll.node",
            "size": 17260544,
          },
          {
            "name": "schema-engine-darwin",
            "size": 21350168,
          },
          {
            "name": "schema-engine-darwin-arm64",
            "size": 20095995,
          },
          {
            "name": "schema-engine-debian-openssl-1.0.x",
            "size": 22128688,
          },
          {
            "name": "schema-engine-debian-openssl-1.1.x",
            "size": 19424592,
          },
          {
            "name": "schema-engine-debian-openssl-3.0.x",
            "size": 19425672,
          },
          {
            "name": "schema-engine-linux-arm64-openssl-1.0.x",
            "size": 21445928,
          },
          {
            "name": "schema-engine-linux-arm64-openssl-1.1.x",
            "size": 22202712,
          },
          {
            "name": "schema-engine-linux-arm64-openssl-3.0.x",
            "size": 23870488,
          },
          {
            "name": "schema-engine-linux-musl",
            "size": 19048528,
          },
          {
            "name": "schema-engine-linux-musl-arm64-openssl-1.1.x",
            "size": 22540968,
          },
          {
            "name": "schema-engine-linux-musl-arm64-openssl-3.0.x",
            "size": 24270912,
          },
          {
            "name": "schema-engine-linux-musl-openssl-3.0.x",
            "size": 19341248,
          },
          {
            "name": "schema-engine-linux-static-arm64",
            "size": 21205832,
          },
          {
            "name": "schema-engine-linux-static-x64",
            "size": 22305112,
          },
          {
            "name": "schema-engine-rhel-openssl-1.0.x",
            "size": 22128688,
          },
          {
            "name": "schema-engine-rhel-openssl-1.1.x",
            "size": 19424592,
          },
          {
            "name": "schema-engine-rhel-openssl-3.0.x",
            "size": 19425672,
          },
          {
            "name": "schema-engine-windows.exe",
            "size": 15776256,
          },
        ]
      `)

      expect(await getVersion(queryEnginePath, BinaryType.QueryEngineBinary)).toMatchInlineSnapshot(
        `"query-engine bb8e7aae27ce478f586df41260253876ccb5b390"`,
      )
      expect(await getVersion(schemaEnginePath, BinaryType.SchemaEngineBinary)).toMatchInlineSnapshot(
        `"schema-engine-cli bb8e7aae27ce478f586df41260253876ccb5b390"`,
      )

      //
      // Cache test 1
      // 1- We delete the artifacts locally but not from the cache folder
      // 2- We measure how much time it takes to call download
      //

      // Delete all artifacts
      const deletedEngines = await del(path.posix.join(baseDirAll, '/*engine*'))
      expect(deletedEngines.length).toBeGreaterThan(0)

      const before = Math.round(performance.now())
      await download({
        binaries: {
          'libquery-engine': baseDirAll,
          'query-engine': baseDirAll,
          'schema-engine': baseDirAll,
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
          [BinaryType.SchemaEngineBinary]: baseDirAll,
        },
        binaryTargets: ['linux-static-x64', 'linux-static-arm64'],
        version: FIXED_ENGINES_HASH,
      })

      const after = Math.round(performance.now())
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
      const before2 = Math.round(performance.now())
      await download({
        binaries: {
          'libquery-engine': baseDirAll,
          'query-engine': baseDirAll,
          'schema-engine': baseDirAll,
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
          [BinaryType.SchemaEngineBinary]: baseDirAll,
        },
        binaryTargets: ['linux-static-x64', 'linux-static-arm64'],
        version: FIXED_ENGINES_HASH,
      })

      const after2 = Math.round(performance.now())
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
      const targetPath = path.join(baseDirCorruption, getBinaryName(BinaryType.QueryEngineBinary, binaryTarget))
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
      process.env.PRISMA_QUERY_ENGINE_BINARY = undefined
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
      expect(testResult['query-engine']!.marvin).toEqual(targetPath)
    })
  })

  describe('retries', () => {
    test('if fetching of checksums fails with a non 200 code it retries it 2 more times', async () => {
      mockFetch.mockImplementation((url, opts) => {
        if (String(url).endsWith('.sha256')) {
          return Promise.resolve({
            ok: false,
            status: 500,
            statusText: 'KO',
          } as Response)
        }
        return actualFetch(url, opts)
      })

      await expect(
        download({
          binaries: {
            [BinaryType.QueryEngineLibrary]: baseDirChecksum,
          },
          binaryTargets: ['rhel-openssl-3.0.x'],
          version: CURRENT_ENGINES_HASH,
        }),
      ).rejects.toThrow(
        `Failed to fetch sha256 checksum at https://binaries.prisma.sh/all_commits/${CURRENT_ENGINES_HASH}/rhel-openssl-3.0.x/libquery_engine.so.node.gz.sha256 - 500 KO`,
      )

      // Because we try to fetch 2 different checksum files
      // And there are 2 retries for the checksums
      // 2 checksums * 3 attempts = 6
      expect(mockFetch).toHaveBeenCalledTimes(6)
    })

    test('if fetching of a binary fails with a non 200 code it retries it 2 more times', async () => {
      mockFetch.mockImplementation((url, opts) => {
        if (!String(url).endsWith('.sha256')) {
          return Promise.resolve({
            ok: false,
            status: 500,
            statusText: 'KO',
          } as Response)
        }
        return actualFetch(url, opts)
      })

      await expect(
        download({
          binaries: {
            [BinaryType.QueryEngineLibrary]: baseDirChecksum,
          },
          binaryTargets: ['rhel-openssl-3.0.x'],
          version: CURRENT_ENGINES_HASH,
        }),
      ).rejects.toThrow(
        `Failed to fetch the engine file at https://binaries.prisma.sh/all_commits/${CURRENT_ENGINES_HASH}/rhel-openssl-3.0.x/libquery_engine.so.node.gz - 500 KO`,
      )

      // Because we try to fetch 2 different checksum files before we even start downloading the binaries
      // And there are 2 retries for the binary
      // 2 checksums + (1 engine * 3 attempts) = 5
      expect(mockFetch).toHaveBeenCalledTimes(5)
    })

    test('if fetching of checksums fails with a timeout it retries it 2 more times', async () => {
      mockFetch.mockImplementation((url, opts) => {
        opts = opts || {}
        // This makes everything fail with a timeout
        opts.signal = timeoutSignal(0)
        return actualFetch(url, opts)
      })

      await expect(
        download({
          binaries: {
            [BinaryType.QueryEngineLibrary]: baseDirChecksum,
          },
          binaryTargets: [binaryTarget],
          version: CURRENT_ENGINES_HASH,
        }),
      ).rejects.toThrow('The operation was aborted.')

      // Because we try to fetch 2 different checksum files
      // And there are 2 retries for the checksums
      // 2 checksums * 3 attempts = 6
      expect(mockFetch).toHaveBeenCalledTimes(6)
    })

    test('if fetching of a binary fails with a timeout it retries it 2 more times', async () => {
      mockFetch.mockImplementation((url, opts) => {
        opts = opts || {}
        // We only make binaries fail with a timeout, not checksums
        if (!String(url).endsWith('.sha256')) {
          opts.signal = timeoutSignal(0)
        }
        return actualFetch(url, opts)
      })

      await expect(
        download({
          binaries: {
            [BinaryType.QueryEngineLibrary]: baseDirChecksum,
          },
          binaryTargets: [binaryTarget],
          version: CURRENT_ENGINES_HASH,
        }),
      ).rejects.toThrow('The operation was aborted.')

      // Because we try to fetch 2 different checksum files before we even start downloading the binaries
      // And there are 2 retries for the binary
      // 2 checksums + (1 engine * 3 attempts) = 5
      expect(mockFetch).toHaveBeenCalledTimes(5)
    })
  })

  describe('env.PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1', () => {
    beforeAll(() => {
      process.env.PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING = '1'
    })

    afterAll(() => {
      process.env.PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING = undefined
    })

    beforeEach(async () => {
      // Make sure to not mix forward and backward slashes in the path
      // or del glob pattern would not work on Windows
      await del(path.posix.join(baseDirChecksum, '*engine*'))
    })

    test('if checksum downloads and matches, does not throw', async () => {
      const queryEnginePath = path.join(baseDirChecksum, getBinaryName(BinaryType.QueryEngineLibrary, binaryTarget))

      await expect(
        download({
          binaries: {
            [BinaryType.QueryEngineLibrary]: baseDirChecksum,
          },
          binaryTargets: [binaryTarget],
          version: CURRENT_ENGINES_HASH,
        }),
      ).resolves.toStrictEqual({
        'libquery-engine': {
          [binaryTarget]: queryEnginePath,
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
              Promise.resolve('1deadbeef2deadbeef3deadbeef4deadbeef5deadbeef6deadbeef7deadbeef8  query-engine.gz\n'),
          } as Response)
        }
        return actualFetch(url, opts)
      })

      await expect(
        download({
          binaries: {
            [BinaryType.QueryEngineLibrary]: baseDirChecksum,
          },
          binaryTargets: [binaryTarget],
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

      const queryEnginePath = path.join(baseDirChecksum, getBinaryName(BinaryType.QueryEngineLibrary, binaryTarget))

      await expect(
        download({
          binaries: {
            [BinaryType.QueryEngineLibrary]: baseDirChecksum,
          },
          binaryTargets: [binaryTarget],
          version: CURRENT_ENGINES_HASH,
        }),
      ).resolves.toStrictEqual({
        'libquery-engine': {
          [binaryTarget]: queryEnginePath,
        },
      })

      const files = getFiles(baseDirChecksum).map((f) => f.name)
      expect(files.filter((name) => !name.startsWith('.'))).toEqual([path.basename(queryEnginePath)])
      expect(await getVersion(queryEnginePath, BinaryType.QueryEngineLibrary)).toContain(CURRENT_ENGINES_HASH)
    })
  })
})
