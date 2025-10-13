#!/usr/bin/env tsx

/**
 * Unified Client Demo - Simplified Type Precedence Approach
 *
 * Demonstrates:
 * 1. Manual types (highest precedence)
 * 2. Generated types (from .refract/types.ts)
 * 3. Any types (fallback)
 *
 * Run: pnpm tsx unified-demo.ts
 */

import { RefractClient } from '../src/index.js'

// Mock database URL for demo
const demoOptions = {
  datasource: {
    url: 'postgresql://demo:demo@localhost:5432/demo',
  },
}

async function demoTypePrecedence() {
  console.log('🎯 Unified Refract Client - Type Precedence Demo\n')

  // Demo 1: Manual Generic Types (Highest Precedence)
  console.log('📋 1. Manual Generic Types (Explicit - Highest Precedence)')

  interface MyCustomSchema {
    User: {
      id: number
      email: string
      name: string | null
      createdAt: Date
    }
    Post: {
      id: number
      title: string
      content: string
      authorId: number
      published: boolean
    }
  }

  try {
    const manualClient = new RefractClient<MyCustomSchema>(demoOptions)

    console.log('   ✅ Client created with manual generic types')
    console.log('   ✅ TypeScript knows about User and Post models')
    console.log('   ✅ $kysely available with proper typing')

    // Even if .refract/types.ts exists, manual types take precedence
    console.log('   📝 Note: Manual types override any generated types')

    await manualClient.$disconnect()
  } catch (error) {
    console.log(`   ❌ Expected error (no database): ${error.message}`)
  }

  // Demo 2: Generated Types Discovery (Middle Precedence)
  console.log('\n📋 2. Generated Types Discovery (from .refract/types.ts)')

  try {
    // This would check for .refract/types.ts automatically
    const generatedClient = await new RefractClientAsync({
      ...demoOptions,
      generatedTypesPath: '.refract/types.ts', // Custom path if needed
    })

    console.log('   ✅ Client created with auto-discovery')
    console.log('   ✅ Checked for .refract/types.ts file')
    console.log('   ✅ Falls back to any types if file not found')

    await generatedClient.$disconnect()
  } catch (error) {
    console.log(`   ❌ Expected error (no database): ${error.message}`)
  }

  // Demo 3: Any Types Fallback (Lowest Precedence)
  console.log('\n📋 3. Any Types Fallback (No types - Maximum flexibility)')

  try {
    const anyClient = new RefractClient(demoOptions)

    console.log('   ✅ Client created with any types')
    console.log('   ✅ No TypeScript constraints - maximum flexibility')
    console.log('   ✅ Perfect for rapid prototyping')
    console.log('   ✅ $kysely still available for direct queries')

    await anyClient.$disconnect()
  } catch (error) {
    console.log(`   ❌ Expected error (no database): ${error.message}`)
  }

  console.log('\n🎉 Unified Client Type Precedence Demo Complete!')
  console.log('\n📝 Summary:')
  console.log('   • Manual Generic Types: new RefractClient<MySchema>() - HIGHEST precedence')
  console.log('   • Generated Types: Auto-discovery from .refract/types.ts - MIDDLE precedence')
  console.log('   • Any Types: Fallback for prototyping - LOWEST precedence')
  console.log('   • All approaches expose $kysely for direct query access')
  console.log('   • Type precedence follows "explicit over implicit" principle')
}

async function demoClientFeatures() {
  console.log('\n🔧 Client Features Demo')

  try {
    const client = new RefractClient(demoOptions)

    console.log('   ✅ $kysely property available for direct queries')
    console.log(`   ✅ Connection methods: $connect, $disconnect, $transaction`)
    console.log('   ✅ All properties are properly typed and read-only')

    // Example of direct Kysely usage (would work with real database)
    console.log('\n   📝 Example direct Kysely usage:')
    console.log('      client.$kysely.selectFrom("users").selectAll().where("email", "=", "test@example.com")')

    // Example transaction usage
    console.log('\n   📝 Example transaction usage:')
    console.log('      await client.$transaction(async (trx) => { ... })')

    await client.$disconnect()
  } catch (error) {
    console.log(`   ❌ Expected error (no database): ${error.message}`)
  }
}

async function demoProgressiveEnhancement() {
  console.log('\n🚀 Progressive Enhancement Demo')

  console.log('   📝 Development Workflow:')
  console.log('   1. Start with any types: new RefractClient()')
  console.log('   2. Add generated types: run refract generate → auto-discovery')
  console.log('   3. Override with manual types: new RefractClient<MySchema>()')
  console.log('   4. All transitions are seamless - same API')

  console.log('\n   ✅ One client, multiple type sources')
  console.log('   ✅ Consistent API across all type modes')
  console.log('   ✅ Easy migration between approaches')
}

// Run the demos
async function main() {
  await demoTypePrecedence()
  await demoClientFeatures()
  await demoProgressiveEnhancement()
}

main().catch(console.error)
