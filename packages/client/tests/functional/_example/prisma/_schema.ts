import testMatrix from '../_matrix'

export default testMatrix.setupSchema(({ provider, randomString, previewFeatures, id }) => {
  return /* Prisma */ `
    generator client {
      provider = "prisma-client-js"
      previewFeatures = [${previewFeatures}]
    }
    
    datasource db {
      provider = "${provider}"
      url      = env("DATABASE_URI_${provider}")
    }
    
    model User {
      id ${id}
      ${randomString} String
    }
  `
})
