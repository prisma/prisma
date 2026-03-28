import testMatrix from '../_matrix'

export default testMatrix.setupSchema(({ provider }) => {
  return /* Prisma */ `
    generator client {
      provider = "prisma-client-js"
    }

    datasource db {
      provider = "${provider}"
    }

    model ModelWithJson {
      id         String @id
      properties Json
    }
  `
})
