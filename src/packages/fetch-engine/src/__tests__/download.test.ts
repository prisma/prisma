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
import del from 'del'

const CURRENT_BINARIES_HASH = require('../../../sdk/package.json').prisma
  .version
const FIXED_BINARIES_HASH = '6c777331554df4c3e0a90dd841339c7b0619d0e1'

jest.setTimeout(30000)

describe('download', () => {
  beforeAll(async () => {
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
      `"query-engine 6c777331554df4c3e0a90dd841339c7b0619d0e1"`,
    )
    expect(await getVersion(introspectionEnginePath)).toMatchInlineSnapshot(
      `"introspection-core 6c777331554df4c3e0a90dd841339c7b0619d0e1"`,
    )
    expect(await getVersion(migrationEnginePath)).toMatchInlineSnapshot(
      `"migration-engine-cli 6c777331554df4c3e0a90dd841339c7b0619d0e1"`,
    )
    expect(await getVersion(prismafmtPath)).toMatchInlineSnapshot(
      `"prisma-fmt 6c777331554df4c3e0a90dd841339c7b0619d0e1"`,
    )
  })

  test('basic download all current binaries', async () => {
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
        'freebsd12',
      ],
      version: CURRENT_BINARIES_HASH,
    })
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
      `"Unknown binaryTargets marvin"`,
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
        'freebsd12',
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
          "size": 13828044,
        },
        Object {
          "name": "introspection-engine-debian-openssl-1.0.x",
          "size": 17351776,
        },
        Object {
          "name": "introspection-engine-debian-openssl-1.1.x",
          "size": 17317424,
        },
        Object {
          "name": "introspection-engine-freebsd12",
          "size": 16797120,
        },
        Object {
          "name": "introspection-engine-linux-musl",
          "size": 20163912,
        },
        Object {
          "name": "introspection-engine-rhel-openssl-1.0.x",
          "size": 21922926,
        },
        Object {
          "name": "introspection-engine-rhel-openssl-1.1.x",
          "size": 21890064,
        },
        Object {
          "name": "introspection-engine-windows.exe",
          "size": 12641280,
        },
        Object {
          "name": "migration-engine-darwin",
          "size": 17214132,
        },
        Object {
          "name": "migration-engine-debian-openssl-1.0.x",
          "size": 20935840,
        },
        Object {
          "name": "migration-engine-debian-openssl-1.1.x",
          "size": 20910448,
        },
        Object {
          "name": "migration-engine-freebsd12",
          "size": 20265640,
        },
        Object {
          "name": "migration-engine-linux-musl",
          "size": 23589824,
        },
        Object {
          "name": "migration-engine-rhel-openssl-1.0.x",
          "size": 25519204,
        },
        Object {
          "name": "migration-engine-rhel-openssl-1.1.x",
          "size": 25499443,
        },
        Object {
          "name": "migration-engine-windows.exe",
          "size": 16844288,
        },
        Object {
          "name": "prisma-fmt-darwin",
          "size": 3295680,
        },
        Object {
          "name": "prisma-fmt-debian-openssl-1.0.x",
          "size": 6205336,
        },
        Object {
          "name": "prisma-fmt-debian-openssl-1.1.x",
          "size": 6205056,
        },
        Object {
          "name": "prisma-fmt-freebsd12",
          "size": 5987088,
        },
        Object {
          "name": "prisma-fmt-linux-musl",
          "size": 6248256,
        },
        Object {
          "name": "prisma-fmt-rhel-openssl-1.0.x",
          "size": 10755506,
        },
        Object {
          "name": "prisma-fmt-rhel-openssl-1.1.x",
          "size": 10757880,
        },
        Object {
          "name": "prisma-fmt-windows.exe",
          "size": 4321280,
        },
        Object {
          "name": "query-engine-darwin",
          "size": 18784360,
        },
        Object {
          "name": "query-engine-debian-openssl-1.0.x",
          "size": 22668136,
        },
        Object {
          "name": "query-engine-debian-openssl-1.1.x",
          "size": 22637248,
        },
        Object {
          "name": "query-engine-freebsd12",
          "size": 21965792,
        },
        Object {
          "name": "query-engine-linux-musl",
          "size": 25313248,
        },
        Object {
          "name": "query-engine-rhel-openssl-1.0.x",
          "size": 27218536,
        },
        Object {
          "name": "query-engine-rhel-openssl-1.1.x",
          "size": 27189132,
        },
        Object {
          "name": "query-engine-windows.exe",
          "size": 17725952,
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
    expect(after - before).toBeLessThan(4000)
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
        'freebsd12',
      ],
      version: FIXED_BINARIES_HASH,
    })
    const after2 = Date.now()
    // if binaries are already there, it should take less than 100ms to check all of them
    // value on Mac: 33ms
    expect(after2 - before2).toBeLessThan(3500)
  })
})

function getFiles(dir: string): Array<{ name: string; size: number }> {
  const files = fs.readdirSync(dir, 'utf8')
  return files.map((name) => {
    const size = fs.statSync(path.join(dir, name)).size

    return { name, size }
  })
}
