import { DMMF } from '@prisma/generator-helper'
import { getDMMF as getRawDMMF, GetDMMFOptions } from '@prisma/sdk'
import { DMMF as PrismaClientDMMF } from './dmmf-types'
import { externalToInternalDmmf } from './externalToInternalDmmf'
import { transformDmmf } from './transformDmmf'

export function getPrismaClientDMMF(
  dmmf: DMMF.Document,
): PrismaClientDMMF.Document {
  return transformDmmf(externalToInternalDmmf(dmmf))
}

// Mostly used for tests
export async function getDMMF(
  options: GetDMMFOptions,
): Promise<PrismaClientDMMF.Document> {
  const dmmf = await getRawDMMF(options)
  return getPrismaClientDMMF(dmmf)
}
