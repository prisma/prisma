import testMatrix from '../_matrix'

export default testMatrix.setupSchema(({ provider }) => {
  return /* Prisma */ `
  generator client {
    provider = "prisma-client-js"
  }
  
  datasource db {
    provider = "${provider}"
    url      = env("TEST_FUNCTIONAL_${provider === 'mysql' ? 'MARIADB' : provider.toUpperCase()}_URI")
  }
  
  model Post {
    id Int @id @default(autoincrement()) @db.UnsignedInt
    tags TagsOnPosts[]
    @@map("posts")
  }

  model Tag {
    id Int @id @default(autoincrement()) @db.UnsignedInt
    posts TagsOnPosts[]
    @@map("tags")
  }

  model TagsOnPosts {
    postId Int  @map("post_id") @db.UnsignedInt
    tagId  Int  @map("tag_id") @db.UnsignedInt
    post   Post @relation(fields: [postId], references: [id], onDelete: Cascade)
    tag    Tag  @relation(fields: [tagId], references: [id], onDelete: Cascade)
    @@id([postId, tagId])
    @@map("posts_tags")
  }
  `
})
