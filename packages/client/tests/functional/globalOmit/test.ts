import { expectTypeOf } from 'expect-type'

import { Providers } from '../_utils/providers'
import { NewPrismaClient } from '../_utils/types'
import testMatrix from './_matrix'
// @ts-ignore
import type { Prisma, PrismaClient } from './node_modules/@prisma/client'

declare let newPrismaClient: NewPrismaClient<typeof PrismaClient>
declare const prisma: PrismaClient

// wrapper around newPrismaClient to correctly infer generic arguments.
// `newPrismaClient` by itself is not smart enough for that and I don't think
// we can make it smarter in a generic way, without having `PrismaClient` on hands.
function clientWithOmit<O extends Prisma.PrismaClientOptions>(options: O): PrismaClient<O> {
  return newPrismaClient(options) as unknown as PrismaClient<O>
}

testMatrix.setupTestSuite(({ provider }) => {
  beforeEach(async () => {
    await prisma.userGroup.deleteMany()
    await prisma.user.deleteMany()
    await prisma.userGroup.create({
      data: {
        name: 'Admins',
        users: {
          create: {
            email: 'user@example.com',
            password: 'hunter2',
          },
        },
      },
    })
  })

  test('throws if omit is not an object', () => {
    expect(() =>
      clientWithOmit({
        // @ts-expect-error
        omit: 'yes',
      }),
    ).toThrowErrorMatchingInlineSnapshot(`
      ""omit" option is expected to be an object.
      Read more at https://pris.ly/d/client-constructor"
    `)
  })

  test('throws if omit is null', () => {
    expect(() =>
      clientWithOmit({
        // @ts-expect-error
        omit: null,
      }),
    ).toThrowErrorMatchingInlineSnapshot(`
      ""omit" option can not be \`null\`
      Read more at https://pris.ly/d/client-constructor"
    `)
  })

  test('throws if unknown model is mentioned in omit', () => {
    expect(() =>
      clientWithOmit({
        omit: {
          // @ts-expect-error
          notAUser: {
            field: true,
          },
        },
      }),
    ).toThrowErrorMatchingInlineSnapshot(`
      "Error validating "omit" option:

      {
        notAUser: {
        ~~~~~~~~
          field: true
        }
      }

      Unknown model name: notAUser.
      Read more at https://pris.ly/d/client-constructor"
    `)
  })

  test('throws if unknown field is mentioned in omit', () => {
    expect(() =>
      clientWithOmit({
        omit: {
          user: {
            // @ts-expect-error
            notAField: true,
          },
        },
      }),
    ).toThrowErrorMatchingInlineSnapshot(`
      "Error validating "omit" option:

      {
        user: {
          notAField: true
          ~~~~~~~~~
        }
      }

      Model "user" does not have a field named "notAField".
      Read more at https://pris.ly/d/client-constructor"
    `)
  })

  test('throws if non boolean field is used in omit', () => {
    expect(() =>
      clientWithOmit({
        omit: {
          user: {
            // @ts-expect-error
            password: 'yes, please',
          },
        },
      }),
    ).toThrowErrorMatchingInlineSnapshot(`
      "Error validating "omit" option:

      {
        user: {
          password: "yes, please"
                    ~~~~~~~~~~~~~
        }
      }

      Omit field option value must be a boolean.
      Read more at https://pris.ly/d/client-constructor"
    `)
  })

  test('throws if relation field is used in omit', () => {
    expect(() =>
      clientWithOmit({
        omit: {
          user: {
            // @ts-expect-error
            group: true,
          },
        },
      }),
    ).toThrowErrorMatchingInlineSnapshot(`
      "Error validating "omit" option:

      {
        user: {
          group: true
          ~~~~~
        }
      }

      Relations are already excluded by default and can not be specified in "omit".
      Read more at https://pris.ly/d/client-constructor"
    `)
  })

  test('findFirstOrThrow', async () => {
    const client = clientWithOmit({
      omit: {
        user: {
          password: true,
        },
      },
    })
    const user = await client.user.findFirstOrThrow()

    expect(user).toHaveProperty('id')
    expect(user).toHaveProperty('email')
    expect(user).not.toHaveProperty('password')

    expectTypeOf(user).toHaveProperty('id')
    expectTypeOf(user).toHaveProperty('email')
    expectTypeOf(user).not.toHaveProperty('password')
  })

  test('findUniqueOrThrow', async () => {
    const client = clientWithOmit({
      omit: {
        user: {
          password: true,
        },
      },
    })
    const user = await client.user.findUniqueOrThrow({ where: { email: 'user@example.com' } })

    expect(user).toHaveProperty('id')
    expect(user).toHaveProperty('email')
    expect(user).not.toHaveProperty('password')

    expectTypeOf(user).toHaveProperty('id')
    expectTypeOf(user).toHaveProperty('email')
    expectTypeOf(user).not.toHaveProperty('password')
  })

  test('findFirst', async () => {
    const client = clientWithOmit({
      omit: {
        user: {
          password: true,
        },
      },
    })
    const user = await client.user.findFirst()

    expect(user).toHaveProperty('id')
    expect(user).toHaveProperty('email')
    expect(user).not.toHaveProperty('password')

    expectTypeOf(user!).toHaveProperty('id')
    expectTypeOf(user!).toHaveProperty('email')
    expectTypeOf(user!).not.toHaveProperty('password')
  })

  test('findUnique', async () => {
    const client = clientWithOmit({
      omit: {
        user: {
          password: true,
        },
      },
    })
    const user = await client.user.findUnique({ where: { email: 'user@example.com' } })

    expect(user).toHaveProperty('id')
    expect(user).toHaveProperty('email')
    expect(user).not.toHaveProperty('password')

    expectTypeOf(user!).toHaveProperty('id')
    expectTypeOf(user!).toHaveProperty('email')
    expectTypeOf(user!).not.toHaveProperty('password')
  })

  test('findMany', async () => {
    const client = clientWithOmit({
      omit: {
        user: {
          password: true,
        },
      },
    })
    const users = await client.user.findMany()

    expect(users[0]).toHaveProperty('id')
    expect(users[0]).toHaveProperty('email')
    expect(users[0]).not.toHaveProperty('password')

    expectTypeOf(users[0]).toHaveProperty('id')
    expectTypeOf(users[0]).toHaveProperty('email')
    expectTypeOf(users[0]).not.toHaveProperty('password')
  })

  test('create', async () => {
    const client = clientWithOmit({
      omit: {
        user: {
          password: true,
        },
      },
    })
    const user = await client.user.create({
      data: {
        email: 'createUser@example.com',
        password: 'hunter2',
      },
    })

    expect(user).toHaveProperty('id')
    expect(user).toHaveProperty('email')
    expect(user).not.toHaveProperty('password')

    expectTypeOf(user).toHaveProperty('id')
    expectTypeOf(user).toHaveProperty('email')
    expectTypeOf(user).not.toHaveProperty('password')
  })

  skipTestIf([Providers.SQLSERVER, Providers.MONGODB, Providers.MYSQL].includes(provider))(
    'createManyAndReturn',
    async () => {
      const client = clientWithOmit({
        omit: {
          user: {
            password: true,
          },
        },
      })
      // @ts-test-if: provider !== Providers.SQLSERVER && provider !== Providers.MONGODB && provider !== Providers.MYSQL
      const users = await client.user.createManyAndReturn({
        data: [
          {
            email: 'createmanyuser1@example.com',
            password: 'hunter2',
          },
        ],
      })

      expect(users[0]).toHaveProperty('id')
      expect(users[0]).toHaveProperty('email')
      expect(users[0]).not.toHaveProperty('password')

      expectTypeOf(users[0]).toHaveProperty('id')
      expectTypeOf(users[0]).toHaveProperty('email')
      // @ts-test-if: provider !== Providers.SQLSERVER && provider !== Providers.MONGODB && provider !== Providers.MYSQL
      expectTypeOf(users[0]).not.toHaveProperty('password')
    },
  )

  test('update', async () => {
    const client = clientWithOmit({
      omit: {
        user: {
          password: true,
        },
      },
    })

    const user = await client.user.update({
      where: {
        email: 'user@example.com',
      },
      data: {
        password: '*******',
      },
    })

    expect(user).toHaveProperty('id')
    expect(user).toHaveProperty('email')
    expect(user).not.toHaveProperty('password')

    expectTypeOf(user).toHaveProperty('id')
    expectTypeOf(user).toHaveProperty('email')
    expectTypeOf(user).not.toHaveProperty('password')
  })

  test('upsert', async () => {
    const client = clientWithOmit({
      omit: {
        user: {
          password: true,
        },
      },
    })

    const user = await client.user.upsert({
      where: {
        email: 'userUpsert@example.com',
      },
      create: {
        email: 'userUpsert@example.com',
        password: '*******',
      },
      update: {
        password: '*******',
      },
    })

    expect(user).toHaveProperty('id')
    expect(user).toHaveProperty('email')
    expect(user).not.toHaveProperty('password')

    expectTypeOf(user).toHaveProperty('id')
    expectTypeOf(user).toHaveProperty('email')
    expectTypeOf(user).not.toHaveProperty('password')
  })

  test('allows to include globally omitted field with omit: false', async () => {
    const client = clientWithOmit({
      omit: {
        user: {
          password: true,
        },
      },
    })
    const user = await client.user.findFirstOrThrow({
      omit: { password: false },
    })

    expect(user).toHaveProperty('id')
    expect(user).toHaveProperty('email')
    expect(user).toHaveProperty('password')

    expectTypeOf(user).toHaveProperty('id')
    expectTypeOf(user).toHaveProperty('email')
    expectTypeOf(user).toHaveProperty('password')
  })

  test('allows to include globally omitted field with select: true', async () => {
    const client = clientWithOmit({
      omit: {
        user: {
          password: true,
        },
      },
    })
    const user = await client.user.findFirstOrThrow({
      select: { id: true, password: true },
    })

    expect(user).toHaveProperty('id')
    expect(user).toHaveProperty('password')

    expectTypeOf(user).toHaveProperty('id')
    expectTypeOf(user).toHaveProperty('password')
  })

  test('works for nested relations (include)', async () => {
    const client = clientWithOmit({
      omit: {
        user: {
          password: true,
        },
      },
    })

    const group = await client.userGroup.findFirstOrThrow({
      include: {
        users: true,
      },
    })
    const user = group.users[0]
    expect(user).toHaveProperty('id')
    expect(user).toHaveProperty('email')
    expect(user).not.toHaveProperty('password')

    expectTypeOf(user).toHaveProperty('id')
    expectTypeOf(user).toHaveProperty('email')
    expectTypeOf(user).not.toHaveProperty('password')
  })

  test('works for nested relations (select)', async () => {
    const client = clientWithOmit({
      omit: {
        user: {
          password: true,
        },
      },
    })

    client.$extends

    const group = await client.userGroup.findFirstOrThrow({
      select: {
        users: true,
      },
    })
    const user = group.users[0]
    expect(user).toHaveProperty('id')
    expect(user).toHaveProperty('email')
    expect(user).not.toHaveProperty('password')

    expectTypeOf(user).toHaveProperty('id')
    expectTypeOf(user).toHaveProperty('email')
    expectTypeOf(user).not.toHaveProperty('password')
  })

  test('works for fluent api', async () => {
    const client = clientWithOmit({
      omit: {
        user: {
          password: true,
        },
      },
    })

    const users = await client.userGroup.findFirst().users()
    expect(users![0]).toHaveProperty('id')
    expect(users![0]).toHaveProperty('email')
    expect(users![0]).not.toHaveProperty('password')

    expectTypeOf(users![0]).toHaveProperty('id')
    expectTypeOf(users![0]).toHaveProperty('email')
    expectTypeOf(users![0]).not.toHaveProperty('password')
  })

  test('works after extending the client', async () => {
    const client = clientWithOmit({
      omit: {
        user: {
          password: true,
        },
      },
    }).$extends({})
    const user = await client.user.findFirstOrThrow()

    expect(user).toHaveProperty('id')
    expect(user).toHaveProperty('email')
    expect(user).not.toHaveProperty('password')

    expectTypeOf(user).toHaveProperty('id')
    expectTypeOf(user).toHaveProperty('email')
    expectTypeOf(user).not.toHaveProperty('password')
  })

  test('works with fluent api after extending the client', async () => {
    const client = clientWithOmit({
      omit: {
        user: {
          password: true,
        },
      },
    }).$extends({})
    const users = await client.userGroup.findFirst().users()

    expect(users![0]).toHaveProperty('id')
    expect(users![0]).toHaveProperty('email')
    expect(users![0]).not.toHaveProperty('password')

    expectTypeOf(users![0]).toHaveProperty('id')
    expectTypeOf(users![0]).toHaveProperty('email')
    expectTypeOf(users![0]).not.toHaveProperty('password')
  })

  test('works with result extension, depending on explicitly omitted field', async () => {
    const client = clientWithOmit({
      omit: {
        user: {
          password: true,
        },
      },
    }).$extends({
      result: {
        user: {
          bigPassword: {
            needs: { password: true },
            compute(data) {
              return data.password.toUpperCase()
            },
          },
        },
      },
    })

    const user = await client.user.findUniqueOrThrow({
      where: {
        email: 'user@example.com',
      },
    })

    expect(user.bigPassword).toBe('HUNTER2')
    expect(user).not.toHaveProperty('password')

    expectTypeOf(user).not.toHaveProperty('password')
  })
})
