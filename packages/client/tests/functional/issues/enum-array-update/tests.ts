import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './generated/prisma/client'

declare let prisma: PrismaClient

testMatrix.setupTestSuite(
  (_suiteMeta, _clientMeta, _cliMeta) => {
    test('can update an enum array', async () => {
      const user = await prisma.user.create({
        data: {
          roles: ['ADMIN'],
        },
      })

      const updated = await prisma.user.update({
        where: { id: user.id },
        data: {
          roles: ['MANAGE', 'VISIT'],
        },
      })

      expect(updated.roles).toEqual(['MANAGE', 'VISIT'])

      const found = await prisma.user.findUnique({
        where: { id: user.id },
      })
      expect(found?.roles).toEqual(['MANAGE', 'VISIT'])
    })
  },
  {
    optOut: {
      from: ['sqlserver', 'mysql', 'sqlite', 'mongodb'],
      reason: 'enum arrays are not supported or tested here',
    },
  },
)
