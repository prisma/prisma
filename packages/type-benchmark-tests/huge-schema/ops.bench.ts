/* eslint-disable @typescript-eslint/no-floating-promises */
// (more convenient benches since we only care about types)

import { bench } from '@ark/attest'

// @ts-ignore
import type { PrismaClient } from './generated/client'

declare const client: PrismaClient

bench('1 ops', () => {
  client.model1.findMany({ where: { int: { gt: 5 } } })
}).types([1127, 'instantiations'])

bench('5 ops', () => {
  client.model1.findMany({ where: { int: { gt: 5 } } })
  client.model2.create({
    data: {
      int: 10,
      float: 3.14,
      string: 'hello',
      json: { key: 'value' },
      boolean: true,
    },
  })
  client.model3.findUnique({ where: { id: 1 } })
  client.model1.updateMany({
    where: { boolean: true },
    data: { optionalString: 'updated' },
  })
  client.model2.count()
}).types([3041, 'instantiations'])

bench('10 op', () => {
  client.model1.findMany({ where: { int: { gt: 5 } }, take: 10 })
  client.model2.create({
    data: {
      int: 10,
      float: 3.14,
      string: 'hello',
      json: { key: 'value' },
      boolean: true,
    },
  })
  client.model3.findUnique({ where: { id: 1 } })
  client.model1.updateMany({
    where: { boolean: true },
    data: { optionalString: 'updated' },
  })
  client.model2.count({ where: { optionalInt: null } })
  client.model3.findFirst({ where: { string: { startsWith: 'test' } } })
  client.model1.aggregate({ _count: { id: true }, _sum: { int: true } })
  client.model2.findMany({ orderBy: { float: 'desc' }, skip: 5, take: 5 })
  client.model3.upsert({
    where: { id: 2 },
    update: { optionalBoolean: false },
    create: {
      id: 2,
      int: 20,
      float: 6.28,
      string: 'world',
      json: {},
      boolean: false,
    },
  })
  client.model1.deleteMany({ where: { optionalFloat: { lt: 0 } } })
}).types([4862, 'instantiations'])
