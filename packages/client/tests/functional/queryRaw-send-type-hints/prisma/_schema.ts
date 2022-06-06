import { idForProvider } from '../../_utils/idForProvider'

export default ({ provider, previewFeatures }) => {
  return /* Prisma */ `
  generator client {
    provider = "prisma-client-js"
    previewFeatures = [${previewFeatures}]
  }
  
  datasource db {
    provider = "${provider}"
    url      = env("DATABASE_URI_${provider}")
  }
  
  model Entry {
    id     ${idForProvider(provider)}
    binary Bytes
  }
  `
}
