export const blog = /* Prisma */ `
datasource db {
  provider = "postgresql"
  url      = "postgresql://localhost:5432/db"
}

generator client {
  provider  = "prisma-client-js"
  output    = "@prisma/client"
  transpile = false
}

/// User model comment
model User {
  id    String  @default(uuid()) @id
  email String  @unique
  /// name comment
  name  String?
  posts Post[]
  profile Profile?
  json Json?
  countFloat Float?
  countInt1 Int?
  countInt2 Int?
  countInt3 Int?
  countInt4 Int?
  countInt5 Int?
  countInt6 Int?
  lastLoginAt DateTime @default(now())
  coinflips Boolean[]
}

model Profile {
  id     String     @default(cuid()) @id
  bio    String?
  user   User       @relation(fields: [userId], references: [id])
  userId String     @unique
}

model Post {
  id        String   @default(cuid()) @id
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  published Boolean
  title     String
  content   String?
  authorId  String?
  optional  Float?
  author    User? @relation(fields: [authorId], references: [id])
  categories Category[]  @relation("MyPostCatRelationTable")
}

model Category {
  id        String   @default(cuid()) @id
  posts     Post[]  @relation("MyPostCatRelationTable")
}

model NoRelations {
  id String @id @default(cuid())
  name String
}

enum Role {
  USER
  ADMIN
}
`
