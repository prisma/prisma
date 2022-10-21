import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient

testMatrix.setupTestSuite(
  () => {
    test('set identity via $transaction batch', async () => {
      await prisma.$transaction([
        prisma.$executeRaw`SET IDENTITY_INSERT "User" ON`,
        prisma.user.create({ data: { id: 5 } }),
        prisma.$executeRaw`SET IDENTITY_INSERT "User" OFF`,
      ])

      const data = await prisma.user.create({})

      expect(data.id).toBe(6)
    })
  },
  {
    optOut: {
      from: ['cockroachdb', 'mongodb', 'mysql', 'postgresql', 'sqlite'],
      reason: 'This test only concerns Microsoft SQL Server',
    },
  },
)

testMatrix.setupTestSuite(
  () => {
    test('set identity via $transaction callback', async () => {
      await prisma.$transaction(async () => {
        await prisma.$executeRaw`SET IDENTITY_INSERT "User" ON`
        await prisma.user.create({ data: { id: 5 } })
        await prisma.$executeRaw`SET IDENTITY_INSERT "User" OFF`
      })

      const data = await prisma.user.create({})

      expect(data.id).toBe(6)
    })
  },
  {
    optOut: {
      from: ['cockroachdb', 'mongodb', 'mysql', 'postgresql', 'sqlite'],
      reason: 'This test only concerns Microsoft SQL Server',
    },
  },
)

testMatrix.setupTestSuite(
  () => {
    test('set identity via single $executeRaw', async () => {
      await prisma.$executeRaw`
      SET IDENTITY_INSERT "User" ON;
      INSERT INTO "User" ("id") VALUES (5);
      SET IDENTITY_INSERT "User" OFF;
    `

      const data = await prisma.user.create({})

      expect(data.id).toBe(6)
    })
  },
  {
    optOut: {
      from: ['cockroachdb', 'mongodb', 'mysql', 'postgresql', 'sqlite'],
      reason: 'This test only concerns Microsoft SQL Server',
    },
  },
)

testMatrix.setupTestSuite(
  () => {
    test('set identity via single $executeRaw with BEGIN/COMMIT', async () => {
      await prisma.$executeRaw`
      BEGIN TRAN;
      SET IDENTITY_INSERT "User" ON;
      INSERT INTO "User" ("id") VALUES (5);
      SET IDENTITY_INSERT "User" OFF;
      COMMIT;
    `

      const data = await prisma.user.create({})

      expect(data.id).toBe(6)
    })
  },
  {
    optOut: {
      from: ['cockroachdb', 'mongodb', 'mysql', 'postgresql', 'sqlite'],
      reason: 'This test only concerns Microsoft SQL Server',
    },
  },
)

testMatrix.setupTestSuite(
  () => {
    test('set identity via single $executeRaw in $transaction batch', async () => {
      await prisma.$transaction([
        prisma.$executeRaw`
        SET IDENTITY_INSERT "User" ON;
        INSERT INTO "User" ("id") VALUES (5);
        SET IDENTITY_INSERT "User" OFF;
      `,
      ])

      const data = await prisma.user.create({})

      expect(data.id).toBe(6)
    })
  },
  {
    optOut: {
      from: ['cockroachdb', 'mongodb', 'mysql', 'postgresql', 'sqlite'],
      reason: 'This test only concerns Microsoft SQL Server',
    },
  },
)

testMatrix.setupTestSuite(
  () => {
    test('set identity via single $executeRaw in $transaction callback', async () => {
      await prisma.$transaction(async (prisma) => {
        await prisma.$executeRaw`
        SET IDENTITY_INSERT "User" ON;
        INSERT INTO "User" ("id") VALUES (5);
        SET IDENTITY_INSERT "User" OFF;
      `
      })

      const data = await prisma.user.create({})

      expect(data.id).toBe(6)
    })
  },
  {
    optOut: {
      from: ['cockroachdb', 'mongodb', 'mysql', 'postgresql', 'sqlite'],
      reason: 'This test only concerns Microsoft SQL Server',
    },
  },
)

testMatrix.setupTestSuite(
  () => {
    test('set identity via multiple $executeRaw in $transaction batch', async () => {
      await prisma.$transaction([
        prisma.$executeRaw`SET IDENTITY_INSERT "User" ON`,
        prisma.$executeRaw`INSERT INTO "User" ("id") VALUES (5)`,
        prisma.$executeRaw`SET IDENTITY_INSERT "User" OFF`,
      ])

      const data = await prisma.user.create({})

      expect(data.id).toBe(6)
    })
  },
  {
    optOut: {
      from: ['cockroachdb', 'mongodb', 'mysql', 'postgresql', 'sqlite'],
      reason: 'This test only concerns Microsoft SQL Server',
    },
  },
)

testMatrix.setupTestSuite(
  () => {
    test('set identity via multiple $executeRaw in $transaction callback', async () => {
      await prisma.$transaction(async (prisma) => {
        await prisma.$executeRaw`SET IDENTITY_INSERT "User" ON`
        await prisma.$executeRaw`INSERT INTO "User" ("id") VALUES (5)`
        await prisma.$executeRaw`SET IDENTITY_INSERT "User" OFF`
      })

      const data = await prisma.user.create({})

      expect(data.id).toBe(6)
    })
  },
  {
    optOut: {
      from: ['cockroachdb', 'mongodb', 'mysql', 'postgresql', 'sqlite'],
      reason: 'This test only concerns Microsoft SQL Server',
    },
  },
)
