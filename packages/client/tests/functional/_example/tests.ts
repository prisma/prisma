// @ts-ignore
import type P from '@prisma/client'

import { setupTestSuiteMatrix } from '../../_utils/setupTestSuiteMatrix'

setupTestSuiteMatrix((importClient, prisma: P.PrismaClient, Prisma: typeof P.Prisma) => {
  beforeAll(async () => {
    const imported = await importClient()
    prisma = new imported.PrismaClient()
    Prisma = imported.Prisma
  })

  test('simpleInput1', async () => await prisma.user.findMany())
  test('simpleInput2', async () => await prisma.user.findMany())
  test('simpleInput3', async () => await prisma.user.findMany())
  test('simpleInput4', async () => await prisma.user.findMany())
  test('simpleInput5', async () => await prisma.user.findMany())
  test('simpleInput6', async () => await prisma.user.findMany())
  test('simpleInput7', async () => await prisma.user.findMany())
  test('simpleInput8', async () => await prisma.user.findMany())
  test('simpleInput9', async () => await prisma.user.findMany())
  test('simpleInput10', async () => await prisma.user.findMany())
  test('simpleInput11', async () => await prisma.user.findMany())
  test('simpleInput12', async () => await prisma.user.findMany())
  test('simpleInput13', async () => await prisma.user.findMany())
  test('simpleInput14', async () => await prisma.user.findMany())
  test('simpleInput15', async () => await prisma.user.findMany())
  test('simpleInput16', async () => await prisma.user.findMany())
  test('simpleInput17', async () => await prisma.user.findMany())
  test('simpleInput18', async () => await prisma.user.findMany())
  test('simpleInput19', async () => await prisma.user.findMany())
  test('simpleInput20', async () => await prisma.user.findMany())
})
