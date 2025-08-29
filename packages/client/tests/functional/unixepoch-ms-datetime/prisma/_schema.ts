import testMatrix from '../_matrix'

export default testMatrix.setupSchema(({ provider }) => {
  return /* Prisma */ `
  generator client {
    provider = "prisma-client-js"
  }

  datasource db {
    provider = "${provider}"
    url      = env("DATABASE_URI_${provider}")
  }

  model Event {
    name String
    uuid String @default(uuid())
    createdAt DateTime @default(now())

    @@id([uuid, createdAt])
  }
  `
})
