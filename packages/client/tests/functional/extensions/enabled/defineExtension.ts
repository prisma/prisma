import { expectTypeOf } from 'expect-type'

import { Prisma as PrismaDefault } from '../../../../scripts/default-index'
import testMatrix from './_matrix'
// @ts-ignore
import type { Prisma as PrismaNamespace, PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient
declare let Prisma: typeof PrismaNamespace

expectTypeOf<PrismaDefault.PrismaPromise<unknown>>().toEqualTypeOf<PrismaNamespace.PrismaPromise<unknown>>()

function clientExtensionCallback() {
  return Prisma.defineExtension((client) => {
    return client.$extends({
      client: {
        $myMethod() {},
      },
    })
  })
}

function clientExtensionObject() {
  return Prisma.defineExtension({
    client: {
      $myMethod() {},
    },
  })
}

function modelExtensionCallback() {
  return Prisma.defineExtension((client) => {
    return client.$extends({
      model: {
        user: {
          myUserMethod() {},
        },
      },
    })
  })
}

function modelExtensionObject() {
  return Prisma.defineExtension({
    model: {
      user: {
        myUserMethod() {},
      },
    },
  })
}

function resultExtensionCallback() {
  return Prisma.defineExtension((client) => {
    return client.$extends({
      result: {
        user: {
          computedField: {
            needs: { id: true },
            compute: () => {},
          },
        },
      },
    })
  })
}

function resultExtensionObject() {
  return Prisma.defineExtension({
    result: {
      user: {
        computedField: {
          needs: { id: true },
          compute: () => {},
        },
      },
    },
  })
}

function clientExtensionCallbackViaDefault() {
  return PrismaDefault.defineExtension((client) => {
    return client.$extends({
      client: {
        $myMethodViaDefault() {},
      },
    })
  })
}

function clientExtensionObjectViaDefault() {
  return PrismaDefault.defineExtension({
    client: {
      $myMethodViaDefault() {},
    },
  })
}

function modelExtensionCallbackViaDefault() {
  return PrismaDefault.defineExtension((client) => {
    return client.$extends({
      model: {
        user: {
          myUserMethodViaDefault() {},
        },
      },
    })
  })
}

function modelExtensionObjectViaDefault() {
  return PrismaDefault.defineExtension({
    model: {
      user: {
        myUserMethodViaDefault() {},
      },
    },
  })
}

function modelGenericExtensionCallbackViaDefault() {
  return PrismaDefault.defineExtension((client) => {
    return client.$extends({
      model: {
        $allModels: {
          myGenericMethodViaDefault<T, A>(this: T, args: PrismaDefault.Exact<A, PrismaDefault.Args<T, 'findFirst'>>) {
            const ctx = Prisma.getExtensionContext(this) // just for testing that it is exported

            return {} as {
              // just for testing the types
              args: A
              payload: PrismaDefault.Payload<T, 'findFirst'>
              result: PrismaDefault.Result<T, A, 'findFirst'>
            }
          },
        },
      },
    })
  })
}

function modelGenericExtensionObjectViaDefault() {
  return PrismaDefault.defineExtension({
    model: {
      $allModels: {
        myGenericMethodViaDefault<T, A>(this: T, args: PrismaDefault.Exact<A, PrismaDefault.Args<T, 'findFirst'>>) {
          const ctx = Prisma.getExtensionContext(this) // just for testing that it is exported

          return {} as {
            // just for testing the types
            args: A
            payload: PrismaDefault.Payload<T, 'findFirst'>
            result: PrismaDefault.Result<T, A, 'findFirst'>
          }
        },
      },
    },
  })
}

function clientGenericExtensionObjectViaDefault() {
  return PrismaDefault.defineExtension({
    client: {
      myGenericMethodViaDefault<T, A extends any[]>(
        this: T,
        ...args: PrismaDefault.Exact<A, [...PrismaDefault.Args<T, '$executeRaw'>]>
      ) {
        const ctx = Prisma.getExtensionContext(this) // just for testing that it is exported

        return {} as {
          // just for testing the types
          args: A
          payload: PrismaDefault.Payload<T, '$executeRaw'>
          result: PrismaDefault.Result<T, A, '$executeRaw'>
        }
      },
    },
  })
}

function resultExtensionCallbackViaDefault() {
  return PrismaDefault.defineExtension((client) => {
    return client.$extends({
      result: {
        user: {
          computedFieldViaDefault: {
            needs: { id: true },
            compute: () => {},
          },
        },
      },
    })
  })
}

function resultExtensionObjectViaDefault() {
  return PrismaDefault.defineExtension({
    result: {
      user: {
        computedFieldViaDefault: {
          needs: { id: true },
          compute: () => {},
        },
      },
    },
  })
}

testMatrix.setupTestSuite(() => {
  test('client - callback', () => {
    const xprisma = prisma.$extends(clientExtensionCallback())
    const xprismaViaDefault = prisma.$extends(clientExtensionCallbackViaDefault())
    expectTypeOf(xprisma).toHaveProperty('$myMethod')
    expectTypeOf(xprismaViaDefault).toHaveProperty('$myMethodViaDefault')
  })

  test('client - object', () => {
    const xprisma = prisma.$extends(clientExtensionObject())
    const xprismaViaDefault = prisma.$extends(clientExtensionObjectViaDefault())
    expectTypeOf(xprisma).toHaveProperty('$myMethod')
    expectTypeOf(xprismaViaDefault).toHaveProperty('$myMethodViaDefault')
  })

  test('model - callback', () => {
    const xprisma = prisma.$extends(modelExtensionCallback())
    const xprismaViaDefault = prisma.$extends(modelExtensionCallbackViaDefault())
    expectTypeOf(xprisma.user).toHaveProperty('myUserMethod')
    expectTypeOf(xprismaViaDefault.user).toHaveProperty('myUserMethodViaDefault')
  })

  test('model - object', () => {
    const xprisma = prisma.$extends(modelExtensionObject())
    const xprismaViaDefault = prisma.$extends(modelExtensionObjectViaDefault())
    expectTypeOf(xprisma.user).toHaveProperty('myUserMethod')
    expectTypeOf(xprismaViaDefault.user).toHaveProperty('myUserMethodViaDefault')
  })

  test('result - callback', async () => {
    const xprisma = prisma.$extends(resultExtensionCallback())
    const xprismaViaDefault = prisma.$extends(resultExtensionCallbackViaDefault())
    const user = await xprisma.user.findFirst({})
    const userViaDefault = await xprismaViaDefault.user.findFirst({})
    expectTypeOf(user!).toHaveProperty('computedField')
    expectTypeOf(userViaDefault!).toHaveProperty('computedFieldViaDefault')
  })

  test('result - object', async () => {
    const xprisma = prisma.$extends(resultExtensionObject())
    const xprismaViaDefault = prisma.$extends(resultExtensionObjectViaDefault())
    const user = await xprisma.user.findFirst({})
    const userViaDefault = await xprismaViaDefault.user.findFirst({})
    expectTypeOf(user!).toHaveProperty('computedField')
    expectTypeOf(userViaDefault!).toHaveProperty('computedFieldViaDefault')
  })

  test('chained', async () => {
    const xprisma = prisma
      .$extends(modelExtensionObject())
      .$extends(clientExtensionCallback())
      .$extends(resultExtensionCallback())
      .$extends(modelExtensionObjectViaDefault())
      .$extends(clientExtensionCallbackViaDefault())
      .$extends(resultExtensionCallbackViaDefault())

    expectTypeOf(xprisma).toHaveProperty('$myMethod')
    expectTypeOf(xprisma).toHaveProperty('$myMethodViaDefault')
    expectTypeOf(xprisma.user).toHaveProperty('myUserMethod')
    expectTypeOf(xprisma.user).toHaveProperty('myUserMethodViaDefault')
    const user = await xprisma.user.findFirst({})
    expectTypeOf(user!).toHaveProperty('computedField')
    expectTypeOf(user!).toHaveProperty('computedFieldViaDefault')
  })

  test('invalid', () => {
    Prisma.defineExtension({
      // @ts-expect-error
      notAComponent: {},
    })

    Prisma.defineExtension({
      model: {
        // @ts-expect-error
        notAModel: {
          myMethod() {},
        },
      },
    })

    Prisma.defineExtension({
      result: {
        // -@ts-expect-error TODO: this should be an error but somehow isn't showing up like eg. `model`
        notAModel: {
          field: {
            needs: { id: true },
            compute: () => {},
          },
        },
      },
    })

    Prisma.defineExtension({
      result: {
        user: {
          field: {
            needs: {
              // @ts-expect-error
              notUserField: true,
            },
            compute: () => {},
          },
        },
      },
    })

    Prisma.defineExtension({
      result: {
        user: {
          field: {
            needs: {
              id: true,
            },
            compute: (user) => {
              // @ts-expect-error
              return user.bad
            },
          },
        },
      },
    })

    Prisma.defineExtension({
      query: {
        // @ts-expect-error
        notAModel: {
          findFirst() {},
        },
      },
    })

    Prisma.defineExtension({
      query: {
        user: {
          // @ts-expect-error
          notAnOperation() {},
        },
      },
    })
  })

  // here we want to check that type utils also work via default
  test('generic model - callback via default', () => {
    const xprisma = prisma.$extends(modelGenericExtensionCallbackViaDefault())
    expectTypeOf(xprisma.user).toHaveProperty('myGenericMethodViaDefault')

    const data = xprisma.user.myGenericMethodViaDefault({
      select: {
        email: true,
      },
    })

    expectTypeOf<(typeof data)['args']>().toEqualTypeOf<{ select: { email: true } }>()
    expectTypeOf<(typeof data)['payload']>().toMatchTypeOf<object>()
    expectTypeOf<(typeof data)['payload']['scalars']>().toHaveProperty('email').toEqualTypeOf<string>()
    expectTypeOf<(typeof data)['result']>().toHaveProperty('email').toEqualTypeOf<string>()
  })

  // here we want to check that type utils also work via default
  test('generic model - object via default', () => {
    const xprisma = prisma.$extends(modelGenericExtensionObjectViaDefault())
    expectTypeOf(xprisma.user).toHaveProperty('myGenericMethodViaDefault')

    const data = xprisma.user.myGenericMethodViaDefault({
      select: {
        email: true,
      },
    })

    expectTypeOf<(typeof data)['args']>().toEqualTypeOf<{ select: { email: true } }>()
    expectTypeOf<(typeof data)['payload']>().toMatchTypeOf<object>()
    expectTypeOf<(typeof data)['payload']['scalars']>().toHaveProperty('email').toEqualTypeOf<string>()
    expectTypeOf<(typeof data)['result']>().toHaveProperty('email').toEqualTypeOf<string>()
  })

  // here we want to check that type utils also work via default
  test('generic client - object via default', () => {
    const xprisma = prisma.$extends(clientGenericExtensionObjectViaDefault())
    expectTypeOf(xprisma).toHaveProperty('myGenericMethodViaDefault')

    const data = xprisma.myGenericMethodViaDefault`SELECT * FROM User WHERE id = ${1}`

    expectTypeOf<(typeof data)['args']>().toEqualTypeOf<[TemplateStringsArray, number]>()
    // @ts-test-if: provider !== 'mongodb'
    expectTypeOf<(typeof data)['payload']>().toEqualTypeOf<any>()
    // @ts-test-if: provider !== 'mongodb'
    expectTypeOf<(typeof data)['result']>().toEqualTypeOf<any>()
  })
})
