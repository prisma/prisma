import testMatrix from './_matrix'

// @ts-ignore
declare let prisma: import('@prisma/client').PrismaClient
// @ts-ignore
declare let Prisma: typeof import('@prisma/client').Prisma

testMatrix.setupTestSuite(
  (suiteConfig) => {
    test('Buffer ($queryRaw)', async () => {
      if (suiteConfig['provider'] === 'mysql') {
        await prisma.$queryRaw`INSERT INTO \`Entry\` (\`id\`, \`binary\`) VALUES (1, ${Buffer.from('hello')})`
      } else {
        await prisma.$queryRaw`INSERT INTO "Entry" ("id", "binary") VALUES (1, ${Buffer.from('hello')})`
      }

      const record = await prisma.entry.findUnique({
        where: {
          id: 1,
        },
      })

      expect(record?.binary).toEqual(Buffer.from('hello'))
    })

    test('Buffer ($executeRaw)', async () => {
      if (suiteConfig['provider'] === 'mysql') {
        await prisma.$executeRaw`INSERT INTO \`Entry\` (\`id\`, \`binary\`) VALUES (2, ${Buffer.from('hello')})`
      } else {
        await prisma.$executeRaw`INSERT INTO "Entry" ("id", "binary") VALUES (2, ${Buffer.from('hello')})`
      }

      const record = await prisma.entry.findUnique({
        where: {
          id: 2,
        },
      })

      expect(record?.binary).toEqual(Buffer.from('hello'))
    })

    test('Buffer ($queryRaw + Prisma.sql)', async () => {
      if (suiteConfig['provider'] === 'mysql') {
        await prisma.$queryRaw(
          Prisma.sql`INSERT INTO \`Entry\` (\`id\`, \`binary\`) VALUES (3, ${Buffer.from('hello')})`,
        )
      } else {
        await prisma.$queryRaw(Prisma.sql`INSERT INTO "Entry" ("id", "binary") VALUES (3, ${Buffer.from('hello')})`)
      }

      const record = await prisma.entry.findUnique({
        where: {
          id: 3,
        },
      })

      expect(record?.binary).toEqual(Buffer.from('hello'))
    })

    test('Buffer ($executeRaw + Prisma.sql)', async () => {
      if (suiteConfig['provider'] === 'mysql') {
        await prisma.$executeRaw(
          Prisma.sql`INSERT INTO \`Entry\` (\`id\`, \`binary\`) VALUES (4, ${Buffer.from('hello')})`,
        )
      } else {
        await prisma.$executeRaw(Prisma.sql`INSERT INTO "Entry" ("id", "binary") VALUES (4, ${Buffer.from('hello')})`)
      }

      const record = await prisma.entry.findUnique({
        where: {
          id: 4,
        },
      })

      expect(record?.binary).toEqual(Buffer.from('hello'))
    })
  },
  { optIn: ['sqlite', 'postgresql', 'mysql'] },
)
