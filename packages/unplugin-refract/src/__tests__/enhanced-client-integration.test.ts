/**
 * Integration test for enhanced client generation in unplugin-refract
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { VirtualTypeGenerator } from '../virtual-modules.js'
import type { EnhancedClientCode, GeneratedTypes } from '../types.js'

describe('Enhanced Client Integration', () => {
  let typeGenerator: VirtualTypeGenerator
  let mockGeneratedTypes: GeneratedTypes
  let mockEnhancedClientCode: EnhancedClientCode

  beforeEach(() => {
    typeGenerator = new VirtualTypeGenerator(false)

    mockGeneratedTypes = {
      interfaces: `export interface User {
  id: number
  name: string
  email: string
}

export interface Post {
  id: number
  title: string
  content: string
  authorId: number
}`,
      schema: `export interface DatabaseSchema {
  user: User
  post: Post
}`,
      augmentation: `declare module '@refract/client' {
  interface RefractGeneratedSchema extends DatabaseSchema {}
}`
    }

    mockEnhancedClientCode = {
      clientCode: `// Enhanced client code with pre-compiled operations
export class RefractClient {
  constructor(dialect: any) {}
  
  readonly user = {
    findMany: async () => [],
    findUnique: async () => null,
    create: async () => ({} as any)
  }
  
  readonly post = {
    findMany: async () => [],
    findUnique: async () => null,
    create: async () => ({} as any)
  }
}`,
      declarations: `export interface User {
  id: number
  name: string
  email: string
}

export interface Post {
  id: number
  title: string
  content: string
  authorId: number
}`,
      dialect: 'sqlite'
    }
  })

  it('should generate enhanced client module with full client code', () => {
    const clientModule = typeGenerator.generateEnhancedClientModule(mockEnhancedClientCode)

    expect(clientModule).toContain('Generated Enhanced Refract Client')
    expect(clientModule).toContain('Database dialect: sqlite')
    expect(clientModule).toContain('export class RefractClient')
    expect(clientModule).toContain('readonly user')
    expect(clientModule).toContain('readonly post')
    expect(clientModule).toContain('findMany')
    expect(clientModule).toContain('findUnique')
    expect(clientModule).toContain('create')
  })

  it('should generate client types module with TypeScript declarations', () => {
    const clientTypesModule = typeGenerator.generateClientTypesModule(mockEnhancedClientCode)

    expect(clientTypesModule).toContain('Generated Refract Client Types')
    expect(clientTypesModule).toContain('interface User')
    expect(clientTypesModule).toContain('interface Post')
    expect(clientTypesModule).toContain('export type { RefractClient, RefractClientOptions }')
  })

  it('should generate fallback client module when enhanced generation fails', () => {
    const fallbackClient = typeGenerator.generateFallbackClientModule()

    expect(fallbackClient).toContain('Fallback Refract Client')
    expect(fallbackClient).toContain('export { RefractClient }')
    expect(fallbackClient).toContain('__REFRACT_FALLBACK__')
    expect(fallbackClient).toContain('__REFRACT_SETUP_REQUIRED__')
  })

  it('should generate fallback client types module', () => {
    const fallbackTypes = typeGenerator.generateFallbackClientTypesModule()

    expect(fallbackTypes).toContain('Fallback Refract Client Types')
    expect(fallbackTypes).toContain('DatabaseSchema')
    expect(fallbackTypes).toContain('__REFRACT_FALLBACK__')
    expect(fallbackTypes).toContain('export type { RefractClient, RefractClientOptions }')
  })

  it('should generate comprehensive index module with enhanced client exports', () => {
    const indexModule = typeGenerator.generateIndexModule(mockGeneratedTypes, true)

    expect(indexModule).toContain('Generated index for .refract directory')
    expect(indexModule).toContain("export * from './types'")
    expect(indexModule).toContain("export type { DatabaseSchema } from './types'")
    expect(indexModule).toContain("export type { User } from './types'")
    expect(indexModule).toContain("export type { Post } from './types'")
    expect(indexModule).toContain("export * from './client'")
    expect(indexModule).toContain("export type * from './client-types'")
  })

  it('should generate standard index module without enhanced client exports', () => {
    const indexModule = typeGenerator.generateIndexModule(mockGeneratedTypes, false)

    expect(indexModule).toContain('Generated index for .refract directory')
    expect(indexModule).toContain("export * from './types'")
    expect(indexModule).not.toContain("export * from './client'")
    expect(indexModule).not.toContain("export type * from './client-types'")
  })

  it('should handle empty schema gracefully', () => {
    const emptyTypes: GeneratedTypes = {
      interfaces: '',
      schema: 'export interface DatabaseSchema { [key: string]: any }',
      augmentation: 'declare module "@refract/client" { interface RefractGeneratedSchema extends DatabaseSchema {} }'
    }

    const indexModule = typeGenerator.generateIndexModule(emptyTypes, false)
    expect(indexModule).toContain('Generated index for .refract directory')
    expect(indexModule).toContain("export * from './types'")
    expect(indexModule).not.toContain('export type { User }')
  })
})