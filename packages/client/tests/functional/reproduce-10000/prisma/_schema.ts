import { Providers } from '../../_utils/providers'
import testMatrix from '../_matrix'

export default testMatrix.setupSchema(
  ({ provider, previewFeatures, relationMode, referentialActions, onUpdate, onDelete, id }) => {
    // if relationMode is not defined, we do not add the line
    // if relationMode is defined
    // we add the line only if the provider is not MongoDB, since MongoDB doesn't need the setting, it's on by default
    const relationModeLine = `relationMode = "${relationMode}"`

    const schemaHeader = /* Prisma */ `
generator client {
  provider = "prisma-client-js"
  previewFeatures = [${previewFeatures}]
}

datasource db {
  provider = "${provider}"
  url      = env("DATABASE_URI_${provider}")
  ${relationModeLine}
}
  `

    let referentialActionLine = ''
    if (onUpdate && onUpdate !== 'DEFAULT') {
      referentialActionLine += `, onUpdate: ${onUpdate}`
    }
    if (onDelete && onDelete !== 'DEFAULT') {
      referentialActionLine += `, onDelete: ${onDelete}`
    }

    const schema = /* Prisma */ `
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

    console.log('schema', schema)

    return schema
  },
)
