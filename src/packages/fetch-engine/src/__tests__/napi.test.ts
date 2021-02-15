import del from 'del'
import fs from 'fs'
import path from 'path'
import { cleanupCache } from '../cleanupCache'
import { download } from '../download'

jest.setTimeout(80000)

describe('download', () => {
  beforeEach(async () => {
    // completely clean up the cache and keep nothing
    await cleanupCache(0)
    await del(__dirname + '/**/*engine*')
    await del(__dirname + '/**/prisma-fmt*')
  })
  afterEach(() => delete process.env.PRISMA_QUERY_ENGINE_BINARY)

  test('download all napi libraries & cache them', async () => {
    // Channel and Version are currently hardcoded
    const baseDir = path.join(__dirname, 'all')
    await download({
      binaries: {
        libquery_engine_napi: baseDir,
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
    })
    const files = getFiles(baseDir)
    expect(files).toMatchInlineSnapshot(`
      Array [
        Object {
          "name": ".gitkeep",
          "size": 0,
        },
        Object {
          "name": "libquery_engine_napi-darwin.dylib.node",
          "size": 21457856,
        },
        Object {
          "name": "libquery_engine_napi-debian-openssl-1.0.x.so.node",
          "size": 23197768,
        },
        Object {
          "name": "libquery_engine_napi-debian-openssl-1.1.x.so.node",
          "size": 23172880,
        },
        Object {
          "name": "libquery_engine_napi-linux-arm-openssl-1.0.x.so.node",
          "size": 24212576,
        },
        Object {
          "name": "libquery_engine_napi-linux-arm-openssl-1.1.x.so.node",
          "size": 24950552,
        },
        Object {
          "name": "libquery_engine_napi-linux-musl.so.node",
          "size": 23361432,
        },
        Object {
          "name": "libquery_engine_napi-rhel-openssl-1.0.x.so.node",
          "size": 23175344,
        },
        Object {
          "name": "libquery_engine_napi-rhel-openssl-1.1.x.so.node",
          "size": 23170840,
        },
        Object {
          "name": "query_engine_napi-windows.dll.node",
          "size": 17845248,
        },
      ]
    `)
  })
})

function getFiles(dir: string): Array<{ name: string; size: number }> {
  const files = fs.readdirSync(dir, 'utf8')
  return files.map((name) => {
    const size = fs.statSync(path.join(dir, name)).size

    return { name, size }
  })
}
