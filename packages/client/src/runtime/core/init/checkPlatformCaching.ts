import { PrismaClientInitializationError } from '@prisma/engine-core'

import type { GetPrismaClientConfig } from '../../getPrismaClient'

/**
 * Throws an error if the client has been generated via auto-install and the
 * platform is known to have caching issues. In that case, we will display a
 * useful error message, and ask the user to run `prisma generate` manually.
 * @returns
 */
export function checkPlatformCaching({ postinstall, ciName, clientVersion }: GetPrismaClientConfig) {
  // if client was not generated manually
  if (postinstall !== true) return

  // and we generated on one of the caching CIs
  if (ciName === 'Vercel' || ciName === 'Netlify CI') {
    // TODO: improve error message and link to docs
    throw new PrismaClientInitializationError('Add `prisma generate` because of caching issues', clientVersion)
  }
}
