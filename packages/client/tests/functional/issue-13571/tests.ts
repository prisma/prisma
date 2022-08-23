import testMatrix from './_matrix'

// @ts-ignore this is just for type checks
declare let prisma: import('@prisma/client').PrismaClient

testMatrix.setupTestSuite(() => {
  test('should return correct type when replication reproduction scenario', async () => {
    const testBoolean = Math.random() > 0.5

    const { id } = await prisma.user.create({
      data: {
        bool: testBoolean,
      },
    })

    const testUser = await prisma.user.findFirstOrThrow({
      where: {
        id,
      },
      select: {
        id: true, // we need to select atleast one field
        bool: testBoolean,
      },
    })

    // This is for typechecks
    const casted: Boolean | undefined = testUser.bool
  })

  test('should return correct type when using reproduction scenario with ternary', async () => {
    const testBoolean = Math.random() > 0.5

    const { id } = await prisma.user.create({
      data: {
        bool: testBoolean,
      },
    })

    const testUser = testBoolean
      ? await prisma.user.findFirstOrThrow({
          where: {
            id,
          },
          select: {
            id: true, // we need to select atleast one field
            bool: true,
          },
        })
      : await prisma.user.findFirstOrThrow({
          where: {
            id,
          },
          select: {
            id: true, // we need to select atleast one field
            bool: false,
          },
        })

    // This is for typechecks
    const casted: Boolean | undefined = testUser.bool
  })
})
