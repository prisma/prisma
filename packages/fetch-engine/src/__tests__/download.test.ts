import { enginesVersion } from '@prisma/engines-version'
import { getPlatform } from '@prisma/get-platform'
import del from 'del'
import fs from 'fs'
import path from 'path'
import stripAnsi from 'strip-ansi'

import { cleanupCache } from '../cleanupCache'
import { checkVersionCommand, download, getEngineFileName, getVersion } from '../download'
import { getFiles } from './__utils__/getFiles'

const CURRENT_ENGINES_HASH = enginesVersion

const FIXED_ENGINES_HASH = 'a10084a836a379babc008c28b143dc1c7e644453'

jest.setTimeout(120_000)

describe('download', () => {
  beforeEach(async () => {
    // completely clean up the cache and keep nothing
    await cleanupCache(0)
    await del(__dirname + '/**/*engine*')
    await del(__dirname + '/**/prisma-fmt*')
  })
  afterEach(() => delete process.env.PRISMA_QUERY_ENGINE_BINARY)
  test('basic download', async () => {
    const platform = await getPlatform()
    const queryEnginePath = path.join(__dirname, getEngineFileName('query-engine', platform))
    const introspectionEnginePath = path.join(__dirname, getEngineFileName('introspection-engine', platform))
    const migrationEnginePath = path.join(__dirname, getEngineFileName('migration-engine', platform))
    const prismafmtPath = path.join(__dirname, getEngineFileName('prisma-fmt', platform))

    await download({
      engines: {
        'query-engine': __dirname,
        'introspection-engine': __dirname,
        'migration-engine': __dirname,
        'prisma-fmt': __dirname,
      },
      version: FIXED_ENGINES_HASH,
    })

    expect(await getVersion(queryEnginePath)).toMatchInlineSnapshot(
      `"query-engine a10084a836a379babc008c28b143dc1c7e644453"`,
    )
    expect(await getVersion(introspectionEnginePath)).toMatchInlineSnapshot(
      `"introspection-core a10084a836a379babc008c28b143dc1c7e644453"`,
    )
    expect(await getVersion(migrationEnginePath)).toMatchInlineSnapshot(
      `"migration-engine-cli a10084a836a379babc008c28b143dc1c7e644453"`,
    )
    expect(await getVersion(prismafmtPath)).toMatchInlineSnapshot(
      `"prisma-fmt a10084a836a379babc008c28b143dc1c7e644453"`,
    )
  })

  test('basic download all current engines', async () => {
    const platform = await getPlatform()
    const queryEnginePath = path.join(__dirname, getEngineFileName('query-engine', platform))
    const introspectionEnginePath = path.join(__dirname, getEngineFileName('introspection-engine', platform))
    const migrationEnginePath = path.join(__dirname, getEngineFileName('migration-engine', platform))
    const prismafmtPath = path.join(__dirname, getEngineFileName('prisma-fmt', platform))

    await download({
      engines: {
        'query-engine': __dirname,
        'introspection-engine': __dirname,
        'migration-engine': __dirname,
        'prisma-fmt': __dirname,
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
      ],
      version: CURRENT_ENGINES_HASH,
    })

    // Check that all engines' git hashes are the same
    expect(await getVersion(queryEnginePath)).toContain(CURRENT_ENGINES_HASH)
    expect(await getVersion(introspectionEnginePath)).toContain(CURRENT_ENGINES_HASH)
    expect(await getVersion(migrationEnginePath)).toContain(CURRENT_ENGINES_HASH)
    expect(await getVersion(prismafmtPath)).toContain(CURRENT_ENGINES_HASH)
  })

  test('auto heal corrupt engine file', async () => {
    const platform = await getPlatform()
    const baseDir = path.join(__dirname, 'corruption')
    const targetPath = path.join(baseDir, getEngineFileName('query-engine', platform))
    if (fs.existsSync(targetPath)) {
      try {
        fs.unlinkSync(targetPath)
      } catch (e) {
        console.error(e)
      }
    }

    await download({
      engines: {
        'query-engine': baseDir,
      },
      version: FIXED_ENGINES_HASH,
    })

    fs.writeFileSync(targetPath, 'incorrect-binary') // TODO

    // please heal it
    await download({
      engines: {
        'query-engine': baseDir,
      },
      version: FIXED_ENGINES_HASH,
    })

    expect(fs.existsSync(targetPath)).toBe(true)

    expect(await checkVersionCommand(targetPath)).toBe(true)
  })

  test('handle non-existent binaryTarget', async () => {
    await expect(
      download({
        engines: {
          'query-engine': __dirname,
        },
        version: FIXED_ENGINES_HASH,
        binaryTargets: ['darwin', 'marvin'] as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      }),
    ).rejects.toThrowErrorMatchingInlineSnapshot(
      `"Unknown binaryTarget marvin and no custom engine files were provided"`,
    )
  })

  test('handle non-existent binaryTarget with missing custom engines', async () => {
    expect.assertions(1)
    process.env.PRISMA_QUERY_ENGINE_BINARY = '../query-engine'
    try {
      await download({
        engines: {
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

  test('handle non-existent binaryTarget with custom engines', async () => {
    const e = await download({
      engines: {
        'query-engine': __dirname,
      },
    })
    const dummyPath = e['query-engine']![Object.keys(e['query-engine']!)[0]]!
    const targetPath = path.join(
      __dirname,
      // @ts-ignore
      getEngineFileName('query-engine', 'marvin'),
    )
    fs.copyFileSync(dummyPath, targetPath)
    process.env.PRISMA_QUERY_ENGINE_BINARY = targetPath

    const testResult = await download({
      engines: {
        'query-engine': path.join(__dirname, 'all'),
      },
      binaryTargets: ['marvin'] as any, // eslint-disable-line @typescript-eslint/no-explicit-any
    })
    expect(testResult['query-engine']!['marvin']).toEqual(targetPath)
  })

  test('download all engines & cache them', async () => {
    const baseDir = path.join(__dirname, 'all')

    const before0 = Date.now()
    await download({
      engines: {
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
      Array [
        Object {
          "name": ".gitkeep",
          "size": 0,
        },
        Object {
          "name": "introspection-engine-darwin",
          "size": 24650392,
        },
        Object {
          "name": "introspection-engine-darwin-arm64",
          "size": 22623570,
        },
        Object {
          "name": "introspection-engine-debian-openssl-1.0.x",
          "size": 32763352,
        },
        Object {
          "name": "introspection-engine-debian-openssl-1.1.x",
          "size": 30046976,
        },
        Object {
          "name": "introspection-engine-debian-openssl-3.0.x",
          "size": 30042880,
        },
        Object {
          "name": "introspection-engine-linux-arm64-openssl-1.0.x",
          "size": 30636624,
        },
        Object {
          "name": "introspection-engine-linux-arm64-openssl-1.1.x",
          "size": 31171104,
        },
        Object {
          "name": "introspection-engine-linux-arm64-openssl-3.0.x",
          "size": 33032912,
        },
        Object {
          "name": "introspection-engine-linux-musl",
          "size": 31989408,
        },
        Object {
          "name": "introspection-engine-rhel-openssl-1.0.x",
          "size": 32733872,
        },
        Object {
          "name": "introspection-engine-rhel-openssl-1.1.x",
          "size": 30042240,
        },
        Object {
          "name": "introspection-engine-rhel-openssl-3.0.x",
          "size": 30041920,
        },
        Object {
          "name": "introspection-engine-windows.exe",
          "size": 21052928,
        },
        Object {
          "name": "migration-engine-darwin",
          "size": 27220536,
        },
        Object {
          "name": "migration-engine-darwin-arm64",
          "size": 24909118,
        },
        Object {
          "name": "migration-engine-debian-openssl-1.0.x",
          "size": 33050208,
        },
        Object {
          "name": "migration-engine-debian-openssl-1.1.x",
          "size": 33022816,
        },
        Object {
          "name": "migration-engine-debian-openssl-3.0.x",
          "size": 33022816,
        },
        Object {
          "name": "migration-engine-linux-arm64-openssl-1.0.x",
          "size": 33031376,
        },
        Object {
          "name": "migration-engine-linux-arm64-openssl-1.1.x",
          "size": 33776744,
        },
        Object {
          "name": "migration-engine-linux-arm64-openssl-3.0.x",
          "size": 35630536,
        },
        Object {
          "name": "migration-engine-linux-musl",
          "size": 34831568,
        },
        Object {
          "name": "migration-engine-rhel-openssl-1.0.x",
          "size": 33030584,
        },
        Object {
          "name": "migration-engine-rhel-openssl-1.1.x",
          "size": 33017984,
        },
        Object {
          "name": "migration-engine-rhel-openssl-3.0.x",
          "size": 33017464,
        },
        Object {
          "name": "migration-engine-windows.exe",
          "size": 23660544,
        },
        Object {
          "name": "prisma-fmt-darwin",
          "size": 4830720,
        },
        Object {
          "name": "prisma-fmt-darwin-arm64",
          "size": 4487528,
        },
        Object {
          "name": "prisma-fmt-debian-openssl-1.0.x",
          "size": 9253888,
        },
        Object {
          "name": "prisma-fmt-debian-openssl-1.1.x",
          "size": 9253880,
        },
        Object {
          "name": "prisma-fmt-debian-openssl-3.0.x",
          "size": 9253880,
        },
        Object {
          "name": "prisma-fmt-linux-arm64-openssl-1.0.x",
          "size": 9126736,
        },
        Object {
          "name": "prisma-fmt-linux-arm64-openssl-1.1.x",
          "size": 9126720,
        },
        Object {
          "name": "prisma-fmt-linux-arm64-openssl-3.0.x",
          "size": 9126720,
        },
        Object {
          "name": "prisma-fmt-linux-musl",
          "size": 8856840,
        },
        Object {
          "name": "prisma-fmt-rhel-openssl-1.0.x",
          "size": 9253704,
        },
        Object {
          "name": "prisma-fmt-rhel-openssl-1.1.x",
          "size": 9253688,
        },
        Object {
          "name": "prisma-fmt-rhel-openssl-3.0.x",
          "size": 9253688,
        },
        Object {
          "name": "prisma-fmt-windows.exe",
          "size": 3839488,
        },
        Object {
          "name": "query-engine-darwin",
          "size": 36528712,
        },
        Object {
          "name": "query-engine-darwin-arm64",
          "size": 33495274,
        },
        Object {
          "name": "query-engine-debian-openssl-1.0.x",
          "size": 44315040,
        },
        Object {
          "name": "query-engine-debian-openssl-1.1.x",
          "size": 44277288,
        },
        Object {
          "name": "query-engine-debian-openssl-3.0.x",
          "size": 44276592,
        },
        Object {
          "name": "query-engine-linux-arm64-openssl-1.0.x",
          "size": 43422656,
        },
        Object {
          "name": "query-engine-linux-arm64-openssl-1.1.x",
          "size": 44142632,
        },
        Object {
          "name": "query-engine-linux-arm64-openssl-3.0.x",
          "size": 45996360,
        },
        Object {
          "name": "query-engine-linux-musl",
          "size": 45587904,
        },
        Object {
          "name": "query-engine-rhel-openssl-1.0.x",
          "size": 44291688,
        },
        Object {
          "name": "query-engine-rhel-openssl-1.1.x",
          "size": 44272184,
        },
        Object {
          "name": "query-engine-rhel-openssl-3.0.x",
          "size": 44271560,
        },
        Object {
          "name": "query-engine-windows.exe",
          "size": 33288704,
        },
      ]
    `)

    //
    // Cache test 1
    // 1- We delete the artifacts locally but not from the cache folder
    // 2- We measure how much time it takes to call download
    //

    // Delete all artifacts
    await del(baseDir + '/*engine*')
    await del(baseDir + '/prisma-fmt*')

    const before = Date.now()
    await download({
      engines: {
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
      engines: {
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
    expect(timeInMsToDownloadAllFromCache1).toBeLessThan(40_000)
    expect(timeInMsToDownloadAllFromCache2).toBeLessThan(40_000)

    // Using cache should be faster
    expect(timeInMsToDownloadAllFromCache1).toBeLessThan(timeInMsToDownloadAll)
    expect(timeInMsToDownloadAllFromCache2).toBeLessThan(timeInMsToDownloadAllFromCache1)
  })
})
