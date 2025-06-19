import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './generated/prisma/client'

declare let prisma: PrismaClient

testMatrix.setupTestSuite(
  () => {
    test('should retrieve records after a create with Bytes IDs', async () => {
      const id1 = new Uint8Array(16).fill(0)
      const id2 = new Uint8Array(16).fill(1)
      const id3 = new Uint8Array(16).fill(2)
      const result = await prisma.accommodation.create({
        data: {
          id: id1,
          name: 'Test Accommodation',
          timeTables: {
            createMany: { data: [{ id: id2 }, { id: id3 }] },
          },
        },
        select: {
          id: true,
          name: true,
          timeTables: {
            select: {
              id: true,
            },
          },
        },
      })

      expect(result).toMatchObject({
        id: id1,
        name: 'Test Accommodation',
        timeTables: [{ id: id2 }, { id: id3 }],
      })
    })
  },
  {
    optOut: {
      from: ['mongodb', 'sqlserver'],
      reason: 'MongoDB and SQL Server do not support Bytes IDs',
    },
  },
)
