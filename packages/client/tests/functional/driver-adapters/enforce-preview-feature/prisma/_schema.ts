import { idForProvider } from '../../../_utils/idForProvider'
import testMatrix from '../_matrix'

export default testMatrix.setupSchema(({ provider, previewFeatures }) => {
  const previewFeaturesStr = previewFeatures ? `previewFeatures = ${previewFeatures}` : ''

  return /* Prisma */ `
    generator client {
      provider = "prisma-client-js"
      ${previewFeaturesStr}
    }
    
    datasource db {
      provider = "${provider}"
      url      = env("DATABASE_URI_${provider}")
    }
    
    model User {
      id ${idForProvider(provider)}
    }
  `
})
