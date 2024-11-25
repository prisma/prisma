import { Providers } from '../../_utils/providers'
import testMatrix from './_matrix'
// @ts-ignore
import type { Prisma as PrismaNamespace, PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient
declare let Prisma: typeof PrismaNamespace

testMatrix.setupTestSuite(
  ({ provider }) => {
    test('Uint8Array ($queryRaw)', async () => {
      if (provider === Providers.MYSQL) {
        await prisma.$queryRaw`INSERT INTO \`Entry\` (\`id\`, \`binary\`) VALUES ('1', ${Uint8Array.from([1, 2, 3])})`
      } else {
        await prisma.$queryRaw`INSERT INTO "Entry" ("id", "binary") VALUES ('1', ${Uint8Array.from([1, 2, 3])})`
      }

      const record = await prisma.entry.findUnique({
        where: {
          id: '1',
        },
      })

      expect(record?.binary).toEqual(Uint8Array.from([1, 2, 3]))
    })

    test('Uint8Array ($executeRaw)', async () => {
      if (provider === Providers.MYSQL) {
        await prisma.$executeRaw`INSERT INTO \`Entry\` (\`id\`, \`binary\`) VALUES ('2', ${Uint8Array.from([1, 2, 3])})`
      } else {
        await prisma.$executeRaw`INSERT INTO "Entry" ("id", "binary") VALUES ('2', ${Uint8Array.from([1, 2, 3])})`
      }

      const record = await prisma.entry.findUnique({
        where: {
          id: '2',
        },
      })

      expect(record?.binary).toEqual(Uint8Array.from([1, 2, 3]))
    })

    test('Uint8Array ($queryRaw + Prisma.sql)', async () => {
      if (provider === Providers.MYSQL) {
        await prisma.$queryRaw(
          Prisma.sql`INSERT INTO \`Entry\` (\`id\`, \`binary\`) VALUES ('3', ${Uint8Array.from([1, 2, 3])})`,
        )
      } else {
        await prisma.$queryRaw(
          Prisma.sql`INSERT INTO "Entry" ("id", "binary") VALUES ('3', ${Uint8Array.from([1, 2, 3])})`,
        )
      }

      const record = await prisma.entry.findUnique({
        where: {
          id: '3',
        },
      })

      expect(record?.binary).toEqual(Uint8Array.from([1, 2, 3]))
    })

    test('Uint8Array ($executeRaw + Prisma.sql)', async () => {
      if (provider === Providers.MYSQL) {
        await prisma.$executeRaw(
          Prisma.sql`INSERT INTO \`Entry\` (\`id\`, \`binary\`) VALUES ('4', ${Uint8Array.from([1, 2, 3])})`,
        )
      } else {
        await prisma.$executeRaw(
          Prisma.sql`INSERT INTO "Entry" ("id", "binary") VALUES ('4', ${Uint8Array.from([1, 2, 3])})`,
        )
      }

      const record = await prisma.entry.findUnique({
        where: {
          id: '4',
        },
      })

      expect(record?.binary).toEqual(Uint8Array.from([1, 2, 3]))
    })
  },
  {
    optOut: {
      from: [Providers.MONGODB],
      reason: '$queryRaw only works on SQL based providers',
    },
  },
)
