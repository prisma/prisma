import { setupTestSuiteMatrix } from '../_utils/setupTestSuiteMatrix'

// @ts-ignore
declare let prisma: import('@prisma/client').PrismaClient

setupTestSuiteMatrix((suiteConfig) => {
  test('Buffer ($queryRaw)', async () => {
    if (suiteConfig['provider'] === 'postgresql') {
      await prisma.$queryRaw`INSERT INTO "Entry" ("id", "binary") VALUES (1, ${Buffer.from('hello')})`
    } else {
      await prisma.$queryRaw`INSERT INTO \`Entry\` (\`id\`, \`binary\`) VALUES (1, ${Buffer.from('hello')})`
    }

    const record = await prisma.entry.findUnique({
      where: {
        id: 1,
      },
    })

    expect(record?.binary).toEqual(Buffer.from('hello'))
  })

  test('Buffer ($executeRaw)', async () => {
    if (suiteConfig['provider'] === 'postgresql') {
      await prisma.$executeRaw`INSERT INTO "Entry" ("id", "binary") VALUES (2, ${Buffer.from('hello')})`
    } else {
      await prisma.$executeRaw`INSERT INTO \`Entry\` (\`id\`, \`binary\`) VALUES (2, ${Buffer.from('hello')})`
    }

    const record = await prisma.entry.findUnique({
      where: {
        id: 2,
      },
    })

    expect(record?.binary).toEqual(Buffer.from('hello'))
  })
})
