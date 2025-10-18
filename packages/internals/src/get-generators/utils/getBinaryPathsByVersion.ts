import type { GetBinaryPathsByVersionInput } from '../getGenerators'

/**
 * Legacy function that previously handled binary downloads for query engines.
 * Now only used for SchemaEngine if needed in the future.
 * Query engines (BinaryEngine, LibraryEngine) have been removed.
 * Client uses WASM-based engines only.
 */
export function getBinaryPathsByVersion({ neededVersions }: GetBinaryPathsByVersionInput): {
  binaryPathsByVersion: Record<string, Record<string, never>>
} {
  const binaryPathsByVersion: Record<string, Record<string, never>> = Object.create(null)

  // No engines need to be downloaded anymore
  // Client engine is WASM-based and included in the package
  for (const currentVersion in neededVersions) {
    binaryPathsByVersion[currentVersion] = {}
  }

  return { binaryPathsByVersion }
}
