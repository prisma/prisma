export const blog = `
datasource db {
  provider = "sqlite"
  url      = "file:db/migration_engine.db"
  default  = true
}

generator photon {
  provider  = "javascript"
  output    = "@generated/photon"
  transpile = false
}

model User {
  id      Int      @id
  email   String   @unique
  name    String
  role    Role     @default(USER)
  posts   Post[]
  profile Profile? @relation(link: INLINE)
}

model Profile {
  id   Int    @id
  user User
  bio  String
}

model Post {
  id         Int        @id
  author     User?
  title      String
  published  Boolean    @default(false)
  categories Category[] @relation("PostToCategory")
}

model Category {
  id    Int    @id
  name  String
  posts Post[] @relation("PostToCategory")
}

enum Role {
  USER
  ADMIN
}
`
