import { bench } from '@ark/attest'

// @ts-ignore for typecheck bootrstrapping
import type { PrismaClient } from './generated/index.js'

declare const prisma: PrismaClient

// trivial getAll expressions moved to baseline to match drizzle
bench.baseline(async () => {
  await prisma.customer.findMany()
  await prisma.employee.findMany()
  await prisma.supplier.findMany()
  await prisma.product.findMany()
  await prisma.order.findMany()
})

bench('Prisma ORM Customers: getInfo', async () => {
  await prisma.customer.findUnique({
    where: {
      id: 'id1',
    },
  })
}).types([298, 'instantiations'])

bench('Prisma ORM Customers: search', async () => {
  await prisma.customer.findMany({
    where: {
      companyName: {
        contains: 'search1',
        mode: 'insensitive',
      },
    },
  })
}).types([177, 'instantiations'])

bench('Prisma ORM Employees: getInfo', async () => {
  await prisma.employee.findUnique({
    where: {
      id: 'id2',
    },
    include: {
      recipient: true,
    },
  })
}).types([382, 'instantiations'])

bench('Prisma ORM Suppliers: getInfo', async () => {
  await prisma.supplier.findUnique({
    where: {
      id: 'id3',
    },
  })
}).types([292, 'instantiations'])

bench('Prisma ORM Products: getInfo', async () => {
  await prisma.product.findUnique({
    where: {
      id: 'id4',
    },
    include: {
      supplier: true,
    },
  })
}).types([340, 'instantiations'])

bench('Prisma ORM Products: search', async () => {
  await prisma.product.findMany({
    where: {
      name: {
        contains: 'search2',
        mode: 'insensitive',
      },
    },
  })
}).types([177, 'instantiations'])

bench('Prisma ORM Orders: getAll', async () => {
  const result = await prisma.order.findMany({
    include: {
      details: true,
    },
  })
  result.map((item) => {
    return {
      id: item.id,
      shippedDate: item.shippedDate,
      shipName: item.shipName,
      shipCity: item.shipCity,
      shipCountry: item.shipCountry,
      productsCount: item.details.length,
      quantitySum: item.details.reduce((sum, deteil) => (sum += +deteil.quantity), 0),
      totalPrice: item.details.reduce((sum, deteil) => (sum += +deteil.quantity * +deteil.unitPrice), 0),
    }
  })
}).types([168, 'instantiations'])

bench('Prisma ORM Orders: getById', async () => {
  const result = await prisma.order.findFirst({
    include: {
      details: true,
    },
    where: {
      id: 'id5',
    },
  })

  return {
    id: result!.id,
    shippedDate: result!.shippedDate,
    shipName: result!.shipName,
    shipCity: result!.shipCity,
    shipCountry: result!.shipCountry,
    productsCount: result!.details.length,
    quantitySum: result!.details.reduce((sum, deteil) => (sum += +deteil.quantity), 0),
    totalPrice: result!.details.reduce((sum, deteil) => (sum += +deteil.quantity * +deteil.unitPrice), 0),
  }
}).types([252, 'instantiations'])

bench('Prisma ORM Orders: getInfo', async () => {
  await prisma.order.findMany({
    where: {
      id: 'id6',
    },
    include: {
      details: {
        include: {
          product: true,
        },
      },
    },
  })
}).types([250, 'instantiations'])
