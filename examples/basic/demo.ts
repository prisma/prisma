/**
 * Ork Basic Example - High-Level Prisma-like API
 *
 * This demo showcases the Prisma-compatible API:
 * - Using generated client with model operations (user.create, post.findMany, etc.)
 * - Type-safe CRUD operations
 * - Relation loading with include
 * - Transactions with the same API surface
 */

import { OrkClient } from './.ork/index.js'
import { PostgreSqlContainer } from '@testcontainers/postgresql'
import { OrkMigrate } from '@ork/migrate'
import { PostgresDialect } from 'kysely'
import pg from 'pg'

async function main() {
  console.log('🚀 Starting Ork Basic Example (High-Level API)\n')

  // Step 1: Start PostgreSQL container
  console.log('📦 Starting PostgreSQL container...')
  const container = await new PostgreSqlContainer('postgres:16-alpine').withExposedPorts(5432).start()

  const connectionString = container.getConnectionUri()
  console.log(`✅ PostgreSQL running at: ${connectionString}\n`)

  try {
    // Step 2: Create Kysely dialect
    console.log('🔧 Creating Kysely dialect...')
    const dialect = new PostgresDialect({
      pool: new pg.Pool({
        connectionString,
        max: 10,
      }),
    })
    console.log('✅ Kysely dialect created\n')

    // Step 3: Create Ork client with generated operations
    console.log('🔧 Creating Ork client...')
    const client = new OrkClient(dialect)
    await client.$connect()
    console.log('✅ Ork client connected\n')

    // Step 4: Run migrations
    console.log('📝 Running migrations...')
    const schemaPath = './schema.prisma'

    const migrate = new OrkMigrate({
      useTransaction: true,
      validateSchema: true,
    })

    try {
      const migrationDiff = await migrate.diff(client.$kysely, schemaPath)
      console.log('Generated migration SQL:')
      console.log(migrationDiff.statements.join('\n'))
      console.log()

      const result = await migrate.apply(client.$kysely, schemaPath)
      if (!result.success) {
        throw new Error(`Migration failed: ${result.errors.map((e) => e.message).join(', ')}`)
      }
      console.log('✅ Migrations applied\n')
    } catch (migrationError) {
      console.error('❌ Migration error:', migrationError)
      throw migrationError
    }

    // Step 5: Use the high-level Prisma-like API
    console.log('📊 Creating sample data with high-level API...\n')

    // Create a user using the generated client
    const user = await client.user.create({
      data: {
        email: 'alice@example.com',
        name: 'Alice',
      },
    })
    console.log('✅ Created user:', user)

    // Create a profile for the user
    const profile = await client.profile.create({
      data: {
        bio: 'Software engineer and TypeScript enthusiast',
        userId: user.id,
      },
    })
    console.log('✅ Created profile:', profile)

    // Create posts
    const post1 = await client.post.create({
      data: {
        title: 'Getting Started with Ork',
        content: 'Ork is a TypeScript-native ORM built on Kysely...',
        published: true,
        authorId: user.id,
      },
    })
    console.log('✅ Created post:', post1)

    const post2 = await client.post.create({
      data: {
        title: 'Advanced Kysely Patterns',
        content: 'Learn how to leverage Kysely for complex queries...',
        published: false,
        authorId: user.id,
      },
    })
    console.log('✅ Created post:', post2)
    console.log()

    // Step 6: Query with relations using include
    console.log('🔍 Querying user with profile relation...')
    try {
      const userWithProfile = await client.user.findUnique({
        where: { id: user.id },
        include: { profile: true },
      })
      console.log('User with profile:', JSON.stringify(userWithProfile, null, 2))
    } catch (error) {
      console.error('❌ Error querying user with profile:', error)
      throw error
    }
    console.log()

    // Step 7: Query with one-to-many relation (posts array)
    console.log('🔍 Querying user with posts relation (one-to-many)...')
    try {
      const userWithPosts = await client.user.findUnique({
        where: { id: user.id },
        include: { posts: true },
      })
      console.log('User with posts:', JSON.stringify(userWithPosts, null, 2))
    } catch (error) {
      console.error('❌ Error querying user with posts:', error)
      throw error
    }
    console.log()

    // Step 8: Find all published posts
    console.log('🔍 Finding published posts...')
    const publishedPosts = await client.post.findMany({
      where: { published: true },
      orderBy: { createdAt: 'desc' },
    })
    console.log('Published posts:', publishedPosts)
    console.log()

    // Step 9: Update operations
    console.log('📝 Updating post...')
    const updatedPost = await client.post.update({
      where: { id: post2.id },
      data: { published: true },
    })
    console.log('✅ Updated post:', updatedPost)
    console.log()

    // Step 10: Create more data without transaction (not needed for independent operations)
    console.log('📊 Creating additional user...')
    const bob = await client.user.create({
      data: {
        email: 'bob@example.com',
        name: 'Bob',
      },
    })
    console.log('✅ Created user:', bob)

    const bobProfile = await client.profile.create({
      data: {
        bio: 'Database enthusiast',
        userId: bob.id,
      },
    })
    console.log('✅ Created profile:', bobProfile)
    const charlie = await client.user.create({
      data: {
        email: 'charlie@example.com',
        name: null,
      },
    })
    console.log('✅ Created user:', charlie)
    console.log()

    // Step 11: Transaction example (only when we need atomicity)
    console.log('💰 Testing transaction for atomic operations...')
    await client.$transaction(async (trx) => {
      // Update user and create post atomically
      await trx.user.update({
        where: { id: bob.id },
        data: { name: 'Bob Smith' },
      })

      await trx.post.create({
        data: {
          title: 'My First Post',
          content: 'Hello from Bob!',
          published: true,
          authorId: bob.id,
        },
      })
    })
    console.log('✅ Transaction completed (user updated & post created atomically)\n')

    // Step 12: Relation filtering (some/every/none, is/isNot)
    console.log('🔍 Relation filtering examples...')
    const usersWithPublishedPosts = await client.user.findMany({
      where: { posts: { some: { published: true } } },
    })
    console.log('Users with published posts:', usersWithPublishedPosts.map((u) => u.email))

    const usersWithAllPublishedPosts = await client.user.findMany({
      where: { posts: { every: { published: true } } },
    })
    console.log('Users where every post is published:', usersWithAllPublishedPosts.map((u) => u.email))

    const usersWithNoPublishedPosts = await client.user.findMany({
      where: { posts: { none: { published: true } } },
    })
    console.log('Users with no published posts:', usersWithNoPublishedPosts.map((u) => u.email))

    const usersWithProfiles = await client.user.findMany({
      where: { profile: { isNot: null } },
    })
    console.log('Users with profiles:', usersWithProfiles.map((u) => u.email))
    console.log()

    // Step 13: Count records
    console.log('📊 Final counts:')
    const userCount = await client.user.count()
    const postCount = await client.post.count()
    const publishedCount = await client.post.count({ where: { published: true } })

    console.log(`Users: ${userCount}`)
    console.log(`Posts: ${postCount}`)
    console.log(`Published posts: ${publishedCount}`)
    console.log()

    // Cleanup
    console.log('🧹 Cleaning up...')
    await client.$disconnect()
    console.log('✅ Client disconnected')
  } finally {
    await container.stop()
    console.log('✅ Container stopped')
  }

  console.log('\n🎉 Demo completed successfully!')
}

main().catch((error) => {
  console.error('❌ Demo failed:', error)
  process.exit(1)
})
