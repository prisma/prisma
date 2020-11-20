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

const CURRENT_BINARIES_HASH = enginesVersion
// From npx @prisma/cli@2.6.2 -v
const FIXED_BINARIES_HASH = '6a8054bb549e4cc23f157b0010cb2e95cb2637fb'

jest.setTimeout(40000)

describe('download', () => {
  beforeEach(async () => {
    // completely clean up the cache and keep nothing
    await cleanupCache(0)
    await del(__dirname + '/**/*engine*')
    await del(__dirname + '/**/prisma-fmt*')
  })

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
      `"query-engine 6a8054bb549e4cc23f157b0010cb2e95cb2637fb"`,
    )
    expect(await getVersion(introspectionEnginePath)).toMatchInlineSnapshot(
      `"introspection-core 6a8054bb549e4cc23f157b0010cb2e95cb2637fb"`,
    )
    expect(await getVersion(migrationEnginePath)).toMatchInlineSnapshot(
      `"migration-engine-cli 6a8054bb549e4cc23f157b0010cb2e95cb2637fb"`,
    )
    expect(await getVersion(prismafmtPath)).toMatchInlineSnapshot(
      `"prisma-fmt 6a8054bb549e4cc23f157b0010cb2e95cb2637fb"`,
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

  test('download all binaries & cache them', async () => {
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
          "size": 13654588,
        },
        Object {
          "name": "introspection-engine-debian-openssl-1.0.x",
          "size": 17114264,
        },
        Object {
          "name": "introspection-engine-debian-openssl-1.1.x",
          "size": 17071616,
        },
        Object {
          "name": "introspection-engine-linux-musl",
          "size": 20131616,
        },
        Object {
          "name": "introspection-engine-rhel-openssl-1.0.x",
          "size": 21695177,
        },
        Object {
          "name": "introspection-engine-rhel-openssl-1.1.x",
          "size": 21657907,
        },
        Object {
          "name": "introspection-engine-windows.exe",
          "size": 12869120,
        },
        Object {
          "name": "migration-engine-darwin",
          "size": 16952076,
        },
        Object {
          "name": "migration-engine-debian-openssl-1.0.x",
          "size": 20608504,
        },
        Object {
          "name": "migration-engine-debian-openssl-1.1.x",
          "size": 20551480,
        },
        Object {
          "name": "migration-engine-linux-musl",
          "size": 23450000,
        },
        Object {
          "name": "migration-engine-rhel-openssl-1.0.x",
          "size": 25197164,
        },
        Object {
          "name": "migration-engine-rhel-openssl-1.1.x",
          "size": 25145997,
        },
        Object {
          "name": "migration-engine-windows.exe",
          "size": 17848832,
        },
        Object {
          "name": "prisma-fmt-darwin",
          "size": 3495624,
        },
        Object {
          "name": "prisma-fmt-debian-openssl-1.0.x",
          "size": 6422336,
        },
        Object {
          "name": "prisma-fmt-debian-openssl-1.1.x",
          "size": 6422040,
        },
        Object {
          "name": "prisma-fmt-linux-musl",
          "size": 6634968,
        },
        Object {
          "name": "prisma-fmt-rhel-openssl-1.0.x",
          "size": 11003362,
        },
        Object {
          "name": "prisma-fmt-rhel-openssl-1.1.x",
          "size": 11009032,
        },
        Object {
          "name": "prisma-fmt-windows.exe",
          "size": 4533248,
        },
        Object {
          "name": "query-engine-darwin",
          "size": 18761708,
        },
        Object {
          "name": "query-engine-debian-openssl-1.0.x",
          "size": 22616208,
        },
        Object {
          "name": "query-engine-debian-openssl-1.1.x",
          "size": 22596112,
        },
        Object {
          "name": "query-engine-linux-musl",
          "size": 25430272,
        },
        Object {
          "name": "query-engine-rhel-openssl-1.0.x",
          "size": 27195733,
        },
        Object {
          "name": "query-engine-rhel-openssl-1.1.x",
          "size": 27181162,
        },
        Object {
          "name": "query-engine-windows.exe",
          "size": 18057728,
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
    expect(took).toBeLessThan(10000)
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
    expect(took2).toBeLessThan(6000)
  })
})

function getFiles(dir: string): Array<{ name: string; size: number }> {
  const files = fs.readdirSync(dir, 'utf8')
  return files.map((name) => {
    const size = fs.statSync(path.join(dir, name)).size

    return { name, size }
  })
}
