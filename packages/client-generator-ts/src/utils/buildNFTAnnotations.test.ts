import { ClientEngineType } from '@prisma/internals'
import { describe, expect, it } from 'vitest'

import { buildNFTAnnotations } from './buildNFTAnnotations'

describe('client engine', () => {
  it('generates no annotations (client engine does not bundle binaries)', () => {
    const annotations = buildNFTAnnotations(false, ClientEngineType.Client, 'out')

    expect(annotations).toBe('')
  })

  it('generates no annotations for multiple platforms', () => {
    const annotations = buildNFTAnnotations(false, ClientEngineType.Client, 'out')

    expect(annotations).toBe('')
  })

  it('generates no annotations when edge is enabled', () => {
    const annotations = buildNFTAnnotations(true, ClientEngineType.Client, 'out')

    expect(annotations).toBe('')
  })
})
