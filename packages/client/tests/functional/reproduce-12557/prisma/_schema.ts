import testMatrix from '../_matrix'

export default testMatrix.setupSchema(({ provider, previewFeatures, relationMode }) => {
  // if relationMode is not defined, we do not add the line
  // if relationMode is defined
  // we add the line only if the provider is not MongoDB, since MongoDB doesn't need the setting, it's on by default
  const relationModeLine = `relationMode = "${relationMode}"`

  const schemaHeader = /* Prisma */ `
generator client {
  provider = "prisma-client-js"
  previewFeatures = [${previewFeatures}]
}

datasource db {
  provider = "${provider}"
  url      = env("DATABASE_URI_${provider}")
  ${relationModeLine}
}
  `

  const schema = /* Prisma */ `
${schemaHeader}

model Category {
  id     String  @id @default(cuid())
  name   String  @unique
  brands Brand[]
}

model Brand {
  id         String     @id @default(cuid())
  name       String     @unique
  categories Category[] 
}
  `

  console.log('schema', schema)

  return schema
})
