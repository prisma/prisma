import { enginesVersion } from '@prisma/engines-version'
import del from 'del'
import path from 'path'

import { cleanupCache } from '../cleanupCache'
import { download } from '../download'
import { getFiles } from './__utils__/getFiles'

const CURRENT_ENGINES_HASH = enginesVersion

jest.setTimeout(120_000)

describe('download', () => {
  beforeEach(async () => {
    // completely clean up the cache and keep nothing
    await cleanupCache(0)
    await del(__dirname + '/**/*engine*')
    await del(__dirname + '/**/prisma-fmt*')
  })

  afterEach(() => delete process.env.PRISMA_QUERY_ENGINE_BINARY)

  test('download all node-api libraries & cache them', async () => {
    // Channel and Version are currently hardcoded
    const baseDir = path.join(__dirname, 'node-api')

    await download({
      engines: {
        'libquery-engine': baseDir,
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

    const files = getFiles(baseDir).map((f) => ({ ...f, size: 'X' }))

    expect(files).toMatchInlineSnapshot(`
Array [
  Object {
    "name": ".gitkeep",
    "size": "X",
  },
  Object {
    "name": "libquery_engine-darwin-arm64.dylib.node",
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
    "name": "libquery_engine-debian-openssl-3.0.x.so.node",
    "size": "X",
  },
  Object {
    "name": "libquery_engine-linux-arm64-openssl-1.0.x.so.node",
    "size": "X",
  },
  Object {
    "name": "libquery_engine-linux-arm64-openssl-1.1.x.so.node",
    "size": "X",
  },
  Object {
    "name": "libquery_engine-linux-arm64-openssl-3.0.x.so.node",
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
    "name": "libquery_engine-rhel-openssl-3.0.x.so.node",
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
