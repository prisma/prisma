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

    model aktivasi_bku {
      id ${idForProvider(provider)}
      id_periode             Decimal      @db.Decimal(2, 0)
    }
  `
})
