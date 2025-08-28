import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './generated/prisma/client'

declare let prisma: PrismaClient

testMatrix.setupTestSuite(
  () => {
    test('findMany with include on many-to-many relationship with enum array should work', async () => {
      const workspaceRole = await prisma.workspace_role.create({
        data: {
          name: 'Editor',
          permissions: ['HELLO', 'WORLD'],
        },
      })
      await prisma.workspace_member.create({
        data: {
          roles: {
            connect: { id: workspaceRole.id },
          },
        },
      })
      const result = await prisma.workspace_member.findMany({
        include: {
          roles: true,
        },
      })
      expect(result).toMatchObject([
        {
          roles: [
            {
              name: 'Editor',
              permissions: ['HELLO', 'WORLD'],
            },
          ],
        },
      ])
    })
  },
  {
    optOut: {
      from: ['sqlite', 'mysql', 'mongodb', 'cockroachdb', 'sqlserver'],
      reason: 'Testing PostgreSQL specific behavior with enum arrays',
    },
  },
)
