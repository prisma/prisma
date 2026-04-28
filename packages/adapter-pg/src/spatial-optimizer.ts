/**
 * Interface for Prisma Client methods needed by spatial optimizer.
 * This avoids a direct dependency on @prisma/client.
 */
export interface PrismaClientLike {
  $queryRaw<T = unknown>(query: TemplateStringsArray, ...values: unknown[]): Promise<T>
  $executeRaw(query: TemplateStringsArray, ...values: unknown[]): Promise<number>
  $transaction<R>(fn: (prisma: PrismaClientLike) => Promise<R>): Promise<R>
}

/**
 * Cache for PostgreSQL version detection.
 * Key: PrismaClient instance
 * Value: boolean indicating if this is PG16
 */
const versionCache = new WeakMap<PrismaClientLike, boolean>()

/**
 * Detects PostgreSQL version and returns true if it's version 16.x
 * Caches the result per client instance for performance.
 */
async function isPG16(prisma: PrismaClientLike): Promise<boolean> {
  // Check cache first
  const cached = versionCache.get(prisma)
  if (cached !== undefined) {
    return cached
  }

  try {
    // Query PostgreSQL version
    const result = await prisma.$queryRaw<Array<{ version: string }>>`SELECT version()`

    const versionString = result[0]?.version || ''
    // Extract major version number (e.g., "PostgreSQL 16.2" -> 16)
    const match = versionString.match(/PostgreSQL (\d+)/)
    const majorVersion = match ? parseInt(match[1], 10) : 0

    const isPg16 = majorVersion === 16

    // Cache the result
    versionCache.set(prisma, isPg16)

    return isPg16
  } catch {
    // If version detection fails, assume it's not PG16 (safe default)
    versionCache.set(prisma, false)
    return false
  }
}

/**
 * Optimizes spatial queries for PostgreSQL 16 by disabling nested loops.
 *
 * PostgreSQL 16 has a query planner bug where it underestimates row counts
 * from spatial CTEs, causing it to choose Nested Loop joins instead of Hash Joins.
 * This can result in 40-50x slower queries (3-5s instead of <100ms).
 *
 * This helper automatically detects PostgreSQL 16 and applies the optimization
 * only when needed. On PostgreSQL 17+, the optimization is skipped as the bug
 * has been fixed.
 *
 * @example
 * ```typescript
 * import { withSpatialOptimization } from '@prisma/adapter-pg'
 *
 * const nearby = await withSpatialOptimization(
 *   prisma,
 *   (client) => client.location.findMany({
 *     where: {
 *       position: {
 *         near: {
 *           point: [13.4, 52.5],
 *           maxDistance: 5000,
 *         },
 *       },
 *     },
 *     take: 20,
 *   })
 * )
 * ```
 *
 * @param prisma - PrismaClient instance (or any object implementing PrismaClientLike)
 * @param operation - Function that performs the spatial query
 * @returns Result of the spatial query operation
 */
export async function withSpatialOptimization<T>(
  prisma: PrismaClientLike,
  operation: (client: PrismaClientLike) => Promise<T>,
): Promise<T> {
  // Check if this is PostgreSQL 16 (cached after first call)
  const needsOptimization = await isPG16(prisma)

  if (!needsOptimization) {
    // Not PG16, run query normally without optimization
    return operation(prisma)
  }

  // PG16 detected: apply optimization within transaction
  return prisma.$transaction(async (tx) => {
    // Disable nested loops for this transaction only
    // SET LOCAL is automatically reverted when transaction completes
    await tx.$executeRaw`SET LOCAL enable_nestloop = off`

    // Execute the spatial query with optimized plan
    return operation(tx)
  })
}
