/**
 * This module provides a map from the official Prisma Driver Adapter names to their underlying driver names.
 * E.g., `@prisma/adapter-planetscale` -> `@planetscale/database`
 */

export const underlyingDriverAdaptersMap = {
  '@prisma/adapter-d1': 'wrangler',
  '@prisma/adapter-libsql': '@libsql/client',
  '@prisma/adapter-neon': '@neondatabase/serverless',
  '@prisma/adapter-planetscale': '@planetscale/database',
  '@prisma/adapter-pg': 'pg',
  '@prisma/adapter-pg-worker': '@prisma/pg-worker',
} as const satisfies Record<string, string>

export function isOfficialDriverAdapter(key: string): key is OfficialDriverAdapters {
  return underlyingDriverAdaptersMap[key] !== undefined
}

export type OfficialDriverAdapters = keyof typeof underlyingDriverAdaptersMap
export type OfficialUnderlyingDrivers = (typeof underlyingDriverAdaptersMap)[OfficialDriverAdapters]
