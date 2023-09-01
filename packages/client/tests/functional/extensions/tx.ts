import { faker } from '@faker-js/faker'
import { expectTypeOf } from 'expect-type'

import { ProviderFlavors } from '../_utils/providerFlavors'
import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient

const email = faker.internet.email()

testMatrix.setupTestSuite(({ providerFlavor }, _1, clientMeta) => {
  beforeEach(async () => {
    await prisma.post.deleteMany()
    await prisma.user.deleteMany()
    const { id: userId } = await prisma.user.create({
      data: {
        email,
        firstName: 'John',
        lastName: 'Smith',
      },
    })

    await prisma.post.create({
      data: {
        user: { connect: { id: userId } },
      },
    })
  })

  testIf(clientMeta.runtime !== 'edge')('extended client in tx can rollback via normal call', async () => {
    const xprisma = prisma.$extends({
      result: {
        user: {
          fullName: {
            needs: { firstName: true, lastName: true },
            compute(user) {
              return `${user.firstName} ${user.lastName}`
            },
          },
        },
      },
    })

    const result = xprisma.$transaction([
      xprisma.user.create({
        data: {
          email: 'jane@smith.com',
          firstName: 'Jane',
          lastName: 'Smith',
        },
      }),
      xprisma.user.create({
        data: {
          email: 'jane@smith.com',
          firstName: 'Jane',
          lastName: 'Smith',
        },
      }),
    ])

    if (providerFlavor === ProviderFlavors.JS_PLANETSCALE) {
      // Full error has a random id so we can't snapshot it
      // extended client in tx can rollback via custom call 1`] = `target: tests.0.primary: vttablet: rpc error: code = AlreadyExists desc = Duplicate entry 'jane@smith.com' for key 'User.User_email_key' (errno 1062) (sqlstate 23000) (CallerID: userData1): Sql: "insert into \`User\`(id, email, firstName, lastName) values (:vtg1 /* VARCHAR */, :vtg2 /* VARCHAR */, :vtg3 /* VARCHAR */, :vtg4 /* VARCHAR */)", BindVars: {vtg1: "type:VARCHAR value:\\"clm0ll3oe002s4pcr8d80i8v8\\""vtg2: "type:VARCHAR value:\\"jane@smith.com\\""vtg3: "type:VARCHAR value:\\"Jane\\""vtg4: "type:VARCHAR value:\\"Smith\\""} (errno 1062) (sqlstate 23000) during query: INSERT INTO \`tests\`.\`User\` (\`id\`,\`email\`,\`firstName\`,\`lastName\`) VALUES ('clm0ll3oe002s4pcr8d80i8v8','jane@smith.com','Jane','Smith')`;
      await expect(result).rejects.toThrow(`code = AlreadyExists`)
    } else {
      await expect(result).rejects.toMatchPrismaErrorSnapshot()
    }
    const users = await prisma.user.findMany({ where: { email: 'jane@smith.com' } })

    expect(users).toHaveLength(0)
  })

  test('extended client in tx works via normal call', async () => {
    const xprisma = prisma.$extends({
      result: {
        user: {
          fullName: {
            needs: { firstName: true, lastName: true },
            compute(user) {
              return `${user.firstName} ${user.lastName}`
            },
          },
        },
      },
    })

    await xprisma.$transaction([
      xprisma.user.create({
        data: {
          email: 'jane@smith.com',
          firstName: 'Jane',
          lastName: 'Smith',
        },
      }),
    ])

    const users = await prisma.user.findMany({ where: { email: 'jane@smith.com' } })

    expect(users).toHaveLength(1)
  })

  testIf(clientMeta.runtime !== 'edge')('extended client in tx can rollback via custom call', async () => {
    const xprisma = prisma
      .$extends({
        result: {
          user: {
            fullName: {
              needs: { firstName: true, lastName: true },
              compute(user) {
                return `${user.firstName} ${user.lastName}`
              },
            },
          },
        },
      })
      .$extends({
        model: {
          $allModels: {
            createAlt(args: any) {
              return (this as any).create(args)
            },
          },
        },
      })

    const result = xprisma.$transaction([
      xprisma.user.createAlt({
        data: {
          email: 'jane@smith.com',
          firstName: 'Jane',
          lastName: 'Smith',
        },
      }),
      xprisma.user.createAlt({
        data: {
          email: 'jane@smith.com',
          firstName: 'Jane',
          lastName: 'Smith',
        },
      }),
    ])

    if (providerFlavor === ProviderFlavors.JS_PLANETSCALE) {
      // Full error has a random id so we can't snapshot it
      // extended client in tx can rollback via custom call 1`] = `target: tests.0.primary: vttablet: rpc error: code = AlreadyExists desc = Duplicate entry 'jane@smith.com' for key 'User.User_email_key' (errno 1062) (sqlstate 23000) (CallerID: userData1): Sql: "insert into \`User\`(id, email, firstName, lastName) values (:vtg1 /* VARCHAR */, :vtg2 /* VARCHAR */, :vtg3 /* VARCHAR */, :vtg4 /* VARCHAR */)", BindVars: {vtg1: "type:VARCHAR value:\\"clm0ll3oe002s4pcr8d80i8v8\\""vtg2: "type:VARCHAR value:\\"jane@smith.com\\""vtg3: "type:VARCHAR value:\\"Jane\\""vtg4: "type:VARCHAR value:\\"Smith\\""} (errno 1062) (sqlstate 23000) during query: INSERT INTO \`tests\`.\`User\` (\`id\`,\`email\`,\`firstName\`,\`lastName\`) VALUES ('clm0ll3oe002s4pcr8d80i8v8','jane@smith.com','Jane','Smith')`;
      await expect(result).rejects.toThrow(`code = AlreadyExists`)
    } else {
      await expect(result).rejects.toMatchPrismaErrorSnapshot()
    }

    const users = await prisma.user.findMany({ where: { email: 'jane@smith.com' } })

    expect(users).toHaveLength(0)
  })

  test('extended client in tx works via custom call', async () => {
    const xprisma = prisma
      .$extends({
        result: {
          user: {
            fullName: {
              needs: { firstName: true, lastName: true },
              compute(user) {
                return `${user.firstName} ${user.lastName}`
              },
            },
          },
        },
      })
      .$extends({
        model: {
          $allModels: {
            createAlt(args: any) {
              return (this as any).create(args)
            },
          },
        },
      })

    await xprisma.$transaction([
      xprisma.user.create({
        data: {
          email: 'jane@smith.com',
          firstName: 'Jane',
          lastName: 'Smith',
        },
      }),
    ])

    const users = await prisma.user.findMany({ where: { email: 'jane@smith.com' } })

    expect(users).toHaveLength(1)
  })

  test('isolation level is properly reflected in extended client', () => {
    ;async () => {
      const xprisma = prisma.$extends({})

      // @ts-test-if: provider !== 'mongodb'
      const data = await xprisma.$transaction([xprisma.user.findFirst({ select: { id: true } })], {
        isolationLevel: 'Serializable',
      })

      expectTypeOf(data).toEqualTypeOf<[{ id: string } | null]>()
    }
  })

  test('type inference allows for destructuring the array', () => {
    ;async () => {
      const xprisma = prisma.$extends({})

      const [data, count] = await xprisma.$transaction([
        xprisma.user.findFirst({ select: { id: true } }),
        xprisma.user.count(),
      ])

      expectTypeOf(data).toEqualTypeOf<{ id: string } | null>()
      expectTypeOf(count).toEqualTypeOf<number>()
    }
  })
})
