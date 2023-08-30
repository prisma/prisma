import { computeSchemaHeader } from '../../../../_utils/computeSchemaHeader'
import { idForProvider } from '../../../../_utils/idForProvider'
import testMatrix from '../_matrix'

export default testMatrix.setupSchema(({ provider, providerFlavor }): string => {
  const schemaHeader = computeSchemaHeader({
    provider,
    providerFlavor,
    relationMode: 'prisma',
  })

  return /* Prisma */ `
${schemaHeader}

model Order {
  id               ${idForProvider(provider)}
  orderId          String @unique
  paid             Boolean?
  statusMilestones OrderStatusHistory[]
}

model OrderStatusHistory {
  id                   ${idForProvider(provider)}
  orderStatusHistoryId String
  orderId              String
  status               String
  createdAt            DateTime    @default(now())
  order                Order       @relation(fields: [orderId], references: [orderId], onUpdate: Restrict, onDelete: Cascade)
}
`
})
