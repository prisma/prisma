/**
 * Type definitions for generated Refract types
 * This file provides TypeScript definitions for the JavaScript module
 */

import type { DatabaseSchema } from '../src/types.js'

export interface GeneratedDatabaseSchema extends DatabaseSchema {
  User: {
    id: number
    email: string
    name: string | null
    createdAt: Date
    updatedAt: Date
  }
  Post: {
    id: number
    title: string
    content: string | null
    published: boolean
    authorId: number
    createdAt: Date
    updatedAt: Date
  }
  Comment: {
    id: number
    content: string
    postId: number
    authorId: number
    createdAt: Date
  }
}

// Module augmentation to inject types into the RefractClient
declare module '@refract/client-refract' {
  interface RefractGeneratedSchema extends GeneratedDatabaseSchema {}
}
