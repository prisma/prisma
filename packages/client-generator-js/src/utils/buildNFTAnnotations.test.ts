import { ClientEngineType } from '@prisma/internals'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { buildNFTAnnotations } from './buildNFTAnnotations'

function normalizePaths(snapshot: string): string {
  if (process.platform === 'win32') {
    return snapshot.replace(/\\\\/g, '/')
  }
  return snapshot
}

describe('library', () => {
  it('generates annotations for a schema and a single engine', () => {
    const annotations = buildNFTAnnotations(false, ClientEngineType.Library, ['debian-openssl-1.1.x'], 'out')

    expect(normalizePaths(annotations)).toMatchInlineSnapshot(`
      "
      // file annotations for bundling tools to include these files
      path.join(__dirname, "libquery_engine-debian-openssl-1.1.x.so.node");
      path.join(process.cwd(), "out/libquery_engine-debian-openssl-1.1.x.so.node")
      // file annotations for bundling tools to include these files
      path.join(__dirname, "schema.prisma");
      path.join(process.cwd(), "out/schema.prisma")"
    `)
  })

  it('generates annotations for a schema and multiple engines', () => {
    const annotations = buildNFTAnnotations(
      false,
      ClientEngineType.Library,
      ['debian-openssl-1.1.x', 'darwin', 'windows'],
      'out',
    )

    expect(normalizePaths(annotations)).toMatchInlineSnapshot(`
      "
      // file annotations for bundling tools to include these files
      path.join(__dirname, "libquery_engine-debian-openssl-1.1.x.so.node");
      path.join(process.cwd(), "out/libquery_engine-debian-openssl-1.1.x.so.node")

      // file annotations for bundling tools to include these files
      path.join(__dirname, "libquery_engine-darwin.dylib.node");
      path.join(process.cwd(), "out/libquery_engine-darwin.dylib.node")

      // file annotations for bundling tools to include these files
      path.join(__dirname, "query_engine-windows.dll.node");
      path.join(process.cwd(), "out/query_engine-windows.dll.node")
      // file annotations for bundling tools to include these files
      path.join(__dirname, "schema.prisma");
      path.join(process.cwd(), "out/schema.prisma")"
    `)
  })
})

describe('special cases for Netlify', () => {
  const originalEnv = { ...process.env }
  const restoreEnv = () => {
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnv)) {
        delete process.env[key]
      }
    }

    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = value
      }
    }
  }
  beforeEach(() => {
    restoreEnv()
  })
  afterAll(() => {
    restoreEnv()
  })

  /**
   * The build image (Debian) is different from the runtime image (RHEL) on Netlify,
   * so the build-time targets are replaced with what will actually be required at run time.
   */
  it('replaces `platforms` with `["rhel-openssl-1.0.x"]` or `["rhel-openssl-3.0.x"]` depending on the Node.js version', () => {
    process.env.NETLIFY = 'true'

    const isNodeMajor20OrUp = parseInt(process.versions.node.split('.')[0]) >= 20
    const binaryTarget = isNodeMajor20OrUp ? 'rhel-openssl-3.0.x' : 'rhel-openssl-1.0.x'
    const annotations = buildNFTAnnotations(
      false,
      ClientEngineType.Library,
      ['debian-openssl-1.1.x', 'darwin', 'windows'],
      'out',
    )

    expect(normalizePaths(annotations.replaceAll(binaryTarget, 'BINARY_TARGET'))).toMatchInlineSnapshot(`
      "
      // file annotations for bundling tools to include these files
      path.join(__dirname, "libquery_engine-BINARY_TARGET.so.node");
      path.join(process.cwd(), "out/libquery_engine-BINARY_TARGET.so.node")
      // file annotations for bundling tools to include these files
      path.join(__dirname, "schema.prisma");
      path.join(process.cwd(), "out/schema.prisma")"
    `)

    expect(annotations).toContain(binaryTarget)
  })

  it('replaces `platforms` with `["rhel-openssl-1.0.x"]` when AWS_LAMBDA_JS_RUNTIME is set to nodejs18.x', () => {
    process.env.NETLIFY = 'true'
    process.env.AWS_LAMBDA_JS_RUNTIME = 'nodejs18.x'

    const annotations = buildNFTAnnotations(
      false,
      ClientEngineType.Library,
      ['debian-openssl-1.1.x', 'darwin', 'windows'],
      'out',
    )

    expect(normalizePaths(annotations)).toMatchInlineSnapshot(`
      "
      // file annotations for bundling tools to include these files
      path.join(__dirname, "libquery_engine-rhel-openssl-1.0.x.so.node");
      path.join(process.cwd(), "out/libquery_engine-rhel-openssl-1.0.x.so.node")
      // file annotations for bundling tools to include these files
      path.join(__dirname, "schema.prisma");
      path.join(process.cwd(), "out/schema.prisma")"
    `)

    expect(annotations).toContain('rhel-openssl-1.0.x')
  })

  it('replaces `platforms` with `["rhel-openssl-3.0.x"]` when AWS_LAMBDA_JS_RUNTIME is set to nodejs20.x', () => {
    process.env.NETLIFY = 'true'
    process.env.AWS_LAMBDA_JS_RUNTIME = 'nodejs20.x'

    const annotations = buildNFTAnnotations(
      false,
      ClientEngineType.Library,
      ['debian-openssl-1.1.x', 'darwin', 'windows'],
      'out',
    )

    expect(normalizePaths(annotations)).toMatchInlineSnapshot(`
      "
      // file annotations for bundling tools to include these files
      path.join(__dirname, "libquery_engine-rhel-openssl-3.0.x.so.node");
      path.join(process.cwd(), "out/libquery_engine-rhel-openssl-3.0.x.so.node")
      // file annotations for bundling tools to include these files
      path.join(__dirname, "schema.prisma");
      path.join(process.cwd(), "out/schema.prisma")"
    `)

    expect(annotations).toContain('rhel-openssl-3.0.x')
  })
  it('replaces `platforms` with `["rhel-openssl-3.0.x"]` when AWS_LAMBDA_JS_RUNTIME is set to nodejs22.x', () => {
    process.env.NETLIFY = 'true'
    process.env.AWS_LAMBDA_JS_RUNTIME = 'nodejs22.x'

    const annotations = buildNFTAnnotations(
      false,
      ClientEngineType.Library,
      ['debian-openssl-1.1.x', 'darwin', 'windows'],
      'out',
    )

    expect(normalizePaths(annotations)).toMatchInlineSnapshot(`
      "
      // file annotations for bundling tools to include these files
      path.join(__dirname, "libquery_engine-rhel-openssl-3.0.x.so.node");
      path.join(process.cwd(), "out/libquery_engine-rhel-openssl-3.0.x.so.node")
      // file annotations for bundling tools to include these files
      path.join(__dirname, "schema.prisma");
      path.join(process.cwd(), "out/schema.prisma")"
    `)

    expect(annotations).toContain('rhel-openssl-3.0.x')
  })
})
