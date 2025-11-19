import { bench } from '@ark/attest'

// @ts-ignore
import { Prisma, PrismaClient } from './generated/client'

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
 * See ../lots-of-relations/client-options.bench.ts for test cases on a larger schema.
 * Those are slower to run but better show how drastic the impact of this is.
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
}).types([688, 'instantiations'])

bench('errorFormat applied', () => {
  const client = new PrismaClientConstructor({
    adapter: mockAdapter,
    errorFormat: 'pretty',
  })

  const passClientAround = (prisma: PrismaClient) => {
    return prisma
  }

  return passClientAround(client)
}).types([508, 'instantiations'])

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
}).types([715, 'instantiations'])

bench('global omit applied', async () => {
  const client = new PrismaClientConstructor({
    adapter: mockAdapter,
    omit: {
      user: {
        name: true,
      },
    },
  })

  type CustomPrismaClient = typeof client
  const passClientAround = (prisma: CustomPrismaClient) => {
    return prisma
  }

  const res = await client.user.findFirst({})
  // Note: 'name' is omitted, so we can't access it
  console.log(res?.email)

  return passClientAround(client)
}).types([65328, 'instantiations'])

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
}).types([2311, 'instantiations'])

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
}).types([2151, 'instantiations'])

bench('fully extended', () => {
  const client = new PrismaClientConstructor({
    adapter: mockAdapter,
    errorFormat: 'pretty',
  })

  const passClientAround = (prisma: PrismaClient) => {
    return prisma.$extends({
      model: {
        $allModels: {
          async exists<T>(this: T, where: Prisma.Args<T, 'findFirst'>['where']): Promise<boolean> {
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
        user: {
          nameAndEmail: {
            needs: { name: true, email: true },
            compute(user) {
              return `${user.name} ${user.email}`
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
}).types([8355, 'instantiations'])

bench('fully extended without client options', () => {
  const client = new PrismaClientConstructor({
    adapter: mockAdapter,
  })

  const passClientAround = (prisma: PrismaClient) => {
    return prisma.$extends({
      model: {
        $allModels: {
          async exists<T>(this: T, where: Prisma.Args<T, 'findFirst'>['where']): Promise<boolean> {
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
        user: {
          nameAndEmail: {
            needs: { name: true, email: true },
            compute(user) {
              return `${user.name} ${user.email}`
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
}).types([8283, 'instantiations'])

// ------------------------------------------------------------
// Workaround solutions using typeof operator
// ------------------------------------------------------------

bench('using typeof', () => {
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
}).types([597, 'instantiations'])

// ------------------------------------------------------------
// Suggestion from David Blass - to be verified
// ------------------------------------------------------------

// You likely want to add variance annotations to reflect the desired behavior like:
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export interface UpdatedPrismaClient<in out ClientOption, in out U, in out ExtArgs> {
  // ...
}

// And export a BasePrismaClient type directly like this:
type BasePrismaClient = PrismaClient<any, any, any>

bench('Any PrismaClient', () => {
  const client = new PrismaClientConstructor({
    adapter: mockAdapter,
    log: [
      { level: 'query', emit: 'event' },
      { level: 'error', emit: 'stdout' },
      { level: 'warn', emit: 'stdout' },
    ],
  })

  const passClientAround = (prisma: BasePrismaClient) => {
    return prisma
  }

  passClientAround(client)
  // with the suggested variance annotations, this value goes down to 247 instantiations
}).types([601, 'instantiations'])
