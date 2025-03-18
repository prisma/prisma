import type * as DMMF from '@prisma/dmmf'
import type { GetDMMFOptions } from '@prisma/internals'
import { getDMMF as getRawDMMF } from '@prisma/internals'

import { externalToInternalDmmf } from './externalToInternalDmmf'

export function getPrismaClientDMMF(dmmf: DMMF.Document): DMMF.Document {
  return externalToInternalDmmf(dmmf)
}

// Mostly used for tests
export async function getDMMF(options: GetDMMFOptions): Promise<DMMF.Document> {
  const dmmf = await getRawDMMF(options)
  return getPrismaClientDMMF(dmmf)
}
