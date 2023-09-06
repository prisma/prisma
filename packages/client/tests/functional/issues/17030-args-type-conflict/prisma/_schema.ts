import { computeSchemaHeader } from '../../../_utils/computeSchemaHeader'
import { idForProvider } from '../../../_utils/idForProvider'
import testMatrix from '../_matrix'

export default testMatrix.setupSchema(({ provider, providerFlavor }): string => {
  const schemaHeader = computeSchemaHeader({
    provider,
    providerFlavor,
  })

  return /* Prisma */ `
${schemaHeader}

model Character {
  id   ${idForProvider(provider)}
  info CharacterInfo[]
}

model CharacterInfo {
  entryId       ${idForProvider(provider)}
  entryLanguage String    
  characterId   String    
  details       Character @relation(fields: [characterId], references: [id])

  @@unique([entryLanguage, characterId])
}
`
})
