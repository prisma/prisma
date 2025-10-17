import { ClientEngineType } from '@prisma/internals'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { buildNFTAnnotations } from './buildNFTAnnotations'

function normalizePaths(snapshot: string): string {
  if (process.platform === 'win32') {
    return snapshot.replace(/\\\\/g, '/')
  }
  return snapshot
}

describe('client', () => {
  it('generates annotations for schema only', () => {
    const annotations = buildNFTAnnotations(false, ClientEngineType.Client, 'out')

    expect(normalizePaths(annotations)).toMatchInlineSnapshot(`
      "
      // file annotations for bundling tools to include these files
      path.join(__dirname, "schema.prisma");
      path.join(process.cwd(), "out/schema.prisma")"
    `)
  })

  it('generates annotations for schema with multiple targets', () => {
    const annotations = buildNFTAnnotations(false, ClientEngineType.Client, 'out')

    expect(normalizePaths(annotations)).toMatchInlineSnapshot(`
      "
      // file annotations for bundling tools to include these files
      path.join(__dirname, "schema.prisma");
      path.join(process.cwd(), "out/schema.prisma")"
    `)
  })
})

describe('no engine', () => {
  it('generates no annotations', () => {
    const annotations = buildNFTAnnotations(true, ClientEngineType.Client, 'out')

    expect(normalizePaths(annotations)).toBe(``)
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

  it('only generates schema annotations regardless of Node.js version', () => {
    process.env.NETLIFY = 'true'

    const annotations = buildNFTAnnotations(false, ClientEngineType.Client, 'out')

    expect(normalizePaths(annotations)).toMatchInlineSnapshot(`
      "
      // file annotations for bundling tools to include these files
      path.join(__dirname, "schema.prisma");
      path.join(process.cwd(), "out/schema.prisma")"
    `)
  })

  it('only generates schema annotations when AWS_LAMBDA_JS_RUNTIME is set to nodejs18.x', () => {
    process.env.NETLIFY = 'true'
    process.env.AWS_LAMBDA_JS_RUNTIME = 'nodejs18.x'

    const annotations = buildNFTAnnotations(false, ClientEngineType.Client, 'out')

    expect(normalizePaths(annotations)).toMatchInlineSnapshot(`
      "
      // file annotations for bundling tools to include these files
      path.join(__dirname, "schema.prisma");
      path.join(process.cwd(), "out/schema.prisma")"
    `)
  })

  it('only generates schema annotations when AWS_LAMBDA_JS_RUNTIME is set to nodejs20.x', () => {
    process.env.NETLIFY = 'true'
    process.env.AWS_LAMBDA_JS_RUNTIME = 'nodejs20.x'

    const annotations = buildNFTAnnotations(false, ClientEngineType.Client, 'out')

    expect(normalizePaths(annotations)).toMatchInlineSnapshot(`
      "
      // file annotations for bundling tools to include these files
      path.join(__dirname, "schema.prisma");
      path.join(process.cwd(), "out/schema.prisma")"
    `)
  })
  it('only generates schema annotations when AWS_LAMBDA_JS_RUNTIME is set to nodejs22.x', () => {
    process.env.NETLIFY = 'true'
    process.env.AWS_LAMBDA_JS_RUNTIME = 'nodejs22.x'

    const annotations = buildNFTAnnotations(false, ClientEngineType.Client, 'out')

    expect(normalizePaths(annotations)).toMatchInlineSnapshot(`
      "
      // file annotations for bundling tools to include these files
      path.join(__dirname, "schema.prisma");
      path.join(process.cwd(), "out/schema.prisma")"
    `)
  })
})
