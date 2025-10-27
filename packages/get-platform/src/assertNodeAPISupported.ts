import fs from 'fs'

/**
 * Determines whether Node API is supported on the current platform and throws if not
 */
export function assertNodeAPISupported(): void {
  const customLibraryPath = process.env.PRISMA_QUERY_ENGINE_LIBRARY
  const customLibraryExists = customLibraryPath && fs.existsSync(customLibraryPath)
  if (!customLibraryExists && process.arch === 'ia32') {
    throw new Error(`The default query engine type (Node-API, "library") is currently not supported for 32bit Node.)`)
  }
}
