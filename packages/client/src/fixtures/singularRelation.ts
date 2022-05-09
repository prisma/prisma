export const singularRelation = /* Prisma */ `
datasource db {
  provider = "postgresql"
  url      = "postgresql://localhost:5432/db"
}

generator client {
  provider  = "prisma-client-js"
  output    = "@prisma/client"
  transpile = false
}

model Location {
  id Int @id
  companyId Int
  company Company @relation(fields: companyId, references: id)
}

model Company {
  id Int @id
  location Location?
}
`
