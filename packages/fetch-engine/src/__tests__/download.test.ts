import { enginesVersion } from '@prisma/engines-version'
import { getPlatform } from '@prisma/get-platform'
import del from 'del'
import fs from 'fs'
import path from 'path'
import stripAnsi from 'strip-ansi'

import { BinaryType } from '../BinaryType'
import { cleanupCache } from '../cleanupCache'
import { download, getBinaryName, getVersion } from '../download'
import { getFiles } from './__utils__/getFiles'

const CURRENT_ENGINES_HASH = enginesVersion
console.debug({ CURRENT_ENGINES_HASH })
const FIXED_ENGINES_HASH = '72a818438fbeb692961516daebf61ab86af03011'
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
    const queryEnginePath = path.join(baseDir, getBinaryName(BinaryType.QueryEngineBinary, platform))
    const schemaEnginePath = path.join(baseDir, getBinaryName(BinaryType.SchemaEngineBinary, platform))

    await download({
      binaries: {
        [BinaryType.QueryEngineLibrary]: baseDir,
        [BinaryType.QueryEngineBinary]: baseDir,
        [BinaryType.SchemaEngineBinary]: baseDir,
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

  test('download all binaries & cache them', async () => {
    const baseDir = path.posix.join(dirname, 'all')

    const platform = await getPlatform()
    const queryEnginePath = path.join(baseDir, getBinaryName(BinaryType.QueryEngineBinary, platform))
    const schemaEnginePath = path.join(baseDir, getBinaryName(BinaryType.SchemaEngineBinary, platform))

    const before0 = Date.now()
    await download({
      binaries: {
        [BinaryType.QueryEngineLibrary]: baseDir,
        [BinaryType.QueryEngineBinary]: baseDir,
        [BinaryType.SchemaEngineBinary]: baseDir,
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
          "size": 14662008,
        },
        {
          "name": "libquery_engine-darwin.dylib.node",
          "size": 15843256,
        },
        {
          "name": "libquery_engine-debian-openssl-1.0.x.so.node",
          "size": 16998600,
        },
        {
          "name": "libquery_engine-debian-openssl-1.1.x.so.node",
          "size": 14523672,
        },
        {
          "name": "libquery_engine-debian-openssl-3.0.x.so.node",
          "size": 14523672,
        },
        {
          "name": "libquery_engine-linux-arm64-openssl-1.0.x.so.node",
          "size": 14679872,
        },
        {
          "name": "libquery_engine-linux-arm64-openssl-1.1.x.so.node",
          "size": 15411928,
        },
        {
          "name": "libquery_engine-linux-arm64-openssl-3.0.x.so.node",
          "size": 16737656,
        },
        {
          "name": "libquery_engine-linux-musl-arm64-openssl-1.1.x.so.node",
          "size": 15690640,
        },
        {
          "name": "libquery_engine-linux-musl-arm64-openssl-3.0.x.so.node",
          "size": 17106400,
        },
        {
          "name": "libquery_engine-linux-musl-openssl-3.0.x.so.node",
          "size": 14564712,
        },
        {
          "name": "libquery_engine-linux-musl.so.node",
          "size": 14380456,
        },
        {
          "name": "libquery_engine-rhel-openssl-1.0.x.so.node",
          "size": 16998600,
        },
        {
          "name": "libquery_engine-rhel-openssl-1.1.x.so.node",
          "size": 14523672,
        },
        {
          "name": "libquery_engine-rhel-openssl-3.0.x.so.node",
          "size": 14523672,
        },
        {
          "name": "query-engine-darwin",
          "size": 17824240,
        },
        {
          "name": "query-engine-darwin-arm64",
          "size": 16606336,
        },
        {
          "name": "query-engine-debian-openssl-1.0.x",
          "size": 19250304,
        },
        {
          "name": "query-engine-debian-openssl-1.1.x",
          "size": 16771256,
        },
        {
          "name": "query-engine-debian-openssl-3.0.x",
          "size": 16771256,
        },
        {
          "name": "query-engine-linux-arm64-openssl-1.0.x",
          "size": 16689880,
        },
        {
          "name": "query-engine-linux-arm64-openssl-1.1.x",
          "size": 17421944,
        },
        {
          "name": "query-engine-linux-arm64-openssl-3.0.x",
          "size": 18751776,
        },
        {
          "name": "query-engine-linux-musl",
          "size": 16623744,
        },
        {
          "name": "query-engine-linux-musl-arm64-openssl-1.1.x",
          "size": 17676008,
        },
        {
          "name": "query-engine-linux-musl-arm64-openssl-3.0.x",
          "size": 19095864,
        },
        {
          "name": "query-engine-linux-musl-openssl-3.0.x",
          "size": 16791728,
        },
        {
          "name": "query-engine-rhel-openssl-1.0.x",
          "size": 19250304,
        },
        {
          "name": "query-engine-rhel-openssl-1.1.x",
          "size": 16771256,
        },
        {
          "name": "query-engine-rhel-openssl-3.0.x",
          "size": 16771256,
        },
        {
          "name": "query-engine-windows.exe",
          "size": 19431936,
        },
        {
          "name": "query_engine-windows.dll.node",
          "size": 17075200,
        },
        {
          "name": "schema-engine-darwin",
          "size": 21353120,
        },
        {
          "name": "schema-engine-darwin-arm64",
          "size": 20099531,
        },
        {
          "name": "schema-engine-debian-openssl-1.0.x",
          "size": 22134072,
        },
        {
          "name": "schema-engine-debian-openssl-1.1.x",
          "size": 19429976,
        },
        {
          "name": "schema-engine-debian-openssl-3.0.x",
          "size": 19431056,
        },
        {
          "name": "schema-engine-linux-arm64-openssl-1.0.x",
          "size": 21452576,
        },
        {
          "name": "schema-engine-linux-arm64-openssl-1.1.x",
          "size": 22209360,
        },
        {
          "name": "schema-engine-linux-arm64-openssl-3.0.x",
          "size": 23881336,
        },
        {
          "name": "schema-engine-linux-musl",
          "size": 19048032,
        },
        {
          "name": "schema-engine-linux-musl-arm64-openssl-1.1.x",
          "size": 22547392,
        },
        {
          "name": "schema-engine-linux-musl-arm64-openssl-3.0.x",
          "size": 24277336,
        },
        {
          "name": "schema-engine-linux-musl-openssl-3.0.x",
          "size": 19325664,
        },
        {
          "name": "schema-engine-rhel-openssl-1.0.x",
          "size": 22134072,
        },
        {
          "name": "schema-engine-rhel-openssl-1.1.x",
          "size": 19429976,
        },
        {
          "name": "schema-engine-rhel-openssl-3.0.x",
          "size": 19431056,
        },
        {
          "name": "schema-engine-windows.exe",
          "size": 15719424,
        },
      ]
    `)

    expect(await getVersion(queryEnginePath, BinaryType.QueryEngineBinary)).toMatchInlineSnapshot(
      `"query-engine 72a818438fbeb692961516daebf61ab86af03011"`,
    )
    expect(await getVersion(schemaEnginePath, BinaryType.SchemaEngineBinary)).toMatchInlineSnapshot(
      `"schema-engine-cli 72a818438fbeb692961516daebf61ab86af03011"`,
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
        'schema-engine': baseDir,
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
        'schema-engine': baseDir,
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

    expect(await getVersion(targetPath, BinaryType.QueryEngineBinary)).not.toBe(undefined)
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
      version: FIXED_ENGINES_HASH,
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
      version: FIXED_ENGINES_HASH,
      binaryTargets: ['marvin'] as any, // eslint-disable-line @typescript-eslint/no-explicit-any
    })
    expect(testResult['query-engine']!['marvin']).toEqual(targetPath)
  })
})
