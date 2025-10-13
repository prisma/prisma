/**
 * Schema templates for different database providers
 */

export interface SchemaTemplate {
  provider: string
  content: string
  description: string
}

/**
 * Generate schema content for a specific provider
 */
export function generateSchemaContent(provider: string): string {
  const baseSchema = `// This is your Prisma schema file,
// learn more about it in the docs: https://pris.ly/d/prisma-schema

generator client {
  provider = "@refract/client"
}

datasource db {
  provider = "${provider}"
  url      = env("DATABASE_URL")
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
    case 'neon':
    case 'supabase':
      // PostgreSQL supports all features in base schema
      return baseSchema

    default:
      return baseSchema
  }
}

/**
 * Schema templates for different use cases
 */
export const SCHEMA_TEMPLATES: Record<string, SchemaTemplate> = {
  basic: {
    provider: 'any',
    description: 'Basic User and Post models',
    content: generateSchemaContent('postgresql'), // Will be replaced with actual provider
  },

  ecommerce: {
    provider: 'any',
    description: 'E-commerce models (User, Product, Order)',
    content: `// E-commerce schema template
generator client {
  provider = "@refract/client"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String?
  orders    Order[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Product {
  id          String      @id @default(cuid())
  name        String
  description String?
  price       Decimal
  stock       Int         @default(0)
  orderItems  OrderItem[]
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt
}

model Order {
  id         String      @id @default(cuid())
  user       User        @relation(fields: [userId], references: [id])
  userId     String
  items      OrderItem[]
  total      Decimal
  status     OrderStatus @default(PENDING)
  createdAt  DateTime    @default(now())
  updatedAt  DateTime    @updatedAt
}

model OrderItem {
  id        String  @id @default(cuid())
  order     Order   @relation(fields: [orderId], references: [id])
  orderId   String
  product   Product @relation(fields: [productId], references: [id])
  productId String
  quantity  Int
  price     Decimal
}

enum OrderStatus {
  PENDING
  PROCESSING
  SHIPPED
  DELIVERED
  CANCELLED
}
`,
  },

  blog: {
    provider: 'any',
    description: 'Blog models with categories and tags',
    content: `// Blog schema template
generator client {
  provider = "@refract/client"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id        String   @id @default(cuid())
  email     String   @unique
  username  String   @unique
  name      String?
  bio       String?
  posts     Post[]
  comments  Comment[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Post {
  id          String     @id @default(cuid())
  title       String
  slug        String     @unique
  content     String
  excerpt     String?
  published   Boolean    @default(false)
  author      User       @relation(fields: [authorId], references: [id])
  authorId    String
  category    Category   @relation(fields: [categoryId], references: [id])
  categoryId  String
  tags        PostTag[]
  comments    Comment[]
  publishedAt DateTime?
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt
}

model Category {
  id          String @id @default(cuid())
  name        String @unique
  slug        String @unique
  description String?
  posts       Post[]
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model Tag {
  id        String    @id @default(cuid())
  name      String    @unique
  slug      String    @unique
  posts     PostTag[]
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
}

model PostTag {
  post   Post   @relation(fields: [postId], references: [id])
  postId String
  tag    Tag    @relation(fields: [tagId], references: [id])
  tagId  String

  @@id([postId, tagId])
}

model Comment {
  id        String   @id @default(cuid())
  content   String
  author    User     @relation(fields: [authorId], references: [id])
  authorId  String
  post      Post     @relation(fields: [postId], references: [id])
  postId    String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
`,
  },
}
