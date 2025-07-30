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
 * See ../lots-of-relations/client-options.bench.ts for test cases on a larger schema.
 * Those are slower to run but better show how drastic the impact of this is.
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
}).types([46866, 'instantiations']) // TODO: we want to get this number down

bench('datasourceUrl applied', () => {
  const client = new PrismaClientConstructor({
    datasourceUrl: 'postgres://localhost:5432/prisma',
  })

  const passClientAround = (prisma: PrismaClient) => {
    return prisma
  }

  return passClientAround(client)
}).types([46755, 'instantiations']) // TODO: we want to get this number down

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
}).types([46834, 'instantiations']) // TODO: we want to get this number down

bench('global omit applied', () => {
  const client = new PrismaClientConstructor({
    omit: {
      user: {
        name: true,
      },
    },
  })

  const passClientAround = (prisma: PrismaClient) => {
    return prisma
  }

  // @ts-expect-error - actually the "omitted client" is not assignable to the original `PrismaClient` as the user.name attributes are missing.
  return passClientAround(client)
}).types([91192, 'instantiations']) // TODO: we want to get this number down

bench('extended client then pass around', () => {
  const client = new PrismaClientConstructor({
    datasourceUrl: 'sqlite://localhost:5432/prisma',
  }).$extends({})

  const passClientAround = (prisma: PrismaClient) => {
    return prisma
  }

  return passClientAround(client)
  // Apparently extending the client and then passing it around is way faster.
}).types([2036, 'instantiations'])

bench('passed around client then extend', () => {
  const client = new PrismaClientConstructor({
    datasourceUrl: 'sqlite://localhost:5432/prisma',
  })

  const passClientAround = (prisma: PrismaClient) => {
    return prisma.$extends({})
  }

  return passClientAround(client)
  // Apparently passing the client around and then extending it is way slower.
}).types([48156, 'instantiations']) // TODO: we want to get this number down

bench('fully extended', () => {
  const client = new PrismaClientConstructor({
    datasourceUrl: 'sqlite://localhost:5432/prisma',
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
}).types([53782, 'instantiations'])

bench('fully extended without client options', () => {
  const client = new PrismaClientConstructor()

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
}).types([7875, 'instantiations'])

// ------------------------------------------------------------
// Workaround solutions using typeof operator
// ------------------------------------------------------------

bench('using typeof', () => {
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
}).types([273, 'instantiations'])

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
}).types([34056, 'instantiations'])
