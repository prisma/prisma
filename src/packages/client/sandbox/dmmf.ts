import { getConfig, getDMMF } from '@prisma/sdk'

const datamodel = /* prisma */ `
datasource db {
  provider = "mongodb"
  url      = "mongodb://localhost:27017/mydb"
}

generator client {
  provider = "prisma-client-js"
  previewFeatures = ["mongodb"]
}

model User {
  id    String @id @default(dbgenerated()) @map("_id") @db.ObjectId
  email String @unique
}

model Post {
  id    String @id @map("_id")
  title String
}


// enum Role {
//   USER
//   ADMIN
// }
`

async function main() {
  const dmmf = await getDMMF({
    datamodel,
    enableExperimental: ['selectRelationCount'],
  })
  console.log(dmmf)
  const config = await getConfig({ datamodel, ignoreEnvVarErrors: true })
  console.log(config)
  debugger
}

main()
