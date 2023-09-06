import { computeSchemaHeader } from '../../_utils/computeSchemaHeader'
import { idForProvider } from '../../_utils/idForProvider'
import testMatrix from '../_matrix'

export default testMatrix.setupSchema(({ provider, providerFlavor }): string => {
  const schemaHeader = computeSchemaHeader({
    provider,
    providerFlavor,
    previewFeatures: 'views',
  })

  return /* Prisma */ `
${schemaHeader}
    
model User {
  id ${idForProvider(provider)}
  email   String   @unique
  name    String?
  profile Profile?
}

model Profile {
  id ${idForProvider(provider)}
  bio       String
  user      User      @relation(fields: [userId], references: [id])
  userId    ${provider === 'mongodb' ? 'String @db.ObjectId' : 'String'} @unique
}

view UserInfo {
  id    ${idForProvider(provider)}
  email String
  name  String
  bio   String
}
`
})
