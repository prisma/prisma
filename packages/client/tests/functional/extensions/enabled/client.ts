import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient

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
          this.$extMethod1()
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

  // TODO: we should align compile and run- time behavior here: this
  // should either be valid in both cases, or error in both cases. Right now,
  // it works in runtime but we are not sure we can make it work on a type level
  // https://github.com/prisma/client-planning/issues/108
  test('allows extension to call other extensions', () => {
    const extMethod1 = jest.fn()
    const xprisma = prisma
      .$extends({
        client: { extMethod1 },
      })
      .$extends({
        client: {
          $extMethod2(this: any) {
            this.extMethod1()
          },
        },
      })

    xprisma.$extMethod2()

    expect(extMethod1).toHaveBeenCalled()
  })

  test('can access models', async () => {
    const xprisma = prisma.$extends({
      client: {
        // TODO: remove after correct types are generated
        $findAllUsers(this: any) {
          return this.user.findMany({})
        },
      },
    })

    const results = await xprisma.$findAllUsers()
    expect(results).toEqual([])
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

    expect(() => xprisma.$fail()).toThrowErrorMatchingInlineSnapshot(
      `Error caused by extension "Faulty client extension": What a terrible failure`,
    )
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

    await expect(() => xprisma.$fail()).rejects.toThrowErrorMatchingInlineSnapshot(
      `Error caused by extension "Faulty async extension": What a terrible failure`,
    )
  })

  test('error in extension method with no name', () => {
    const xprisma = prisma.$extends({
      client: {
        $fail() {
          throw new Error('What a terrible failure')
        },
      },
    })

    expect(() => xprisma.$fail()).toThrowErrorMatchingInlineSnapshot(
      `Error caused by an extension: What a terrible failure`,
    )
  })
})
