import testMatrix from '../_matrix'

export default testMatrix.setupSchema(({ provider, providerFeatures, previewFeatures, id }) => {
  return /* Prisma */ `
  generator client {
    provider = "prisma-client-js"
    previewFeatures = [${providerFeatures}${previewFeatures}]
  }
  
  datasource db {
    provider = "${provider}"
    url      = env("DATABASE_URI_${provider}")
  }
  
  model User {
    id ${id}
  }
  `
})
