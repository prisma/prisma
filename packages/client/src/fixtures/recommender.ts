export const recommender = /* Prisma */ `
datasource db {
  provider = "sqlite"
  url      = "file:./dev.db"
}

model Article {
  id      Int      @id
  url     String   @unique
  title   String
  content String
  date    DateTime
  likedBy User[]
  link    Link?
}

model Link {
  id        Int      @id
  articleId Int
  article   Article  @relation(fields: [articleId], references: [id])
  postedAt  DateTime
}

model User {
  id            Int       @id
  name          String
  email         String    @unique
  likedArticles Article[]
  personaId     Int
  persona       Persona   @relation(fields: [personaId], references: [id])
}

model Persona {
  id          Int     @id
  isDeveloper Boolean
  User        User[]
}
`
