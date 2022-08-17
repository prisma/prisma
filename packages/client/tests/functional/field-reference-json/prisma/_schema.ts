import { idForProvider } from '../../_utils/idForProvider'
import testMatrix from '../_matrix'

export default testMatrix.setupSchema(({ provider }) => {
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
    id ${idForProvider(provider)}
    title String
    properties1 Json
    properties2 Json?
  }
  `
})
