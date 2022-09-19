import { faker } from '@faker-js/faker'
// @ts-ignore
import type { PrismaClient } from '@prisma/client'

import testMatrix from './_matrix'

declare let prisma: PrismaClient

// https://github.com/prisma/prisma/issues/13766
testMatrix.setupTestSuite(
  ({ provider }) => {
    test('should not prevent any updates on a model when updating a field', async () => {
      const orderId = faker.random.numeric().toString()

      await prisma.order.create({
        data: {
          orderId,
          paid: false,
          statusMilestones: {
            create: {
              status: 'NEW',
            },
          },
        },
      })

      const updatedOrder = await prisma.order.update({
        where: {
          orderId,
        },
        data: {
          paid: true,
        },
      })

      expect(updatedOrder).toMatchObject({ orderId, paid: true })
    })

    test('should prevent updates on a model if any other relation references an field', async () => {
      const orderId1 = faker.random.numeric().toString()
      const orderId2 = faker.random.numeric().toString()

      await prisma.order.create({
        data: {
          orderId: orderId1,
          paid: false,
          statusMilestones: {
            create: {
              status: 'NEW',
            },
          },
        },
      })

      await prisma.order.create({
        data: {
          orderId: orderId2,
          paid: false,
          statusMilestones: {
            create: {
              status: 'NEW',
            },
          },
        },
      })

      await expect(() =>
        prisma.order.update({
          where: {
            orderId: orderId1,
          },
          data: {
            orderId: orderId2,
          },
        }),
      ).toThrowError()
    })
  },
  {
    optOut: {
      from: ['sqlserver', 'sqlite', 'mongodb'],
      reason: `
        sqlserver, sqlite - dont support enum's
        mongodb - Command failed (InvalidIndexSpecificationOption): The field 'unique' is not valid for an _id index specification - TODO
      `,
    },
  },
)
