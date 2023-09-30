// @ts-ignore
import type { PrismaClient } from '@prisma/client'
import { copycat } from '@snaplet/copycat'

import { Providers } from '../../../_utils/providers'
import testMatrix from './_matrix'

declare let prisma: PrismaClient

// https://github.com/prisma/prisma/issues/13766
testMatrix.setupTestSuite(({ provider }) => {
  test('relationMode=prisma should not prevent any updates on a model when updating a field which is not referenced in a relation', async () => {
    const orderId = copycat.uuid(13).replaceAll('-', '').slice(-24)
    const orderStatusHistoryId = copycat.uuid(25).replaceAll('-', '').slice(-24)

    await prisma.order.create({
      data: {
        orderId,
        paid: false,
        statusMilestones: {
          create: {
            orderStatusHistoryId,
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

  // _id is immutable for MongoDB
  testIf(provider !== Providers.MONGODB)(
    'relationMode=prisma should prevent updates on a model if any other relation references a field',
    async () => {
      const orderId1 = copycat.uuid(3).replaceAll('-', '').slice(-24)
      const orderId2 = copycat.uuid(44).replaceAll('-', '').slice(-24)
      const orderStatusHistoryId1 = copycat.uuid(50).replaceAll('-', '').slice(-24)
      const orderStatusHistoryId2 = copycat.uuid(76).replaceAll('-', '').slice(-24)

      await prisma.order.create({
        data: {
          orderId: orderId1,
          paid: false,
          statusMilestones: {
            create: {
              orderStatusHistoryId: orderStatusHistoryId1,
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
              orderStatusHistoryId: orderStatusHistoryId2,
              status: 'NEW',
            },
          },
        },
      })

      await expect(
        prisma.order.update({
          where: {
            orderId: orderId1,
          },
          data: {
            // @ts-test-if: provider !== 'mongodb'
            orderId: orderId2,
          },
        }),
      ).rejects.toThrow(
        "The change you are trying to make would violate the required relation 'OrderToOrderStatusHistory' between the `OrderStatusHistory` and `Order` models.",
      )
    },
  )
})
