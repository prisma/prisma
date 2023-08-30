import { computeSchemaHeader } from '../../../_utils/computeSchemaHeader'
import testMatrix from '../_matrix'

export default testMatrix.setupSchema(({ provider, providerFlavor }): string => {
  const schemaHeader = computeSchemaHeader({
    provider,
    providerFlavor,
  })

  return /* Prisma */ `
${schemaHeader}

model Event {
  id          String    @id
  name        String
  sessions    Session[]

  @@map("events")
}

model Session {
  id          String
  name        String
  event       Event    @relation(fields: [eventId], references: [id], onDelete: Cascade)
  eventId     String   @map("event_id")

  @@id([id, eventId])
  @@map("sessions")
}
  `
})
