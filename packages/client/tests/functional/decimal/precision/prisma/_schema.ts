import { idForProvider } from '../../../_utils/idForProvider'
import testMatrix from '../_matrix'

export default testMatrix.setupSchema(({ provider, precision, scale }) => {
  return /* Prisma */ `
  generator client {
    provider = "prisma-client-js"
  }
  
  datasource db {
    provider = "${provider}"
    url      = env("DATABASE_URI_${provider}")
  }
  
  model TestModel {
    id ${idForProvider(provider)}
    decimal Decimal @db.Decimal(${precision},${scale})
  }
  `
})
