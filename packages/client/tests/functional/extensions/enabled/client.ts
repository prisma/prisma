import { expectTypeOf } from 'expect-type'

import testMatrix from './_matrix'
// @ts-ignore
import type { Prisma as PrismaNamespace, PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient
declare let Prisma: typeof PrismaNamespace

testMatrix.setupTestSuite(() => {
  test('allows to extend client', () => {
    const $extMethod = jest.fn()
    const xprisma = prisma.$extends({
      client: { $extMethod },
    })

    xprisma.$extMethod()

    expect($extMethod).toHaveBeenCalled()
  })

  test('forwards arguments to an extension method', () => {
    const $extMethod = jest.fn()
    const xprisma = prisma.$extends({
      client: { $extMethod },
    })

    xprisma.$extMethod(123, 'hello')

    expect($extMethod).toHaveBeenCalledWith(123, 'hello')
  })

  test('forwards return value from  an extension method', () => {
    const $extMethod = jest.fn().mockReturnValue('hello from extension')
    const xprisma = prisma.$extends({
      client: { $extMethod },
    })

    expect(xprisma.$extMethod()).toBe('hello from extension')
  })

  test('allows single extension to have multiple extension methods', () => {
    const $extMethod1 = jest.fn()
    const $extMethod2 = jest.fn()
    const xprisma = prisma.$extends({
      client: { $extMethod1, $extMethod2 },
    })

    xprisma.$extMethod1()
    xprisma.$extMethod2()

    expect($extMethod1).toHaveBeenCalled()
    expect($extMethod2).toHaveBeenCalled()
  })

  test('allows extension methods to call each other', () => {
    const $extMethod1 = jest.fn()
    const xprisma = prisma.$extends({
      client: {
        $extMethod1,
        $extMethod2() {
          const ctx = Prisma.getExtensionContext(this)

          expectTypeOf(ctx).toHaveProperty('$extMethod1').toEqualTypeOf($extMethod1)

          ctx.$extMethod1()
        },
      },
    })

    xprisma.$extMethod2()

    expect($extMethod1).toHaveBeenCalled()
  })

  test('allows to have multiple client extensions with their own methods', () => {
    const $extMethod1 = jest.fn()
    const $extMethod2 = jest.fn()
    const xprisma = prisma
      .$extends({
        client: { $extMethod1 },
      })
      .$extends({
        client: { $extMethod2 },
      })

    xprisma.$extMethod1()
    xprisma.$extMethod2()

    expect($extMethod1).toHaveBeenCalled()
    expect($extMethod2).toHaveBeenCalled()
  })

  test('in case of name conflict, later extension wins', () => {
    const original = jest.fn()
    const override = jest.fn()
    const xprisma = prisma
      .$extends({
        client: { $extMethod: original },
      })
      .$extends({ client: { $extMethod: override } })

    xprisma.$extMethod()

    expect(original).not.toHaveBeenCalled()
    expect(override).toHaveBeenCalled()
  })

  test('allows to override builtin methods', async () => {
    const transactionOverride = jest.fn()
    const xprisma = prisma.$extends({
      client: { $transaction: transactionOverride },
    })

    await xprisma.$transaction()

    expect(transactionOverride).toHaveBeenCalled()
  })

  test('allows to call builtin methods from extensions', async () => {
    const xprisma = prisma.$extends({
      client: {
        // TODO: remove any once types are generated
        $myTransaction(this: any, ...args: any[]) {
          return this.$transaction(args)
        },
      },
    })

    const results = await xprisma.$myTransaction()
    expect(results).toEqual([])
  })

  test('allows extension to call other extensions', () => {
    const $extMethod1 = jest.fn()
    const xprisma = prisma
      .$extends({
        client: { $extMethod1 },
      })
      .$extends({
        client: {
          $extMethod2() {
            const ctx = Prisma.getExtensionContext(this)

            expectTypeOf(ctx).toHaveProperty('$extMethod1').toEqualTypeOf($extMethod1)

            ctx.$extMethod1()
          },
        },
      })

    xprisma.$extMethod2()

    expect($extMethod1).toHaveBeenCalled()
  })

  test('can access models', async () => {
    const xprisma = prisma.$extends({
      client: {
        $findAllUsers() {
          const ctx = Prisma.getExtensionContext(this)

          expectTypeOf(ctx).toHaveProperty('user').toHaveProperty('findMany').toMatchTypeOf<Function>()

          return ctx.user.findMany({})
        },
      },
    })

    const results = await xprisma.$findAllUsers()
    expect(results).toEqual([])
  })

  test('empty extension does nothing', async () => {
    const xprisma = prisma
      .$extends({
        client: {
          $findAllUsers() {
            const ctx = Prisma.getExtensionContext(this)

            return ctx.user.findMany({})
          },
        },
      })
      .$extends({})
      .$extends({ client: {} })

    const results = await xprisma.$findAllUsers()
    expect(results).toEqual([])
  })

  test('only accepts methods', () => {
    prisma.$extends({
      client: {
        // @ts-expect-error
        badInput: 1,
      },
    })
  })

  test('error in extension method', () => {
    const xprisma = prisma.$extends({
      name: 'Faulty client extension',
      client: {
        $fail() {
          throw new Error('What a terrible failure')
        },
      },
    })

    expect(() => xprisma.$fail()).toThrowErrorMatchingInlineSnapshot(`What a terrible failure`)
  })

  test('error in async extension method', async () => {
    const xprisma = prisma.$extends({
      name: 'Faulty async extension',
      client: {
        $fail() {
          return Promise.reject(new Error('What a terrible failure'))
        },
      },
    })

    await expect(() => xprisma.$fail()).rejects.toThrowErrorMatchingInlineSnapshot(`What a terrible failure`)
  })

  test('error in extension method with no name', () => {
    const xprisma = prisma.$extends({
      client: {
        $fail() {
          throw new Error('What a terrible failure')
        },
      },
    })

    expect(() => xprisma.$fail()).toThrowErrorMatchingInlineSnapshot(`What a terrible failure`)
  })

  test('custom method re-using input to augment', () => {
    const xprisma = prisma.$extends({
      client: {
        $executeRawCustom<T, A extends any[]>(
          this: T,
          ...args: PrismaNamespace.Exact<A, [...PrismaNamespace.Args<T, '$executeRaw'>, { extra: boolean }]>
        ): PrismaNamespace.Result<T, A, '$executeRaw'> {
          return {} as any
        },
      },
    })

    // @ts-test-if: provider !== 'mongodb'
    xprisma.$executeRawCustom(Prisma.sql`SELECT * FROM User`, { extra: true })
  })
})
