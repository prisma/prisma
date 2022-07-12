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

    //
    // 1:1 relation
    //

    model UserOneToOne {
      id      ${id}
      profile ProfileOneToOne?
    }
    model ProfileOneToOne {
      id       ${id}
      user     UserOneToOne @relation(fields: [userId], references: [id])
      userId   String @unique
    }

    //
    // 1:n relation
    //

    model UserOneToMany {
      id    ${id}
      posts PostOneToMany[]
    }
    model PostOneToMany {
      id       ${id}
      author   UserOneToMany @relation(fields: [authorId], references: [id])
      authorId String
    }

    //
    // m:n relation
    //

    model PostManyToMany {
      id         ${id}
      categories CategoriesOnPostsManyToMany[]
    }

    model CategoryManyToMany {
      id    ${id}
      posts CategoriesOnPostsManyToMany[]
    }

    model CategoriesOnPostsManyToMany {
      post       PostManyToMany     @relation(fields: [postId], references: [id])
      postId     String
      category   CategoryManyToMany @relation(fields: [categoryId], references: [id])
      categoryId String

      @@id([postId, categoryId])
    }
  `
})
