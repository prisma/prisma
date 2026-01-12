/**
 * Webpack Test Fixture
 */

import type { DatabaseSchema, Post, Profile, Tag, User } from '.ork/types'

console.log('📦 Webpack + Ork Recommended Path Demo')

// Create typed data
const sampleUser: User = {
  id: 1,
  email: 'webpack@example.com',
  name: 'Webpack User',
  avatar: 'avatar.jpg',
  createdAt: new Date(),
  updatedAt: new Date(),
  posts: [],
  profile: null,
}

const samplePost: Post = {
  id: 1,
  title: 'Webpack Integration Test',
  content: 'Testing unplugin-ork with Webpack bundler',
  published: true,
  publishedAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
  authorId: 1,
  author: sampleUser,
  tags: [],
}

// Comprehensive type testing
function validateTypes(): void {
  // Test all model types are available
  console.log('✅ User type validation:', sampleUser.email)
  console.log('✅ Post type validation:', samplePost.title)

  // Test database schema type
  const dbSchema: DatabaseSchema = {
    users: sampleUser,
    posts: samplePost,
    profiles: {} as Profile,
    tags: {} as Tag,
  }

  console.log('✅ DatabaseSchema type available')

  // Test optional fields
  const userWithProfile: User = {
    ...sampleUser,
    profile: {
      id: 1,
      bio: 'Test bio',
      userId: 1,
      user: sampleUser,
    },
  }

  console.log('✅ Nested types work:', userWithProfile.profile?.bio)

  // Test array types
  const postWithTags: Post = {
    ...samplePost,
    tags: [
      { id: 1, name: 'typescript', posts: [] },
      { id: 2, name: 'webpack', posts: [] },
    ],
  }

  console.log('✅ Array types work:', postWithTags.tags.length)

  console.log('🎉 All type validations passed!')
}

// Test webpack-specific features
function testWebpackIntegration(): void {
  // Test tree-shaking (webpack should optimize unused imports)
  console.log('📊 Testing Webpack-specific optimizations')

  // Test that types are available at build time
  const typeCheck: User['email'] = 'type-check@example.com'
  console.log('✅ Build-time type checking works:', typeCheck)

  // Test production optimizations
  if (process.env.NODE_ENV === 'production') {
    console.log('🏭 Production mode optimizations active')
  } else {
    console.log('🔧 Development mode with full debugging')
  }
}

// Run all tests
validateTypes()
testWebpackIntegration()

// Export for testing
export { samplePost, sampleUser, testWebpackIntegration, validateTypes }
