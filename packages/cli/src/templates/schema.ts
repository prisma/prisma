/**
 * Generate schema content for a specific provider
 */
export function generateSchemaContent(provider: string, url: string = ''): string {
  const baseSchema = `// This is your Ork schema file (.prisma syntax).

generator client {
  provider = "ork"
}

datasource db {
  provider = "${provider}"
}

model User {
  id        Int      @id @default(autoincrement())
  email     String   @unique
  name      String?
  posts     Post[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Post {
  id        Int      @id @default(autoincrement())
  title     String
  content   String?
  published Boolean  @default(false)
  author    User     @relation(fields: [authorId], references: [id])
  authorId  Int
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
`

  // Provider-specific adjustments
  switch (provider) {
    case 'sqlite':
    case 'd1':
      // SQLite doesn't support autoincrement() with Int, use autoincrement() or cuid()
      return baseSchema.replace(/@id @default\(autoincrement\(\)\)/g, '@id @default(autoincrement())')

    case 'mysql':
      // MySQL works well with the base schema
      return baseSchema

    case 'postgresql':
      // PostgreSQL supports all features in base schema
      return baseSchema

    default:
      return baseSchema
  }
}
