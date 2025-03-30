import { copycat } from '@snaplet/copycat'

import { Providers } from '../../_utils/providers'
import testMatrix from './_matrix'
// @ts-ignore
import type * as $ from './generated/prisma/client'

declare let prisma: $.PrismaClient
declare let Prisma: typeof $.Prisma

// ported from: blog
testMatrix.setupTestSuite(
  ({ provider }) => {
    const isMySql = provider === Providers.MYSQL
    const usesAnonymousParams = [Providers.MYSQL, Providers.SQLITE].includes(provider)

    beforeEach(async () => {
      await prisma.user.deleteMany()
      await prisma.user.create({
        data: {
          id: copycat.uuid(1).replaceAll('-', '').slice(-24),
          email: copycat.email(1),
          age: 20,
        },
      })
      await prisma.user.create({
        data: {
          id: copycat.uuid(2).replaceAll('-', '').slice(-24),
          email: copycat.email(2),
          age: 45,
        },
      })
      await prisma.user.create({
        data: {
          id: copycat.uuid(3).replaceAll('-', '').slice(-24),
          email: copycat.email(3),
          age: 60,
        },
      })
      await prisma.user.create({
        data: {
          id: copycat.uuid(4).replaceAll('-', '').slice(-24),
          email: copycat.email(4),
          age: 63,
        },
      })
    })

    test('update via executeRawUnsafe', async () => {
      let affected: number

      if (isMySql) {
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
            "age": 65,
            "email": "Kyla_Crist96556@cancollaboration.biz",
            "id": "a7fe5dac91ab6b0f529430c5",
            "name": null,
          },
          {
            "age": 65,
            "email": "Sam.Dickinson32909@memorableparticular.org",
            "id": "a85d5d75a3a886cb61eb3a0e",
            "name": null,
          },
        ]
      `)
    })

    test('update via queryRawUnsafe with values', async () => {
      let affected: number

      if (usesAnonymousParams) {
        // eslint-disable-next-line prettier/prettier
        affected = await prisma.$executeRawUnsafe(`UPDATE User SET age = ? WHERE age >= ? AND age <= ?`, 65, 45, 60)
      } else if (provider === Providers.SQLSERVER) {
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
            "age": 65,
            "email": "Kyla_Crist96556@cancollaboration.biz",
            "id": "a7fe5dac91ab6b0f529430c5",
            "name": null,
          },
          {
            "age": 65,
            "email": "Sam.Dickinson32909@memorableparticular.org",
            "id": "a85d5d75a3a886cb61eb3a0e",
            "name": null,
          },
        ]
      `)
    })

    test('update via executeRaw', async () => {
      let affected: number

      if (isMySql) {
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
            "age": 65,
            "email": "Kyla_Crist96556@cancollaboration.biz",
            "id": "a7fe5dac91ab6b0f529430c5",
            "name": null,
          },
          {
            "age": 65,
            "email": "Sam.Dickinson32909@memorableparticular.org",
            "id": "a85d5d75a3a886cb61eb3a0e",
            "name": null,
          },
        ]
      `)
    })

    test('update via executeRaw using Prisma.join', async () => {
      let affected: number

      if (isMySql) {
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
            "age": 65,
            "email": "Kyla_Crist96556@cancollaboration.biz",
            "id": "a7fe5dac91ab6b0f529430c5",
            "name": null,
          },
          {
            "age": 65,
            "email": "Sam.Dickinson32909@memorableparticular.org",
            "id": "a85d5d75a3a886cb61eb3a0e",
            "name": null,
          },
        ]
      `)
    })

    test('update via executeRaw using Prisma.join and Prisma.sql', async () => {
      let affected: number

      if (isMySql) {
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
            "age": 65,
            "email": "Kyla_Crist96556@cancollaboration.biz",
            "id": "a7fe5dac91ab6b0f529430c5",
            "name": null,
          },
          {
            "age": 65,
            "email": "Sam.Dickinson32909@memorableparticular.org",
            "id": "a85d5d75a3a886cb61eb3a0e",
            "name": null,
          },
        ]
      `)
    })
  },
  {
    optOut: {
      from: [Providers.MONGODB],
      reason: 'MongoDB does not support raw queries',
    },
  },
)
