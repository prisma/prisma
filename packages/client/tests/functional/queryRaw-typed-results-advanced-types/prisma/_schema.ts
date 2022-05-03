export default ({ provider, previewFeatures }) => {
  return `
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
    json        Json?
    string_list String[]
    bInt_list   BigInt[]
  }
  `
}
