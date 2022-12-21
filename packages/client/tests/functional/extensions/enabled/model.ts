import { expectTypeOf } from 'expect-type'

import testMatrix from './_matrix'
// @ts-ignore
import type { Prisma as PrismaNamespace, PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient
declare let Prisma: typeof PrismaNamespace

testMatrix.setupTestSuite(() => {
  test('extend specific model', () => {
    const extMethod = jest.fn()
    const xprisma = prisma.$extends({
      model: {
        user: {
          extMethod,
        },
      },
    })

    xprisma.user.extMethod()

    expect(extMethod).toHaveBeenCalledTimes(1)
    expect((xprisma.post as any).extMethod).toBeUndefined()
  })

  test('extend all models', () => {
    const extMethod = jest.fn()
    const xprisma = prisma.$extends({
      model: {
        $allModels: {
          extMethod,
        },
      },
    })

    xprisma.user.extMethod()
    xprisma.post.extMethod()

    expect(extMethod).toHaveBeenCalledTimes(2)
  })

  test('pass arguments to ext method', () => {
    const extMethod = jest.fn()
    const xprisma = prisma.$extends({
      model: {
        user: {
          extMethod,
        },
      },
    })

    xprisma.user.extMethod('hello', 'world')
    expect(extMethod).toHaveBeenCalledWith('hello', 'world')
  })

  test('return value to ext method', () => {
    const extMethod = jest.fn().mockReturnValue('hi!')
    const xprisma = prisma.$extends({
      model: {
        user: {
          extMethod,
        },
      },
    })

    expect(xprisma.user.extMethod()).toBe('hi!')
  })

  test('specific model extension has precedence over $allModels', () => {
    const genericMethod = jest.fn()
    const specificMethod = jest.fn()
    const xprisma = prisma.$extends({
      model: {
        $allModels: {
          extMethod: genericMethod,
        },
        user: {
          extMethod: specificMethod,
        },
      },
    })

    xprisma.user.extMethod()

    expect(specificMethod).toHaveBeenCalled()
    expect(genericMethod).not.toHaveBeenCalled()
  })

  test('last extension takes precedence over earlier ones', () => {
    const firstMethod = jest.fn()
    const secondMethod = jest.fn()
    const xprisma = prisma
      .$extends({
        model: {
          user: {
            extMethod: firstMethod,
          },
        },
      })
      .$extends({
        model: {
          user: {
            extMethod: secondMethod,
          },
        },
      })

    xprisma.user.extMethod()

    expect(secondMethod).toHaveBeenCalled()
    expect(firstMethod).not.toHaveBeenCalled()
  })

  test('allows to override built-in methods', async () => {
    const extMethod = jest.fn()
    const xprisma = prisma.$extends({
      model: {
        user: {
          findFirst: extMethod,
        },
      },
    })

    await xprisma.user.findFirst({})

    expect(extMethod).toHaveBeenCalled()
  })

  test('non-conflicting extensions can co-exist', () => {
    const firstMethod = jest.fn()
    const secondMethod = jest.fn()
    const xprisma = prisma
      .$extends({
        model: {
          user: {
            firstMethod,
          },
        },
      })
      .$extends({
        model: {
          user: {
            secondMethod,
          },
        },
      })

    xprisma.user.firstMethod()
    xprisma.user.secondMethod()

    expect(firstMethod).toHaveBeenCalled()
    expect(secondMethod).toHaveBeenCalled()
  })

  test('extension methods can call each other', () => {
    const helper = jest.fn()
    const xprisma = prisma.$extends({
      model: {
        user: {
          helper,
          extMethod() {
            this.helper()
          },
        },
      },
    })

    xprisma.user.extMethod()
    expect(helper).toHaveBeenCalled()
  })

  test('extension methods can call model methods', async () => {
    const xprisma = prisma.$extends({
      model: {
        user: {
          myFind() {
            const ctx = Prisma.getExtensionContext(this)

            return ctx.findMany({})
          },
        },
      },
    })

    const users = await xprisma.user.myFind()
    expect(users).toEqual([])
  })

  test('extension methods can call methods of other extensions', () => {
    const firstMethod = jest.fn()
    const xprisma = prisma
      .$extends({
        model: {
          user: {
            firstMethod,
          },
        },
      })
      .$extends({
        model: {
          user: {
            secondMethod() {
              const ctx = Prisma.getExtensionContext(this)

              ctx.firstMethod()
            },
          },
        },
      })

    xprisma.user.secondMethod()

    expect(firstMethod).toHaveBeenCalled()
  })

  test('empty extension does nothing', async () => {
    const xprisma = prisma
      .$extends({
        model: {
          user: {
            myFind() {
              const ctx = Prisma.getExtensionContext(this)

              return ctx.findMany({})
            },
          },
        },
      })
      .$extends({})
      .$extends({
        model: {
          user: {},
        },
      })

    const users = await xprisma.user.myFind()
    expect(users).toEqual([])
  })

  test('only accepts methods', () => {
    prisma.$extends({
      model: {
        // @ts-expect-error
        badInput: 1,
      },
    })
  })

  test('error in extension methods', () => {
    const xprisma = prisma.$extends({
      name: 'Faulty model',
      model: {
        user: {
          fail() {
            throw new Error('Fail!')
          },
        },
      },
    })

    expect(() => xprisma.user.fail()).toThrowErrorMatchingInlineSnapshot(
      `Error caused by extension "Faulty model": Fail!`,
    )
  })

  test('error in async methods', async () => {
    const xprisma = prisma.$extends({
      name: 'Faulty model',
      model: {
        user: {
          fail() {
            return Promise.reject(new Error('Fail!'))
          },
        },
      },
    })

    await expect(xprisma.user.fail()).rejects.toThrowErrorMatchingInlineSnapshot(
      `Error caused by extension "Faulty model": Fail!`,
    )
  })

  test('error in extension methods without name', () => {
    const xprisma = prisma.$extends({
      model: {
        user: {
          fail() {
            throw new Error('Fail!')
          },
        },
      },
    })

    expect(() => xprisma.user.fail()).toThrowErrorMatchingInlineSnapshot(`Error caused by an extension: Fail!`)
  })

  test('custom method re-using input types to augment them via intersection', () => {
    const xprisma = prisma.$extends({
      model: {
        $allModels: {
          findFirstOrCreate<T, A>(
            this: T,
            args: PrismaNamespace.Exact<
              A,
              PrismaNamespace.Args<T, 'findUniqueOrThrow'> & {
                cache: boolean
              }
            >,
          ): A {
            return args as any as A
          },
        },
      },
    })

    const args = xprisma.user.findFirstOrCreate({
      cache: true,
      where: {
        id: '1',
      },
    })

    expectTypeOf(args).toEqualTypeOf<{ cache: true; where: { id: '1' } }>
  })

  test('custom method re-using input types to augment them via mapped type', () => {
    type Nullable<T> = {
      [K in keyof T]: T[K] | null
    }

    const xprisma = prisma.$extends({
      model: {
        $allModels: {
          findFirstOrCreate<T, A>(
            this: T,
            args: PrismaNamespace.Exact<A, Nullable<PrismaNamespace.Args<T, 'findUniqueOrThrow'>>>,
          ): A {
            return args as any as A
          },
        },
      },
    })

    const args = xprisma.user.findFirstOrCreate({
      include: null,
      where: {
        id: '1',
      },
    })

    expectTypeOf(args).toMatchTypeOf<{ include: null; where: { id: '1' } }>
  })

  test('custom method re-using output to augment it via mapped type', () => {
    type Nullable<T> = {
      [K in keyof T]: T[K] | null
    }

    const xprisma = prisma.$extends({
      model: {
        $allModels: {
          findFirstOrCreate<T, A>(
            this: T,
            args: PrismaNamespace.Exact<A, Nullable<PrismaNamespace.Args<T, 'findUniqueOrThrow'>>>,
          ): PrismaNamespace.Result<T, A, 'findUniqueOrThrow'> {
            return {} as any
          },
        },
      },
    })

    const data = xprisma.user.findFirstOrCreate({
      include: null,
      where: {
        id: '1',
      },
    })

    expectTypeOf(data).toMatchTypeOf<{
      id: string
      email: string
      firstName: string
      lastName: string
    }>
  })
})
