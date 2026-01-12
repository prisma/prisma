/**
 * Vite Test Fixture - Demonstrates blessed path usage
 */

// The blessed path - clean .ork/types imports
import { OrkClient } from '@ork/client'

import type { DatabaseSchema, Post, Profile, Tag, User } from '.ork/types'

console.log('🚀 Vite + Ork Blessed Path Demo')

// Types are automatically available
const exampleUser: User = {
  id: 1,
  email: 'user@example.com',
  name: 'John Doe',
  avatar: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  posts: [],
  profile: null,
}

const examplePost: Post = {
  id: 1,
  title: 'Hello Ork',
  content: 'This is a test post using the blessed path!',
  published: true,
  publishedAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
  authorId: 1,
  author: exampleUser,
  tags: [],
}

// Verify types work correctly
function testTypes() {
  // Type checking should work perfectly
  const user: User = exampleUser
  const post: Post = examplePost

  console.log('✅ User type:', user.email)
  console.log('✅ Post type:', post.title)

  // Database schema type should be available
  const schema: DatabaseSchema = {
    users: exampleUser,
    posts: examplePost,
    profiles: {} as Profile,
    tags: {} as Tag,
  }

  console.log('✅ Database schema type works')

  return { user, post, schema }
}

// Test HMR integration
if (import.meta.hot) {
  import.meta.hot.accept(() => {
    console.log('🔄 HMR: Types updated')
    testTypes()
  })
}

// Run tests
testTypes()

export { testTypes }
