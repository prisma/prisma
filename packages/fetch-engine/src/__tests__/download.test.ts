import fs from 'node:fs'
import path from 'node:path'

import { enginesVersion } from '@prisma/engines-version'
import { getBinaryTargetForCurrentPlatform } from '@prisma/get-platform'
import del from 'del'
import { default as fetch, type Response } from 'node-fetch'
import timeoutSignal from 'timeout-signal'
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'

import { BinaryType } from '../BinaryType'
import { cleanupCache } from '../cleanupCache'
import { download, getBinaryName, getVersion } from '../download'
import { getFiles } from './__utils__/getFiles'

const testIf = (condition: boolean) => (condition ? test : test.skip)

vi.mock('node-fetch', { spy: true })

const CURRENT_ENGINES_HASH = enginesVersion
console.debug({ CURRENT_ENGINES_HASH })
const FIXED_ENGINES_HASH = 'bb8e7aae27ce478f586df41260253876ccb5b390'
const dirname = process.platform === 'win32' ? __dirname.split(path.sep).join('/') : __dirname

const describeIf = (condition: boolean) => (condition ? describe : describe.skip)
const usesCustomEngines =
  process.env.PRISMA_QUERY_ENGINE_LIBRARY ||
  process.env.PRISMA_QUERY_ENGINE_BINARY ||
  process.env.PRISMA_SCHEMA_ENGINE_BINARY

vi.setConfig({ testTimeout: 300_000 })

describeIf(!usesCustomEngines)('download', async () => {
  const baseDirAll = path.posix.join(dirname, 'all')
  const baseDirCorruption = path.posix.join(dirname, 'corruption')
  const baseDirChecksum = path.posix.join(dirname, 'checksum')
  let binaryTarget: string
  const actualFetch = (await vi.importActual('node-fetch')).default as typeof fetch

  beforeEach(async () => {
    vi.resetAllMocks()
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
        version: CURRENT_ENGINES_HASH,
      })

      const files = getFiles(baseDirAll).map((f) => f.name)
      // Only the current platform's binaries should be downloaded
      expect(files.length).toBeGreaterThan(0)
      expect(files).toContain(path.basename(queryEnginePath))
      expect(files).toContain(path.basename(schemaEnginePath))

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
        version: FIXED_ENGINES_HASH,
      })

      const after0 = Math.round(performance.now())
      const timeInMsToDownloadAll = after0 - before0
      console.debug(
        `1 - No Cache: first time, download everything.
It took ${timeInMsToDownloadAll}ms to execute download() for current platform.`,
      )

      const files = getFiles(baseDirAll)
      // Only the current platform's binaries should be downloaded
      expect(files.length).toBeGreaterThan(0)

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
        version: FIXED_ENGINES_HASH,
      })

      const after = Math.round(performance.now())
      const timeInMsToDownloadAllFromCache1 = after - before
      console.debug(
        `2 - With cache1: We deleted the engines locally but not from the cache folder.
It took ${timeInMsToDownloadAllFromCache1}ms to execute download() for current platform.`,
      )

      //
      // Cache test 2
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
        version: FIXED_ENGINES_HASH,
      })

      const after2 = Math.round(performance.now())
      const timeInMsToDownloadAllFromCache2 = after2 - before2
      console.debug(
        `3 - With cache2: Engines were already present
It took ${timeInMsToDownloadAllFromCache2}ms to execute download() for current platform.`,
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

  describe('retries', { retry: 3 }, () => {
    test('if fetching of checksums fails with a non 200 code it retries it 2 more times', async () => {
      vi.mocked(fetch).mockImplementation((url, opts) => {
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
          version: CURRENT_ENGINES_HASH,
        }),
      ).rejects.toThrow(/Failed to fetch sha256 checksum/)

      // Because we try to fetch 2 different checksum files
      // And there are 2 retries for the checksums
      // 2 checksums * 3 attempts = 6
      expect(fetch).toHaveBeenCalledTimes(6)
    })

    test('if fetching of a binary fails with a non 200 code it retries it 2 more times', async () => {
      vi.mocked(fetch).mockImplementation((url, opts) => {
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
          version: CURRENT_ENGINES_HASH,
        }),
      ).rejects.toThrow(/Failed to fetch the engine file/)

      // Because we try to fetch 2 different checksum files before we even start downloading the binaries
      // And there are 2 retries for the binary
      // 2 checksums + (1 engine * 3 attempts) = 5
      expect(fetch).toHaveBeenCalledTimes(5)
    })

    test('if fetching of checksums fails with a timeout it retries it 2 more times', async () => {
      vi.mocked(fetch).mockImplementation((url, opts) => {
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
          version: CURRENT_ENGINES_HASH,
        }),
      ).rejects.toThrow(`The operation was aborted.`)

      // Because we try to fetch 2 different checksum files
      // And there are 2 retries for the checksums
      // 2 checksums * 3 attempts = 6
      expect(fetch).toHaveBeenCalledTimes(6)
    })

    test('if fetching of a binary fails with a timeout it retries it 2 more times', async () => {
      vi.mocked(fetch).mockImplementation((url, opts) => {
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
          version: CURRENT_ENGINES_HASH,
        }),
      ).rejects.toThrow(`The operation was aborted.`)

      // Because we try to fetch 2 different checksum files before we even start downloading the binaries
      // And there are 2 retries for the binary
      // 2 checksums + (1 engine * 3 attempts) = 5
      expect(fetch).toHaveBeenCalledTimes(5)
    })
  })

  describe('env.PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1', () => {
    beforeAll(() => {
      vi.stubEnv('PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING', '1')
    })

    afterAll(() => {
      vi.unstubAllEnvs()
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
      vi.mocked(fetch).mockImplementation((url, opts) => {
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
          version: CURRENT_ENGINES_HASH,
        }),
      ).rejects.toThrow(/^sha256 checksum of .+ \(zipped\) should be .+ but is .+$/)
    })

    // This tests is skipped on Windows because it errors out with
    // EPERM: operation not permitted, unlink 'D:\a\prisma\prisma\packages\fetch-engine\src\__tests__\checksum\query_engine-windows.dll.node'
    // TODO: Fix this test on Windows one day
    testIf(process.platform !== 'win32')('if checksum download fails, logs warning but does not throw', async () => {
      vi.mocked(fetch).mockImplementation((url, opts) => {
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
