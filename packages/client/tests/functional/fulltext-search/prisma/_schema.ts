import testMatrix from '../_matrix'

export default testMatrix.setupSchema(({ provider, previewFeatures, index }) => {
  return /* Prisma */ `
  generator client {
    provider = "prisma-client-js"
    previewFeatures = [${previewFeatures}]
  }
  
  datasource db {
    provider = "${provider}"
    url      = env("DATABASE_URI_${provider}")
  }
  
  model User {
    id    Int @id @default(autoincrement())
    email String @unique
    name  String
    ${index}
  }
  `
})
