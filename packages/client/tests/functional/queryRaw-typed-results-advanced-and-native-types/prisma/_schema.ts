import testMatrix from '../_matrix'

export default testMatrix.setupSchema(({ provider, previewFeatures }) => {
  return /* Prisma */ `
    generator client {
      provider = "prisma-client-js"
      previewFeatures = [${previewFeatures}]
    }
    
    datasource db {
      provider = "${provider}"
      url      = env("DATABASE_URI_${provider}")
    }
    
    model TestModel {
      id          Int       @id
      json        Json
      string_list String[]
      bInt_list   BigInt[]
      date        DateTime  @db.Date
      time        DateTime  @db.Time(3)
    }
  `
})
