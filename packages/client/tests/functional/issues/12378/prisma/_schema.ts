import { computeSchemaHeader } from '../../../_utils/computeSchemaHeader'
import testMatrix from '../_matrix'

export default testMatrix.setupSchema(({ provider, providerFlavor }): string => {
  const schemaHeader = computeSchemaHeader({
    provider,
    providerFlavor,
  })

  return /* Prisma */ `
${schemaHeader}

model User {
  id         String              @id @default(cuid())
  email      String              @unique
  workspaces UsersOnWorkspaces[]
  name       String?
}

model Workspace {
  id        String              @id @default(cuid())
  users     UsersOnWorkspaces[]
  name      String
}

model UsersOnWorkspaces {
  user        User           @relation(fields: [userId], references: [id])
  userId      String
  workspace   Workspace      @relation(fields: [workspaceId], references: [id])
  workspaceId String

  @@id([userId, workspaceId])
}
`
})
