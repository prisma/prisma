import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './generated/prisma/client'

declare let prisma: PrismaClient

testMatrix.setupTestSuite(
  () => {
    test('writes and reads string values to JSON fields correctly', async () => {
      // Test plain string value in JSON field
      const document = await prisma.document.create({
        data: {
          content: 'hello world',
          metadata: { author: 'test' },
        },
      })

      expect(document.content).toBe('hello world')
      expect(document.metadata).toEqual({ author: 'test' })

      // Test with findMany
      const found = await prisma.document.findFirst({
        where: { id: document.id },
      })

      expect(found?.content).toBe('hello world')
      expect(found?.metadata).toEqual({ author: 'test' })
    })

    test('writes various JSON types correctly', async () => {
      const testCases = [
        { content: 'string value', desc: 'string' },
        { content: 42, desc: 'number' },
        { content: true, desc: 'boolean' },
        { content: null, desc: 'null' },
        { content: { nested: 'object' }, desc: 'object' },
        { content: [1, 2, 3], desc: 'array' },
      ]

      for (const { content, desc } of testCases) {
        const doc = await prisma.document.create({
          data: { content, metadata: null },
        })
        expect(doc.content).toEqual(content)
      }
    })
  },
  {
    optOut: {
      from: ['sqlite'],
      reason: 'SQLite does not support native JSON type',
    },
  },
)
