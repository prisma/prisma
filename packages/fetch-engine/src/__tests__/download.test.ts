import fs from 'fs'
import path from 'path'
import { download, getBinaryName, checkVersionCommand, getVersion } from '../download'
import { getPlatform } from '@prisma/get-platform'
import { cleanupCache } from '../cleanupCache'
import del from 'del'

jest.setTimeout(30000)

describe('download', () => {
  beforeAll(async () => {
    // completely clean up the cache and keep nothing
    await cleanupCache(0)
    await del(__dirname + '/**/*engine*')
  })

  test('basic download', async () => {
    const platform = await getPlatform()
    const queryEnginePath = path.join(__dirname, getBinaryName('query-engine', platform))
    const introspectionEnginePath = path.join(__dirname, getBinaryName('introspection-engine', platform))
    const migrationEnginePath = path.join(__dirname, getBinaryName('migration-engine', platform))

    await download({
      binaries: {
        'query-engine': __dirname,
        'introspection-engine': __dirname,
        'migration-engine': __dirname,
      },
      version: '89d2f3b0657ca867ba684e9fc85643713c21ab3e',
    })

    expect(await getVersion(queryEnginePath)).toMatchInlineSnapshot(`"prisma 89d2f3b0657ca867ba684e9fc85643713c21ab3e"`)
    expect(await getVersion(introspectionEnginePath)).toMatchInlineSnapshot(
      `"introspection-core 89d2f3b0657ca867ba684e9fc85643713c21ab3e"`,
    )
    expect(await getVersion(migrationEnginePath)).toMatchInlineSnapshot(
      `"migration-engine-cli 89d2f3b0657ca867ba684e9fc85643713c21ab3e"`,
    )
  })

  test('auto heal corrupt binary', async () => {
    const platform = await getPlatform()
    const baseDir = path.join(__dirname, 'corruption')
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
      version: '89d2f3b0657ca867ba684e9fc85643713c21ab3e',
    })

    fs.writeFileSync(targetPath, 'incorrect-binary')

    // please heal it
    await download({
      binaries: {
        'query-engine': baseDir,
      },
      version: '89d2f3b0657ca867ba684e9fc85643713c21ab3e',
    })

    expect(fs.existsSync(targetPath)).toBe(true)

    expect(await checkVersionCommand(targetPath)).toBe(true)
  })

  test('handle non-existent binary target', async () => {
    expect(
      download({
        binaries: {
          'query-engine': __dirname,
        },
        version: '89d2f3b0657ca867ba684e9fc85643713c21ab3e',
        binaryTargets: ['darwin', 'marvin'] as any,
      }),
    ).rejects.toThrowErrorMatchingInlineSnapshot(`"Unknown binaryTargets marvin"`)
  })

  test('download all binaries & cache them', async () => {
    const baseDir = path.join(__dirname, 'all')
    await download({
      binaries: {
        'query-engine': baseDir,
        'introspection-engine': baseDir,
        'migration-engine': baseDir,
      },
      binaryTargets: [
        'darwin',
        'debian-openssl-1.0.x',
        'debian-openssl-1.1.x',
        'rhel-openssl-1.0.x',
        'rhel-openssl-1.1.x',
        'windows',
      ],
      version: '89d2f3b0657ca867ba684e9fc85643713c21ab3e',
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
          "size": 11090832,
        },
        Object {
          "name": "introspection-engine-debian-openssl-1.0.x",
          "size": 13999072,
        },
        Object {
          "name": "introspection-engine-debian-openssl-1.1.x",
          "size": 13972712,
        },
        Object {
          "name": "introspection-engine-rhel-openssl-1.0.x",
          "size": 14039682,
        },
        Object {
          "name": "introspection-engine-rhel-openssl-1.1.x",
          "size": 14019211,
        },
        Object {
          "name": "introspection-engine-windows.exe",
          "size": 23002804,
        },
        Object {
          "name": "migration-engine-darwin",
          "size": 14750152,
        },
        Object {
          "name": "migration-engine-debian-openssl-1.0.x",
          "size": 17889208,
        },
        Object {
          "name": "migration-engine-debian-openssl-1.1.x",
          "size": 17861560,
        },
        Object {
          "name": "migration-engine-rhel-openssl-1.0.x",
          "size": 17946296,
        },
        Object {
          "name": "migration-engine-rhel-openssl-1.1.x",
          "size": 17924474,
        },
        Object {
          "name": "migration-engine-windows.exe",
          "size": 27743315,
        },
        Object {
          "name": "query-engine-darwin",
          "size": 16480952,
        },
        Object {
          "name": "query-engine-debian-openssl-1.0.x",
          "size": 19818032,
        },
        Object {
          "name": "query-engine-debian-openssl-1.1.x",
          "size": 19791296,
        },
        Object {
          "name": "query-engine-rhel-openssl-1.0.x",
          "size": 19858342,
        },
        Object {
          "name": "query-engine-rhel-openssl-1.1.x",
          "size": 19837433,
        },
        Object {
          "name": "query-engine-windows.exe",
          "size": 30064710,
        },
      ]
    `)
    await del(baseDir + '/*engine*')
    const before = Date.now()
    await download({
      binaries: {
        'query-engine': baseDir,
        'introspection-engine': baseDir,
        'migration-engine': baseDir,
      },
      binaryTargets: [
        'darwin',
        'debian-openssl-1.0.x',
        'debian-openssl-1.1.x',
        'rhel-openssl-1.0.x',
        'rhel-openssl-1.1.x',
        'windows',
      ],
      version: '89d2f3b0657ca867ba684e9fc85643713c21ab3e',
    })
    const after = Date.now()
    // cache should take less than 2s
    // value on Mac: 1440
    expect(after - before).toBeLessThan(2000)
    const before2 = Date.now()
    await download({
      binaries: {
        'query-engine': baseDir,
        'introspection-engine': baseDir,
        'migration-engine': baseDir,
      },
      binaryTargets: [
        'darwin',
        'debian-openssl-1.0.x',
        'debian-openssl-1.1.x',
        'rhel-openssl-1.0.x',
        'rhel-openssl-1.1.x',
        'windows',
      ],
      version: '89d2f3b0657ca867ba684e9fc85643713c21ab3e',
    })
    const after2 = Date.now()
    // if binaries are already there, it should take less than 100ms to check all of them
    // value on Mac: 33ms
    expect(after2 - before2).toBeLessThan(1000)
  })
})

function getFiles(dir: string): Array<{ name: string; size: number }> {
  const files = fs.readdirSync(dir, 'utf8')
  return files.map(name => {
    const size = fs.statSync(path.join(dir, name)).size

    return { name, size }
  })
}
