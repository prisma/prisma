/* eslint-disable @typescript-eslint/no-floating-promises */
// (more convenient benches since we only care about types)

import { bench } from '@ark/attest'
import { PrismaClient } from '@prisma/client'

const client = new PrismaClient()

bench('1 op', () => {
  client.model0.findMany({ select: { id: true, model1Id: true } })
}).types([143, 'instantiations'])

bench('5 ops', () => {
  client.model0.findMany({ take: 10, select: { id: true } })
  client.model1.findUnique({ where: { id: 1 }, select: { id: true } })
  client.model2.count()
  client.model3.findFirst({
    where: { model4Id: 5 },
    select: { id: true, model4Id: true },
  })
  client.model0.findMany({
    where: { model1Id: 2 },
    select: { id: true, model1Id: true },
  })
}).types([857, 'instantiations'])

bench('10 ops', () => {
  client.model0.findMany({ take: 5, select: { id: true } })
  client.model1.findUnique({ where: { id: 1 }, select: { id: true } })
  client.model2.count({ where: { model3Id: { gt: 0 } } })
  client.model3.findFirst({
    where: { id: 3 },
    select: { id: true, model4Id: true, model5Id: true },
  })
  client.model4.findMany({
    where: { model5Id: 4 },
    select: { id: true },
  })
  client.model5.findUniqueOrThrow({ where: { id: 5 }, select: { id: true } })
  client.model6.count()
  client.model7.findMany({
    take: 20,
    orderBy: { id: 'desc' },
    select: { id: true },
  })
  client.model8.findFirst({ select: { id: true } })
  client.model0.findMany({
    where: {
      OR: [{ model1Id: 1 }, { model2Id: 2 }],
    },
    select: { id: true, model1Id: true, model2Id: true },
  })
}).types([1864, 'instantiations'])
