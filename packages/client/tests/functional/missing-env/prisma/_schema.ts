import testMatrix from '../_matrix'

export default testMatrix.setupSchema(({ provider, id }) => {
  return /* Prisma */ `
    generator client {
      provider = "prisma-client-js"
    }
    
    datasource db {
      provider = "${provider}"
      url      = env("DATABASE_URI")
    }
    
    model User {
      id ${id}
    }
  `
})
