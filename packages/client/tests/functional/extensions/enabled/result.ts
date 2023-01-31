import { faker } from '@faker-js/faker'
import { expectTypeOf } from 'expect-type'

import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient

const email = faker.internet.email()

function prismaWithExtension() {
  return prisma.$extends({
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
}

testMatrix.setupTestSuite(() => {
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

  test('findFirst', async () => {
    const xprisma = prismaWithExtension()

    const user = await xprisma.user.findFirst({})
    expect(user?.fullName).toBe('John Smith')
  })

  test('findFirst using $allModels', async () => {
    const xprisma = prisma.$extends({
      result: {
        $allModels: {
          computed: {
            compute: () => 123,
          },
        },
      },
    })

    const user = await xprisma.user.findFirst({})
    expect(user?.computed).toBe(123)
  })

  test('findUnique', async () => {
    const xprisma = prismaWithExtension()

    const user = await xprisma.user.findUnique({ where: { email } })
    expect(user?.fullName).toBe('John Smith')
  })

  test('findMany', async () => {
    const xprisma = prismaWithExtension()

    const user = await xprisma.user.findMany({})
    expect(user[0].fullName).toBe('John Smith')
  })

  test('create', async () => {
    const xprisma = prismaWithExtension()

    const user = await xprisma.user.create({
      data: {
        firstName: 'Max',
        lastName: 'Mustermann',
        email: faker.internet.email(),
      },
    })
    expect(user.fullName).toBe('Max Mustermann')
  })

  test('update', async () => {
    const xprisma = prismaWithExtension()
    const user = await xprisma.user.update({
      where: { email },
      data: { firstName: 'Jane' },
    })

    expect(user.fullName).toBe('Jane Smith')
  })

  test('upsert - update', async () => {
    const xprisma = prismaWithExtension()
    const user = await xprisma.user.upsert({
      where: { email },
      update: { firstName: 'Jane' },
      create: { email, firstName: 'Create', lastName: 'Shouldnothappen' },
    })

    expect(user.fullName).toBe('Jane Smith')
  })

  test('upsert - create', async () => {
    const nonExistingEmail = faker.internet.email()
    const xprisma = prismaWithExtension()
    const user = await xprisma.user.upsert({
      where: { email: nonExistingEmail },
      update: { firstName: 'Update', lastName: 'Shouldnothappen' },
      create: { email: nonExistingEmail, firstName: 'Jane', lastName: 'Smith' },
    })

    expect(user.fullName).toBe('Jane Smith')
  })

  test('when using select', async () => {
    const xprisma = prismaWithExtension()

    const user = await xprisma.user.findFirst({
      select: {
        fullName: true,
      },
    })
    expect(user?.fullName).toBe('John Smith')
    expect(user).not.toHaveProperty('firstName')
    expect(user).not.toHaveProperty('lastName')
  })

  test('when using select and $allModels', async () => {
    const xprisma = prisma.$extends({
      result: {
        $allModels: {
          computed: {
            compute: () => 123,
          },
        },
      },
    })

    const user = await xprisma.user.findFirst({
      select: {
        id: true, // TODO: since computed field has no dependencies,
        // we need to query at least one non-computed field in order for query to succeed
        computed: true,
      },
    })
    expect(user?.computed).toBe(123)
  })

  test('relationships: with include', async () => {
    const xprisma = prismaWithExtension()
    const post = await xprisma.post.findFirst({ include: { user: true } })

    expect(post?.user.fullName).toBe('John Smith')
  })

  test('relationships: with select', async () => {
    const xprisma = prismaWithExtension()
    const post = await xprisma.post.findFirst({ select: { user: true } })

    expect(post?.user.fullName).toBe('John Smith')
  })

  test('relationships: with deep select', async () => {
    const xprisma = prismaWithExtension()
    const post = await xprisma.post.findFirst({ select: { user: { select: { fullName: true } } } })

    expect(post?.user.fullName).toBe('John Smith')
  })

  test('relationships: mixed include and select', async () => {
    const xprisma = prismaWithExtension()
    const post = await xprisma.post.findFirst({ include: { user: { select: { fullName: true } } } })

    expect(post?.user.fullName).toBe('John Smith')
  })

  test('dependencies between computed fields', async () => {
    const xprisma = prismaWithExtension().$extends({
      result: {
        user: {
          loudName: {
            needs: { fullName: true },
            compute(user) {
              expectTypeOf(user.fullName).toEqualTypeOf<string>()
              return user.fullName.toUpperCase()
            },
          },
        },
      },
    })

    const user = await xprisma.user.findFirst()
    expect(user?.loudName).toBe('JOHN SMITH')
  })

  test('shadowing dependency', async () => {
    const xprisma = prisma.$extends({
      result: {
        user: {
          firstName: {
            needs: { firstName: true },
            compute(user) {
              return user.firstName.toUpperCase()
            },
          },
        },
      },
    })

    const user = await xprisma.user.findFirst()
    expect(user?.firstName).toBe('JOHN')
  })

  test('shadowing dependency multiple times', async () => {
    const xprisma = prisma
      .$extends({
        result: {
          user: {
            firstName: {
              needs: { firstName: true },
              compute(user) {
                return user.firstName.toUpperCase()
              },
            },
          },
        },
      })
      .$extends({
        result: {
          user: {
            firstName: {
              needs: { firstName: true },
              compute(user) {
                return `${user.firstName}!!!`
              },
            },
          },
        },
      })

    const user = await xprisma.user.findFirst()
    expect(user?.firstName).toBe('JOHN!!!')
  })

  test('empty extension does nothing', async () => {
    const xprisma = prismaWithExtension()
      .$extends({
        result: {},
      })
      .$extends({
        result: {
          user: {},
        },
      })

    const user = await xprisma.user.findFirst({})
    expect(user?.fullName).toBe('John Smith')
  })

  test('with null result', async () => {
    const xprisma = prismaWithExtension()

    const user = await xprisma.user.findUnique({ where: { email: 'nothere@example.com' } })
    expect(user).toBeNull()
  })

  test('error in computed field', async () => {
    const xprisma = prisma.$extends({
      name: 'Faulty extension',
      result: {
        user: {
          fullName: {
            needs: { firstName: true, lastName: true },
            compute() {
              throw new Error('oops!')
            },
          },
        },
      },
    })

    const user = await xprisma.user.findFirstOrThrow({})
    expect(() => user.fullName).toThrowErrorMatchingInlineSnapshot(`oops!`)
  })

  test('error in computed field with no name', async () => {
    const xprisma = prisma.$extends({
      result: {
        user: {
          fullName: {
            needs: { firstName: true, lastName: true },
            compute() {
              throw new Error('oops!')
            },
          },
        },
      },
    })

    const user = await xprisma.user.findFirstOrThrow({})
    expect(() => user.fullName).toThrowErrorMatchingInlineSnapshot(`oops!`)
  })

  test('nested includes should include scalars and relations', async () => {
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

    const user = await xprisma.user.findFirstOrThrow({
      include: {
        posts: {
          where: {}, // testing with where as it caused issues
          include: {
            user: {
              include: {
                posts: true,
              },
            },
          },
        },
      },
    })

    expectTypeOf(user.id).toEqualTypeOf<string>()
    expectTypeOf(user.posts[0].id).toEqualTypeOf<string>()
    expectTypeOf(user.posts[0].user.id).toEqualTypeOf<string>()
    expectTypeOf(user.posts[0].user.posts[0].id).toEqualTypeOf<string>()
    expectTypeOf(user.posts[0].user.posts[0]).not.toHaveProperty('user')
  })
})
