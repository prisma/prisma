import fs from 'fs'
import path from 'path'
import { download, getBinaryName, checkVersionCommand, getVersion } from '../download'
import { getPlatform } from '@prisma/get-platform'
import { cleanupCache } from '../cleanupCache'
import del from 'del'

jest.setTimeout(20000)

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
      version: 'a78fee833bcf4e202645e7cc7df5c3839f658e6a',
    })

    expect(await getVersion(queryEnginePath)).toMatchInlineSnapshot(`"prisma a78fee833bcf4e202645e7cc7df5c3839f658e6a"`)
    expect(await getVersion(introspectionEnginePath)).toMatchInlineSnapshot(
      `"a78fee833bcf4e202645e7cc7df5c3839f658e6a"`,
    )
    expect(await getVersion(migrationEnginePath)).toMatchInlineSnapshot(`"a78fee833bcf4e202645e7cc7df5c3839f658e6a"`)
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
      version: 'd20d1e6b1525ae45e3cc39784ad16c97d463f61c',
    })

    fs.writeFileSync(targetPath, 'incorrect-binary')

    // please heal it
    await download({
      binaries: {
        'query-engine': baseDir,
      },
      version: 'd20d1e6b1525ae45e3cc39784ad16c97d463f61c',
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
        version: 'd20d1e6b1525ae45e3cc39784ad16c97d463f61c',
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
      version: 'd20d1e6b1525ae45e3cc39784ad16c97d463f61c',
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
          "size": 10818024,
        },
        Object {
          "name": "introspection-engine-debian-openssl-1.0.x",
          "size": 13686432,
        },
        Object {
          "name": "introspection-engine-debian-openssl-1.1.x",
          "size": 13672616,
        },
        Object {
          "name": "introspection-engine-rhel-openssl-1.0.x",
          "size": 13727413,
        },
        Object {
          "name": "introspection-engine-rhel-openssl-1.1.x",
          "size": 13714821,
        },
        Object {
          "name": "introspection-engine-windows.exe",
          "size": 22851591,
        },
        Object {
          "name": "migration-engine-darwin",
          "size": 14451544,
        },
        Object {
          "name": "migration-engine-debian-openssl-1.0.x",
          "size": 17538960,
        },
        Object {
          "name": "migration-engine-debian-openssl-1.1.x",
          "size": 17529464,
        },
        Object {
          "name": "migration-engine-rhel-openssl-1.0.x",
          "size": 17592124,
        },
        Object {
          "name": "migration-engine-rhel-openssl-1.1.x",
          "size": 17588083,
        },
        Object {
          "name": "migration-engine-windows.exe",
          "size": 27487354,
        },
        Object {
          "name": "query-engine-darwin",
          "size": 16302864,
        },
        Object {
          "name": "query-engine-debian-openssl-1.0.x",
          "size": 19595240,
        },
        Object {
          "name": "query-engine-debian-openssl-1.1.x",
          "size": 19576464,
        },
        Object {
          "name": "query-engine-rhel-openssl-1.0.x",
          "size": 19635768,
        },
        Object {
          "name": "query-engine-rhel-openssl-1.1.x",
          "size": 19622446,
        },
        Object {
          "name": "query-engine-windows.exe",
          "size": 29855371,
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
      version: 'd20d1e6b1525ae45e3cc39784ad16c97d463f61c',
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
      version: 'd20d1e6b1525ae45e3cc39784ad16c97d463f61c',
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
