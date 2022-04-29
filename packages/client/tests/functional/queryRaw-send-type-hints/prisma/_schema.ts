export default ({ provider, previewFeatures, id }) => {
  return `
  generator client {
    provider = "prisma-client-js"
    previewFeatures = [${previewFeatures}]
  }
  
  datasource db {
    provider = "${provider}"
    url      = env("DATABASE_URI_${provider}")
  }
  
  model Entry {
    id     Int @id @default(autoincrement())
    binary Bytes
  }
  `
}
