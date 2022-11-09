import { idForProvider } from '../../../../_utils/idForProvider'
import testMatrix from '../_matrix'

export default testMatrix.setupSchema(({ provider }) => {
  return /* Prisma */ `
    generator client {
      provider = "prisma-client-js"
      previewFeatures = ["referentialIntegrity"]
    }
    
    datasource db {
      provider = "${provider}"
      url      = env("DATABASE_URI_${provider}")
      relationMode = "prisma"
    }

    model Order {
      orderId          ${idForProvider(provider)}
      paid             Boolean?
      statusMilestones OrderStatusHistory[]
    }

    model OrderStatusHistory {
      orderStatusHistoryId ${idForProvider(provider)}
      orderId              String
      status               String
      createdAt            DateTime    @default(now())
      order                Order       @relation(fields: [orderId], references: [orderId], onUpdate: Restrict, onDelete: Cascade)
    }
  `
})
