// Copied over to avoid the heavy dependency on `@prisma/internals` with its
// transitive dependencies that are not needed for other query plan executor
// implementations outside of Prisma Client (e.g. test executor for query
// engine tests and query plan executor for Accelerate) that also depend on
// `@prisma/client-engine-runtime`.
export function assertNever(_: never, message: string): never {
  throw new Error(message)
}

/**
 * Checks if two objects are deeply equal, recursively checking all properties for strict equality.
 */
export function isDeepStrictEqual(a: unknown, b: unknown): boolean {
  return (
    a === b ||
    (a !== null &&
      b !== null &&
      typeof a === 'object' &&
      typeof b === 'object' &&
      Object.keys(a).length === Object.keys(b).length &&
      Object.keys(a).every((key) => isDeepStrictEqual(a[key], b[key])))
  )
}
