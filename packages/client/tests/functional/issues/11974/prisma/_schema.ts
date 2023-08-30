import { computeSchemaHeader } from '../../../_utils/computeSchemaHeader'
import testMatrix from '../_matrix'

export default testMatrix.setupSchema(({ provider, providerFlavor }): string => {
  const schemaHeader = computeSchemaHeader({
    provider,
    providerFlavor,
  })

  return /* Prisma */ `
${schemaHeader}

model Comment {
  id String @id

  upVotedUsers   User[] @relation("upVotes")
  downVotedUsers User[] @relation("downVotes")
}

model User {
  uid String @id

  upVotedComments   Comment[] @relation("upVotes")
  downVotedComments Comment[] @relation("downVotes")
}
`
})
