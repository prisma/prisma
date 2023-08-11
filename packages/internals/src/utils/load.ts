import type { PlatformInfo } from '@prisma/get-platform'

import { handleLibraryLoadingErrors } from './handleEngineLoadingErrors'

/**
 * This is a wrapper around `require` for loading a Node-API library.
 * This is to avoid eval and hide require away from bundlers
 */
export function loadLibrary<T>(id: string, platformInfo: PlatformInfo): T {
  try {
    return require(id) as T
  } catch (e: any) {
    const errorMessage = handleLibraryLoadingErrors({
      e: e as Error,
      platformInfo,
      id,
    })

    throw new Error(errorMessage)
  }
}
