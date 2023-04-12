import fs from 'fs'

/**
 * Determines whether Node API is supported on the current platform and throws if not
 */
export function isNodeAPISupported() {
  const customLibraryPath = process.env.PRISMA_QUERY_ENGINE_LIBRARY
  const customLibraryExists = customLibraryPath && fs.existsSync(customLibraryPath)
  if (!customLibraryExists && (process.arch === 'x32' || process.arch === 'ia32')) {
    throw new Error(
      `The default query engine type (Node-API, "library") is currently not supported for 32bit Node. Please set \`engineType = "binary"\` in the "generator" block of your "schema.prisma" file (or use the environment variables "PRISMA_CLIENT_ENGINE_TYPE=binary" and/or "PRISMA_CLI_QUERY_ENGINE_TYPE=binary".)`,
    )
  }
}
