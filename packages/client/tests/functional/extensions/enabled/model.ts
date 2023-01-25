import { expectTypeOf } from 'expect-type'

import { waitFor } from '../../_utils/tests/waitFor'
import { NewPrismaClient } from '../../_utils/types'
import testMatrix from './_matrix'
// @ts-ignore
import type { Prisma as PrismaNamespace, PrismaClient } from './node_modules/@prisma/client'

declare let Prisma: typeof PrismaNamespace
let prisma: PrismaClient
declare const newPrismaClient: NewPrismaClient<typeof PrismaClient>

testMatrix.setupTestSuite(
  ({ provider }) => {
    beforeEach(() => {
      prisma = newPrismaClient({
        log: [{ emit: 'event', level: 'query' }],
      })
    })

    afterEach(async () => {
      await prisma.$disconnect()
    })

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

    test('error in async PrismaPromise methods', async () => {
      const xprisma = prisma.$extends((client) => {
        return client.$extends({
          name: 'Faulty model',
          model: {
            user: {
              fail() {
                const ctx = Prisma.getExtensionContext(this)
                return ctx.findUnique({
                  // @ts-expect-error
                  badInput: true,
                })
              },
            },
          },
        })
      })

      await expect(xprisma.user.fail()).rejects.toThrowErrorMatchingInlineSnapshot(`
      Error caused by extension "Faulty model": 
      Invalid \`prisma.user.findUnique()\` invocation:

      {
        badInput: true,
        ~~~~~~~~
      + where: {
      +   id?: String,
      +   email?: String
      + }
      }

      Unknown arg \`badInput\` in badInput for type User. Did you mean \`select\`?
      Argument where is missing.

      Note: Lines with + are required

    `)
    })

    // skipping data proxy because query count isn't the same
    testIf(provider !== 'mongodb' && process.platform !== 'win32' && !!process.env.DATA_PROXY)(
      'batching of PrismaPromise returning custom model methods',
      async () => {
        const fnEmitter = jest.fn()

        // @ts-expect-error
        prisma.$on('query', fnEmitter)

        const xprisma = prisma.$extends({
          model: {
            user: {
              fn() {
                const ctx = Prisma.getExtensionContext(this)
                return Object.assign(ctx.findFirst(), { prop: 'value' })
              },
            },
          },
        })

        const data = await xprisma.$transaction([xprisma.user.fn(), xprisma.user.fn()])

        expect(data).toMatchInlineSnapshot(`
        [
          null,
          null,
        ]
      `)

        await waitFor(() => {
          expect(fnEmitter).toHaveBeenCalledTimes(4)
          expect(fnEmitter.mock.calls).toMatchObject([
            [{ query: expect.stringContaining('BEGIN') }],
            [{ query: expect.stringContaining('SELECT') }],
            [{ query: expect.stringContaining('SELECT') }],
            [{ query: expect.stringContaining('COMMIT') }],
          ])
        })
      },
    )

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

      expectTypeOf(args).toHaveProperty('cache').toEqualTypeOf<true>()
      expectTypeOf(args).toHaveProperty('where').toEqualTypeOf<{ id: '1' }>()
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

      expectTypeOf(args).toHaveProperty('include').toEqualTypeOf<null>()
      expectTypeOf(args).toHaveProperty('where').toEqualTypeOf<{ id: '1' }>()
    })

    test('custom method re-using output to augment it via intersection', () => {
      const xprisma = prisma.$extends({
        model: {
          $allModels: {
            findFirstOrCreate<T, A>(
              this: T,
              args: PrismaNamespace.Exact<A, PrismaNamespace.Args<T, 'findUniqueOrThrow'>>,
            ): PrismaNamespace.Result<T, A, 'findUniqueOrThrow'> & { extra: boolean } {
              return {} as any
            },
          },
        },
      })

      const data = xprisma.user.findFirstOrCreate({
        where: {
          id: '1',
        },
      })

      expectTypeOf(data).toHaveProperty('extra').toEqualTypeOf<boolean>()
      expectTypeOf(data).toHaveProperty('id').toEqualTypeOf<string>()
      expectTypeOf(data).toHaveProperty('email').toEqualTypeOf<string>()
      expectTypeOf(data).toHaveProperty('firstName').toEqualTypeOf<string>()
      expectTypeOf(data).toHaveProperty('lastName').toEqualTypeOf<string>()
    })

    test('custom method re-using payload output types', () => {
      const xprisma = prisma.$extends({
        model: {
          $allModels: {
            findFirstOrCreate<T>(this: T) {
              return {} as PrismaNamespace.Payload<T, 'findUniqueOrThrow'>
            },
          },
        },
      })

      const data = xprisma.user.findFirstOrCreate()

      expectTypeOf<typeof data>().toHaveProperty('scalars').toMatchTypeOf<object>()
      expectTypeOf<typeof data>().toHaveProperty('objects').toMatchTypeOf<object>()
      expectTypeOf<typeof data['scalars']>().toHaveProperty('id').toMatchTypeOf<string>()
      expectTypeOf<typeof data['objects']>().toHaveProperty('posts').toMatchTypeOf<object>()
      expectTypeOf<typeof data['objects']['posts']>().toMatchTypeOf<object[]>()
      expectTypeOf<typeof data['objects']['posts'][0]>().toMatchTypeOf<object>()
      expectTypeOf<typeof data['objects']['posts'][0]>().toHaveProperty('scalars').toMatchTypeOf<object>()
      expectTypeOf<typeof data['objects']['posts'][0]>().toHaveProperty('objects').toMatchTypeOf<object>()
    })

    test('custom method that uses exact for narrowing inputs', () => {
      const xprisma = prisma.$extends({
        model: {
          $allModels: {
            findFirstOrCreate<T, A>(
              this: T,
              args: PrismaNamespace.Exact<
                A,
                {
                  guestName: string
                  foodChoice: ('starters' | 'main' | 'desert' | 'drink')[]
                  allergies: string[]
                  vegan: boolean
                }
              >,
            ): A {
              return {} as any
            },
          },
        },
      })

      const data = xprisma.user.findFirstOrCreate({
        allergies: ['nuts'],
        foodChoice: ['starters', 'main'],
        guestName: 'John',
        vegan: false,
      })

      expectTypeOf(data).toEqualTypeOf<{
        allergies: ['nuts']
        foodChoice: ['starters', 'main']
        guestName: 'John'
        vegan: false
      }>()

      void xprisma.user.findFirstOrCreate({
        // @ts-expect-error
        allergies: 'invalid',
        // @ts-expect-error
        foodChoice: ['starters', 'invalid'],
        // @ts-expect-error
        guestName: null,
        // @ts-expect-error
        vegan: 'invalid',
      })
    })

    test('custom method that uses exact for narrowing generic inputs', () => {
      type Pick<T, K extends string | number | symbol> = {
        [P in keyof T as P extends K ? P : never]: T[P]
      }

      type Input<T> = {
        where: Pick<
          PrismaNamespace.Args<T, 'findMany'>['where'],
          keyof PrismaNamespace.Payload<T, 'findMany'>['scalars']
        >
        include: PrismaNamespace.Args<T, 'findMany'>['include']
      }

      const xprisma = prisma.$extends({
        model: {
          $allModels: {
            findFirstOrCreate<T, A>(this: T, args: PrismaNamespace.Exact<A, Input<T>>): A {
              return {} as any
            },
          },
        },
      })

      const data = xprisma.user.findFirstOrCreate({
        where: {
          email: 'test',
          // @ts-expect-error
          posts: {
            none: {
              id: '1',
            },
          },
        },
        include: {},
      })

      expectTypeOf(data).toEqualTypeOf<{
        where: {
          email: 'test'
          posts: {
            none: {
              id: '1'
            }
          }
        }
        include: {}
      }>()
    })

    test('getExtension context on specific model and non-generic this', () => {
      const xprisma = prisma.$extends({
        model: {
          user: {
            myCustomCallB() {},
            myCustomCallA() {
              const ctx = Prisma.getExtensionContext(this)

              expect(ctx.name).toEqual('User')

              return ctx
            },
          },
        },
      })

      const ctx = xprisma.user.myCustomCallA()
      expectTypeOf(ctx).toHaveProperty('name').toEqualTypeOf<string>()
      expectTypeOf(ctx).toHaveProperty('myCustomCallB').toEqualTypeOf<() => void>()
      expectTypeOf(ctx).toHaveProperty('update').toMatchTypeOf<Function>()
    })

    test('getExtension context on generic model and non-generic this', () => {
      const xprisma = prisma.$extends({
        model: {
          $allModels: {
            myCustomCallB() {},
            myCustomCallA() {
              const ctx = Prisma.getExtensionContext(this)

              expect(ctx.name).toEqual('User')

              return ctx
            },
          },
        },
      })

      const ctx = xprisma.user.myCustomCallA()
      expectTypeOf(ctx).toHaveProperty('name').toEqualTypeOf<string>()
      expectTypeOf(ctx).toHaveProperty('myCustomCallB').toEqualTypeOf<() => void>()
      expectTypeOf(ctx).not.toHaveProperty('update')
    })

    test('getExtension context on specific model and generic this', () => {
      const xprisma = prisma.$extends({
        model: {
          user: {
            myCustomCallB() {},
            myCustomCallA<T>(this: T) {
              const ctx = Prisma.getExtensionContext(this)

              expect(ctx.name).toEqual('User')

              return ctx
            },
          },
        },
      })

      const ctx = xprisma.user.myCustomCallA()
      expectTypeOf(ctx).toHaveProperty('name').toEqualTypeOf<string>()
      expectTypeOf(ctx).toHaveProperty('myCustomCallB').toEqualTypeOf<() => void>()
      expectTypeOf(ctx).toHaveProperty('update').toMatchTypeOf<Function>()
    })

    test('getExtension context on generic model and generic this', () => {
      const xprisma = prisma.$extends({
        model: {
          $allModels: {
            myCustomCallB() {},
            myCustomCallA<T>(this: T) {
              const ctx = Prisma.getExtensionContext(this)

              expect(ctx.name).toEqual('User')

              return ctx
            },
          },
        },
      })

      const ctx = xprisma.user.myCustomCallA()
      expectTypeOf(ctx).toHaveProperty('name').toEqualTypeOf<string>()
      expectTypeOf(ctx).toHaveProperty('myCustomCallB').toEqualTypeOf<() => void>()
      expectTypeOf(ctx).toHaveProperty('update').toMatchTypeOf<Function>()
    })
  },
  {
    skipDefaultClientInstance: true,
  },
)
