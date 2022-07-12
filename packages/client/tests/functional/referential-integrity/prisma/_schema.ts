import testMatrix from '../_matrix'

export default testMatrix.setupSchema(({ provider, previewFeatures, referentialIntegrity, id }) => {
  let referentialIntegrityLine = ''

  switch (referentialIntegrity) {
    case 'prisma':
    case 'foreignKeys':
      referentialIntegrityLine = `referentialIntegrity = "${referentialIntegrity}"`
      break
    default:
      break
  }

  const schemaHeader = /* Prisma */ `
    generator client {
      provider = "prisma-client-js"
      previewFeatures = [${previewFeatures}]
    }
    
    datasource db {
      provider = "${provider}"
      url      = env("DATABASE_URI_${provider}")
      ${referentialIntegrityLine}
    }
  `

  return /* Prisma */ `
    ${schemaHeader}

    // TODO rename models to more explicit name
    // 1:1 relation
    model User {
      id      ${id}
      profile Profile?
    }
    model Profile {
      id       ${id}
      user     User @relation(fields: [userId], references: [id])
      userId   String @unique
    }

    // 1:n relation
    model OneToManyUser {
      id    Int    @id
      posts Post[]
    }
    model OneToManyPost {
      id       Int  @id
      author   User @relation(fields: [authorId], references: [id])
      authorId Int
    }
  `
})
