import { getTestSuiteSchema } from '../_utils/getTestSuiteInfo'
import { NewPrismaClient } from '../_utils/types'
import testMatrix from './_matrix'
// @ts-ignore
import type { Prisma as PrismaNamespace, PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient
declare let Prisma: typeof PrismaNamespace
declare let newPrismaClient: NewPrismaClient<typeof PrismaClient>

testMatrix.setupTestSuite((suiteConfig, suiteMeta) => {
  beforeAll(async () => {
    const user = await prisma.user.create({ data: {} })
    const taskSheet = await prisma.taskSheet.create({ data: { date: new Date() } })
    const taskSheetTask = await prisma.task.create({
      data: { user: { connect: { id: user.id } }, taskSheet: { connect: { id: taskSheet.id } } },
    })
  })

  test('findMany', async () => {
    const [taskSheet] = await prisma.taskSheet.findMany({
      include: {
        tasks: {
          include: {
            user: true,
          },
        },
      },
      where: {
        date: {
          lte: new Date(),
        },
      },
      take: 1,
    })

    expect(taskSheet).not.toBeUndefined()
  })
})
