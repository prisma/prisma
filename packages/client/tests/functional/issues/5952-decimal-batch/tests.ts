import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient

testMatrix.setupTestSuite(
  () => {
    beforeAll(async () => {
      await prisma.resource.create({
        data: { decimal: 1.2 },
      })
      await prisma.resource.create({
        data: { decimal: 2.4 },
      })
    })

    test.skip('findUnique decimal with Promise.all', async () => {
      const result = await Promise.all([
        prisma.resource.findUnique({
          where: { decimal: 1.2 },
          select: { decimal: true },
        }),
        prisma.resource.findUnique({
          where: { decimal: 2.4 },
          select: { decimal: true },
        }),
      ])

      expect(result).toMatchInlineSnapshot(`
        Array [
          Object {
            decimal: 1.2,
          },
          Object {
            decimal: 2.4,
          },
        ]
      `)
    })

    test.skip('findUnique decimal with $transaction([...])', async () => {
      const result = await prisma.$transaction([
        prisma.resource.findUnique({
          where: { decimal: 1.2 },
          select: { decimal: true },
        }),
        prisma.resource.findUnique({
          where: { decimal: 2.4 },
          select: { decimal: true },
        }),
      ])

      expect(result).toMatchInlineSnapshot(`
        Array [
          Object {
            decimal: 1.2,
          },
          Object {
            decimal: 2.4,
          },
        ]
      `)
    })

    test('findFirst decimal with Promise.all', async () => {
      const result = await Promise.all([
        prisma.resource.findFirst({
          where: { decimal: 1.2 },
          select: { decimal: true },
        }),
        prisma.resource.findFirst({
          where: { decimal: 2.4 },
          select: { decimal: true },
        }),
      ])

      expect(result).toMatchInlineSnapshot(`
        Array [
          Object {
            decimal: 1.2,
          },
          Object {
            decimal: 2.4,
          },
        ]
      `)
    })

    test('findFirst decimal with $transaction([...])', async () => {
      const result = await prisma.$transaction([
        prisma.resource.findFirst({
          where: { decimal: 1.2 },
          select: { decimal: true },
        }),
        prisma.resource.findFirst({
          where: { decimal: 2.4 },
          select: { decimal: true },
        }),
      ])

      expect(result).toMatchInlineSnapshot(`
        Array [
          Object {
            decimal: 1.2,
          },
          Object {
            decimal: 2.4,
          },
        ]
      `)
    })
  },
  {
    optOut: {
      from: ['mongodb'],
      reason: 'MongoDB does not support decimal',
    },
  },
)
