import { getos } from '@prisma/get-platform'

/**
 * Determines whether Node API is supported on the current platform and throws if not
 */
export async function isNodeAPISupported() {
  const os = await getos()
  if (os.platform === 'darwin' && os.arch === 'arm64') {
    throw new Error(
      `Node-API is currently not supported for Apple M1. Please remove \`nApi\` from the "previewFeatures" attribute in the "generator" block of the "schema.prisma", or remove the "PRISMA_FORCE_NAPI" environment variable.`,
    )
  }
}
