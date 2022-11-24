import { expectTypeOf } from 'expect-type'

import testMatrix from './_matrix'
// @ts-ignore
import type { Prisma as PrismaNamespace, PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient
declare let Prisma: typeof PrismaNamespace

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

testMatrix.setupTestSuite(() => {
  test('client - callback', () => {
    const xprisma = prisma.$extends(clientExtensionCallback())
    expectTypeOf(xprisma).toHaveProperty('$myMethod')
  })

  test('client - object', () => {
    const xprisma = prisma.$extends(clientExtensionObject())
    expectTypeOf(xprisma).toHaveProperty('$myMethod')
  })

  test('model - callback', () => {
    const xprisma = prisma.$extends(modelExtensionCallback())
    expectTypeOf(xprisma.user).toHaveProperty('myUserMethod')
  })

  test('model - object', () => {
    const xprisma = prisma.$extends(modelExtensionObject())
    expectTypeOf(xprisma.user).toHaveProperty('myUserMethod')
  })

  test('result - callback', async () => {
    const xprisma = prisma.$extends(resultExtensionCallback())
    const user = await xprisma.user.findFirst({})
    expectTypeOf(user!).toHaveProperty('computedField')
  })

  test('result - object', async () => {
    const xprisma = prisma.$extends(resultExtensionObject())
    const user = await xprisma.user.findFirst({})
    expectTypeOf(user!).toHaveProperty('computedField')
  })

  test('chained', async () => {
    const xprisma = prisma
      .$extends(modelExtensionObject())
      .$extends(clientExtensionCallback())
      .$extends(resultExtensionCallback())

    expectTypeOf(xprisma).toHaveProperty('$myMethod')
    // @ts-expect-error: TMP: this is broken at the moment
    expectTypeOf(xprisma.user).toHaveProperty('myUserMethod')
    const user = await xprisma.user.findFirst({})
    expectTypeOf(user!).toHaveProperty('computedField')
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
        // @ts-expect-error
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
              return user.id
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
})
