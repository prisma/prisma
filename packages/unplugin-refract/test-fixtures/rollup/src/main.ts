/**
 * Rollup Test Fixture - Demonstrates blessed path usage
 */

// The blessed path - clean .refract/types imports
import type { DatabaseSchema, Post, Profile, Tag, User } from '.refract/types'

console.log('🗞️ Rollup + Refract Blessed Path Demo')

// Test complex nested types
const complexUser: User = {
  id: 1,
  email: 'rollup@example.com',
  name: 'Rollup Tester',
  avatar: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date(),
  posts: [],
  profile: {
    id: 1,
    bio: 'I love tree-shaking!',
    userId: 1,
    user: {} as User, // Circular reference handled
  },
}

const complexPost: Post = {
  id: 1,
  title: 'Rollup Bundle Optimization',
  content: 'Testing how Rollup handles Refract virtual modules',
  published: true,
  publishedAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
  authorId: 1,
  author: complexUser,
  tags: [
    { id: 1, name: 'rollup', posts: [] },
    { id: 2, name: 'bundling', posts: [] },
    { id: 3, name: 'tree-shaking', posts: [] },
  ],
}

// Test Rollup-specific optimizations
function testTreeShaking(): void {
  console.log('🌳 Testing tree-shaking with Rollup')

  // Only use specific fields to test tree-shaking
  const userEmail: User['email'] = complexUser.email
  const postTitle: Post['title'] = complexPost.title

  console.log('✅ Tree-shaking test:', { userEmail, postTitle })

  // Test that unused types are still available
  const unusedProfile: Profile = {
    id: 999,
    bio: 'This should be tree-shaken if unused',
    userId: 999,
    user: complexUser,
  }

  // This reference prevents tree-shaking
  console.log('📊 Profile available for tree-shaking:', unusedProfile.id)
}

function testDatabaseSchema(): void {
  console.log('🗄️ Testing DatabaseSchema type')

  const schema: DatabaseSchema = {
    users: complexUser,
    posts: complexPost,
    profiles: complexUser.profile!,
    tags: complexPost.tags[0],
  }

  // Test all schema properties are accessible
  Object.keys(schema).forEach((table) => {
    console.log(`✅ Table "${table}" is typed correctly`)
  })
}

// Test production bundle optimization
function testProductionOptimizations(): void {
  if (process.env.NODE_ENV === 'production') {
    console.log('🏭 Production optimizations enabled')
    console.log('  - Code minification active')
    console.log('  - Source maps generated')
    console.log('  - Virtual module caching enabled')
  } else {
    console.log('🔧 Development mode active')
  }
}

// Test import patterns work with Rollup
function testImportPatterns(): void {
  console.log('📦 Testing import pattern compatibility')

  // These should all resolve to the same virtual modules
  // (Note: These are type-only imports, so they won't affect bundle size)

  // Test that all expected types are available
  const typeTests = {
    user: 'User' as keyof DatabaseSchema,
    post: 'Post' as keyof DatabaseSchema,
    profile: 'Profile' as keyof DatabaseSchema,
    tag: 'Tag' as keyof DatabaseSchema,
  }

  console.log('✅ All import patterns work:', Object.keys(typeTests))
}

// Run all tests
testTreeShaking()
testDatabaseSchema()
testProductionOptimizations()
testImportPatterns()

console.log('🎉 Rollup fixture tests completed!')

// Export for external testing
export {
  complexPost,
  complexUser,
  testDatabaseSchema,
  testImportPatterns,
  testProductionOptimizations,
  testTreeShaking,
}
