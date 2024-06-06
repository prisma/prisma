/**
 * This module provides a map from the official Prisma Driver Adapter names to their underlying driver names.
 * E.g., `@prisma/adapter-planetscale` -> `@planetscale/database`
 */

const officialDriverAdapters = [
  '@prisma/adapter-d1',
  '@prisma/adapter-libsql',
  '@prisma/adapter-neon',
  '@prisma/adapter-planetscale',
  '@prisma/adapter-pg',
  '@prisma/adapter-pg-worker',
] as const

export function isOfficialDriverAdapter(key: string): key is OfficialDriverAdapters {
  return (officialDriverAdapters as readonly string[]).includes(key)
}

export const underlyingDriverAdaptersMap = {
  '@prisma/adapter-d1': 'wrangler',
  '@prisma/adapter-libsql': '@libsql/client',
  '@prisma/adapter-neon': '@neondatabase/serverless',
  '@prisma/adapter-planetscale': '@planetscale/database',
  '@prisma/adapter-pg': 'pg',
  '@prisma/adapter-pg-worker': '@prisma/pg-worker',
} as const satisfies Record<OfficialDriverAdapters, string>

export type OfficialDriverAdapters = (typeof officialDriverAdapters)[number]
export type OfficialUnderlyingDrivers = (typeof underlyingDriverAdaptersMap)[OfficialDriverAdapters]
