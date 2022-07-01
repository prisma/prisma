import testMatrix from '../_matrix'

export default testMatrix.setupSchema(({ provider, id }) => {
  return /* Prisma */ `
    generator client {
      provider = "prisma-client-js"
      previewFeatures = ["tracing"]
    }
    
    datasource db {
      provider = "${provider}"
      url      = env("DATABASE_URI_${provider}")
    }
    
    model User {
      id ${id}
      email String
    }
  `
})
