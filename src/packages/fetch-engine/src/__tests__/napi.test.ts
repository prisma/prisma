import del from 'del'
import fs from 'fs'
import path from 'path'
import { cleanupCache } from '../cleanupCache'
import { download } from '../download'
import { enginesVersion } from '@prisma/engines-version'

const CURRENT_BINARIES_HASH = enginesVersion

jest.setTimeout(30000)

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
        'libquery-engine': baseDir,
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

    const files = getFiles(baseDir).map((f) => ({ ...f, size: 'X' }))

    expect(files).toMatchInlineSnapshot(`
      Array [
        Object {
          "name": ".gitkeep",
          "size": "X",
        },
        Object {
          "name": "libquery_engine-darwin.dylib.node",
          "size": "X",
        },
        Object {
          "name": "libquery_engine-debian-openssl-1.0.x.so.node",
          "size": "X",
        },
        Object {
          "name": "libquery_engine-debian-openssl-1.1.x.so.node",
          "size": "X",
        },
        Object {
          "name": "libquery_engine-linux-arm-openssl-1.0.x.so.node",
          "size": "X",
        },
        Object {
          "name": "libquery_engine-linux-arm-openssl-1.1.x.so.node",
          "size": "X",
        },
        Object {
          "name": "libquery_engine-linux-musl.so.node",
          "size": "X",
        },
        Object {
          "name": "libquery_engine-rhel-openssl-1.0.x.so.node",
          "size": "X",
        },
        Object {
          "name": "libquery_engine-rhel-openssl-1.1.x.so.node",
          "size": "X",
        },
        Object {
          "name": "query_engine-windows.dll.node",
          "size": "X",
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
