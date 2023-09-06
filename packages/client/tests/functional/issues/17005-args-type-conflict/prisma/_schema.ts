import { computeSchemaHeader } from '../../../_utils/computeSchemaHeader'
import { foreignKeyForProvider, idForProvider } from '../../../_utils/idForProvider'
import testMatrix from '../_matrix'

export default testMatrix.setupSchema(({ provider, providerFlavor }): string => {
  const schemaHeader = computeSchemaHeader({
    provider,
    providerFlavor,
  })

  return /* Prisma */ `
${schemaHeader}
  
model Post {
  id ${idForProvider(provider)}
  media PostMedia[]
}

model Media {
  id ${idForProvider(provider)}
  posts PostMedia[]
}

model PostMedia {
  id ${idForProvider(provider)}
  post    Post  @relation(fields: [postId], references: [id])
  media   Media @relation(fields: [mediaId], references: [id])
  postId  ${foreignKeyForProvider(provider)}
  mediaId ${foreignKeyForProvider(provider)}
  @@unique([postId, mediaId])
}
`
})
