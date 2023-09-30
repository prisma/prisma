import { copycat } from '@snaplet/copycat'

import testMatrix from './_matrix'
// @ts-ignore
import type $ from './node_modules/@prisma/client'

declare let prisma: $.PrismaClient
declare let Prisma: typeof $.Prisma

// ported from: blog
testMatrix.setupTestSuite(
  (suiteConfig) => {
    beforeEach(async () => {
      await prisma.user.deleteMany()
      await prisma.user.create({
        data: {
          id: copycat.uuid(11).replaceAll('-', '').slice(-24),
          email: copycat.email(15),
          age: 20,
        },
      })
      await prisma.user.create({
        data: {
          id: copycat.uuid(52).replaceAll('-', '').slice(-24),
          email: copycat.email(82),
          age: 45,
        },
      })
      await prisma.user.create({
        data: {
          id: copycat.uuid(13).replaceAll('-', '').slice(-24),
          email: copycat.email(73),
          age: 60,
        },
      })
      await prisma.user.create({
        data: {
          id: copycat.uuid(64).replaceAll('-', '').slice(-24),
          email: copycat.email(42),
          age: 63,
        },
      })
    })

    test('update via executeRawUnsafe', async () => {
      let affected: number

      if (suiteConfig.provider === 'mysql') {
        affected = await prisma.$executeRawUnsafe(`
          UPDATE User SET age = ${65} WHERE age >= ${45} AND age <= ${60}
        `)
      } else {
        affected = await prisma.$executeRawUnsafe(`
          UPDATE "User" SET age = ${65} WHERE age >= ${45} AND age <= ${60}
        `)
      }

      const result = await prisma.user.findMany({ where: { age: 65 } })
      result.sort((a, b) => a.id.localeCompare(b.id))

      expect(affected).toMatchInlineSnapshot(`2`)
      expect(result).toMatchInlineSnapshot(`
        [
          {
            age: 65,
            email: Olaf.Quitzon50356@defrock-chapel.info,
            id: 7b15573eb6470a221ef6f7ad,
            name: null,
          },
          {
            age: 65,
            email: Florine_Mohr61002@loathe-screwdriver.name,
            id: aab15191b1735281fdf4fb00,
            name: null,
          },
        ]
      `)
    })

    test('update via queryRawUnsafe with values', async () => {
      let affected: number

      if (suiteConfig.provider === 'mysql') {
        // eslint-disable-next-line prettier/prettier
        affected = await prisma.$executeRawUnsafe(`UPDATE User SET age = ? WHERE age >= ? AND age <= ?`, 65, 45, 60)
      } else if (suiteConfig.provider === 'sqlserver') {
        affected = await prisma.$executeRawUnsafe(
          `UPDATE "User" SET age = @P1 WHERE age >= @P2 AND age <= @P3`,
          65,
          45,
          60,
        )
      } else {
        affected = await prisma.$executeRawUnsafe(
          `UPDATE "User" SET age = $1 WHERE age >= $2 AND age <= $3`,
          65,
          45,
          60,
        )
      }

      const result = await prisma.user.findMany({ where: { age: 65 } })
      result.sort((a, b) => a.id.localeCompare(b.id))

      expect(affected).toMatchInlineSnapshot(`2`)
      expect(result).toMatchInlineSnapshot(`
        [
          {
            age: 65,
            email: Olaf.Quitzon50356@defrock-chapel.info,
            id: 7b15573eb6470a221ef6f7ad,
            name: null,
          },
          {
            age: 65,
            email: Florine_Mohr61002@loathe-screwdriver.name,
            id: aab15191b1735281fdf4fb00,
            name: null,
          },
        ]
      `)
    })

    test('update via executeRaw', async () => {
      let affected: number

      if (suiteConfig.provider === 'mysql') {
        affected = await prisma.$executeRaw`
          UPDATE User SET age = ${65} WHERE age >= ${45} AND age <= ${60}
        `
      } else {
        affected = await prisma.$executeRaw`
          UPDATE "User" SET age = ${65} WHERE age >= ${45} AND age <= ${60}
        `
      }

      const result = await prisma.user.findMany({ where: { age: 65 } })
      result.sort((a, b) => a.id.localeCompare(b.id))

      expect(affected).toMatchInlineSnapshot(`2`)
      expect(result).toMatchInlineSnapshot(`
        [
          {
            age: 65,
            email: Olaf.Quitzon50356@defrock-chapel.info,
            id: 7b15573eb6470a221ef6f7ad,
            name: null,
          },
          {
            age: 65,
            email: Florine_Mohr61002@loathe-screwdriver.name,
            id: aab15191b1735281fdf4fb00,
            name: null,
          },
        ]
      `)
    })

    test('update via executeRaw using Prisma.join', async () => {
      let affected: number

      if (suiteConfig.provider === 'mysql') {
        affected = await prisma.$executeRaw`
          UPDATE User SET age = ${65} WHERE age IN (${Prisma.join([45, 60])})
        `
      } else {
        affected = await prisma.$executeRaw`
          UPDATE "User" SET age = ${65} WHERE age IN (${Prisma.join([45, 60])})
        `
      }

      const result = await prisma.user.findMany({ where: { age: 65 } })
      result.sort((a, b) => a.id.localeCompare(b.id))

      expect(affected).toMatchInlineSnapshot(`2`)
      expect(result).toMatchInlineSnapshot(`
        [
          {
            age: 65,
            email: Olaf.Quitzon50356@defrock-chapel.info,
            id: 7b15573eb6470a221ef6f7ad,
            name: null,
          },
          {
            age: 65,
            email: Florine_Mohr61002@loathe-screwdriver.name,
            id: aab15191b1735281fdf4fb00,
            name: null,
          },
        ]
      `)
    })

    test('update via executeRaw using Prisma.join and Prisma.sql', async () => {
      let affected: number

      if (suiteConfig.provider === 'mysql') {
        affected = await prisma.$executeRaw(Prisma.sql`
          UPDATE User SET age = ${65} WHERE age IN (${Prisma.join([45, 60])})
        `)
      } else {
        affected = await prisma.$executeRaw(Prisma.sql`
          UPDATE "User" SET age = ${65} WHERE age IN (${Prisma.join([45, 60])})
        `)
      }

      const result = await prisma.user.findMany({ where: { age: 65 } })
      result.sort((a, b) => a.id.localeCompare(b.id))

      expect(affected).toMatchInlineSnapshot(`2`)
      expect(result).toMatchInlineSnapshot(`
        [
          {
            age: 65,
            email: Olaf.Quitzon50356@defrock-chapel.info,
            id: 7b15573eb6470a221ef6f7ad,
            name: null,
          },
          {
            age: 65,
            email: Florine_Mohr61002@loathe-screwdriver.name,
            id: aab15191b1735281fdf4fb00,
            name: null,
          },
        ]
      `)
    })
  },
  {
    optOut: {
      from: ['mongodb'],
      reason: 'MongoDB does not support raw queries',
    },
  },
)
