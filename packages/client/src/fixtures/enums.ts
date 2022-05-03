export const enums = /* Prisma */ `
datasource db {
  provider = "postgresql"
  url      = "postgresql://localhost:5432/db"
}

model User {
  id           String       @id @default(cuid())
  name         String
  email        String       @unique
  status       String
  nicknames    String[]
  permissions  Permission[]
  favoriteTree Tree
  locationId   Int
  location     Location     @relation(fields: [locationId], references: [id])
  posts        Post[]
  someFloats   Float[]
}

model Post {
  id        String   @id @default(cuid())
  name      String
  email     String   @unique
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  userId    String
  user      User     @relation(fields: [userId], references: [id])
}

model Test {
  id   String @id @default(uuid())
  name String
}

model Location {
  id   Int    @id
  city String
  User User[]
}

enum Tree {
  ARBORVITAE
  YELLOWBIRCH
  BLACKASH
  DOUGLASFIR
  OAK
}

enum Permission {
  ADMIN
  USER
  OWNER
  COLLABORATOR
}

`
