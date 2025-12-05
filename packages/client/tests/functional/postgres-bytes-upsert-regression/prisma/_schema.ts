import testMatrix from '../_matrix'

export default testMatrix.setupSchema(({ provider }) => {
  return /* Prisma */ `
  generator client {
    provider = "prisma-client-js"
  }
  
  datasource db {
    provider = "${provider}"
  }
  
  model TestByteId {
    id    Bytes  @id
    value String
  }
  
  model TestStringId {
    id    String @id
    value String
  }
  `
})