import { copycat } from '@snaplet/copycat'

import testMatrix from './_matrix'
// @ts-ignore
import type $ from './node_modules/@prisma/client'

declare let prisma: $.PrismaClient
declare let Prisma: typeof $.Prisma

// ported from: blog
testMatrix.setupTestSuite(
  (suiteConfig) => {
    beforeAll(async () => {
      await prisma.user.create({
        data: {
          id: copycat.uuid(18).replaceAll('-', '').slice(-24),
          email: copycat.email(51),
          age: 20,
        },
      })
      await prisma.user.create({
        data: {
          id: copycat.uuid(62).replaceAll('-', '').slice(-24),
          email: copycat.email(23),
          age: 45,
        },
      })
      await prisma.user.create({
        data: {
          id: copycat.uuid(43).replaceAll('-', '').slice(-24),
          email: copycat.email(13),
          age: 60,
        },
      })
      await prisma.user.create({
        data: {
          id: copycat.uuid(49).replaceAll('-', '').slice(-24),
          email: copycat.email(44),
          age: 63,
        },
      })
    })

    test('select 1 via queryRaw', async () => {
      const result: any = await prisma.$queryRaw`
        SELECT 1
      `
      const results = {
        postgresql: [{ '?column?': 1 }],
        cockroachdb: [{ '?column?': BigInt('1') }],
        mysql: [{ '1': BigInt('1') }],
        sqlite: [{ '1': BigInt('1') }],
        sqlserver: [{ '': 1 }],
      }

      expect(result).toStrictEqual(results[suiteConfig.provider])
    })

    test('select 1 via queryRawUnsafe', async () => {
      const result: any = await prisma.$queryRawUnsafe(`
        SELECT 1 as "number"
      `)

      const results = {
        postgresql: [{ number: 1 }],
        cockroachdb: [{ number: BigInt('1') }],
        mysql: [{ number: BigInt('1') }],
        sqlite: [{ number: BigInt('1') }],
        sqlserver: [{ number: 1 }],
      }

      expect(result).toStrictEqual(results[suiteConfig.provider])
    })

    test('select with alias via queryRaw', async () => {
      const result: any = await prisma.$queryRaw`
        SELECT 1 as "number"
      `
      const results = {
        postgresql: [{ number: 1 }],
        cockroachdb: [{ number: BigInt('1') }],
        mysql: [{ number: BigInt('1') }],
        sqlite: [{ number: BigInt('1') }],
        sqlserver: [{ number: 1 }],
      }

      expect(result).toStrictEqual(results[suiteConfig.provider])
    })

    test('select values via queryRawUnsafe', async () => {
      const result: any = await prisma.$queryRawUnsafe(`
        SELECT 1
      `)

      const results = {
        postgresql: [{ '?column?': 1 }],
        cockroachdb: [{ '?column?': BigInt('1') }],
        mysql: [{ '1': BigInt('1') }],
        sqlite: [{ '1': BigInt('1') }],
        sqlserver: [{ '': 1 }],
      }

      expect(result).toStrictEqual(results[suiteConfig.provider])
    })

    test('select * via queryRawUnsafe', async () => {
      let result: any[] = []
      if (suiteConfig.provider === 'mysql') {
        result = await prisma.$queryRawUnsafe(`
          SELECT * FROM User WHERE age >= ${45} AND age <= ${60}
        `)
      } else {
        result = await prisma.$queryRawUnsafe(`
          SELECT * FROM "User" WHERE age >= ${45} AND age <= ${60}
        `)
      }

      result.sort((a, b) => a.id.localeCompare(b.id))

      expect(result).toMatchInlineSnapshot(`
        [
          {
            age: 60,
            email: Susanna.Cartwright41376@freestyle-planter.org,
            id: a53e589aa14b6e7f84265afb,
            name: null,
          },
          {
            age: 45,
            email: Christina_Mohr19867@pongregistry.org,
            id: d794552b8e3babeb582906d3,
            name: null,
          },
        ]
      `)
    })

    test('select * via queryRawUnsafe with values', async () => {
      let result: any[] = []
      if (suiteConfig.provider === 'mysql') {
        result = await prisma.$queryRawUnsafe(`SELECT * FROM User WHERE age >= ? AND age <= ?`, 45, 60)
      } else if (suiteConfig.provider === 'sqlserver') {
        result = await prisma.$queryRawUnsafe(`SELECT * FROM "User" WHERE age >= @P1 AND age <= @P2`, 45, 60)
      } else {
        result = await prisma.$queryRawUnsafe(`SELECT * FROM "User" WHERE age >= $1 AND age <= $2`, 45, 60)
      }

      result.sort((a, b) => a.id.localeCompare(b.id))

      expect(result).toMatchInlineSnapshot(`
        [
          {
            age: 60,
            email: Susanna.Cartwright41376@freestyle-planter.org,
            id: a53e589aa14b6e7f84265afb,
            name: null,
          },
          {
            age: 45,
            email: Christina_Mohr19867@pongregistry.org,
            id: d794552b8e3babeb582906d3,
            name: null,
          },
        ]
      `)
    })

    test('select * via queryRaw', async () => {
      let result: any[] = []
      if (suiteConfig.provider === 'mysql') {
        result = await prisma.$queryRaw`
          SELECT * FROM User WHERE age >= ${45} AND age <= ${60}
        `
      } else {
        result = await prisma.$queryRaw`
          SELECT * FROM "User" WHERE age >= ${45} AND age <= ${60}
        `
      }

      result.sort((a, b) => a.id.localeCompare(b.id))

      expect(result).toMatchInlineSnapshot(`
        [
          {
            age: 60,
            email: Susanna.Cartwright41376@freestyle-planter.org,
            id: a53e589aa14b6e7f84265afb,
            name: null,
          },
          {
            age: 45,
            email: Christina_Mohr19867@pongregistry.org,
            id: d794552b8e3babeb582906d3,
            name: null,
          },
        ]
      `)
    })

    test('select fields via queryRaw using Prisma.join', async () => {
      let result: any[] = []

      if (suiteConfig.provider === 'mysql') {
        result = await prisma.$queryRaw`
          SELECT ${Prisma.join([
            Prisma.raw('age'),
            Prisma.raw('email'),
            Prisma.raw('id'),
          ])} FROM User WHERE age IN (${Prisma.join([45, 60])})
        `
      } else {
        result = await prisma.$queryRaw`
          SELECT ${Prisma.join([
            Prisma.raw('age'),
            Prisma.raw('email'),
            Prisma.raw('id'),
          ])} FROM "User" WHERE age IN (${Prisma.join([45, 60])})
        `
      }

      result.sort((a, b) => a.id.localeCompare(b.id))

      expect(result).toMatchInlineSnapshot(`
        [
          {
            age: 60,
            email: Susanna.Cartwright41376@freestyle-planter.org,
            id: a53e589aa14b6e7f84265afb,
          },
          {
            age: 45,
            email: Christina_Mohr19867@pongregistry.org,
            id: d794552b8e3babeb582906d3,
          },
        ]
      `)
    })

    test('select fields via queryRaw using Prisma.join and Prisma.sql', async () => {
      let result: any[] = []

      if (suiteConfig.provider === 'mysql') {
        result = await prisma.$queryRaw(Prisma.sql`
          SELECT ${Prisma.join([
            Prisma.raw('age'),
            Prisma.raw('email'),
            Prisma.raw('id'),
          ])} FROM User WHERE age IN (${Prisma.join([45, 60])})
        `)
      } else {
        result = await prisma.$queryRaw(Prisma.sql`
          SELECT ${Prisma.join([
            Prisma.raw('age'),
            Prisma.raw('email'),
            Prisma.raw('id'),
          ])} FROM "User" WHERE age IN (${Prisma.join([45, 60])})
        `)
      }

      result.sort((a, b) => a.id.localeCompare(b.id))

      expect(result).toMatchInlineSnapshot(`
        [
          {
            age: 60,
            email: Susanna.Cartwright41376@freestyle-planter.org,
            id: a53e589aa14b6e7f84265afb,
          },
          {
            age: 45,
            email: Christina_Mohr19867@pongregistry.org,
            id: d794552b8e3babeb582906d3,
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
