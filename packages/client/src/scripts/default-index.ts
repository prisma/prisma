import { prisma } from '@prisma/engines-version/package.json'

import { clientVersion } from '../runtime/utils/clientVersion'

export class PrismaClient {
  constructor() {
    throw new Error('@prisma/client did not initialize yet. Please run "prisma generate" and try to import it again.')
  }
}

function defineExtension(ext) {
  if (typeof ext === 'function') {
    return ext
  }

  return (client) => client.$extends(ext)
}

function getExtensionContext(that) {
  return that
}

export const Prisma = {
  defineExtension,
  getExtensionContext,
  prismaVersion: { client: clientVersion, engine: prisma.enginesVersion },
}

export default { Prisma }
