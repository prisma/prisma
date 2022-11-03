import { idForProvider } from '../../../_utils/idForProvider'
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
  
  model Component {
    id         BigInt              @id @default(autoincrement()) @db.BigInt
    title      String
    categories ComponentCategory[]
  }

  model ComponentCategory {
    id         BigInt      @id @default(autoincrement()) @db.BigInt
    name       String
    components Component[]
  }
  `
})
