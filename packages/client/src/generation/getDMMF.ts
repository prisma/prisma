import type { DMMF } from '@prisma/generator-helper'
import type { GetDMMFOptions } from '@prisma/internals'
import { getDMMF as getRawDMMF } from '@prisma/internals'

import type { DMMF as PrismaClientDMMF } from '../runtime/dmmf-types'
import { externalToInternalDmmf } from '../runtime/externalToInternalDmmf'

export function getPrismaClientDMMF(dmmf: DMMF.Document): PrismaClientDMMF.Document {
  return externalToInternalDmmf(dmmf)
}

// Mostly used for tests
export async function getDMMF(options: GetDMMFOptions): Promise<PrismaClientDMMF.Document> {
  const dmmf = await getRawDMMF(options)
  return getPrismaClientDMMF(dmmf)
}
