import { idForProvider } from '../../_utils/idForProvider'
import testMatrix from '../_matrix'

export default testMatrix.setupSchema(({ provider }) => {
  const fields = /* Prisma */ `
    id ${idForProvider(provider)}
    string String
    otherString String
    notString Int
  `
  return /* Prisma */ `
  generator client {
    provider = "prisma-client-js"
    previewFeatures = ["fieldReference"]
  }
  
  datasource db {
    provider = "${provider}"
    url      = env("DATABASE_URI_${provider}")
  }

  model Product {
    ${fields}
  }

  model IdenticalToProduct {
    ${fields}
  }

  model OtherModel {
    id ${idForProvider(provider)}
    string String
  }
  `
})
