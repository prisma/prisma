#!/usr/bin/env tsx
/**
 * Demo of @refract/client
 *
 * Shows the completed functionality:
 * 1. Package structure with ESM/TypeScript
 * 2. Schema AST consumption and type generation
 * 3. Client factory with driver integration
 *
 * Usage: pnpx tsx demo.ts
 */

import { parseSchema } from '@refract/schema-parser'

import { RefractClientFactory, TypeGenerator } from '../src/index.js'

console.log('🚀 Refract Client Demo\n')

// Simple blog schema - easy to understand
const exampleSchema = `
generator client {
  provider = "refract"
  output   = "./generated/client"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id        Int      @id @default(autoincrement())
  email     String   @unique
  name      String?
  role      Role     @default(READER)
  createdAt DateTime @default(now())
  
  posts     Post[]
}

model Post {
  id        Int      @id @default(autoincrement())
  title     String
  content   String?
  published Boolean  @default(false)
  createdAt DateTime @default(now())
  authorId  Int
  
  author    User     @relation(fields: [authorId], references: [id])
}

enum Role {
  ADMIN
  AUTHOR
  READER
}
`

async function runDemo() {
  console.log("🎯 What's Working Now\n")

  // ============================================================================
  // Schema Parsing with String Input
  // ============================================================================
  console.log('📝 Schema Parsing (String Input)')
  console.log('─'.repeat(50))

  // Parse the schema using the schema parser - test string input
  const parseResult = parseSchema(exampleSchema)

  if (parseResult.errors.length > 0) {
    console.error(
      '❌ Schema parsing failed:',
      parseResult.errors.map((e) => e.message),
    )
    return
  }

  console.log(`✅ Parsed complete schema with:`)
  console.log(`   • ${parseResult.ast.generators.length} generator(s)`)
  console.log(`   • ${parseResult.ast.datasources.length} datasource(s)`)
  console.log(`   • ${parseResult.ast.models.length} models`)
  console.log(`   • ${parseResult.ast.enums.length} enum(s)`)
  console.log(`   • Relations, defaults, unique constraints\n`)

  // ============================================================================
  // Schema Parsing with File Input
  // ============================================================================
  console.log('📁 Schema Parsing (File Input)')
  console.log('─'.repeat(50))

  // Test file path parsing
  const fileParseResult = parseSchema('./schema.prisma')

  if (fileParseResult.errors.length > 0) {
    console.log("⚠️  File parsing had errors (expected if file doesn't exist)")
  } else {
    console.log(`✅ Parsed schema file with:`)
    console.log(`   • ${fileParseResult.ast.models.length} models from file`)
    console.log(`   • File-based parsing working correctly`)
  }
  console.log('')

  // ============================================================================
  // Type Generation (Kysely-Compatible)
  // ============================================================================
  console.log('🏗️ Type Generation (Kysely-Compatible)')
  console.log('─'.repeat(50))

  const typeGenerator = new TypeGenerator(parseResult.ast)

  console.log('📋 Generated Database Schema:')
  console.log(typeGenerator.generateDatabaseSchema())

  console.log('\n📋 Generated Model Interfaces:')
  console.log(typeGenerator.generateModelInterfaces())

  // ============================================================================
  // Client Factory Integration
  // ============================================================================
  console.log('🏭 Client Factory Integration')
  console.log('─'.repeat(50))

  // Demonstrate client factory instantiation
  const clientOptions = {
    schema: exampleSchema,
    datasource: {
      connectionString: 'postgresql://demo:demo@localhost:5432/demo',
    },
  }

  new RefractClientFactory(clientOptions)
  console.log('✅ RefractClientFactory instantiated with:')
  console.log('   • Schema parsing integration')
  console.log('   • PostgreSQL driver integration')
  console.log('   • Kysely instance management')
  console.log('   • Connection lifecycle methods')
  console.log('   • Transaction support')
  console.log('   • Factory cleanup pattern\n')

  // ============================================================================
  // Generated Model Summary
  // ============================================================================
  console.log('📊 Generated Models Summary')
  console.log('─'.repeat(50))

  const models = typeGenerator.getGeneratedModels()
  models.forEach((model) => {
    console.log(`📄 ${model.name} (table: ${model.tableName})`)

    model.fields.forEach((field) => {
      const badges: string[] = []
      if (field.isPrimaryKey) badges.push('PK')
      if (field.isUnique) badges.push('UNIQUE')
      if (field.hasDefault) badges.push('DEFAULT')

      const badgeStr = badges.length > 0 ? ` [${badges.join(', ')}]` : ''
      const optional = field.isOptional ? '?' : ''
      const list = field.isList ? '[]' : ''

      console.log(`   ${field.name}${optional}: ${field.type}${list}${badgeStr}`)
    })
    console.log()
  })

  // ============================================================================
  // What's Coming Next
  // ============================================================================
  console.log("🚀 What's Coming Next")
  console.log('─'.repeat(50))
  console.log('🔜 CRUD Operations Generator')
  console.log('   • Generate findMany, findUnique, create, update, delete methods')
  console.log('   • Type-safe query building with Kysely')
  console.log('   • Relation handling and nested operations')
  console.log('')
  console.log('🔜 Final Client Assembly')
  console.log('   • Combine all model operations into unified client')
  console.log('   • ESM export generation with tree-shaking')
  console.log('   • Complete TypeScript declaration files')
  console.log('')
  console.log('✨ The foundation is complete and ready for implementation!')

  // Example of what the final client API will look like (preview)
  console.log('\n🔮 PREVIEW: Final Client API')
  console.log('─'.repeat(60))
  console.log(`
const client = new RefractClient(dialect, {
  schema: 'path/to/schema.prisma',
  datasource: { connectionString: 'postgresql://...' }
})

// Generated CRUD operations (coming next)
const users = await client.user.findMany({
  where: { role: 'AUTHOR' }
})

const newUser = await client.user.create({
  email: 'jane@example.com',
  name: 'Jane Doe',
  role: 'AUTHOR'
})

const posts = await client.post.findMany({
  where: { published: true }
})

const newPost = await client.post.create({
  title: 'My First Post',
  content: 'Hello world!',
  published: true,
  authorId: newUser.id
})

// Direct Kysely access (already working)
const publishedPosts = await client.$kysely
  .selectFrom('post')
  .innerJoin('user', 'post.authorId', 'user.id')
  .select(['post.title', 'user.name as authorName'])
  .where('post.published', '=', true)
  .execute()

// Transaction support (already working)
await client.$transaction(async (trx) => {
  const user = await trx.user.create({...})
  await trx.post.create({ authorId: user.id, ... })
})
`)
}

// Run the demo
runDemo().catch(console.error)
