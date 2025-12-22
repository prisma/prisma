/**
 * FNV-1a hash implementation for fast cache key generation.
 * 32-bit variant for good distribution with minimal overhead.
 */

const FNV_OFFSET_BASIS = 2166136261
const FNV_PRIME = 16777619

/**
 * Compute FNV-1a hash of a string
 */
export function fnv1aHash(str: string, hash = FNV_OFFSET_BASIS): number {
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i)
    hash = Math.imul(hash, FNV_PRIME)
  }
  return hash >>> 0
}

/**
 * Hash any JSON-like value, computing hash during traversal
 */
export function hashValue(value: unknown, hash = FNV_OFFSET_BASIS): number {
  switch (typeof value) {
    case 'string':
      return fnv1aHash(value, hash)
    case 'number':
    case 'bigint':
    case 'function':
    case 'symbol':
      return fnv1aHash(String(value), hash)
    case 'boolean':
      return fnv1aHash(value ? 'T' : 'F', hash)
    case 'undefined':
      return fnv1aHash('undefined', hash)
    case 'object':
      if (value === null) return fnv1aHash('null', hash)
      if (Array.isArray(value)) {
        for (const item of value) {
          hash = hashValue(item, hash)
        }
      }
      const keys = Object.keys(value).sort()
      for (const key of keys) {
        hash = fnv1aHash(key, hash)
        hash = hashValue((value as Record<string, unknown>)[key], hash)
      }
      return hash
    default:
      throw new Error('unreachable')
  }
}

/**
 * Generate a cache key for a parameterized query
 */
export function generateCacheKey(modelName: string | undefined, action: string, parameterizedQuery: unknown): number {
  let hash = FNV_OFFSET_BASIS
  if (modelName) {
    hash = fnv1aHash(modelName, hash)
  }
  hash = fnv1aHash(action, hash)
  hash = hashValue(parameterizedQuery, hash)
  return hash
}
