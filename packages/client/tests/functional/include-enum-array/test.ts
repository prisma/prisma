import { NewPrismaClient } from '../_utils/types'
import { defaultTestSuiteOptions } from '../driver-adapters/_utils/test-suite-options'
import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './generated/prisma/client'

declare let newPrismaClient: NewPrismaClient<typeof PrismaClient>

testMatrix.setupTestSuite(
  () => {
    let prisma: PrismaClient

    beforeAll(async () => {
      prisma = await newPrismaClient()
    })

    afterAll(async () => {
      await prisma.$disconnect()
    })
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
      const result = await prisma.workspace_member.findManyOrThrow({
        include: {
          roles: true,
        },
      })

      expect(result[0].roles[0].permissions).toEqual(['HELLO', 'WORLD'])
    })
  },
  {
    ...defaultTestSuiteOptions,
    optOut: {
      from: ['sqlite', 'mysql', 'mongodb', 'cockroachdb', 'sqlserver'],
      reason: 'Testing specific PostgreSQL driver adapter issue with enum arrays',
    },
  },
)
