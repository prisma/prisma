import { ClientEngineType } from '@prisma/sdk'

import { buildNFTAnnotations } from '../generation/utils/buildNFTAnnotations'

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

      path.join(__dirname, "libquery_engine-TEST_PLATFORM.LIBRARY_TYPE.node");
      path.join(process.cwd(), "out/libquery_engine-TEST_PLATFORM.so.node")
      path.join(__dirname, "schema.prisma");
      path.join(process.cwd(), "out/schema.prisma")
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

      path.join(__dirname, "libquery_engine-TEST_PLATFORM.LIBRARY_TYPE.node");
      path.join(process.cwd(), "out/libquery_engine-TEST_PLATFORM.so.node")

      path.join(__dirname, "libquery_engine-TEST_PLATFORM.dylib.node");
      path.join(process.cwd(), "out/libquery_engine-TEST_PLATFORM.dylib.node")

      path.join(__dirname, "query_engine-TEST_PLATFORM.dll.node");
      path.join(process.cwd(), "out/query_engine-TEST_PLATFORM.dll.node")
      path.join(__dirname, "schema.prisma");
      path.join(process.cwd(), "out/schema.prisma")
    `)
  })
})

describe('binary', () => {
  it('generates annotations for a schema and a single engine', () => {
    const annotations = buildNFTAnnotations(false, ClientEngineType.Binary, ['debian-openssl-1.1.x'], 'out')

    expect(normalizePaths(annotations)).toMatchInlineSnapshot(`

      path.join(__dirname, "query-engine-TEST_PLATFORM");
      path.join(process.cwd(), "out/query-engine-TEST_PLATFORM")
      path.join(__dirname, "schema.prisma");
      path.join(process.cwd(), "out/schema.prisma")
    `)
  })

  it('generates annotations for a schema and multiple engines', () => {
    const annotations = buildNFTAnnotations(
      false,
      ClientEngineType.Binary,
      ['debian-openssl-1.1.x', 'darwin', 'windows'],
      'out',
    )

    expect(normalizePaths(annotations)).toMatchInlineSnapshot(`

      path.join(__dirname, "query-engine-TEST_PLATFORM");
      path.join(process.cwd(), "out/query-engine-TEST_PLATFORM")

      path.join(__dirname, "query-engine-TEST_PLATFORM");
      path.join(process.cwd(), "out/query-engine-TEST_PLATFORM")

      path.join(__dirname, "query-engine-TEST_PLATFORM");
      path.join(process.cwd(), "out/query-engine-TEST_PLATFORM")
      path.join(__dirname, "schema.prisma");
      path.join(process.cwd(), "out/schema.prisma")
    `)
  })
})

describe('dataproxy', () => {
  it('generates no annotations', () => {
    const annotations = buildNFTAnnotations(
      true,
      ClientEngineType.Library,
      ['debian-openssl-1.1.x', 'darwin', 'windows'],
      'out',
    )

    // TODO: when using .toMatchInlineSnapshot(), this fails after updating snapshots.
    // Probably an issue with the snapshot serializer?
    expect(normalizePaths(annotations)).toBe(``)
  })
})

describe('special cases', () => {
  /**
   * The build image (Debian) is different from the runtime image (RHEL) on Netlify,
   * so the build-time targets are replaced with what will actually be required at run time.
   */
  it('replaces platforms with ["rhel-openssl-1.0.x"] on Netlify', () => {
    process.env.NETLIFY = 'true'

    const annotations = buildNFTAnnotations(
      false,
      ClientEngineType.Library,
      ['debian-openssl-1.1.x', 'darwin', 'windows'],
      'out',
    )

    delete process.env.NETLIFY

    expect(normalizePaths(annotations)).toMatchInlineSnapshot(`

      path.join(__dirname, "libquery_engine-TEST_PLATFORM.LIBRARY_TYPE.node");
      path.join(process.cwd(), "out/libquery_engine-TEST_PLATFORM.so.node")
      path.join(__dirname, "schema.prisma");
      path.join(process.cwd(), "out/schema.prisma")
    `)

    expect(annotations).toContain('rhel-openssl-1.0.x')
  })
})
