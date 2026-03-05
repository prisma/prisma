import { describe, expect, it } from 'vitest'

import { parseDefaultExport } from '../PrismaConfig'

describe('prismaSchemaFolder validation', () => {
  it('throws specific error when prismaSchemaFolder is used', () => {
    const invalidConfig = {
      prismaSchemaFolder: 'prisma',
      schema: 'prisma/schema.prisma',
    }

    try {
      parseDefaultExport(invalidConfig)
    } catch (e: any) {
      expect(e.message).toContain("The field 'prismaSchemaFolder' is not a valid configuration option")
      expect(e.message).toContain("Did you mean to use 'schema' pointing to a directory?")
      return
    }

    throw new Error('Should have thrown an error')
  })

  it('passes with valid config', () => {
    const validConfig = {
      schema: 'prisma',
    }

    // Should not throw
    parseDefaultExport(validConfig)
  })
})
