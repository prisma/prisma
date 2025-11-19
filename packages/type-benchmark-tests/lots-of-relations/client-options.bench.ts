import { bench } from '@ark/attest'

// @ts-ignore
import type { Prisma, PrismaClient } from './generated/client'

declare const PrismaClientConstructor: typeof PrismaClient

// Mock adapter for type benchmark tests (these tests don't actually run, so a mock is sufficient)
const mockAdapter = {
  provider: 'sqlite' as const,
  adapterName: 'mock-adapter',
  connect: () => Promise.resolve({} as any),
}

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
    adapter: mockAdapter,
    log: [
      { level: 'query', emit: 'event' },
      { level: 'error', emit: 'stdout' },
      { level: 'warn', emit: 'stdout' },
    ],
  })

  const passClientAround = (prisma: PrismaClient) => {
    return prisma
  }

  const passToAnyClientAround = (prisma: PrismaClient<any>) => {
    return prisma
  }

  passClientAround(client)
  passToAnyClientAround(client)
}).types([697, 'instantiations'])

bench('errorFormat applied', () => {
  const client = new PrismaClientConstructor({
    adapter: mockAdapter,
    errorFormat: 'pretty',
  })

  const passClientAround = (prisma: PrismaClient) => {
    return prisma
  }

  return passClientAround(client)
}).types([517, 'instantiations'])

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
}).types([724, 'instantiations'])

bench('global omit applied', async () => {
  const client = new PrismaClientConstructor({
    adapter: mockAdapter,
    omit: {
      model0: {
        name: true,
      },
    },
  })

  type CustomPrismaClient = typeof client
  const passClientAround = (prisma: CustomPrismaClient) => {
    return prisma
  }

  const res = await client.model0.findFirst({})
  // Note: 'name' is omitted, so we can't access it
  console.log(res?.id)

  return passClientAround(client)
}).types([88887, 'instantiations'])

bench('extended client then pass around', () => {
  const client = new PrismaClientConstructor({
    adapter: mockAdapter,
    errorFormat: 'pretty',
  }).$extends({})

  type CustomPrismaClient = typeof client
  const passClientAround = (prisma: CustomPrismaClient) => {
    return prisma
  }

  return passClientAround(client)
  // Apparently extending the client and then passing it around is way faster.
}).types([3202, 'instantiations'])

bench('passed around client then extend', () => {
  const client = new PrismaClientConstructor({
    adapter: mockAdapter,
    errorFormat: 'pretty',
  })

  const passClientAround = (prisma: PrismaClient) => {
    return prisma.$extends({})
  }

  return passClientAround(client)
  // Apparently passing the client around and then extending it is way slower.
}).types([3042, 'instantiations'])

bench('fully extended', () => {
  const client = new PrismaClientConstructor({
    adapter: mockAdapter,
    errorFormat: 'pretty',
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

  type CustomPrismaClient = typeof client
  const passClientAround = (prisma: CustomPrismaClient) => {
    return prisma
  }

  return passClientAround(client)
}).types([26915, 'instantiations'])

bench('fully extended without client options', () => {
  const client = new PrismaClientConstructor({
    adapter: mockAdapter,
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

  type CustomPrismaClient = typeof client
  const passClientAround = (prisma: CustomPrismaClient) => {
    return prisma
  }

  return passClientAround(client)
}).types([26843, 'instantiations'])

// ------------------------------------------------------------
// Workaround solutions using typeof operator
// ------------------------------------------------------------

bench('using typeof - log config applied', () => {
  const client = new PrismaClientConstructor({
    adapter: mockAdapter,
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
}).types([606, 'instantiations'])

bench('using typeof - errorFormat applied', () => {
  const client = new PrismaClientConstructor({
    adapter: mockAdapter,
    errorFormat: 'pretty',
  })

  type CustomPrismaClient = typeof client

  const passClientAround = (prisma: CustomPrismaClient) => {
    return prisma
  }

  return passClientAround(client)
}).types([513, 'instantiations'])

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
}).types([720, 'instantiations'])

bench('using typeof - global omit applied', () => {
  const client = new PrismaClientConstructor({
    adapter: mockAdapter,
    omit: {
      model0: {},
    },
  })

  type CustomPrismaClient = typeof client

  const passClientAround = (prisma: CustomPrismaClient) => {
    return prisma
  }

  return passClientAround(client)
}).types([578, 'instantiations'])

bench('using typeof - fully extended', () => {
  const client = new PrismaClientConstructor({
    adapter: mockAdapter,
    errorFormat: 'pretty',
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
}).types([26669, 'instantiations'])
