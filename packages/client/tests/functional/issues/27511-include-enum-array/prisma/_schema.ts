import testMatrix from '../_matrix'

export default testMatrix.setupSchema(({ provider }) => {
  return /* Prisma */ `
      generator client {
        provider = "prisma-client-js"
        previewFeatures = ["driverAdapters"]
      }

      datasource db {
        provider = "${provider}"
        url      = env("DATABASE_URI_${provider}")
      }

      enum workspace_permission {
        HELLO
        WORLD
      }

      model workspace_member {
        id          String           @id @default(cuid()) @db.VarChar(30)
        roles       workspace_role[]
      }

      model workspace_role {
        id           String                 @id @default(cuid()) @db.VarChar(30)
        name         String
        permissions  workspace_permission[]
        members      workspace_member[]
      }
      `
})
