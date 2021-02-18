import fs from 'fs'
import path from 'path'
import {
  download,
  getBinaryName,
  checkVersionCommand,
  getVersion,
} from '../download'
import { getPlatform } from '@prisma/get-platform'
import { cleanupCache } from '../cleanupCache'
import { enginesVersion } from '@prisma/engines-version'
import del from 'del'
import stripAnsi from 'strip-ansi'

const CURRENT_BINARIES_HASH = enginesVersion
// From npx @prisma/cli@2.6.2 -v
const FIXED_BINARIES_HASH = '60c1d1e9396bf462eda7b97f8f65523bf65c9f5f'

jest.setTimeout(80000)

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
    const queryEnginePath = path.join(
      __dirname,
      getBinaryName('query-engine', platform),
    )
    const introspectionEnginePath = path.join(
      __dirname,
      getBinaryName('introspection-engine', platform),
    )
    const migrationEnginePath = path.join(
      __dirname,
      getBinaryName('migration-engine', platform),
    )
    const prismafmtPath = path.join(
      __dirname,
      getBinaryName('prisma-fmt', platform),
    )

    await download({
      binaries: {
        'query-engine': __dirname,
        'introspection-engine': __dirname,
        'migration-engine': __dirname,
        'prisma-fmt': __dirname,
      },
      version: FIXED_BINARIES_HASH,
    })

    expect(await getVersion(queryEnginePath)).toMatchInlineSnapshot(
      `"query-engine 60c1d1e9396bf462eda7b97f8f65523bf65c9f5f"`,
    )
    expect(await getVersion(introspectionEnginePath)).toMatchInlineSnapshot(
      `"introspection-core 60c1d1e9396bf462eda7b97f8f65523bf65c9f5f"`,
    )
    expect(await getVersion(migrationEnginePath)).toMatchInlineSnapshot(
      `"migration-engine-cli 60c1d1e9396bf462eda7b97f8f65523bf65c9f5f"`,
    )
    expect(await getVersion(prismafmtPath)).toMatchInlineSnapshot(
      `"prisma-fmt 60c1d1e9396bf462eda7b97f8f65523bf65c9f5f"`,
    )
  })

  test('basic download all current binaries', async () => {
    const platform = await getPlatform()
    const queryEnginePath = path.join(
      __dirname,
      getBinaryName('query-engine', platform),
    )
    const introspectionEnginePath = path.join(
      __dirname,
      getBinaryName('introspection-engine', platform),
    )
    const migrationEnginePath = path.join(
      __dirname,
      getBinaryName('migration-engine', platform),
    )
    const prismafmtPath = path.join(
      __dirname,
      getBinaryName('prisma-fmt', platform),
    )

    await download({
      binaries: {
        'query-engine': __dirname,
        'introspection-engine': __dirname,
        'migration-engine': __dirname,
        'prisma-fmt': __dirname,
      },
      binaryTargets: [
        'darwin',
        'debian-openssl-1.0.x',
        'debian-openssl-1.1.x',
        'linux-arm-openssl-1.0.x',
        'linux-arm-openssl-1.1.x',
        'rhel-openssl-1.0.x',
        'rhel-openssl-1.1.x',
        'windows',
        'linux-musl',
      ],
      version: CURRENT_BINARIES_HASH,
    })

    // Check that all binaries git hash are the same
    expect(await getVersion(queryEnginePath)).toContain(CURRENT_BINARIES_HASH)
    expect(await getVersion(introspectionEnginePath)).toContain(
      CURRENT_BINARIES_HASH,
    )
    expect(await getVersion(migrationEnginePath)).toContain(
      CURRENT_BINARIES_HASH,
    )
    expect(await getVersion(prismafmtPath)).toContain(CURRENT_BINARIES_HASH)
  })

  test('auto heal corrupt binary', async () => {
    const platform = await getPlatform()
    const baseDir = path.join(__dirname, 'corruption')
    const targetPath = path.join(
      baseDir,
      getBinaryName('query-engine', platform),
    )
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
      version: FIXED_BINARIES_HASH,
    })

    fs.writeFileSync(targetPath, 'incorrect-binary')

    // please heal it
    await download({
      binaries: {
        'query-engine': baseDir,
      },
      version: FIXED_BINARIES_HASH,
    })

    expect(fs.existsSync(targetPath)).toBe(true)

    expect(await checkVersionCommand(targetPath)).toBe(true)
  })

  test('handle non-existent binary target', async () => {
    await expect(
      download({
        binaries: {
          'query-engine': __dirname,
        },
        version: FIXED_BINARIES_HASH,
        binaryTargets: ['darwin', 'marvin'] as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      }),
    ).rejects.toThrowErrorMatchingInlineSnapshot(
      `"Unknown binaryTarget marvin and no custom binaries were provided"`,
    )
  })
  test.skip('handle non-existent binary target with missing custom binaries', async () => {
    expect.assertions(1)
    process.env.PRISMA_QUERY_ENGINE_BINARY = '../query-engine'
    try {
      await download({
        binaries: {
          'query-engine': __dirname,
        },
        version: FIXED_BINARIES_HASH,
        binaryTargets: ['darwin', 'marvin'] as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      })
    } catch (err) {
      expect(stripAnsi(err.message)).toMatchInlineSnapshot(
        `"Env var PRISMA_QUERY_ENGINE_BINARY is provided but provided path ../query-engine can't be resolved."`,
      )
    }
  })
  test.skip('handle non-existent binary target with custom binaries', async () => {
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
  test.skip('download all binaries & cache them', async () => {
    const baseDir = path.join(__dirname, 'all')
    await download({
      binaries: {
        'query-engine': baseDir,
        'introspection-engine': baseDir,
        'migration-engine': baseDir,
        'prisma-fmt': baseDir,
      },
      binaryTargets: [
        'darwin',
        'debian-openssl-1.0.x',
        'debian-openssl-1.1.x',
        'linux-arm-openssl-1.0.x',
        'linux-arm-openssl-1.1.x',
        'rhel-openssl-1.0.x',
        'rhel-openssl-1.1.x',
        'windows',
        'linux-musl',
      ],
      version: FIXED_BINARIES_HASH,
    })
    const files = getFiles(baseDir)
    expect(files).toMatchInlineSnapshot(`
      Array [
        Object {
          "name": ".gitkeep",
          "size": 0,
        },
        Object {
          "name": "introspection-engine-darwin",
          "size": 14441124,
        },
        Object {
          "name": "introspection-engine-debian-openssl-1.0.x",
          "size": 18215968,
        },
        Object {
          "name": "introspection-engine-debian-openssl-1.1.x",
          "size": 18193328,
        },
        Object {
          "name": "introspection-engine-linux-arm-openssl-1.0.x",
          "size": 19738920,
        },
        Object {
          "name": "introspection-engine-linux-arm-openssl-1.1.x",
          "size": 20491832,
        },
        Object {
          "name": "introspection-engine-linux-musl",
          "size": 20329048,
        },
        Object {
          "name": "introspection-engine-rhel-openssl-1.0.x",
          "size": 21896007,
        },
        Object {
          "name": "introspection-engine-rhel-openssl-1.1.x",
          "size": 21875399,
        },
        Object {
          "name": "introspection-engine-windows.exe",
          "size": 12485632,
        },
        Object {
          "name": "migration-engine-darwin",
          "size": 18975644,
        },
        Object {
          "name": "migration-engine-debian-openssl-1.0.x",
          "size": 23028784,
        },
        Object {
          "name": "migration-engine-debian-openssl-1.1.x",
          "size": 23033760,
        },
        Object {
          "name": "migration-engine-linux-arm-openssl-1.0.x",
          "size": 23981944,
        },
        Object {
          "name": "migration-engine-linux-arm-openssl-1.1.x",
          "size": 24759784,
        },
        Object {
          "name": "migration-engine-linux-musl",
          "size": 24931256,
        },
        Object {
          "name": "migration-engine-rhel-openssl-1.0.x",
          "size": 26791914,
        },
        Object {
          "name": "migration-engine-rhel-openssl-1.1.x",
          "size": 26760749,
        },
        Object {
          "name": "migration-engine-windows.exe",
          "size": 16921088,
        },
        Object {
          "name": "prisma-fmt-darwin",
          "size": 4079652,
        },
        Object {
          "name": "prisma-fmt-debian-openssl-1.0.x",
          "size": 7340056,
        },
        Object {
          "name": "prisma-fmt-debian-openssl-1.1.x",
          "size": 7340056,
        },
        Object {
          "name": "prisma-fmt-linux-arm-openssl-1.0.x",
          "size": 7164168,
        },
        Object {
          "name": "prisma-fmt-linux-arm-openssl-1.1.x",
          "size": 7164168,
        },
        Object {
          "name": "prisma-fmt-linux-musl",
          "size": 6943176,
        },
        Object {
          "name": "prisma-fmt-rhel-openssl-1.0.x",
          "size": 11292208,
        },
        Object {
          "name": "prisma-fmt-rhel-openssl-1.1.x",
          "size": 11292208,
        },
        Object {
          "name": "prisma-fmt-windows.exe",
          "size": 3368448,
        },
        Object {
          "name": "query-engine-darwin",
          "size": 20634380,
        },
        Object {
          "name": "query-engine-debian-openssl-1.0.x",
          "size": 24912272,
        },
        Object {
          "name": "query-engine-debian-openssl-1.1.x",
          "size": 24889272,
        },
        Object {
          "name": "query-engine-linux-arm-openssl-1.0.x",
          "size": 25714016,
        },
        Object {
          "name": "query-engine-linux-arm-openssl-1.1.x",
          "size": 26463072,
        },
        Object {
          "name": "query-engine-linux-musl",
          "size": 26741432,
        },
        Object {
          "name": "query-engine-rhel-openssl-1.0.x",
          "size": 28520235,
        },
        Object {
          "name": "query-engine-rhel-openssl-1.1.x",
          "size": 28500195,
        },
        Object {
          "name": "query-engine-windows.exe",
          "size": 18685440,
        },
      ]
    `)
    await del(baseDir + '/*engine*')
    await del(baseDir + '/prisma-fmt*')
    const before = Date.now()
    await download({
      binaries: {
        'query-engine': baseDir,
        'introspection-engine': baseDir,
        'migration-engine': baseDir,
        'prisma-fmt': baseDir,
      },
      binaryTargets: [
        'darwin',
        'debian-openssl-1.0.x',
        'debian-openssl-1.1.x',
        'linux-arm-openssl-1.0.x',
        'linux-arm-openssl-1.1.x',
        'rhel-openssl-1.0.x',
        'rhel-openssl-1.1.x',
        'windows',
        'linux-musl',
      ],
      version: FIXED_BINARIES_HASH,
    })
    const after = Date.now()
    // cache should take less than 2s
    // value on Mac: 1440
    // value on GH Actions: ~5812
    const took = after - before
    expect(took).toBeLessThan(20000)
    const before2 = Date.now()
    await download({
      binaries: {
        'query-engine': baseDir,
        'introspection-engine': baseDir,
        'migration-engine': baseDir,
        'prisma-fmt': baseDir,
      },
      binaryTargets: [
        'darwin',
        'debian-openssl-1.0.x',
        'debian-openssl-1.1.x',
        'linux-arm-openssl-1.0.x',
        'linux-arm-openssl-1.1.x',
        'rhel-openssl-1.0.x',
        'rhel-openssl-1.1.x',
        'windows',
        'linux-musl',
      ],
      version: FIXED_BINARIES_HASH,
    })
    const after2 = Date.now()
    // value on Mac: 33ms
    // value on GH Actions: ?
    // https://github.com/prisma/prisma/runs/1176632754
    const took2 = after2 - before2
    expect(took2).toBeLessThan(10000)
  })
})

function getFiles(dir: string): Array<{ name: string; size: number }> {
  const files = fs.readdirSync(dir, 'utf8')
  return files.map((name) => {
    const size = fs.statSync(path.join(dir, name)).size

    return { name, size }
  })
}
