import { idForProvider } from '../../../_utils/idForProvider'
import testMatrix from '../_matrix'

export default testMatrix.setupSchema(({ provider, enumName }) => {
  return /* Prisma */ `
  generator client {
    provider = "prisma-client-js"
  }
  
  datasource db {
    provider = "${provider}"
    url      = env("DATABASE_URI_${provider}")
  }
  
  model EnumHolder {
    id ${idForProvider(provider)}
    value ${enumName}
  }

  enum ${enumName} {
    ONE
    TWO
  }
  `
})
