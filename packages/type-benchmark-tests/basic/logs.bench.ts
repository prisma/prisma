import { bench } from '@ark/attest'

// @ts-ignore
import type { PrismaClient } from './generated/index.js'

declare const PrismaClientConstructor: typeof PrismaClient

bench('inferred', () => {
  const addPrismaClientExtensions = (prisma: PrismaClient) => {
    return prisma
  }

  const client = new PrismaClientConstructor({
    log: [
      { level: 'query', emit: 'event' },
      { level: 'error', emit: 'stdout' },
      { level: 'warn', emit: 'stdout' },
    ],
  })
  return addPrismaClientExtensions(client)
  // the reason for the increased instantiation count is this triggers
  // a check to determine if the log config affects the structural assignability
  // of PrismaClientConstructor
}).types([46873, 'instantiations'])

bench('annotated', () => {
  const client = new PrismaClientConstructor({
    log: [
      { level: 'query', emit: 'event' },
      { level: 'error', emit: 'stdout' },
      { level: 'warn', emit: 'stdout' },
    ],
  })

  type BasePrismaClient = typeof client

  const addPrismaClientExtensions = (prisma: BasePrismaClient) => {
    return prisma
  }

  addPrismaClientExtensions(client)
}).types([280, 'instantiations'])

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

  const addPrismaClientExtensions = (prisma: BasePrismaClient) => {
    return prisma
  }

  addPrismaClientExtensions(client)
  // with the suggested variance annotations, this value goes down to 247 instantiations
}).types([34056, 'instantiations'])
