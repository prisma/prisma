export const blog = /* GraphQL */ `
datasource db {
  provider = "postgresql"
  url      = "postgresql://localhost:5432/db"
}

generator photon {
  provider  = "javascript"
  output    = "@generated/photon"
  transpile = false
}

/// User model comment
model User {
  id    String  @default(uuid()) @id
  email String  @unique
  /// name comment
  name  String?
  posts Post[]
}

model Post {
  id        String   @default(cuid()) @id
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
