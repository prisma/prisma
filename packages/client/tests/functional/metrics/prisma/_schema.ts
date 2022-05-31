import testMatrix from '../_matrix'

export default testMatrix.setupSchema(
  ({ provider, engineType }) => /* Prisma */ `

  generator client {
    provider = "prisma-client-js"
    engineType = "${engineType}"
    previewFeatures = ["metrics"]
  }
  
  datasource db {
    provider = "${provider}"
    url      = env("DATABASE_URI_${provider}")
  }
  
  model User {
    id    Int @id @default(autoincrement())
    email String
  }

`,
)
