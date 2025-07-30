import { bench } from '@ark/attest'

// @ts-ignore
import type { Prisma, PrismaClient } from './generated/client'

declare const PrismaClientConstructor: typeof PrismaClient

/**
 * These tests check the type performance of the PrismaClient constructor which can get complex due to passed client options.
 * The client options can have an impact on the structural assignability of the PrismaClientConstructor as they might change the available APIs.
 *
 * This does not get noticed when just creating a client, but when a PrismaClient needs to be passed around.
 * Because then the actual PrismaClient instance needs to be compared against the `PrismaClient` type on the parameter.
 *
 * Currently this can be worked around on the user side by using the `typeof` operator.
 * See the `using typeof` tests for examples and impact.
 *
 * See ../basic/client-options.bench.ts for test cases on a smaller schema.
 * They are faster to run to iterate but do not show the magnitude of this issue as well.
 */

bench('log config applied', () => {
  const client = new PrismaClientConstructor({
    log: [
      { level: 'query', emit: 'event' },
      { level: 'error', emit: 'stdout' },
      { level: 'warn', emit: 'stdout' },
    ],
  })

  const passClientAround = (prisma: PrismaClient) => {
    return prisma
  }

  return passClientAround(client)
}).types([13720983, 'instantiations']) // TODO: we want to get this number down

bench('datasourceUrl applied', () => {
  const client = new PrismaClientConstructor({
    datasourceUrl: 'postgres://localhost:5432/prisma',
  })

  const passClientAround = (prisma: PrismaClient) => {
    return prisma
  }

  return passClientAround(client)
}).types([13720872, 'instantiations'])

bench('adapter applied', () => {
  const client = new PrismaClientConstructor({
    adapter: {
      provider: 'sqlite',
      adapterName: 'mock-adapter',
      connect: () => Promise.resolve({} as any),
    },
  })

  const passClientAround = (prisma: PrismaClient) => {
    return prisma
  }

  return passClientAround(client)
}).types([13720951, 'instantiations']) // TODO: we want to get this number down

bench('global omit applied', () => {
  const client = new PrismaClientConstructor({
    omit: {
      model0: {},
    },
  })

  const passClientAround = (prisma: PrismaClient) => {
    return prisma
  }

  return passClientAround(client)
}).types([18346308, 'instantiations']) // TODO: we want to get this number down

bench('extended client then pass around', () => {
  const client = new PrismaClientConstructor({
    datasourceUrl: 'sqlite://localhost:5432/prisma',
  }).$extends({})

  const passClientAround = (prisma: PrismaClient) => {
    return prisma
  }

  return passClientAround(client)
  // Apparently extending the client and then passing it around is way faster.
}).types([2927, 'instantiations'])

bench('passed around client then extend', () => {
  const client = new PrismaClientConstructor({
    datasourceUrl: 'sqlite://localhost:5432/prisma',
  })

  const passClientAround = (prisma: PrismaClient) => {
    return prisma.$extends({})
  }

  return passClientAround(client)
  // Apparently passing the client around and then extending it is way slower.
}).types([13723163, 'instantiations']) // TODO: we want to get this number down

bench('fully extended', () => {
  const client = new PrismaClientConstructor({
    datasourceUrl: 'sqlite://localhost:5432/prisma',
  }).$extends({
    model: {
      $allModels: {
        exists<T>(this: T, where: Prisma.Args<T, 'findFirst'>['where']): Promise<boolean> {
          console.log('exists', where)
          return Promise.resolve(true)
        },
      },
    },
    query: {
      $allModels: {
        findMany({ model, operation, args, query }) {
          console.log('findMany', model, operation, args)
          return query(args)
        },
      },
    },
    result: {
      model0: {
        wrappedId: {
          needs: { id: true },
          compute(model0) {
            return `wrapped:${model0.id}`
          },
        },
      },
    },
    client: {
      $fooBar: (s: string) => console.log(s),
    },
  })

  const passClientAround = (prisma: PrismaClient) => {
    return prisma
  }

  return passClientAround(client)
}).types([27133, 'instantiations'])

bench('fully extended without client options', () => {
  const client = new PrismaClientConstructor().$extends({
    model: {
      $allModels: {
        exists<T>(this: T, where: Prisma.Args<T, 'findFirst'>['where']): Promise<boolean> {
          console.log('exists', where)
          return Promise.resolve(true)
        },
      },
    },
    query: {
      $allModels: {
        findMany({ model, operation, args, query }) {
          console.log('findMany', model, operation, args)
          return query(args)
        },
      },
    },
    result: {
      model0: {
        wrappedId: {
          needs: { id: true },
          compute(model0) {
            return `wrapped:${model0.id}`
          },
        },
      },
    },
    client: {
      $fooBar: (s: string) => console.log(s),
    },
  })

  const passClientAround = (prisma: PrismaClient) => {
    return prisma
  }

  return passClientAround(client)
}).types([26630, 'instantiations'])

// ------------------------------------------------------------
// Workaround solutions using typeof operator
// ------------------------------------------------------------

bench('using typeof - log config applied', () => {
  const client = new PrismaClientConstructor({
    log: [
      { level: 'query', emit: 'event' },
      { level: 'error', emit: 'stdout' },
      { level: 'warn', emit: 'stdout' },
    ],
  })

  type CustomPrismaClient = typeof client

  const passClientAround = (prisma: CustomPrismaClient) => {
    return prisma
  }

  passClientAround(client)
}).types([282, 'instantiations'])

bench('using typeof - datasourceUrl applied', () => {
  const client = new PrismaClientConstructor({
    datasourceUrl: 'postgres://localhost:5432/prisma',
  })

  type CustomPrismaClient = typeof client

  const passClientAround = (prisma: CustomPrismaClient) => {
    return prisma
  }

  return passClientAround(client)
}).types([167, 'instantiations'])

bench('using typeof - adapter applied', () => {
  const client = new PrismaClientConstructor({
    adapter: {
      provider: 'sqlite',
      adapterName: 'mock-adapter',
      connect: () => Promise.resolve({} as any),
    },
  })

  type CustomPrismaClient = typeof client

  const passClientAround = (prisma: CustomPrismaClient) => {
    return prisma
  }

  return passClientAround(client)
}).types([374, 'instantiations'])

bench('using typeof - global omit applied', () => {
  const client = new PrismaClientConstructor({
    omit: {
      model0: {},
    },
  })

  type CustomPrismaClient = typeof client

  const passClientAround = (prisma: CustomPrismaClient) => {
    return prisma
  }

  return passClientAround(client)
}).types([196, 'instantiations'])

bench('using typeof - fully extended', () => {
  const client = new PrismaClientConstructor({
    datasourceUrl: 'sqlite://localhost:5432/prisma',
  })

  type CustomPrismaClient = typeof client

  const passClientAround = (prisma: CustomPrismaClient) => {
    return prisma.$extends({
      model: {
        $allModels: {
          exists<T>(this: T, where: Prisma.Args<T, 'findFirst'>['where']): Promise<boolean> {
            console.log('exists', where)
            return Promise.resolve(true)
          },
        },
      },
      query: {
        $allModels: {
          findMany({ model, operation, args, query }) {
            console.log('findMany', model, operation, args)
            return query(args)
          },
        },
      },
      result: {
        model0: {
          wrappedId: {
            needs: { id: true },
            compute(model0) {
              return `wrapped:${model0.id}`
            },
          },
        },
      },
      client: {
        $fooBar: (s: string) => console.log(s),
      },
    })
  }

  return passClientAround(client)
}).types([26870, 'instantiations'])
