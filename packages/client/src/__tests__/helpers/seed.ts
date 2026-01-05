import { Kysely, sql } from 'kysely'

export interface SeedData {
  users: Array<{ id: number; email: string; name: string | null }>
  profiles: Array<{ id: number; bio: string | null; userId: number }>
  posts: Array<{ id: number; title: string; content: string | null; published: boolean; authorId: number }>
}

/**
 * Seed the test database with consistent data
 */
export async function seedTestData(kysely: Kysely<any>): Promise<SeedData> {
  // Create users
  const users = await kysely
    .insertInto('User')
    .values([
      { email: 'alice@example.com', name: 'Alice' },
      { email: 'bob@example.com', name: 'Bob' },
      { email: 'charlie@example.com', name: null },
    ])
    .returning(['id', 'email', 'name'])
    .execute()

  // Create profiles
  const profiles = await kysely
    .insertInto('Profile')
    .values([
      { userId: users[0].id, bio: 'Software developer from San Francisco' },
      { userId: users[1].id, bio: null },
    ])
    .returning(['id', 'bio', 'userId'])
    .execute()

  // Create posts
  const posts = await kysely
    .insertInto('Post')
    .values([
      {
        title: 'Getting Started with TypeScript',
        content: 'TypeScript is great for type safety...',
        published: true,
        authorId: users[0].id,
      },
      {
        title: 'Advanced Prisma Patterns',
        content: 'Learn about advanced querying...',
        published: true,
        authorId: users[0].id,
      },
      {
        title: 'Draft Post',
        content: 'This is a draft...',
        published: false,
        authorId: users[0].id,
      },
      {
        title: 'Bob\'s First Post',
        content: 'Hello world!',
        published: true,
        authorId: users[1].id,
      },
    ])
    .returning(['id', 'title', 'content', 'published', 'authorId'])
    .execute()

  return { users, profiles, posts }
}

/**
 * Clear all data from the test database
 */
export async function clearTestData(kysely: Kysely<any>) {
  await sql`TRUNCATE TABLE "Post", "Profile", "User" RESTART IDENTITY CASCADE`.execute(kysely)
}
