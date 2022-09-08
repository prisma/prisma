import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient

/**
 * Regression test for #13885
 * Null constraint violation on one-to-one relation
 */
testMatrix.setupTestSuite(({ provider }) => {
  // this on works with mongodb at the moment
  testIf(provider !== 'mongodb').failing('create', async () => {
    await prisma.resource.create({ data: {} })

    // TODO: add expect here
  })

  test.failing('create connect', async () => {
    const holder = await prisma.resourceHolder.create({ data: {} })

    await prisma.resource.create({
      data: {
        resourceHolder: {
          connect: {
            id: holder.id,
          },
        },
      },
    })

    // TODO: add expect here
  })
})
