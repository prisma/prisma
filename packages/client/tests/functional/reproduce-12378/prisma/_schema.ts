import testMatrix from '../_matrix'

export default testMatrix.setupSchema(({ provider, previewFeatures, referentialIntegrity }) => {
  // if referentialIntegrity is not defined, we do not add the line
  // if referentialIntegrity is defined
  // we add the line only if the provider is not MongoDB, since MongoDB doesn't need the setting, it's on by default
  const referentialIntegrityLine = `referentialIntegrity = "${referentialIntegrity}"`

  const schemaHeader = /* Prisma */ `
generator client {
  provider = "prisma-client-js"
  previewFeatures = [${previewFeatures}]
}

datasource db {
  provider = "${provider}"
  url      = env("DATABASE_URI_${provider}")
  ${referentialIntegrityLine}
}
  `

  const schema = /* Prisma */ `
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

  return schema
})
