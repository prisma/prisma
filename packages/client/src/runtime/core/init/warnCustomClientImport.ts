import { warnOnce } from '@prisma/internals'

import type { GetPrismaClientConfig } from '../../getPrismaClient'

export function warnCustomClientImport({ indexWarning }: GetPrismaClientConfig) {
  if (indexWarning === true) {
    const message = `TODO: add your custom client to your package.json`

    warnOnce('warnCustomClientImport', message)
  }
}
