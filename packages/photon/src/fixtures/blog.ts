export const blog = /* GraphQL */ `
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

/// User model comment
model User {
  id    String  @default(cuid()) @id @unique
  email String  @unique
  /// name comment
  name  String?
  posts Post[]
}

model Post {
  id        String   @default(cuid()) @id @unique
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  published Boolean
  title     String
  content   String?
  author    User?
}

enum Role {
  USER
  ADMIN
}
`
