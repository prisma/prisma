import { ClientEngineType } from '@prisma/internals'

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
      "
      // file annotations for bundling tools to include these files
      path.join(__dirname, "libquery_engine-TEST_PLATFORM.LIBRARY_TYPE.node");
      path.join(process.cwd(), "out/libquery_engine-TEST_PLATFORM.LIBRARY_TYPE.node")
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
      path.join(__dirname, "libquery_engine-TEST_PLATFORM.LIBRARY_TYPE.node");
      path.join(process.cwd(), "out/libquery_engine-TEST_PLATFORM.LIBRARY_TYPE.node")

      // file annotations for bundling tools to include these files
      path.join(__dirname, "libquery_engine-TEST_PLATFORM.LIBRARY_TYPE.node");
      path.join(process.cwd(), "out/libquery_engine-TEST_PLATFORM.LIBRARY_TYPE.node")

      // file annotations for bundling tools to include these files
      path.join(__dirname, "libquery_engine-TEST_PLATFORM.LIBRARY_TYPE.node");
      path.join(process.cwd(), "out/libquery_engine-TEST_PLATFORM.LIBRARY_TYPE.node")
      // file annotations for bundling tools to include these files
      path.join(__dirname, "schema.prisma");
      path.join(process.cwd(), "out/schema.prisma")"
    `)
  })
})

describe('binary', () => {
  it('generates annotations for a schema and a single engine', () => {
    const annotations = buildNFTAnnotations(false, ClientEngineType.Binary, ['debian-openssl-1.1.x'], 'out')

    expect(normalizePaths(annotations)).toMatchInlineSnapshot(`
      "
      // file annotations for bundling tools to include these files
      path.join(__dirname, "query-engine-TEST_PLATFORM");
      path.join(process.cwd(), "out/query-engine-TEST_PLATFORM")
      // file annotations for bundling tools to include these files
      path.join(__dirname, "schema.prisma");
      path.join(process.cwd(), "out/schema.prisma")"
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
      "
      // file annotations for bundling tools to include these files
      path.join(__dirname, "query-engine-TEST_PLATFORM");
      path.join(process.cwd(), "out/query-engine-TEST_PLATFORM")

      // file annotations for bundling tools to include these files
      path.join(__dirname, "query-engine-TEST_PLATFORM");
      path.join(process.cwd(), "out/query-engine-TEST_PLATFORM")

      // file annotations for bundling tools to include these files
      path.join(__dirname, "query-engine-TEST_PLATFORM");
      path.join(process.cwd(), "out/query-engine-TEST_PLATFORM")
      // file annotations for bundling tools to include these files
      path.join(__dirname, "schema.prisma");
      path.join(process.cwd(), "out/schema.prisma")"
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
    expect(normalizePaths(annotations)).toBe('')
  })
})

describe('special cases for Netlify', () => {
  const originalEnv = { ...process.env }
  beforeEach(() => {
    process.env = { ...originalEnv }
  })
  afterAll(() => {
    process.env = { ...originalEnv }
  })

  /**
   * The build image (Debian) is different from the runtime image (RHEL) on Netlify,
   * so the build-time targets are replaced with what will actually be required at run time.
   */
  it('replaces `platforms` with `["rhel-openssl-1.0.x"]` or `["rhel-openssl-3.0.x"]` depending on the Node.js version', () => {
    process.env.NETLIFY = 'true'

    const isNodeMajor20OrUp = Number.parseInt(process.versions.node.split('.')[0]) >= 20
    const binaryTarget = isNodeMajor20OrUp ? 'rhel-openssl-3.0.x' : 'rhel-openssl-1.0.x'
    const annotations = buildNFTAnnotations(
      false,
      ClientEngineType.Library,
      ['debian-openssl-1.1.x', 'darwin', 'windows'],
      'out',
    )

    expect(normalizePaths(annotations)).toMatchInlineSnapshot(`
      "
      // file annotations for bundling tools to include these files
      path.join(__dirname, "libquery_engine-TEST_PLATFORM.LIBRARY_TYPE.node");
      path.join(process.cwd(), "out/libquery_engine-TEST_PLATFORM.LIBRARY_TYPE.node")
      // file annotations for bundling tools to include these files
      path.join(__dirname, "schema.prisma");
      path.join(process.cwd(), "out/schema.prisma")"
    `)

    expect(annotations).toContain(binaryTarget)
  })

  it('replaces `platforms` with `["rhel-openssl-1.0.x"]` when AWS_LAMBDA_JS_RUNTIME is set to nodejs16.x', () => {
    process.env.NETLIFY = 'true'
    process.env.AWS_LAMBDA_JS_RUNTIME = 'nodejs16.x'

    const annotations = buildNFTAnnotations(
      false,
      ClientEngineType.Library,
      ['debian-openssl-1.1.x', 'darwin', 'windows'],
      'out',
    )

    expect(normalizePaths(annotations)).toMatchInlineSnapshot(`
      "
      // file annotations for bundling tools to include these files
      path.join(__dirname, "libquery_engine-TEST_PLATFORM.LIBRARY_TYPE.node");
      path.join(process.cwd(), "out/libquery_engine-TEST_PLATFORM.LIBRARY_TYPE.node")
      // file annotations for bundling tools to include these files
      path.join(__dirname, "schema.prisma");
      path.join(process.cwd(), "out/schema.prisma")"
    `)

    expect(annotations).toContain('rhel-openssl-1.0.x')
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
      path.join(__dirname, "libquery_engine-TEST_PLATFORM.LIBRARY_TYPE.node");
      path.join(process.cwd(), "out/libquery_engine-TEST_PLATFORM.LIBRARY_TYPE.node")
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
      path.join(__dirname, "libquery_engine-TEST_PLATFORM.LIBRARY_TYPE.node");
      path.join(process.cwd(), "out/libquery_engine-TEST_PLATFORM.LIBRARY_TYPE.node")
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
      path.join(__dirname, "libquery_engine-TEST_PLATFORM.LIBRARY_TYPE.node");
      path.join(process.cwd(), "out/libquery_engine-TEST_PLATFORM.LIBRARY_TYPE.node")
      // file annotations for bundling tools to include these files
      path.join(__dirname, "schema.prisma");
      path.join(process.cwd(), "out/schema.prisma")"
    `)

    expect(annotations).toContain('rhel-openssl-3.0.x')
  })
})
