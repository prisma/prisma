/* eslint-disable @typescript-eslint/no-floating-promises */
// (more convenient benches since we only care about types)
import { bench } from '@ark/attest'

// @ts-ignore
import type { PrismaClient } from './generated/client'

declare const client: PrismaClient

bench('1 op', () => {
  client.model0.findMany({ select: { model1: true } })
}).types([589, 'instantiations'])

bench('5 ops', () => {
  client.model0.findMany({ take: 10, select: { model1: true } })
  client.model1.findUnique({ where: { id: 1 }, select: { model2: true } })
  client.model2.count()
  client.model3.findFirst({
    where: { model4Id: 5 },
    select: { model4: true },
  })
  client.model0.findMany({
    where: { model1Id: 2 },
    select: { model1: true },
  })
}).types([2079, 'instantiations'])

bench('10 ops', () => {
  client.model0.findMany({ take: 5, select: { model1: true } })
  client.model1.findUnique({ where: { id: 1 }, select: { model2: true } })
  client.model2.count({ where: { model3Id: { gt: 0 } } })
  client.model3.findFirst({
    where: { id: 3 },
    select: { model4: true },
  })
  client.model4.findMany({
    where: { model5Id: 4 },
    select: { model5: true },
  })
  client.model5.findUniqueOrThrow({ where: { id: 5 }, select: { model6: true } })
  client.model6.count()
  client.model7.findMany({
    take: 20,
    orderBy: { id: 'desc' },
    select: { model8: true },
  })
  client.model8.findFirst({ select: { model9: true } })
  client.model0.findMany({
    where: {
      OR: [{ model1Id: 1 }, { model2Id: 2 }],
    },
    select: { model1: true },
  })
}).types([4392, 'instantiations'])
