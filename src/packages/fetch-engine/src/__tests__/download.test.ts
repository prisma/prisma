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

jest.setTimeout(30000)

describe('download', () => {
  beforeAll(async () => {
    // completely clean up the cache and keep nothing
    await cleanupCache(0)
    await del(__dirname + '/**/*engine*')
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

    await download({
      binaries: {
        'query-engine': __dirname,
        'introspection-engine': __dirname,
        'migration-engine': __dirname,
      },
      version: '1743b1e3c8fbe24cb345528ab0cf3013cdc36fa3',
    })

    expect(await getVersion(queryEnginePath)).toMatchInlineSnapshot(
      `"prisma 1743b1e3c8fbe24cb345528ab0cf3013cdc36fa3"`,
    )
    expect(await getVersion(introspectionEnginePath)).toMatchInlineSnapshot(
      `"introspection-core 1743b1e3c8fbe24cb345528ab0cf3013cdc36fa3"`,
    )
    expect(await getVersion(migrationEnginePath)).toMatchInlineSnapshot(
      `"migration-engine-cli 1743b1e3c8fbe24cb345528ab0cf3013cdc36fa3"`,
    )
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
      version: '1743b1e3c8fbe24cb345528ab0cf3013cdc36fa3',
    })

    fs.writeFileSync(targetPath, 'incorrect-binary')

    // please heal it
    await download({
      binaries: {
        'query-engine': baseDir,
      },
      version: '1743b1e3c8fbe24cb345528ab0cf3013cdc36fa3',
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
        version: '1743b1e3c8fbe24cb345528ab0cf3013cdc36fa3',
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
      },
      binaryTargets: [
        'darwin',
        'debian-openssl-1.0.x',
        'debian-openssl-1.1.x',
        'rhel-openssl-1.0.x',
        'rhel-openssl-1.1.x',
        'windows',
      ],
      version: '1743b1e3c8fbe24cb345528ab0cf3013cdc36fa3',
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
          "size": 11217352,
        },
        Object {
          "name": "introspection-engine-debian-openssl-1.0.x",
          "size": 14144184,
        },
        Object {
          "name": "introspection-engine-debian-openssl-1.1.x",
          "size": 14117656,
        },
        Object {
          "name": "introspection-engine-rhel-openssl-1.0.x",
          "size": 14184811,
        },
        Object {
          "name": "introspection-engine-rhel-openssl-1.1.x",
          "size": 14164268,
        },
        Object {
          "name": "introspection-engine-windows.exe",
          "size": 23438433,
        },
        Object {
          "name": "migration-engine-darwin",
          "size": 14817144,
        },
        Object {
          "name": "migration-engine-debian-openssl-1.0.x",
          "size": 17972920,
        },
        Object {
          "name": "migration-engine-debian-openssl-1.1.x",
          "size": 17946184,
        },
        Object {
          "name": "migration-engine-rhel-openssl-1.0.x",
          "size": 18030001,
        },
        Object {
          "name": "migration-engine-rhel-openssl-1.1.x",
          "size": 18009213,
        },
        Object {
          "name": "migration-engine-windows.exe",
          "size": 28021828,
        },
        Object {
          "name": "query-engine-darwin",
          "size": 16575264,
        },
        Object {
          "name": "query-engine-debian-openssl-1.0.x",
          "size": 19918856,
        },
        Object {
          "name": "query-engine-debian-openssl-1.1.x",
          "size": 19897512,
        },
        Object {
          "name": "query-engine-rhel-openssl-1.0.x",
          "size": 19963237,
        },
        Object {
          "name": "query-engine-rhel-openssl-1.1.x",
          "size": 19943763,
        },
        Object {
          "name": "query-engine-windows.exe",
          "size": 30330977,
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
      version: '1743b1e3c8fbe24cb345528ab0cf3013cdc36fa3',
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
      },
      binaryTargets: [
        'darwin',
        'debian-openssl-1.0.x',
        'debian-openssl-1.1.x',
        'rhel-openssl-1.0.x',
        'rhel-openssl-1.1.x',
        'windows',
      ],
      version: '1743b1e3c8fbe24cb345528ab0cf3013cdc36fa3',
    })
    const after2 = Date.now()
    // if binaries are already there, it should take less than 100ms to check all of them
    // value on Mac: 33ms
    expect(after2 - before2).toBeLessThan(3000)
  })
})

function getFiles(dir: string): Array<{ name: string; size: number }> {
  const files = fs.readdirSync(dir, 'utf8')
  return files.map((name) => {
    const size = fs.statSync(path.join(dir, name)).size

    return { name, size }
  })
}
